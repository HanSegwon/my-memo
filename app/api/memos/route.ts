import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

const COOKIE_NAME = 'memo_auth';

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

  const { data, error } = await supabaseAdmin
    .from('memos')
    .select('id, title, content, created_at')
    .order('created_at', { ascending: false });

  if (error) {
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

  if (!content) {
    return Response.json(
      { message: '메모 내용을 입력해주세요.' },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('memos')
    .insert({
      title,
      content,
    })
    .select('id, title, content, created_at')
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