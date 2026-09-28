import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

const COOKIE_NAME = 'memo_auth';
const VALID_EXERCISES = ['상체', '하체', '코어', '휴식'];
const VALID_MEALS = ['미취식', '소식', '보통', '과식'];
const SCHEMA_MESSAGE =
  '체중관리 데이터베이스가 아직 준비되지 않았습니다. Supabase에서 체중관리 테이블을 먼저 만들어주세요.';

function createSessionToken() {
  return createHmac('sha256', process.env.SUPABASE_SECRET_KEY!)
    .update('my-memo-authenticated')
    .digest('hex');
}

async function isAuthenticated() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) return false;

  const expected = createSessionToken();
  const actualBytes = Buffer.from(cookie.value);
  const expectedBytes = Buffer.from(expected);
  return (
    actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes)
  );
}

function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

function getKoreanToday() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function getMonday(date: string) {
  const monday = new Date(`${date}T00:00:00.000Z`);
  const weekday = monday.getUTCDay() || 7;
  monday.setUTCDate(monday.getUTCDate() - weekday + 1);
  return monday.toISOString().slice(0, 10);
}

function missingSchemaResponse() {
  return Response.json(
    { code: 'WEIGHT_SCHEMA_REQUIRED', message: SCHEMA_MESSAGE },
    { status: 503 }
  );
}

function isMissingTable(error: { code?: string; message?: string }) {
  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    error.message?.includes('schema cache') === true
  );
}

