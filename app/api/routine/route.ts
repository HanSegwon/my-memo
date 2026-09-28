import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

const COOKIE_NAME = 'memo_auth';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createSessionToken() {
  return createHmac('sha256', process.env.SUPABASE_SECRET_KEY!)
    .update('my-memo-authenticated')
    .digest('hex');
}

async function isAuthenticated() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) return false;
  const expected = Buffer.from(createSessionToken());
  const actual = Buffer.from(cookie.value);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function isMissingSchema(error: { code?: string; message?: string }) {
  return ['PGRST205', 'PGRST204', '42P01', '42703'].includes(error.code ?? '') ||
    error.message?.includes('schema cache') === true;
}

function schemaRequired() {
  return Response.json({
    message: 'Supabase에서 생활루틴 테이블을 만들어주세요. supabase/migrations/20260930_create_routine_items.sql 파일을 실행하면 됩니다.',
  }, { status: 503 });
}

function validateTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export async function GET() {
  if (!(await isAuthenticated())) {
    return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin
    .from('routine_items')
    .select('id, start_time, end_time, title, details, created_at')
    .order('start_time', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    if (isMissingSchema(error)) return schemaRequired();
    console.error(error);
    return Response.json({ message: '생활루틴을 불러오지 못했습니다.' }, { status: 500 });
  }
  return Response.json({ routines: data ?? [] });
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  }
  const body = await request.json() as Record<string, unknown>;
  const startTime = body.startTime;
  const endTime = body.endTime;
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const details = typeof body.details === 'string' ? body.details.trim() : '';

  if (!validateTime(startTime) || !validateTime(endTime)) {
    return Response.json({ message: '시작 시간과 종료 시간을 확인해주세요.' }, { status: 400 });
  }
  if (!title || title.length > 100) {
    return Response.json({ message: '제목은 1~100자로 입력해주세요.' }, { status: 400 });
  }
  if (details.length > 2000) {
    return Response.json({ message: '세부 계획은 2,000자 이내로 입력해주세요.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('routine_items')
    .insert({ start_time: startTime, end_time: endTime, title, details: details || null })
    .select('id, start_time, end_time, title, details, created_at')
    .single();

  if (error) {
    if (isMissingSchema(error)) return schemaRequired();
    console.error(error);
    return Response.json({ message: '생활루틴을 저장하지 못했습니다.' }, { status: 500 });
  }
  return Response.json({ routine: data });
}

export async function DELETE(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  }
  const id = new URL(request.url).searchParams.get('id');
  if (!id || !UUID_PATTERN.test(id)) {
    return Response.json({ message: '삭제할 생활루틴을 확인해주세요.' }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from('routine_items').delete().eq('id', id);
  if (error) {
    if (isMissingSchema(error)) return schemaRequired();
    console.error(error);
    return Response.json({ message: '생활루틴을 삭제하지 못했습니다.' }, { status: 500 });
  }
  return Response.json({ success: true });
}
