import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import KoreanLunarCalendar from 'korean-lunar-calendar';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

const COOKIE_NAME = 'memo_auth';
const CALENDAR_TYPES = ['solar', 'lunar'] as const;

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

function isMissingTable(error: { code?: string; message?: string }) {
  return error.code === 'PGRST205' || error.code === '42P01' ||
    error.message?.includes('schema cache') === true;
}

function schemaRequired() {
  return Response.json(
    { message: 'Supabase에서 집안행사 테이블을 먼저 만들어주세요. 프로젝트의 supabase/migrations/20260929_create_family_events.sql 파일을 실행하면 됩니다.' },
    { status: 503 }
  );
}

export async function GET() {
  if (!(await isAuthenticated())) {
    return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('family_events')
    .select('id, title, event_month, event_day, calendar_type, is_leap_month, created_at')
    .order('event_month', { ascending: true })
    .order('event_day', { ascending: true });

  if (error) {
    if (isMissingTable(error)) return schemaRequired();
    console.error(error);
    return Response.json({ message: '집안행사를 불러오지 못했습니다.' }, { status: 500 });
  }

  return Response.json({ events: data ?? [] });
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  }

  const body = await request.json();
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const calendarType = body.calendarType;
  const eventMonth = Number(body.eventMonth);
  const eventDay = Number(body.eventDay);
  const referenceYear = Number(body.referenceYear);
  const isLeapMonth = body.isLeapMonth === true;

  if (!title || title.length > 100) {
    return Response.json({ message: '행사 내용은 1~100자로 입력해주세요.' }, { status: 400 });
  }
  if (!CALENDAR_TYPES.includes(calendarType)) {
    return Response.json({ message: '음력 또는 양력을 선택해주세요.' }, { status: 400 });
  }
  if (!Number.isInteger(eventMonth) || eventMonth < 1 || eventMonth > 12 ||
      !Number.isInteger(eventDay) || eventDay < 1 || eventDay > 31) {
    return Response.json({ message: '행사 날짜를 확인해주세요.' }, { status: 400 });
  }
  if (calendarType === 'solar') {
    const validDay = new Date(2000, eventMonth, 0).getDate();
    if (eventDay > validDay || isLeapMonth) {
      return Response.json({ message: '양력 날짜를 확인해주세요.' }, { status: 400 });
    }
  } else {
    const calendar = new KoreanLunarCalendar();
    if (!Number.isInteger(referenceYear) || referenceYear < 1000 || referenceYear > 2050 ||
        !calendar.setLunarDate(referenceYear, eventMonth, eventDay, isLeapMonth)) {
      return Response.json({ message: '선택한 연도에 존재하는 음력 날짜인지 확인해주세요.' }, { status: 400 });
    }
  }

  const { data, error } = await supabaseAdmin
    .from('family_events')
    .insert({
      title,
      event_month: eventMonth,
      event_day: eventDay,
      calendar_type: calendarType,
      is_leap_month: calendarType === 'lunar' && isLeapMonth,
    })
    .select('id, title, event_month, event_day, calendar_type, is_leap_month, created_at')
    .single();

  if (error) {
    if (isMissingTable(error)) return schemaRequired();
    console.error(error);
    return Response.json({ message: '행사를 저장하지 못했습니다.' }, { status: 500 });
  }

  return Response.json({ event: data });
}

export async function DELETE(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get('id');
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return Response.json({ message: '삭제할 행사를 확인해주세요.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('family_events').delete().eq('id', id);
  if (error) {
    if (isMissingTable(error)) return schemaRequired();
    console.error(error);
    return Response.json({ message: '행사를 삭제하지 못했습니다.' }, { status: 500 });
  }

  return Response.json({ success: true });
}
