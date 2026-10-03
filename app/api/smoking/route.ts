import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

const COOKIE_NAME = 'memo_auth';

function createSessionToken() {
  return createHmac('sha256', process.env.SUPABASE_SECRET_KEY!).update('my-memo-authenticated').digest('hex');
}

async function isAuthenticated() {
  const cookie = (await cookies()).get(COOKIE_NAME);
  if (!cookie?.value) return false;
  const expected = Buffer.from(createSessionToken());
  const actual = Buffer.from(cookie.value);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function isMissingSchema(error: { code?: string; message?: string }) {
  return ['PGRST205', 'PGRST204', '42P01', '42703'].includes(error.code ?? '') || error.message?.includes('schema cache') === true;
}

function schemaRequired() {
  return Response.json({
    code: 'SMOKING_SCHEMA_REQUIRED',
    message: '금연관리 데이터베이스가 아직 준비되지 않았습니다. Supabase에서 supabase/migrations/20261004_create_smoking_records.sql 파일의 SQL을 실행해주세요.',
  }, { status: 503 });
}

function parseCount(value: unknown): number | null | undefined {
  if (value === null || value === undefined || value === '') return null;
  const count = typeof value === 'number' ? value : typeof value === 'string' && /^\d{1,4}$/.test(value) ? Number(value) : NaN;
  return Number.isInteger(count) && count >= 0 && count <= 9999 ? count : undefined;
}

function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function GET() {
  if (!(await isAuthenticated())) return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  const { data, error } = await supabaseAdmin
    .from('smoking_records')
    .select('record_date, regular_count, electronic_count, updated_at')
    .order('record_date', { ascending: true });
  if (error) {
    if (isMissingSchema(error)) return schemaRequired();
    console.error(error);
    return Response.json({ message: '금연관리 기록을 불러오지 못했습니다.' }, { status: 500 });
  }
  return Response.json({ records: data ?? [] });
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const recordDate = body.recordDate;
  const regularCount = parseCount(body.regularCount);
  const electronicCount = parseCount(body.electronicCount);
  if (!isValidDate(recordDate)) return Response.json({ message: '날짜를 확인해주세요.' }, { status: 400 });
  if (regularCount === undefined || electronicCount === undefined) {
    return Response.json({ message: '흡연량은 0~9,999개 사이의 정수로 입력해주세요.' }, { status: 400 });
  }

  if (regularCount === null && electronicCount === null) {
    const { error } = await supabaseAdmin.from('smoking_records').delete().eq('record_date', recordDate);
    if (error) {
      if (isMissingSchema(error)) return schemaRequired();
      console.error(error);
      return Response.json({ message: '금연관리 기록을 삭제하지 못했습니다.' }, { status: 500 });
    }
    return Response.json({ record: null, deleted: true });
  }

  const { data, error } = await supabaseAdmin.from('smoking_records').upsert({
    record_date: recordDate,
    regular_count: regularCount,
    electronic_count: electronicCount,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'record_date' })
    .select('record_date, regular_count, electronic_count, updated_at')
    .single();
  if (error) {
    if (isMissingSchema(error)) return schemaRequired();
    console.error(error);
    return Response.json({ message: '금연관리 기록을 저장하지 못했습니다.' }, { status: 500 });
  }
  return Response.json({ record: data, deleted: false });
}
