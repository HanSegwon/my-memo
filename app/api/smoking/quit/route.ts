import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

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

function schemaRequired() {
  return Response.json({
    message: '금연 시작 시간 저장을 위해 Supabase에서 supabase/migrations/20261027_add_smoking_quit_status.sql 파일의 SQL을 실행해주세요.',
  }, { status: 503 });
}

function isMissingSchema(error: { code?: string; message?: string }) {
  return ['PGRST204', 'PGRST205', '42P01', '42703'].includes(error.code ?? '') || error.message?.includes('schema cache') === true;
}

export async function GET() {
  if (!(await isAuthenticated())) return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  const { data, error } = await supabaseAdmin.from('smoking_quit_status')
    .select('quit_started_at, updated_at').eq('id', 1).maybeSingle();
  if (error) {
    if (isMissingSchema(error)) return schemaRequired();
    console.error(error);
    return Response.json({ message: '금연 시작 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
  return Response.json({ quitStartedAt: data?.quit_started_at ?? null });
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  if (body.action !== 'start' && body.action !== 'fail') {
    return Response.json({ message: '금연 상태 변경 요청을 확인해주세요.' }, { status: 400 });
  }
  const quitStartedAt = body.action === 'start' ? new Date().toISOString() : null;
  const { data, error } = await supabaseAdmin.from('smoking_quit_status').upsert({
    id: 1,
    quit_started_at: quitStartedAt,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' }).select('quit_started_at, updated_at').single();
  if (error) {
    if (isMissingSchema(error)) return schemaRequired();
    console.error(error);
    return Response.json({ message: '금연 상태를 저장하지 못했습니다.' }, { status: 500 });
  }
  return Response.json({ quitStartedAt: data.quit_started_at });
}
