import { cookies } from 'next/headers';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
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
    message: 'Supabase에서 생활루틴 탭 설정 SQL을 실행해주세요. supabase/migrations/20261026_add_routine_tabs.sql 파일이 필요합니다.',
  }, { status: 503 });
}

function validateTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function validateRoutine(body: Record<string, unknown>) {
  const startTime = body.startTime;
  const endTime = body.endTime;
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const details = typeof body.details === 'string' ? body.details.trim() : '';
  const routineTabId = body.routineTabId;
  if (!validateTime(startTime) || !validateTime(endTime)) return { error: '시작 시간과 종료 시간을 확인해주세요.' };
  if (!title || title.length > 100) return { error: '제목은 1~100자로 입력해주세요.' };
  if (details.length > 2000) return { error: '세부 계획은 2,000자 이내로 입력해주세요.' };
  if (typeof routineTabId !== 'string' || !(['weekday', 'holiday'].includes(routineTabId) || UUID_PATTERN.test(routineTabId))) return { error: '루틴 탭을 확인해주세요.' };
  return { value: { start_time: startTime, end_time: endTime, title, details: details || null, routine_tab_id: routineTabId } };
}

async function getRoutineTab(id: string) {
  return supabaseAdmin.from('routine_tabs').select('id, title, day_type, sort_order').eq('id', id).maybeSingle();
}

export async function GET() {
  if (!(await isAuthenticated())) {
    return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  }
  const [tabsResult, routinesResult] = await Promise.all([
    supabaseAdmin.from('routine_tabs').select('id, title, day_type, sort_order').order('sort_order', { ascending: true }),
    supabaseAdmin.from('routine_items').select('id, start_time, end_time, title, details, day_type, routine_tab_id, created_at').order('routine_tab_id', { ascending: true }).order('start_time', { ascending: true }).order('created_at', { ascending: true }),
  ]);

  if (tabsResult.error || routinesResult.error) {
    const error = tabsResult.error ?? routinesResult.error!;
    if (isMissingSchema(error)) return schemaRequired();
    console.error(error);
    return Response.json({ message: '생활루틴을 불러오지 못했습니다.' }, { status: 500 });
  }
  return Response.json({ tabs: tabsResult.data ?? [], routines: routinesResult.data ?? [] });
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  }
  const body = await request.json() as Record<string, unknown>;
  if (body.type === 'new-tab') {
    const { count, error: countError } = await supabaseAdmin.from('routine_tabs').select('id', { count: 'exact', head: true });
    if (countError) {
      if (isMissingSchema(countError)) return schemaRequired();
      console.error(countError);
      return Response.json({ message: '루틴 탭을 확인하지 못했습니다.' }, { status: 500 });
    }
    if ((count ?? 0) >= 3) return Response.json({ message: '루틴은 최대 3개까지 만들 수 있습니다.' }, { status: 409 });
    const id = randomUUID();
    const { data, error } = await supabaseAdmin.from('routine_tabs').insert({ id, title: '새 루틴', day_type: 'custom', sort_order: count ?? 2 })
      .select('id, title, day_type, sort_order').single();
    if (error) {
      if (isMissingSchema(error)) return schemaRequired();
      console.error(error);
      return Response.json({ message: '새 루틴을 추가하지 못했습니다.' }, { status: 500 });
    }
    return Response.json({ tab: data });
  }
  const validated = validateRoutine(body);
  if (validated.error || !validated.value) return Response.json({ message: validated.error }, { status: 400 });

  const tabResult = await getRoutineTab(validated.value.routine_tab_id);
  if (tabResult.error || !tabResult.data) {
    if (tabResult.error && isMissingSchema(tabResult.error)) return schemaRequired();
    return Response.json({ message: '루틴 탭을 찾을 수 없습니다.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('routine_items')
    .insert({ ...validated.value, day_type: tabResult.data.day_type })
    .select('id, start_time, end_time, title, details, day_type, routine_tab_id, created_at')
    .single();

  if (error) {
    if (isMissingSchema(error)) return schemaRequired();
    console.error(error);
    return Response.json({ message: '생활루틴을 저장하지 못했습니다.' }, { status: 500 });
  }
  return Response.json({ routine: data });
}

export async function PATCH(request: Request) {
  if (!(await isAuthenticated())) return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  if (body.type === 'tab') {
    const id = body.id;
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (typeof id !== 'string' || !(['weekday', 'holiday'].includes(id) || UUID_PATTERN.test(id)) || !title || title.length > 30) {
      return Response.json({ message: '루틴 이름은 1~30자로 입력해주세요.' }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin.from('routine_tabs').update({ title }).eq('id', id).select('id, title, day_type, sort_order').single();
    if (error) {
      if (isMissingSchema(error)) return schemaRequired();
      console.error(error);
      return Response.json({ message: '루틴 이름을 변경하지 못했습니다.' }, { status: 500 });
    }
    return Response.json({ tab: data });
  }
  const id = body.id;
  if (typeof id !== 'string' || !UUID_PATTERN.test(id)) return Response.json({ message: '수정할 생활루틴을 확인해주세요.' }, { status: 400 });
  const validated = validateRoutine(body);
  if (validated.error || !validated.value) return Response.json({ message: validated.error }, { status: 400 });
  const tabResult = await getRoutineTab(validated.value.routine_tab_id);
  if (tabResult.error || !tabResult.data) {
    if (tabResult.error && isMissingSchema(tabResult.error)) return schemaRequired();
    return Response.json({ message: '루틴 탭을 찾을 수 없습니다.' }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin.from('routine_items').update({ ...validated.value, day_type: tabResult.data.day_type }).eq('id', id)
    .select('id, start_time, end_time, title, details, day_type, routine_tab_id, created_at').single();
  if (error) {
    if (isMissingSchema(error)) return schemaRequired();
    console.error(error);
    return Response.json({ message: '생활루틴을 수정하지 못했습니다.' }, { status: 500 });
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
