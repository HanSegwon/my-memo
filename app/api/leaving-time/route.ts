import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

const COOKIE_NAME = 'memo_auth';
const SETTINGS_ID = 'default';
const DEFAULT_PLAN = { start_time: null, goal_hours: 0, goal_minutes: 0, exclusions: [] as Exclusion[] };

type Exclusion = { id: string; title: string; hours: number; minutes: number };

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

function missingTable(error: { code?: string; message?: string }) {
  return ['PGRST204', 'PGRST205', '42P01', '42703'].includes(error.code ?? '') || error.message?.includes('schema cache') === true;
}

function tableRequired() {
  return Response.json({
    message: '퇴근시간 저장용 테이블이 필요합니다. Supabase에서 supabase/migrations/20261028_create_leaving_time_settings.sql 파일을 실행해주세요.',
  }, { status: 503 });
}

function toPlan(row: { start_time: string | null; goal_hours: number; goal_minutes: number; exclusions: Exclusion[] }) {
  return {
    startTime: row.start_time ? row.start_time.slice(0, 5) : '',
    goalHours: String(row.goal_hours).padStart(2, '0'),
    goalMinutes: String(row.goal_minutes).padStart(2, '0'),
    exclusions: row.exclusions,
  };
}

function latestSeoulResetTime(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value);
  const year = part('year');
  const month = part('month');
  const day = part('day');
  const hour = part('hour');
  // 02:00 KST marks the start of a new workday. Before then, use yesterday's reset boundary.
  return new Date(Date.UTC(year, month - 1, day - (hour < 2 ? 1 : 0), 17, 0, 0));
}

function validatePlan(body: Record<string, unknown>) {
  const goalHours = Number(body.goalHours);
  const goalMinutes = Number(body.goalMinutes);
  const startTime = body.startTime === '' || body.startTime === null ? null : body.startTime;
  const exclusions = body.exclusions;

  if (!Number.isInteger(goalHours) || goalHours < 0 || goalHours > 99) return { error: '목표 근무시간을 확인해주세요.' };
  if (!Number.isInteger(goalMinutes) || goalMinutes < 0 || goalMinutes > 59) return { error: '목표 근무시간을 확인해주세요.' };
  if (startTime !== null && (typeof startTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime))) {
    return { error: '출근시각을 확인해주세요.' };
  }
  if (!Array.isArray(exclusions) || exclusions.length > 50) return { error: '제외시간 항목을 확인해주세요.' };

  const cleanExclusions: Exclusion[] = [];
  for (const value of exclusions) {
    if (!value || typeof value !== 'object') return { error: '제외시간 항목을 확인해주세요.' };
    const item = value as Record<string, unknown>;
    const id = typeof item.id === 'string' ? item.id : '';
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    const hours = Number(item.hours);
    const minutes = Number(item.minutes);
    if (!id || id.length > 80 || title.length > 40 || !Number.isInteger(hours) || hours < 0 || hours > 99 || !Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
      return { error: '제외시간 항목과 시간을 확인해주세요.' };
    }
    cleanExclusions.push({ id, title, hours, minutes });
  }

  return {
    value: {
      id: SETTINGS_ID,
      start_time: startTime,
      goal_hours: goalHours,
      goal_minutes: goalMinutes,
      exclusions: cleanExclusions,
      updated_at: new Date().toISOString(),
    },
  };
}

export async function GET() {
  if (!(await isAuthenticated())) return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  const { data, error } = await supabaseAdmin.from('leaving_time_settings')
    .select('start_time, goal_hours, goal_minutes, exclusions, updated_at').eq('id', SETTINGS_ID).maybeSingle();
  if (error) {
    if (missingTable(error)) return tableRequired();
    console.error(error);
    return Response.json({ message: '퇴근시간 설정을 불러오지 못했습니다.' }, { status: 500 });
  }
  if (data?.updated_at && new Date(data.updated_at).getTime() < latestSeoulResetTime().getTime() && (data.start_time || data.exclusions?.length)) {
    const { data: resetData, error: resetError } = await supabaseAdmin.from('leaving_time_settings')
      .update({ start_time: null, exclusions: [], updated_at: new Date().toISOString() })
      .eq('id', SETTINGS_ID)
      .select('start_time, goal_hours, goal_minutes, exclusions')
      .single();
    if (resetError) {
      console.error(resetError);
      return Response.json({ message: '퇴근시간을 자동 초기화하지 못했습니다.' }, { status: 500 });
    }
    return Response.json({ plan: toPlan(resetData), defaults: toPlan(DEFAULT_PLAN) });
  }
  return Response.json({ plan: data ? toPlan(data) : null, defaults: toPlan(DEFAULT_PLAN) });
}

export async function PUT(request: Request) {
  if (!(await isAuthenticated())) return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return Response.json({ message: '저장할 설정을 확인해주세요.' }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return Response.json({ message: '저장할 설정을 확인해주세요.' }, { status: 400 });
  }
  const validated = validatePlan(body);
  if (validated.error || !validated.value) return Response.json({ message: validated.error }, { status: 400 });

  const { data, error } = await supabaseAdmin.from('leaving_time_settings').upsert(validated.value, { onConflict: 'id' })
    .select('start_time, goal_hours, goal_minutes, exclusions').single();
  if (error) {
    if (missingTable(error)) return tableRequired();
    console.error(error);
    return Response.json({ message: '퇴근시간 설정을 저장하지 못했습니다.' }, { status: 500 });
  }
  return Response.json({ plan: toPlan(data) });
}
