'use client';

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import Link from 'next/link';
import LoadingDots from '../../components/LoadingDots';
import ConfirmDialog from '../../components/ConfirmDialog';

type ExpenseItem = { id: string; category_id: string; expense_name: string; due_day: number; fixed_amount: number; actual_amount: number | null; is_paid: boolean; sort_order: number };
type ExpenseCategory = { id: string; month_start: string; name: string; sort_order: number; items: ExpenseItem[] };
type EditDialog = { kind: 'category'; id: string; value: string } | { kind: 'item-name' | 'due-day' | 'fixed-amount'; id: string; value: string } | null;
type DragState = { kind: 'category' | 'item'; id: string; categoryId?: string; pointerId: number; startY: number; lastY: number; timer: number; active: boolean; scrolling: boolean; originalOrder: string[] };

const FIRST_MONTH = '2026-10';
const MIN_HISTORY_MONTH = '2026-10';
const money = (value: number | null) => value == null ? '' : value.toLocaleString('ko-KR');
const validId = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

function shiftMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function currentSeoulMonth() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}`;
}

function monthRange() {
  const current = currentSeoulMonth();
  const latest = current < FIRST_MONTH ? FIRST_MONTH : current;
  const earliestCandidate = shiftMonth(latest, -11);
  return { earliest: earliestCandidate < MIN_HISTORY_MONTH ? MIN_HISTORY_MONTH : earliestCandidate, latest };
}

function numberInput(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits) : null;
}

export default function FixedExpensesPage() {
  const [month, setMonth] = useState(() => currentSeoulMonth() < FIRST_MONTH ? FIRST_MONTH : currentSeoulMonth());
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [monthlyIncome, setMonthlyIncome] = useState<number | null>(null);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(() => new Set());
  const [selectedItems, setSelectedItems] = useState<Set<string>>(() => new Set());
  const [editDialog, setEditDialog] = useState<EditDialog>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragState = useRef<DragState | null>(null);
  const suppressClick = useRef(false);

  async function loadMonth(targetMonth: string) {
    setLoading(true);
    setError('');
    try {
      const [response, salaryResponse] = await Promise.all([
        fetch(`/api/fixed-expenses?month=${encodeURIComponent(targetMonth)}`, { cache: 'no-store' }),
        fetch('/api/salary-records', { cache: 'no-store' }),
      ]);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '고정지출을 불러오지 못했습니다.');
      setCategories((data.categories ?? []) as ExpenseCategory[]);
      let income: number | null = null;
      if (salaryResponse.ok) {
        try {
          const salaryData = await salaryResponse.json() as { records?: Array<{ income_year: number; income_month: number; monthly_salary: number | null }> };
          const [year, monthNumber] = targetMonth.split('-').map(Number);
          income = salaryData.records?.find((record) => record.income_year === year && record.income_month === monthNumber)?.monthly_salary ?? null;
        } catch {
          income = null;
        }
      }
      setMonthlyIncome(income);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '고정지출을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/auth', { cache: 'no-store' });
        const data = await response.json();
        if (cancelled) return;
        setAuthenticated(Boolean(data.authenticated));
        if (data.authenticated) await loadMonth(month);
        else setLoading(false);
      } catch (loadError) {
        if (!cancelled) {
          setAuthenticated(false);
          setError(loadError instanceof Error ? loadError.message : '로그인 상태를 확인하지 못했습니다.');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
    // Load the initial month once after authentication.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function requestJson(url: string, method: 'POST' | 'PATCH' | 'DELETE', body: Record<string, unknown>) {
    const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || '고정지출을 저장하지 못했습니다.');
    return data;
  }

  function changeMonth(value: string) {
    const range = monthRange();
    if (value < range.earliest || value > range.latest) return;
    setMonth(value);
    setSelectionMode(false);
    setSelectedCategories(new Set());
    setSelectedItems(new Set());
    void loadMonth(value);
  }

  async function addCategory() {
    try {
      const data = await requestJson('/api/fixed-expenses', 'POST', { type: 'category', month });
      setCategories((current) => [...current, data.category as ExpenseCategory]);
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : '카테고리를 추가하지 못했습니다.');
    }
  }

  async function addItem(categoryId: string) {
    try {
      const data = await requestJson('/api/fixed-expenses', 'POST', { type: 'item', categoryId });
      setCategories((current) => current.map((category) => category.id === categoryId ? { ...category, items: [...category.items, data.item as ExpenseItem] } : category));
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : '지출 항목을 추가하지 못했습니다.');
    }
  }

  function toggleSelection(kind: 'category' | 'item', id: string) {
    const setter = kind === 'category' ? setSelectedCategories : setSelectedItems;
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCategorySelection(category: ExpenseCategory) {
    setSelectedCategories((current) => {
      const next = new Set(current);
      if (next.has(category.id)) next.delete(category.id);
      else next.add(category.id);
      return next;
    });
  }

  async function deleteSelected() {
    const nestedItemIds = categories.filter((category) => selectedCategories.has(category.id)).flatMap((category) => category.items.map((item) => item.id));
    const itemIds = [...new Set([...selectedItems, ...nestedItemIds])];
    setBusy(true);
    setError('');
    try {
      await requestJson('/api/fixed-expenses', 'DELETE', { categoryIds: [...selectedCategories], itemIds });
      setCategories((current) => current.filter((category) => !selectedCategories.has(category.id)).map((category) => ({ ...category, items: category.items.filter((item) => !selectedItems.has(item.id)) })));
      setSelectedCategories(new Set());
      setSelectedItems(new Set());
      setSelectionMode(false);
      setConfirmDeleteOpen(false);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '선택 항목을 삭제하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  function openEdit(kind: NonNullable<EditDialog>['kind'], id: string, value: string) {
    if (selectionMode) return;
    setEditDialog({ kind, id, value });
  }

  async function saveEdit() {
    if (!editDialog) return;
    setBusy(true);
    setError('');
    try {
      if (editDialog.kind === 'category') {
        await requestJson('/api/fixed-expenses', 'PATCH', { type: 'category', id: editDialog.id, name: editDialog.value });
        setCategories((current) => current.map((category) => category.id === editDialog.id ? { ...category, name: editDialog.value.trim() } : category));
      } else {
        const item = categories.flatMap((category) => category.items).find((entry) => entry.id === editDialog.id);
        if (!item) return;
        let body: Record<string, unknown> = { type: 'item', id: editDialog.id };
        if (editDialog.kind === 'item-name') body.expenseName = editDialog.value;
        if (editDialog.kind === 'due-day') body.dueDay = numberInput(editDialog.value);
        if (editDialog.kind === 'fixed-amount') body.fixedAmount = numberInput(editDialog.value);
        await requestJson('/api/fixed-expenses', 'PATCH', body);
        setCategories((current) => current.map((category) => ({
          ...category,
          items: category.items.map((entry) => entry.id !== item.id ? entry : {
            ...entry,
            ...(editDialog.kind === 'item-name' ? { expense_name: editDialog.value.trim() } : {}),
            ...(editDialog.kind === 'due-day' ? { due_day: numberInput(editDialog.value) ?? entry.due_day } : {}),
            ...(editDialog.kind === 'fixed-amount' ? { fixed_amount: numberInput(editDialog.value) ?? entry.fixed_amount } : {}),
          }),
        })));
      }
      setEditDialog(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '고정지출 정보를 저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  function startLongPress(kind: 'category' | 'item', id: string, categoryId: string | undefined, event: PointerEvent<HTMLElement>) {
    if (selectionMode || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (kind === 'category' && (event.target as HTMLElement).closest('[data-expense-item]')) return;
    const category = categories.find((entry) => entry.id === categoryId);
    const originalOrder = kind === 'category' ? categories.map((entry) => entry.id) : (category?.items ?? []).map((entry) => entry.id);
    const captureTarget = event.currentTarget;
    try { captureTarget.setPointerCapture(event.pointerId); } catch {}
    const timer = window.setTimeout(() => {
      const state = dragState.current;
      if (!state || state.id !== id || state.pointerId !== event.pointerId) return;
      state.active = true;
      suppressClick.current = true;
      setDraggingId(id);
      try { captureTarget.setPointerCapture(event.pointerId); } catch {}
    }, 380);
    dragState.current = { kind, id, categoryId, pointerId: event.pointerId, startY: event.clientY, lastY: event.clientY, timer, active: false, scrolling: false, originalOrder };
  }

  function moveLongPress(event: PointerEvent<HTMLElement>) {
    const state = dragState.current;
    if (!state || state.pointerId !== event.pointerId) return;
    if (!state.active) {
      if (Math.abs(event.clientY - state.startY) > 12) {
        window.clearTimeout(state.timer);
        state.scrolling = true;
      }
      if (state.scrolling) {
        event.preventDefault();
        window.scrollBy(0, state.lastY - event.clientY);
        state.lastY = event.clientY;
      }
      return;
    }
    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>(state.kind === 'category' ? '[data-expense-category]' : '[data-expense-item]');
    if (!target) return;
    const targetId = state.kind === 'category' ? target.dataset.expenseCategory : target.dataset.expenseItem;
    if (!targetId || targetId === state.id) return;
    const rect = target.getBoundingClientRect();
    if (event.clientY > rect.top + rect.height / 2) {
      const afterTarget = target.nextElementSibling?.getAttribute(state.kind === 'category' ? 'data-expense-category' : 'data-expense-item');
      if (afterTarget === state.id) return;
    } else {
      const previous = target.previousElementSibling?.getAttribute(state.kind === 'category' ? 'data-expense-category' : 'data-expense-item');
      if (previous === state.id) return;
    }
    const selector = state.kind === 'category' ? '[data-expense-category]' : '[data-expense-item]';
    const movingAttribute = state.kind === 'category' ? 'data-expense-category' : 'data-expense-item';
    const previousTops = new Map<string, number>();
    document.querySelectorAll<HTMLElement>(selector).forEach((node) => {
      const nodeId = node.getAttribute(movingAttribute);
      if (nodeId && nodeId !== state.id) {
        node.getAnimations().forEach((animation) => animation.cancel());
        previousTops.set(nodeId, node.getBoundingClientRect().top);
      }
    });
    const animateDisplaced = () => window.requestAnimationFrame(() => {
      document.querySelectorAll<HTMLElement>(selector).forEach((node) => {
        const nodeId = node.getAttribute(movingAttribute);
        const previousTop = nodeId ? previousTops.get(nodeId) : undefined;
        if (!nodeId || nodeId === state.id || previousTop === undefined) return;
        const distance = previousTop - node.getBoundingClientRect().top;
        if (Math.abs(distance) < 1) return;
        node.animate([{ transform: `translateY(${distance}px)` }, { transform: 'translateY(0)' }], { duration: 180, easing: 'cubic-bezier(0.22, 0.75, 0.25, 1)' });
      });
    });
    if (state.kind === 'category') {
      setCategories((current) => {
        const from = current.findIndex((item) => item.id === state.id);
        const targetIndex = current.findIndex((item) => item.id === targetId);
        if (from < 0 || targetIndex < 0 || from === targetIndex) return current;
        const insertAfter = event.clientY > rect.top + rect.height / 2;
        const to = targetIndex + (insertAfter ? 1 : 0) - (from < targetIndex ? 1 : 0);
        const next = [...current];
        const [moving] = next.splice(from, 1);
        next.splice(to, 0, moving);
        return next;
      });
      animateDisplaced();
    } else if (state.categoryId) {
      setCategories((current) => current.map((category) => {
        if (category.id !== state.categoryId) return category;
        const from = category.items.findIndex((item) => item.id === state.id);
        const targetIndex = category.items.findIndex((item) => item.id === targetId);
        if (from < 0 || targetIndex < 0 || from === targetIndex) return category;
        const insertAfter = event.clientY > rect.top + rect.height / 2;
        const to = targetIndex + (insertAfter ? 1 : 0) - (from < targetIndex ? 1 : 0);
        const items = [...category.items];
        const [moving] = items.splice(from, 1);
        items.splice(to, 0, moving);
        return { ...category, items };
      }));
      animateDisplaced();
    }
  }

  async function finishLongPress(cancelled = false) {
    const state = dragState.current;
    dragState.current = null;
    if (!state) return;
    window.clearTimeout(state.timer);
    if (!state.active) return;
    setDraggingId(null);
    window.setTimeout(() => { suppressClick.current = false; }, 100);
    if (cancelled) {
      setCategories((current) => state.kind === 'category'
        ? state.originalOrder.map((id) => current.find((category) => category.id === id)).filter((category): category is ExpenseCategory => Boolean(category))
        : current.map((category) => category.id === state.categoryId ? {
          ...category,
          items: state.originalOrder.map((id) => category.items.find((item) => item.id === id)).filter((item): item is ExpenseItem => Boolean(item)),
        } : category));
      return;
    }
    const ids = state.kind === 'category'
      ? categories.map((category) => category.id)
      : categories.find((category) => category.id === state.categoryId)?.items.map((item) => item.id) ?? [];
    try {
      await requestJson('/api/fixed-expenses', 'PATCH', { type: state.kind === 'category' ? 'reorderCategories' : 'reorderItems', ids });
    } catch (reorderError) {
      setError(reorderError instanceof Error ? reorderError.message : '순서를 저장하지 못했습니다.');
      void loadMonth(month);
    }
  }

  async function togglePaid(item: ExpenseItem) {
    const nextPaid = !item.is_paid;
    setCategories((current) => current.map((category) => ({
      ...category,
      items: category.items.map((entry) => entry.id === item.id ? { ...entry, is_paid: nextPaid } : entry),
    })));
    try {
      await requestJson('/api/fixed-expenses', 'PATCH', { type: 'item', id: item.id, isPaid: nextPaid });
    } catch (saveError) {
      setCategories((current) => current.map((category) => ({
        ...category,
        items: category.items.map((entry) => entry.id === item.id ? { ...entry, is_paid: item.is_paid } : entry),
      })));
      setError(saveError instanceof Error ? saveError.message : '납부 상태를 저장하지 못했습니다.');
    }
  }

  if (loading || authenticated === null) return <main className="loading-screen"><LoadingDots /></main>;
  if (!authenticated) return <main className="app"><section className="container"><div className="feature-placeholder"><h2>접근할 수 없습니다.</h2><p>먼저 Passcode를 입력해주세요.</p><Link href="/" className="back-link">처음으로</Link></div></section></main>;

  const [year, monthNumber] = month.split('-').map(Number);
  const range = monthRange();
  const selectedCount = selectedCategories.size + selectedItems.size;
  const allItems = categories.flatMap((category) => category.items);
  const paidItems = allItems.filter((item) => item.is_paid);
  const unpaidItems = allItems.filter((item) => !item.is_paid);
  const monthlyExpenses = allItems.reduce((total, item) => total + Number(item.fixed_amount || 0), 0);
  const paidTotal = paidItems.reduce((total, item) => total + Number(item.fixed_amount || 0), 0);
  const unpaidTotal = unpaidItems.reduce((total, item) => total + Number(item.fixed_amount || 0), 0);
  const monthlyBalance = monthlyIncome === null ? null : monthlyIncome - monthlyExpenses;
  const editValueDisplay = editDialog?.kind === 'fixed-amount' && editDialog.value
    ? Number(editDialog.value).toLocaleString('ko-KR')
    : editDialog?.value ?? '';

  return <main className="app">
    <section className="container stock-container fixed-expenses-container">
      <header className="header">
        <div><p className="eyebrow brand-eyebrow">Master 3.0</p><h1>고정지출</h1></div>
        <div className="routine-header-actions health-routine-list-actions fixed-expenses-header-actions" data-back-dialog={selectionMode ? 'true' : undefined}>
          {!selectionMode && <button type="button" className="fixed-expense-category-add" onClick={() => void addCategory()}>카테고리 추가</button>}
          {selectionMode ? <>
            <button type="button" className="health-selection-cancel" data-back-close onClick={() => { setSelectionMode(false); setSelectedCategories(new Set()); setSelectedItems(new Set()); }}>취소</button>
            <button type="button" className="health-selection-delete" disabled={selectedCount === 0 || busy} onClick={() => setConfirmDeleteOpen(true)}>삭제</button>
          </> : <button type="button" className="health-selection-start" onClick={() => { setSelectionMode(true); setSelectedCategories(new Set()); setSelectedItems(new Set()); }}>선택삭제</button>}
          <Link href="/" className="logout-button">처음으로</Link>
        </div>
      </header>
      <div className="fixed-expenses-monthbar">
        <button type="button" aria-label="이전 달" disabled={month <= range.earliest} onClick={() => changeMonth(shiftMonth(month, -1))}>‹</button>
        <h2>{year}년 {monthNumber}월</h2>
        <button type="button" aria-label="다음 달" disabled={month >= range.latest} onClick={() => changeMonth(shiftMonth(month, 1))}>›</button>
      </div>
      <section className="fixed-expense-summary" aria-label={`${year}년 ${monthNumber}월 요약`}>
        <h2 className="fixed-expense-summary-heading">월간 요약</h2>
        <div className="fixed-expense-summary-grid">
          <div className="fixed-expense-summary-cell"><span>월 소득</span><strong className={monthlyIncome === null ? 'is-empty' : ''}>{monthlyIncome === null ? '데이터 없음' : `${monthlyIncome.toLocaleString('ko-KR')}원`}</strong></div>
          <div className="fixed-expense-summary-cell"><span>월 지출</span><strong>{`${monthlyExpenses.toLocaleString('ko-KR')}원`}</strong></div>
          <div className="fixed-expense-summary-cell"><span>잔액</span><strong className={monthlyBalance === null ? 'is-empty' : ''}>{monthlyBalance === null ? '-' : `${monthlyBalance.toLocaleString('ko-KR')}원`}</strong></div>
          <div className="fixed-expense-summary-cell"><span>납부건수</span><strong>{`${paidItems.length}/${allItems.length}건`}</strong></div>
          <div className="fixed-expense-summary-cell"><span>납부총액</span><strong>{`${paidTotal.toLocaleString('ko-KR')}원`}</strong></div>
          <div className="fixed-expense-summary-cell"><span>미납총액</span><strong>{`${unpaidTotal.toLocaleString('ko-KR')}원`}</strong></div>
        </div>
      </section>
      {error && <p className="routine-error" role="alert">{error}</p>}

      <div className="fixed-expenses-categories">
        {categories.map((category) => <section key={category.id} className={`fixed-expense-category${draggingId === category.id ? ' is-dragging' : ''}${selectionMode ? ' is-selection-mode' : ''}`} data-expense-category={category.id} onPointerDown={(event) => startLongPress('category', category.id, undefined, event)} onPointerMove={moveLongPress} onPointerUp={() => void finishLongPress()} onPointerCancel={() => void finishLongPress(true)} onContextMenu={(event) => event.preventDefault()} onDragStart={(event) => event.preventDefault()}>
          <header className="fixed-expense-category-heading">
            {selectionMode && <input type="checkbox" className="health-exercise-select" aria-label={`${category.name} 카테고리 선택`} checked={selectedCategories.has(category.id)} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onChange={() => toggleCategorySelection(category)} />}
            <button type="button" className="fixed-expense-category-name" onClick={(event) => { event.stopPropagation(); if (selectionMode) { toggleCategorySelection(category); return; } if (suppressClick.current) { event.preventDefault(); return; } openEdit('category', category.id, category.name); }}>{category.name}</button>
            <span className="fixed-expense-category-total">총 {category.items.reduce((sum, item) => sum + Number(item.fixed_amount || 0), 0).toLocaleString('ko-KR')}원</span>
            <button type="button" className="fixed-expense-add-item" disabled={selectionMode} onPointerDown={(event) => event.stopPropagation()} onClick={() => void addItem(category.id)}>항목 추가</button>
          </header>
          <div className="fixed-expense-items">
            {category.items.map((item, index) => <article key={item.id} className={`fixed-expense-item${draggingId === item.id ? ' is-dragging' : ''}${selectionMode ? ' is-selection-mode' : ''}`} data-expense-item={item.id} onPointerDown={selectionMode ? undefined : (event) => startLongPress('item', item.id, category.id, event)} onPointerMove={selectionMode ? undefined : moveLongPress} onPointerUp={selectionMode ? undefined : () => void finishLongPress()} onPointerCancel={selectionMode ? undefined : () => void finishLongPress(true)} onContextMenu={(event) => event.preventDefault()} onDragStart={(event) => event.preventDefault()} onClick={selectionMode ? () => toggleSelection('item', item.id) : undefined}>
              {selectionMode ? <input type="checkbox" className="health-exercise-select" aria-label={`${item.expense_name} 선택`} checked={selectedItems.has(item.id)} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onChange={() => toggleSelection('item', item.id)} /> : <span className="health-exercise-order" aria-label={`${index + 1}번째 지출항목`}>{index + 1}</span>}
              <button type="button" className="fixed-expense-item-name" onClick={(event) => { event.stopPropagation(); if (selectionMode) { toggleSelection('item', item.id); return; } if (!suppressClick.current) openEdit('item-name', item.id, item.expense_name); }}>{Array.from(item.expense_name).slice(0, 10).join('')}</button>
              <button type="button" className="fixed-expense-due" onClick={(event) => { event.stopPropagation(); if (selectionMode) { toggleSelection('item', item.id); return; } openEdit('due-day', item.id, String(item.due_day)); }}>{item.due_day}일</button>
              <button type="button" className="fixed-expense-fixed-amount" onClick={(event) => { event.stopPropagation(); if (selectionMode) { toggleSelection('item', item.id); return; } openEdit('fixed-amount', item.id, String(item.fixed_amount)); }}>{money(item.fixed_amount)}원</button>
              <button type="button" className={`fixed-expense-paid-button${item.is_paid ? ' is-paid' : ''}`} aria-label={`${item.expense_name} 납부 ${item.is_paid ? '완료' : '미납'}`} aria-pressed={item.is_paid} onClick={(event) => { event.stopPropagation(); if (selectionMode) { toggleSelection('item', item.id); return; } void togglePaid(item); }}>{item.is_paid ? '납부' : '미납'}</button>
            </article>)}
          </div>
        </section>)}
      </div>
    </section>

    <ConfirmDialog open={confirmDeleteOpen} title={`선택한 항목 ${selectedCount}개를 삭제할까요?`} description="삭제한 고정지출은 복구할 수 없습니다. 선택한 카테고리는 하위 지출 항목도 함께 삭제됩니다." busy={busy} onCancel={() => setConfirmDeleteOpen(false)} onConfirm={() => void deleteSelected()} />
    {editDialog && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditDialog(null); }}>
      <section className="settings-modal fixed-expense-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="fixed-expense-dialog-title">
        <div className="settings-modal-header"><h2 id="fixed-expense-dialog-title">{editDialog.kind === 'category' ? '카테고리 이름' : editDialog.kind === 'item-name' ? '지출명' : editDialog.kind === 'due-day' ? '납부일' : '지출금액'}</h2><button type="button" className="app-picker-close" onClick={() => setEditDialog(null)} aria-label="닫기">×</button></div>
        <label className={`fixed-expense-dialog-field${editDialog.kind === 'fixed-amount' ? ' is-money' : ''}`}>
          <input autoFocus type="text" inputMode={editDialog.kind === 'category' || editDialog.kind === 'item-name' ? 'text' : 'numeric'} maxLength={editDialog.kind === 'category' ? 40 : editDialog.kind === 'item-name' ? 10 : undefined} value={editValueDisplay} onChange={(event) => setEditDialog({ ...editDialog, value: editDialog.kind === 'category' || editDialog.kind === 'item-name' ? event.target.value : event.target.value.replace(/\D/g, '') })} />
          {editDialog.kind === 'due-day' && <span>일</span>}
          {editDialog.kind === 'fixed-amount' && <span>원</span>}
        </label>
        <button type="button" className="settings-save-button" disabled={busy || !editDialog.value.trim()} onClick={() => void saveEdit()}>{editDialog.kind === 'category' ? '적용' : '입력'}</button>
      </section>
    </div>}
  </main>;
}