export async function GET() {
  if (!(await isAuthenticated())) {
    return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  }

  const [settingsResult, recordsResult, goalsResult] = await Promise.all([
    supabaseAdmin
      .from('weight_settings')
      .select('id, fasting_frequency, fasting_weekdays, fasting_anchor_date')
      .eq('id', 1)
      .maybeSingle(),
    supabaseAdmin
      .from('weight_records')
      .select(
        'record_date, weight_kg, exercise, breakfast, lunch, dinner, other_food, updated_at'
      )
      .order('record_date', { ascending: true }),
    supabaseAdmin
      .from('weight_monthly_goals')
      .select('goal_month, target_weight, updated_at')
      .order('goal_month', { ascending: true }),
  ]);

  if (settingsResult.error || recordsResult.error) {
    const error = settingsResult.error ?? recordsResult.error!;
    if (isMissingTable(error)) return missingSchemaResponse();
    console.error(error);
    return Response.json(
      { message: '체중관리 정보를 불러오지 못했습니다.' },
      { status: 500 }
    );
  }

  if (goalsResult.error && !isMissingTable(goalsResult.error)) {
    console.error(goalsResult.error);
    return Response.json(
      { message: '월별 체중 목표를 불러오지 못했습니다.' },
      { status: 500 }
    );
  }

  const anchorDate = getMonday(getKoreanToday());
  return Response.json({
    settings: settingsResult.data ?? {
      id: 1,
      fasting_frequency: 'weekly',
      fasting_weekdays: [],
      fasting_anchor_date: anchorDate,
    },
    records: recordsResult.data ?? [],
    monthlyGoals: goalsResult.data ?? [],
    goalTableReady: !goalsResult.error,
  });
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  }

  const body = await request.json();

  if (body.type === 'settings') {
    const frequency = body.fastingFrequency;
    const rawWeekdays = body.fastingWeekdays;
    if (
      !['weekly', 'biweekly'].includes(frequency) ||
      !Array.isArray(rawWeekdays) ||
      rawWeekdays.some(
        (day) => !Number.isInteger(day) || day < 1 || day > 7
      )
    ) {
      return Response.json(
        { message: '간헐적 단식 설정을 확인해주세요.' },
        { status: 400 }
      );
    }

    const existing = await supabaseAdmin
      .from('weight_settings')
      .select('fasting_frequency, fasting_anchor_date')
      .eq('id', 1)
      .maybeSingle();

    if (existing.error) {
      if (isMissingTable(existing.error)) return missingSchemaResponse();
      console.error(existing.error);
      return Response.json(
        { message: '간헐적 단식 설정을 불러오지 못했습니다.' },
        { status: 500 }
      );
    }

    const today = getKoreanToday();
    const anchorDate =
      frequency === 'biweekly' &&
      existing.data?.fasting_frequency === 'biweekly' &&
      existing.data.fasting_anchor_date
        ? existing.data.fasting_anchor_date
        : getMonday(today);

    const { data, error } = await supabaseAdmin
      .from('weight_settings')
      .upsert(
        {
          id: 1,
          fasting_frequency: frequency,
          fasting_weekdays: [...new Set(rawWeekdays)].sort(),
          fasting_anchor_date: anchorDate,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      .select('id, fasting_frequency, fasting_weekdays, fasting_anchor_date')
      .single();

    if (error) {
      console.error(error);
      return Response.json(
        { message: '간헐적 단식 설정을 저장하지 못했습니다.' },
        { status: 500 }
      );
    }

    return Response.json({ settings: data });
  }

  if (body.type === 'goal') {
    const goalMonth = body.goalMonth;
    if (typeof goalMonth !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(goalMonth)) {
      return Response.json({ message: '목표 월을 확인해주세요.' }, { status: 400 });
    }

    const weightText = String(body.targetWeight ?? '').trim();
    if (!/^\d+(\.\d{1,2})?$/.test(weightText)) {
      return Response.json({ message: '목표 체중을 확인해주세요.' }, { status: 400 });
    }
    const targetWeight = Number(weightText);
    if (!Number.isFinite(targetWeight) || targetWeight <= 0 || targetWeight > 500) {
      return Response.json(
        { message: '목표 체중은 0보다 크고 500kg 이하여야 합니다.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('weight_monthly_goals')
      .upsert(
        {
          goal_month: `${goalMonth}-01`,
          target_weight: targetWeight,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'goal_month' }
      )
      .select('goal_month, target_weight, updated_at')
      .single();

    if (error) {
      if (isMissingTable(error)) {
        return Response.json(
          { message: 'Supabase에 월별 체중 목표 테이블을 먼저 만들어주세요.' },
          { status: 503 }
        );
      }
      console.error(error);
      return Response.json(
        { message: '월별 체중 목표를 저장하지 못했습니다.' },
        { status: 500 }
      );
    }

    return Response.json({ goal: data });
  }

  if (body.type === 'record') {
    const recordDate = body.recordDate;
    if (!isValidDate(recordDate)) {
      return Response.json({ message: '날짜를 확인해주세요.' }, { status: 400 });
    }

    const weightText = String(body.weightKg ?? '').trim();
    let weightKg: number | null = null;
    if (weightText) {
      if (!/^\d+(\.\d{1,2})?$/.test(weightText)) {
        return Response.json(
          { message: '체중은 소수점 둘째 자리까지 입력해주세요.' },
          { status: 400 }
        );
      }
      weightKg = Number(weightText);
      if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 500) {
        return Response.json(
          { message: '체중은 0보다 크고 500kg 이하여야 합니다.' },
          { status: 400 }
        );
      }
    }

    const validateChoice = (value: unknown, allowed: string[]) =>
      value === '' || value === null || value === undefined
        ? { valid: true, value: null }
        : typeof value === 'string' && allowed.includes(value)
          ? { valid: true, value }
          : { valid: false, value: null };

    const exercise = validateChoice(body.exercise, VALID_EXERCISES);
    const breakfast = validateChoice(body.breakfast, VALID_MEALS);
    const lunch = validateChoice(body.lunch, VALID_MEALS);
    const dinner = validateChoice(body.dinner, VALID_MEALS);
    const otherFood =
      typeof body.otherFood === 'string' ? body.otherFood.trim() : '';
    if (otherFood.length > 100) {
      return Response.json(
        { message: '기타 취식은 100자 이내로 입력해주세요.' },
        { status: 400 }
      );
    }
    if (
      !exercise.valid ||
      !breakfast.valid ||
      !lunch.valid ||
      !dinner.valid
    ) {
      return Response.json(
        { message: '운동 또는 식사 선택을 확인해주세요.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('weight_records')
      .upsert(
        {
          record_date: recordDate,
          weight_kg: weightKg,
          exercise: exercise.value,
          breakfast: breakfast.value,
          lunch: lunch.value,
          dinner: dinner.value,
          other_food: otherFood || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'record_date' }
      )
      .select(
        'record_date, weight_kg, exercise, breakfast, lunch, dinner, other_food, updated_at'
      )
      .single();

    if (error) {
      if (isMissingTable(error)) return missingSchemaResponse();
      console.error(error);
      return Response.json(
        { message: '체중 기록을 저장하지 못했습니다.' },
        { status: 500 }
      );
    }

    return Response.json({ record: data });
  }

  return Response.json({ message: '잘못된 요청입니다.' }, { status: 400 });
}
