import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

const COOKIE_NAME = 'memo_auth';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const MIN_MONTH = '2026-10';

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

function schemaMissing(error: { code?: string; message?: string }) {
  return ['PGRST204', 'PGRST205', '42P01', '42703'].includes(error.code ?? '') || error.message?.includes('schema cache') === true;
}

function schemaRequired() {
  return Response.json({ message: 'Supabase에서 supabase/migrations/20261029_create_fixed_expenses.sql 파일의 SQL을 실행해주세요.' }, { status: 503 });
}

function monthStart(month: string | null) {
  const { earliest, latest } = monthRange();
  if (!month || !MONTH_PATTERN.test(month) || month < earliest || month > latest) return null;
  return `${month}-01`;
}

function currentSeoulMonth() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}`;
}

function monthRange() {
  const current = currentSeoulMonth();
  const latest = current < MIN_MONTH ? MIN_MONTH : current;
  const [year, month] = latest.split('-').map(Number);
  const startDate = new Date(Date.UTC(year, month - 1 - 11, 1));
  const rollingStart = `${startDate.getUTCFullYear()}-${String(startDate.getUTCMonth() + 1).padStart(2, '0')}`;
  return { earliest: rollingStart < MIN_MONTH ? MIN_MONTH : rollingStart, latest };
}

async function deleteExpiredMonths() {
  const { earliest } = monthRange();
  const { error } = await supabaseAdmin.from('fixed_expense_months').delete().lt('month_start', `${earliest}-01`);
  if (error) throw error;
}

async function ensureMonth(month: string) {
  const monthDate = monthStart(month);
  if (!monthDate) throw new Error('월 정보를 확인해주세요.');
  const { error: insertError } = await supabaseAdmin.from('fixed_expense_months').insert({ month_start: monthDate });
  if (insertError) {
    if (insertError.code === '23505') return;
    throw insertError;
  }

  const previous = new Date(`${monthDate}T00:00:00Z`);
  previous.setUTCMonth(previous.getUTCMonth() - 1);
  const previousMonth = `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, '0')}`;
  const previousDate = monthStart(previousMonth);
  if (!previousDate) return;

  const { data: previousCategories, error: categoryError } = await supabaseAdmin.from('fixed_expense_categories')
    .select('id, name, sort_order').eq('month_start', previousDate).order('sort_order', { ascending: true });
  if (categoryError) throw categoryError;
  if (!previousCategories?.length) return;

  const categoryMap = new Map<string, string>();
  for (const category of previousCategories) {
    const { data: newCategory, error: newCategoryError } = await supabaseAdmin.from('fixed_expense_categories')
      .insert({ month_start: monthDate, name: category.name, sort_order: category.sort_order }).select('id').single();
    if (newCategoryError) throw newCategoryError;
    categoryMap.set(category.id, newCategory.id);
  }
  const oldIds = previousCategories.map((category) => category.id);
  const { data: previousItems, error: itemError } = await supabaseAdmin.from('fixed_expense_items')
    .select('category_id, expense_name, due_day, fixed_amount, sort_order')
    .in('category_id', oldIds).order('sort_order', { ascending: true });
  if (itemError) throw itemError;
  const copies = (previousItems ?? []).flatMap((item) => {
    const categoryId = categoryMap.get(item.category_id);
    return categoryId ? [{ category_id: categoryId, expense_name: item.expense_name, due_day: item.due_day, fixed_amount: item.fixed_amount, actual_amount: null, is_paid: false, sort_order: item.sort_order }] : [];
  });
  if (copies.length) {
    const { error } = await supabaseAdmin.from('fixed_expense_items').insert(copies);
    if (error) throw error;
  }
}

function parseBody(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export async function GET(request: Request) {
  if (!(await isAuthenticated())) return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  const month = new URL(request.url).searchParams.get('month');
  const date = monthStart(month);
  if (!date || !month) return Response.json({ message: '현재 달부터 최근 1년 이내의 월을 선택해주세요.' }, { status: 400 });
  try {
    await deleteExpiredMonths();
    await ensureMonth(month);
    const { data: categories, error: categoryError } = await supabaseAdmin.from('fixed_expense_categories')
      .select('id, month_start, name, sort_order').eq('month_start', date).order('sort_order', { ascending: true }).order('created_at', { ascending: true });
    if (categoryError) throw categoryError;
    const ids = (categories ?? []).map((category) => category.id);
    const { data: items, error: itemError } = ids.length
      ? await supabaseAdmin.from('fixed_expense_items').select('id, category_id, expense_name, due_day, fixed_amount, actual_amount, is_paid, sort_order').in('category_id', ids).order('sort_order', { ascending: true }).order('created_at', { ascending: true })
      : { data: [], error: null };
    if (itemError) throw itemError;
    return Response.json({ categories: (categories ?? []).map((category) => ({ ...category, items: (items ?? []).filter((item) => item.category_id === category.id) })) });
  } catch (error) {
    if (schemaMissing(error as { code?: string; message?: string })) return schemaRequired();
    console.error(error);
    return Response.json({ message: '고정지출을 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  const body = parseBody(await request.json().catch(() => null));
  if (!body) return Response.json({ message: '저장할 정보를 확인해주세요.' }, { status: 400 });
  try {
    if (body.type === 'category') {
      const month = typeof body.month === 'string' ? body.month : '';
      const date = monthStart(month);
      if (!date) return Response.json({ message: '월 정보를 확인해주세요.' }, { status: 400 });
      await ensureMonth(month);
      const { data: last } = await supabaseAdmin.from('fixed_expense_categories').select('sort_order').eq('month_start', date).order('sort_order', { ascending: false }).limit(1).maybeSingle();
      const { data, error } = await supabaseAdmin.from('fixed_expense_categories').insert({ month_start: date, name: '새 카테고리', sort_order: (last?.sort_order ?? -1) + 1 }).select('id, month_start, name, sort_order').single();
      if (error) throw error;
      return Response.json({ category: { ...data, items: [] } });
    }
    if (body.type === 'item' && typeof body.categoryId === 'string' && UUID_PATTERN.test(body.categoryId)) {
      const { data: category, error: categoryError } = await supabaseAdmin.from('fixed_expense_categories').select('id').eq('id', body.categoryId).maybeSingle();
      if (categoryError) throw categoryError;
      if (!category) return Response.json({ message: '카테고리를 찾을 수 없습니다.' }, { status: 404 });
      const { data: last } = await supabaseAdmin.from('fixed_expense_items').select('sort_order').eq('category_id', body.categoryId).order('sort_order', { ascending: false }).limit(1).maybeSingle();
      const { data, error } = await supabaseAdmin.from('fixed_expense_items').insert({ category_id: body.categoryId, expense_name: '지출항목', due_day: 21, fixed_amount: 100000, actual_amount: null, is_paid: false, sort_order: (last?.sort_order ?? -1) + 1 }).select('id, category_id, expense_name, due_day, fixed_amount, actual_amount, is_paid, sort_order').single();
      if (error) throw error;
      return Response.json({ item: data });
    }
    return Response.json({ message: '추가할 항목을 확인해주세요.' }, { status: 400 });
  } catch (error) {
    if (schemaMissing(error as { code?: string; message?: string })) return schemaRequired();
    console.error(error);
    return Response.json({ message: '고정지출 항목을 추가하지 못했습니다.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!(await isAuthenticated())) return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  const body = parseBody(await request.json().catch(() => null));
  if (!body) return Response.json({ message: '수정할 정보를 확인해주세요.' }, { status: 400 });
  try {
    if (body.type === 'reorderCategories' || body.type === 'reorderItems') {
      const ids = body.ids;
      if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || !UUID_PATTERN.test(id)) || new Set(ids).size !== ids.length) return Response.json({ message: '순서 정보를 확인해주세요.' }, { status: 400 });
      const table = body.type === 'reorderCategories' ? 'fixed_expense_categories' : 'fixed_expense_items';
      const results = await Promise.all(ids.map((id, sortOrder) => supabaseAdmin.from(table).update({ sort_order: sortOrder }).eq('id', id as string)));
      const error = results.find((result) => result.error)?.error;
      if (error) throw error;
      return Response.json({ success: true });
    }
    if (body.type === 'category' && typeof body.id === 'string' && UUID_PATTERN.test(body.id)) {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name || name.length > 40) return Response.json({ message: '카테고리명을 1~40자로 입력해주세요.' }, { status: 400 });
      const { error } = await supabaseAdmin.from('fixed_expense_categories').update({ name }).eq('id', body.id);
      if (error) throw error;
      return Response.json({ success: true });
    }
    if (body.type === 'item' && typeof body.id === 'string' && UUID_PATTERN.test(body.id)) {
      const update: Record<string, unknown> = {};
      if (body.expenseName !== undefined) {
        const name = typeof body.expenseName === 'string' ? body.expenseName.trim() : '';
        if (!name || name.length > 60) return Response.json({ message: '지출명을 1~60자로 입력해주세요.' }, { status: 400 });
        update.expense_name = name;
      }
      if (body.dueDay !== undefined) {
        const dueDay = Number(body.dueDay);
        if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) return Response.json({ message: '납부일은 1~31일로 입력해주세요.' }, { status: 400 });
        update.due_day = dueDay;
      }
      for (const [key, column] of [['fixedAmount', 'fixed_amount'], ['actualAmount', 'actual_amount']] as const) {
        if (body[key] === undefined) continue;
        const amount = body[key] === null || body[key] === '' ? null : Number(body[key]);
        if (amount !== null && (!Number.isSafeInteger(amount) || amount < 0)) return Response.json({ message: '금액은 0 이상의 정수로 입력해주세요.' }, { status: 400 });
        if (column === 'fixed_amount' && amount === null) return Response.json({ message: '고정금액은 비워둘 수 없습니다.' }, { status: 400 });
        update[column] = amount;
      }
      if (body.isPaid !== undefined) {
        if (typeof body.isPaid !== 'boolean') return Response.json({ message: '납부 상태를 확인해주세요.' }, { status: 400 });
        update.is_paid = body.isPaid;
      }
      if (!Object.keys(update).length) return Response.json({ message: '수정할 내용을 선택해주세요.' }, { status: 400 });
      const { error } = await supabaseAdmin.from('fixed_expense_items').update(update).eq('id', body.id);
      if (error) throw error;
      return Response.json({ success: true });
    }
    return Response.json({ message: '수정할 항목을 확인해주세요.' }, { status: 400 });
  } catch (error) {
    if (schemaMissing(error as { code?: string; message?: string })) return schemaRequired();
    console.error(error);
    return Response.json({ message: '고정지출 정보를 수정하지 못했습니다.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isAuthenticated())) return Response.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  const body = parseBody(await request.json().catch(() => null));
  if (!body) return Response.json({ message: '삭제할 항목을 확인해주세요.' }, { status: 400 });
  const categoryIds = Array.isArray(body.categoryIds) ? body.categoryIds : [];
  const itemIds = Array.isArray(body.itemIds) ? body.itemIds : [];
  if ([...categoryIds, ...itemIds].some((id) => typeof id !== 'string' || !UUID_PATTERN.test(id))) return Response.json({ message: '삭제할 항목 정보를 확인해주세요.' }, { status: 400 });
  try {
    if (categoryIds.length) {
      const { error } = await supabaseAdmin.from('fixed_expense_categories').delete().in('id', categoryIds as string[]);
      if (error) throw error;
    }
    if (itemIds.length) {
      const { error } = await supabaseAdmin.from('fixed_expense_items').delete().in('id', itemIds as string[]);
      if (error) throw error;
    }
    return Response.json({ success: true });
  } catch (error) {
    if (schemaMissing(error as { code?: string; message?: string })) return schemaRequired();
    console.error(error);
    return Response.json({ message: '선택한 고정지출을 삭제하지 못했습니다.' }, { status: 500 });
  }
}
