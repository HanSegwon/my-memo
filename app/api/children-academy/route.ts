import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

const COOKIE_NAME = 'memo_auth';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CHILDREN = ['한유준', '한이준'] as const;
const WEEKDAYS = [1, 2, 3, 4, 5] as const;

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
  return Response.json({ message: 'Supabase에서 자녀학원 시간표 SQL을 실행해주세요. supabase/migrations/20260930_create_children_academy.sql 파일이 필요합니다.' }, { status: 503 });
}

function validateSchedule(body: Record<string, unknown>) {
  const childName = body.childName;
  const weekday = Number(body.weekday);
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const startTime = body.startTime;
  const endTime = body.endTime;
  const validTime = (value: unknown) => typeof value === 'string' && /^(09|1\d|20):[0-5][0]$/.test(value);
  if (!CHILDREN.includes(childName as typeof CHILDREN[number])) return { error: '자녀를 선택해주세요.' };
  if (!WEEKDAYS.includes(weekday as typeof WEEKDAYS[number])) return { error: '월요일부터 금요일 중 요일을 선택해주세요.' };
  if (!title || title.length > 100) return { error: '일정은 1~100자로 입력해주세요.' };
  if (!validTime(startTime) || !validTime(endTime) || String(startTime) >= String(endTime)) return { error: '09:00~20:00 사이에서 시작·종료 시간을 10분 단위로 선택해주세요.' };
  return { value: { child_name: childName, weekday, title, start_time: startTime, end_time: endTime } };
}

export async function GET() {
  if (!(await isAuthenticated())) return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  const { data, error } = await supabaseAdmin.from('children_academy_schedules')
    .select('id, child_name, weekday, title, start_time, end_time, created_at, updated_at')
    .order('weekday', { ascending: true }).order('start_time', { ascending: true });
  if (error) {
    if (isMissingSchema(error)) return schemaRequired();
    console.error(error);
    return Response.json({ message: '자녀학원 시간표를 불러오지 못했습니다.' }, { status: 500 });
  }
  return Response.json({ schedules: data ?? [] });
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  const validated = validateSchedule(await request.json() as Record<string, unknown>);
  if (validated.error || !validated.value) return Response.json({ message: validated.error }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('children_academy_schedules').insert(validated.value)
    .select('id, child_name, weekday, title, start_time, end_time, created_at, updated_at').single();
  if (error) {
    if (isMissingSchema(error)) return schemaRequired();
    console.error(error);
    return Response.json({ message: '일정을 저장하지 못했습니다.' }, { status: 500 });
  }
  return Response.json({ schedule: data });
}

export async function PATCH(request: Request) {
  if (!(await isAuthenticated())) return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  if (typeof body.id !== 'string' || !UUID_PATTERN.test(body.id)) return Response.json({ message: '수정할 일정을 확인해주세요.' }, { status: 400 });
  const validated = validateSchedule(body);
  if (validated.error || !validated.value) return Response.json({ message: validated.error }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('children_academy_schedules').update(validated.value).eq('id', body.id)
    .select('id, child_name, weekday, title, start_time, end_time, created_at, updated_at').single();
  if (error) {
    if (isMissingSchema(error)) return schemaRequired();
    console.error(error);
    return Response.json({ message: '일정을 수정하지 못했습니다.' }, { status: 500 });
  }
  return Response.json({ schedule: data });
}

export async function DELETE(request: Request) {
  if (!(await isAuthenticated())) return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id');
  if (!id || !UUID_PATTERN.test(id)) return Response.json({ message: '삭제할 일정을 확인해주세요.' }, { status: 400 });
  const { error } = await supabaseAdmin.from('children_academy_schedules').delete().eq('id', id);
  if (error) {
    if (isMissingSchema(error)) return schemaRequired();
    console.error(error);
    return Response.json({ message: '일정을 삭제하지 못했습니다.' }, { status: 500 });
  }
  return Response.json({ success: true });
}
