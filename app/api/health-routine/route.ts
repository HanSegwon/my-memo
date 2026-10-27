import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

const COOKIE_NAME = 'memo_auth';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BODY_PARTS = ['upper', 'lower'] as const;
const INTENSITIES = ['easy', 'normal', 'hard'] as const;

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
  return ['PGRST204', 'PGRST205', '42P01', '42703'].includes(error.code ?? '') || error.message?.includes('schema cache') === true;
}

function schemaRequired() {
  return Response.json({
    message: 'Supabase에서 헬스루틴 테이블을 만들어야 합니다. supabase/migrations/20261027_create_health_routine_exercises.sql 파일의 SQL을 실행해주세요.',
  }, { status: 503 });
}

function validateExercise(body: Record<string, unknown>) {
  const bodyPart = body.bodyPart;
  const exerciseName = typeof body.exerciseName === 'string' ? body.exerciseName.trim() : '';
  const repetitions = Number(body.repetitions);
  const sets = Number(body.sets);
  const intensity = body.intensity;
  const sortOrder = Number(body.sortOrder);

  if (!BODY_PARTS.includes(bodyPart as typeof BODY_PARTS[number])) return { error: '상체 또는 하체를 선택해주세요.' };
  if (!exerciseName || exerciseName.length > 80) return { error: '운동 종목은 1~80자로 입력해주세요.' };
  if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 99) return { error: '반복 횟수는 1~99회로 입력해주세요.' };
  if (!Number.isInteger(sets) || sets < 1 || sets > 9) return { error: '세트 수는 1~9세트로 입력해주세요.' };
  if (!INTENSITIES.includes(intensity as typeof INTENSITIES[number])) return { error: '운동 강도를 선택해주세요.' };
  if (!Number.isInteger(sortOrder) || sortOrder < 0) return { error: '운동 순서를 확인해주세요.' };

  return {
    value: {
      body_part: bodyPart as typeof BODY_PARTS[number],
      exercise_name: exerciseName,
      repetitions,
      sets,
      intensity: intensity as typeof INTENSITIES[number],
      sort_order: sortOrder,
    },
  };
}

export async function GET() {
  if (!(await isAuthenticated())) return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  const { data, error } = await supabaseAdmin.from('health_routine_exercises')
    .select('id, body_part, exercise_name, repetitions, sets, intensity, sort_order, created_at, updated_at')
    .order('body_part', { ascending: true }).order('sort_order', { ascending: true });
  if (error) {
    if (isMissingSchema(error)) return schemaRequired();
    console.error(error);
    return Response.json({ message: '헬스루틴을 불러오지 못했습니다.' }, { status: 500 });
  }
  return Response.json({ exercises: data ?? [] });
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  const validated = validateExercise(await request.json() as Record<string, unknown>);
  if (validated.error || !validated.value) return Response.json({ message: validated.error }, { status: 400 });

  const { data, error } = await supabaseAdmin.from('health_routine_exercises').insert(validated.value)
    .select('id, body_part, exercise_name, repetitions, sets, intensity, sort_order, created_at, updated_at').single();
  if (error) {
    if (isMissingSchema(error)) return schemaRequired();
    console.error(error);
    return Response.json({ message: '운동을 저장하지 못했습니다.' }, { status: 500 });
  }
  return Response.json({ exercise: data });
}

export async function PATCH(request: Request) {
  if (!(await isAuthenticated())) return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;

  if (body.type === 'reorder') {
    const ids = body.ids;
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || !UUID_PATTERN.test(id)) || new Set(ids).size !== ids.length) {
      return Response.json({ message: '운동 순서 정보를 확인해주세요.' }, { status: 400 });
    }
    const results = await Promise.all(ids.map((id, sortOrder) =>
      supabaseAdmin.from('health_routine_exercises').update({ sort_order: sortOrder }).eq('id', id as string),
    ));
    const error = results.find((result) => result.error)?.error;
    if (error) {
      if (isMissingSchema(error)) return schemaRequired();
      console.error(error);
      return Response.json({ message: '운동 순서를 저장하지 못했습니다.' }, { status: 500 });
    }
    return Response.json({ success: true });
  }

  if (typeof body.id !== 'string' || !UUID_PATTERN.test(body.id)) return Response.json({ message: '수정할 운동을 확인해주세요.' }, { status: 400 });
  const validated = validateExercise(body);
  if (validated.error || !validated.value) return Response.json({ message: validated.error }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('health_routine_exercises').update(validated.value).eq('id', body.id)
    .select('id, body_part, exercise_name, repetitions, sets, intensity, sort_order, created_at, updated_at').single();
  if (error) {
    if (isMissingSchema(error)) return schemaRequired();
    console.error(error);
    return Response.json({ message: '운동 정보를 수정하지 못했습니다.' }, { status: 500 });
  }
  return Response.json({ exercise: data });
}

export async function DELETE(request: Request) {
  if (!(await isAuthenticated())) return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id');
  if (!id || !UUID_PATTERN.test(id)) return Response.json({ message: '삭제할 운동을 확인해주세요.' }, { status: 400 });
  const { error } = await supabaseAdmin.from('health_routine_exercises').delete().eq('id', id);
  if (error) {
    if (isMissingSchema(error)) return schemaRequired();
    console.error(error);
    return Response.json({ message: '운동을 삭제하지 못했습니다.' }, { status: 500 });
  }
  return Response.json({ success: true });
}
