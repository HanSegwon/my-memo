import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';

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

export async function GET() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);

  return Response.json({
    authenticated: isAuthenticated(cookie?.value),
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const passcode = String(body.passcode ?? '');

  const expectedPasscode = process.env.MEMO_PASSCODE ?? '';

  if (!expectedPasscode || passcode !== expectedPasscode) {
    return Response.json(
      { success: false, message: 'Passcode가 올바르지 않습니다.' },
      { status: 401 }
    );
  }

  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return Response.json({ success: true });
}

export async function DELETE() {
  const cookieStore = await cookies();

  cookieStore.delete(COOKIE_NAME);

  return Response.json({ success: true });
}