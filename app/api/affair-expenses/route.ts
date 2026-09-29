import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

const COOKIE_NAME = 'memo_auth';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FLOWS = ['expense', 'income'] as const;

type TransactionInput = { flow: 'expense' | 'income'; event_date: string; event_name: string; amount: number };

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
  return Response.json({ message: 'Supabase에서 경조사비 데이터베이스 SQL을 실행해주세요. supabase/migrations/20260930_create_affair_expenses.sql 파일이 필요합니다.' }, { status: 503 });
}

function validateContact(body: Record<string, unknown>) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const relation = typeof body.relation === 'string' ? body.relation.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  if (!name || name.length > 80) return { error: '이름은 1~80자로 입력해주세요.' };
  if (relation.length > 80) return { error: '관계는 80자 이내로 입력해주세요.' };
  if (phone.length > 40) return { error: '전화번호를 확인해주세요.' };
  if (!Array.isArray(body.transactions)) return { error: '입출금 항목을 확인해주세요.' };

  const transactions: TransactionInput[] = [];
  for (const row of body.transactions) {
    if (!row || typeof row !== 'object') return { error: '입출금 항목을 확인해주세요.' };
    const item = row as Record<string, unknown>;
    const flow = item.flow;
    const eventDate = typeof item.eventDate === 'string' ? item.eventDate : '';
    const eventName = typeof item.eventName === 'string' ? item.eventName.trim() : '';
    const rawAmount = item.amount;
    const hasAny = flow !== '' || eventDate !== '' || eventName !== '' || rawAmount !== '';
    if (!hasAny) continue;
    const amount = typeof rawAmount === 'number' ? rawAmount : Number(rawAmount);
    if (!FLOWS.includes(flow as 'expense' | 'income')) return { error: '출금 또는 입금을 선택해주세요.' };
    const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(eventDate) ? new Date(`${eventDate}T00:00:00Z`) : null;
    if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== eventDate) return { error: '날짜를 확인해주세요.' };
    if (!eventName || eventName.length > 100) return { error: '행사명은 1~100자로 입력해주세요.' };
    if (!Number.isSafeInteger(amount) || amount < 0) return { error: '금액은 0 이상의 정수로 입력해주세요.' };
    transactions.push({ flow: flow as 'expense' | 'income', event_date: eventDate, event_name: eventName, amount });
  }
  return { value: { contact: { name, relation: relation || null, phone: phone || null }, transactions } };
}

export async function GET() {
  if (!(await isAuthenticated())) return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  const [{ data: contacts, error: contactError }, { data: transactions, error: transactionError }] = await Promise.all([
    supabaseAdmin.from('affair_contacts').select('id, name, relation, phone, created_at, updated_at'),
    supabaseAdmin.from('affair_transactions').select('id, contact_id, flow, event_date, event_name, amount, created_at').order('event_date', { ascending: false }),
  ]);
  const error = contactError ?? transactionError;
  if (error) {
    if (isMissingSchema(error)) return schemaRequired();
    console.error(error);
    return Response.json({ message: '경조사비를 불러오지 못했습니다.' }, { status: 500 });
  }
  const records = (contacts ?? []).map((contact) => ({
    ...contact,
    transactions: (transactions ?? []).filter((item) => item.contact_id === contact.id),
  }));
  return Response.json({ contacts: records });
}

async function saveTransactions(contactId: string, transactions: TransactionInput[]) {
  if (transactions.length === 0) return { error: null };
  return supabaseAdmin.from('affair_transactions').insert(transactions.map((item) => ({ ...item, contact_id: contactId })));
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  const validated = validateContact(await request.json() as Record<string, unknown>);
  if (validated.error || !validated.value) return Response.json({ message: validated.error }, { status: 400 });
  const { data: contact, error } = await supabaseAdmin.from('affair_contacts').insert(validated.value.contact).select('id').single();
  if (error) {
    if (isMissingSchema(error)) return schemaRequired();
    console.error(error);
    return Response.json({ message: '연락처를 저장하지 못했습니다.' }, { status: 500 });
  }
  const childResult = await saveTransactions(contact.id, validated.value.transactions);
  if (childResult.error) {
    await supabaseAdmin.from('affair_contacts').delete().eq('id', contact.id);
    if (isMissingSchema(childResult.error)) return schemaRequired();
    console.error(childResult.error);
    return Response.json({ message: '행사 내역을 저장하지 못했습니다.' }, { status: 500 });
  }
  return Response.json({ success: true });
}

export async function PATCH(request: Request) {
  if (!(await isAuthenticated())) return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const id = body.id;
  if (typeof id !== 'string' || !UUID_PATTERN.test(id)) return Response.json({ message: '수정할 연락처를 확인해주세요.' }, { status: 400 });
  const validated = validateContact(body);
  if (validated.error || !validated.value) return Response.json({ message: validated.error }, { status: 400 });
  const { error: updateError } = await supabaseAdmin.from('affair_contacts').update(validated.value.contact).eq('id', id);
  if (updateError) {
    if (isMissingSchema(updateError)) return schemaRequired();
    console.error(updateError);
    return Response.json({ message: '연락처를 수정하지 못했습니다.' }, { status: 500 });
  }
  const { data: oldItems, error: readError } = await supabaseAdmin.from('affair_transactions').select('id').eq('contact_id', id);
  if (readError) {
    if (isMissingSchema(readError)) return schemaRequired();
    console.error(readError);
    return Response.json({ message: '기존 행사 내역을 확인하지 못했습니다.' }, { status: 500 });
  }
  const childResult = await saveTransactions(id, validated.value.transactions);
  if (childResult.error) {
    if (isMissingSchema(childResult.error)) return schemaRequired();
    console.error(childResult.error);
    return Response.json({ message: '행사 내역을 저장하지 못했습니다.' }, { status: 500 });
  }
  if (oldItems?.length) {
    const { error: deleteError } = await supabaseAdmin.from('affair_transactions').delete().in('id', oldItems.map((item) => item.id));
    if (deleteError) {
      console.error(deleteError);
      return Response.json({ message: '수정된 연락처는 저장했지만 기존 항목 정리에 실패했습니다. 다시 불러와 확인해주세요.' }, { status: 500 });
    }
  }
  return Response.json({ success: true });
}

export async function DELETE(request: Request) {
  if (!(await isAuthenticated())) return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id');
  if (!id || !UUID_PATTERN.test(id)) return Response.json({ message: '삭제할 연락처를 확인해주세요.' }, { status: 400 });
  const { error } = await supabaseAdmin.from('affair_contacts').delete().eq('id', id);
  if (error) {
    if (isMissingSchema(error)) return schemaRequired();
    console.error(error);
    return Response.json({ message: '연락처를 삭제하지 못했습니다.' }, { status: 500 });
  }
  return Response.json({ success: true });
}
