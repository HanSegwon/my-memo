import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

const COOKIE_NAME = 'memo_auth';

function sessionToken() {
  return createHmac('sha256', process.env.SUPABASE_SECRET_KEY!)
    .update('my-memo-authenticated')
    .digest('hex');
}

async function isAuthenticated() {
  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE_NAME)?.value;
  if (!value) return false;
  const actual = Buffer.from(value);
  const expected = Buffer.from(sessionToken());
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function tableRequired() {
  return Response.json({
    message: '연봉추이 데이터베이스 설정이 필요합니다. Supabase에서 supabase/migrations/20260930_create_salary_records.sql 파일을 실행해주세요.',
  }, { status: 503 });
}

function missingTable(error: { code?: string; message?: string }) {
  return ['PGRST205', 'PGRST204', '42P01', '42703'].includes(error.code ?? '') || error.message?.includes('schema cache') === true;
}

function parseAmount(value: unknown): number | null | undefined {
  if (value === null || value === undefined || value === '') return null;
  const normalized = String(value).replace(/,/g, '').trim();
  if (!/^\d{1,12}$/.test(normalized)) return undefined;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export async function GET() {
  if (!(await isAuthenticated())) return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  const { data, error } = await supabaseAdmin.from('salary_records')
    .select('income_year, income_month, monthly_salary, base_bonus, extra_bonus, is_sample, updated_at')
    .order('income_year', { ascending: true }).order('income_month', { ascending: true });
  if (error) {
    if (missingTable(error)) return tableRequired();
    console.error(error);
    return Response.json({ message: '연봉추이 자료를 불러오지 못했습니다.' }, { status: 500 });
  }
  return Response.json({ records: data ?? [] });
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const year = Number(body.year);
  const month = Number(body.month);
  const currentYear = new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2015 || year > currentYear || !Number.isInteger(month) || month < 1 || month > 12) {
    return Response.json({ message: '년도와 월을 확인해주세요.' }, { status: 400 });
  }
  const monthlySalary = parseAmount(body.monthlySalary);
  const baseBonus = parseAmount(body.baseBonus);
  const extraBonus = parseAmount(body.extraBonus);
  if (monthlySalary === undefined || baseBonus === undefined || extraBonus === undefined) {
    return Response.json({ message: '금액은 0원 이상, 12자리 이하의 정수로 입력해주세요.' }, { status: 400 });
  }

  const values = { income_year: year, income_month: month, monthly_salary: monthlySalary, base_bonus: baseBonus, extra_bonus: extraBonus, is_sample: false, updated_at: new Date().toISOString() };
  const query = monthlySalary === null && baseBonus === null && extraBonus === null
    ? supabaseAdmin.from('salary_records').delete().eq('income_year', year).eq('income_month', month).select('income_year')
    : supabaseAdmin.from('salary_records').upsert(values, { onConflict: 'income_year,income_month' })
      .select('income_year, income_month, monthly_salary, base_bonus, extra_bonus, is_sample, updated_at');
  const { data, error } = await query;
  if (error) {
    if (missingTable(error)) return tableRequired();
    console.error(error);
    return Response.json({ message: '월별 수입을 저장하지 못했습니다.' }, { status: 500 });
  }
  return Response.json({ record: Array.isArray(data) ? data[0] ?? null : data ?? null });
}
