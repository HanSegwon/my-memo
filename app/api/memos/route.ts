import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

const COOKIE_NAME = 'memo_auth';

function isMissingCompletionSchema(error: { code?: string; message?: string }) {
  return ['PGRST204', '42703'].includes(error.code ?? '') || error.message?.includes('schema cache') === true;
}

function completionSchemaRequired() {
  return Response.json({
    message: '완료 상태 저장을 위해 Supabase에서 supabase/migrations/20260930_add_memo_completion.sql 파일을 실행해주세요.',
  }, { status: 503 });
}

function createSessionToken() {
  return createHmac('sha256', process.env.SUPABASE_SECRET_KEY!)
    .update('my-memo-authenticated')
    .digest('hex');
}

function isAuthenticated(cookieValue: string | undefined) {
  if (!cookieValue) return false;

  const expected = createSessionToken();

  const a = Buffer.from(cookieValue);
  const b = Buffer.from(expected);

  return a.length === b.length && timingSafeEqual(a, b);
}

async function checkAuth() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);

  return isAuthenticated(cookie?.value);
}

export async function GET() {
  if (!(await checkAuth())) {
    return Response.json(
      { message: '로그인이 필요합니다.' },
      { status: 401 }
    );
  }

  const expiration = new Date();
  const targetMonth = expiration.getUTCMonth() - 1;
  const targetYear = expiration.getUTCFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = (targetMonth + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  expiration.setUTCFullYear(targetYear, normalizedMonth, Math.min(expiration.getUTCDate(), lastDay));

  const { error: cleanupError } = await supabaseAdmin
    .from('memos')
    .delete()
    .eq('is_completed', true)
    .lt('completed_at', expiration.toISOString());

  if (cleanupError) {
    if (isMissingCompletionSchema(cleanupError)) return completionSchemaRequired();
    console.error(cleanupError);
    return Response.json({ message: '완료된 메모를 정리하지 못했습니다.' }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from('memos')
    .select('id, title, content, created_at, is_completed, completed_at')
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingCompletionSchema(error)) return completionSchemaRequired();
    console.error(error);

    return Response.json(
      { message: '메모를 불러오지 못했습니다.' },
      { status: 500 }
    );
  }

  return Response.json({ memos: data ?? [] });
}

export async function POST(request: Request) {
  if (!(await checkAuth())) {
    return Response.json(
      { message: '로그인이 필요합니다.' },
      { status: 401 }
    );
  }

  const body = await request.json();

  const title = String(body.title ?? '').trim() || '제목 없음';
  const content = String(body.content ?? '').trim();

  const { data, error } = await supabaseAdmin
    .from('memos')
    .insert({
      title,
      content,
    })
    .select('id, title, content, created_at, is_completed, completed_at')
    .single();

  if (error) {
    console.error(error);

    return Response.json(
      { message: '메모 저장에 실패했습니다.' },
      { status: 500 }
    );
  }

  return Response.json({ memo: data });
}

export async function DELETE(request: Request) {
  if (!(await checkAuth())) {
    return Response.json(
      { message: '로그인이 필요합니다.' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return Response.json(
      { message: '메모 ID가 필요합니다.' },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from('memos')
    .delete()
    .eq('id', id);

  if (error) {
    console.error(error);

    return Response.json(
      { message: '메모 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }

  return Response.json({ success: true });
}

export async function PATCH(request: Request) {
  if (!(await checkAuth())) {
    return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  }

  const body = await request.json() as Record<string, unknown>;
  const id = body.id;
  if ((typeof id !== 'number' && typeof id !== 'string') || String(id).trim() === '') {
    return Response.json({ message: '수정할 메모를 확인해주세요.' }, { status: 400 });
  }

  let values: Record<string, unknown>;
  if (typeof body.isCompleted === 'boolean') {
    values = {
      is_completed: body.isCompleted,
      completed_at: body.isCompleted ? new Date().toISOString() : null,
    };
  } else {
    const title = String(body.title ?? '').trim() || '제목 없음';
    const content = String(body.content ?? '').trim();
    values = { title, content };
  }

  const { data, error } = await supabaseAdmin.from('memos').update(values).eq('id', id)
    .select('id, title, content, created_at, is_completed, completed_at').single();
  if (error) {
    if (isMissingCompletionSchema(error)) return completionSchemaRequired();
    console.error(error);
    return Response.json({ message: '메모를 수정하지 못했습니다.' }, { status: 500 });
  }
  return Response.json({ memo: data });
}
