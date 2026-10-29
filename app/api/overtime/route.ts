import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

const COOKIE_NAME = 'memo_auth';
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const FIELDS = ['weekday_total_minutes', 'weekday_night_minutes', 'weekend_total_minutes', 'weekend_overtime_minutes', 'weekend_night_minutes'] as const;

function sessionToken() {
  return createHmac('sha256', process.env.SUPABASE_SECRET_KEY!).update('my-memo-authenticated').digest('hex');
}

async function isAuthenticated() {
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  if (!value) return false;
  const actual = Buffer.from(value);
  const expected = Buffer.from(sessionToken());
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function schemaMissing(error: { code?: string; message?: string }) {
  return ['PGRST204', 'PGRST205', '42P01', '42703'].includes(error.code ?? '') || error.message?.includes('schema cache') === true;
}

function schemaRequired() {
  return Response.json({ message: 'Supabase에서 supabase/migrations/20261030_create_overtime_records.sql 파일의 SQL을 실행해주세요.' }, { status: 503 });
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseBody(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export async function GET(request: Request) {
  if (!(await isAuthenticated())) return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  const month = new URL(request.url).searchParams.get('month');
  if (!month || !MONTH_PATTERN.test(month)) return Response.json({ message: '조회할 월을 확인해주세요.' }, { status: 400 });
  const start = `${month}-01`;
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const end = `${month}-${String(lastDay).padStart(2, '0')}`;
  try {
    const [{ data: records, error: recordsError }, { data: settings, error: settingsError }] = await Promise.all([
      supabaseAdmin.from('overtime_records').select('*').gte('record_date', start).lte('record_date', end).order('record_date', { ascending: true }),
      supabaseAdmin.from('overtime_settings').select('hourly_wage').eq('id', 1).maybeSingle(),
    ]);
    if (recordsError || settingsError) throw recordsError ?? settingsError;
    return Response.json({ records: records ?? [], hourlyWage: Number(settings?.hourly_wage ?? 26117) });
  } catch (error) {
    if (schemaMissing(error as { code?: string; message?: string })) return schemaRequired();
    console.error(error);
    return Response.json({ message: '초과근무 데이터를 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!(await isAuthenticated())) return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  const body = parseBody(await request.json().catch(() => null));
  if (!body) return Response.json({ message: '저장할 정보를 확인해주세요.' }, { status: 400 });
  try {
    if (body.type === 'settings') {
      const hourlyWage = Number(body.hourlyWage);
      if (!Number.isSafeInteger(hourlyWage) || hourlyWage < 0) return Response.json({ message: '시급은 0 이상의 정수로 입력해주세요.' }, { status: 400 });
      const { data, error } = await supabaseAdmin.from('overtime_settings').upsert({ id: 1, hourly_wage: hourlyWage, updated_at: new Date().toISOString() }).select('hourly_wage').single();
      if (error) throw error;
      return Response.json({ hourlyWage: Number(data.hourly_wage) });
    }
    if (body.type !== 'record' || !validDate(body.record_date) || typeof body.worked !== 'boolean') return Response.json({ message: '근무 기록을 확인해주세요.' }, { status: 400 });
    const attendance = body.attendance == null || body.attendance === '' ? null : typeof body.attendance === 'string' ? body.attendance.trim() : undefined;
    if (attendance === undefined || (attendance !== null && attendance.length > 40)) return Response.json({ message: '근태 내용은 40자 이내로 입력해주세요.' }, { status: 400 });
    const row: Record<string, unknown> = { record_date: body.record_date, worked: body.worked, attendance, updated_at: new Date().toISOString() };
    for (const field of FIELDS) {
      const value = body[field];
      if (value !== null && (!Number.isInteger(value) || Number(value) < 0 || Number(value) > 1439)) return Response.json({ message: '근무시간은 00:00~23:59로 입력해주세요.' }, { status: 400 });
      row[field] = value;
    }
    const { data, error } = await supabaseAdmin.from('overtime_records').upsert(row, { onConflict: 'record_date' }).select('*').single();
    if (error) throw error;
    return Response.json({ record: data });
  } catch (error) {
    if (schemaMissing(error as { code?: string; message?: string })) return schemaRequired();
    console.error(error);
    return Response.json({ message: '근무 기록을 저장하지 못했습니다.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isAuthenticated())) return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  const body = parseBody(await request.json().catch(() => null));
  if (!body || !validDate(body.recordDate)) return Response.json({ message: '삭제할 날짜를 확인해주세요.' }, { status: 400 });
  try {
    const { error } = await supabaseAdmin.from('overtime_records').delete().eq('record_date', body.recordDate);
    if (error) throw error;
    return Response.json({ success: true });
  } catch (error) {
    if (schemaMissing(error as { code?: string; message?: string })) return schemaRequired();
    console.error(error);
    return Response.json({ message: '근무 기록을 삭제하지 못했습니다.' }, { status: 500 });
  }
}
