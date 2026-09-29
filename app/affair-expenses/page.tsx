'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import LoadingDots from '../../components/LoadingDots';

type AffairTransaction = { id: string; flow: 'expense' | 'income'; event_date: string; event_name: string; amount: number };
type AffairContact = { id: string; name: string; relation: string | null; phone: string | null; transactions: AffairTransaction[] };
type TransactionDraft = { flow: '' | 'expense' | 'income'; eventDate: string; eventName: string; amount: string };

function todayString() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-');
  return `${year}.${month}.${day}`;
}

function sortContacts(items: AffairContact[]) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function formatAmount(value: string | number) {
  const digits = String(value).replace(/\D/g, '');
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function emptyTransaction(): TransactionDraft {
  return { flow: '', eventDate: todayString(), eventName: '', amount: '' };
}

export default function AffairExpensesPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [contacts, setContacts] = useState<AffairContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AffairContact | null>(null);
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const [phone, setPhone] = useState('');
  const [transactions, setTransactions] = useState<TransactionDraft[]>([]);
  const [saving, setSaving] = useState(false);

  const loadContacts = useCallback(async () => {
    const response = await fetch('/api/affair-expenses', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || '경조사비를 불러오지 못했습니다.');
    setContacts(sortContacts(data.contacts ?? []));
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/auth', { cache: 'no-store' });
        const data = await response.json();
        setAuthenticated(data.authenticated);
        if (data.authenticated) await loadContacts();
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : '경조사비를 불러오지 못했습니다.');
      } finally { setLoading(false); }
    })();
  }, [loadContacts]);

  useEffect(() => {
    const closeDialog = () => {
      if (!saving) setShowForm(false);
    };
    window.addEventListener('affair-expense:close-dialog', closeDialog);
    return () => window.removeEventListener('affair-expense:close-dialog', closeDialog);
  }, [saving]);

  const sortedContacts = useMemo(() => sortContacts(contacts), [contacts]);

  function openForm(contact?: AffairContact) {
    setError('');
    setEditing(contact ?? null);
    setName(contact?.name ?? '');
    setRelation(contact?.relation ?? '');
    setPhone(formatPhone(contact?.phone ?? ''));
    setTransactions(contact?.transactions.map((item) => ({ flow: item.flow, eventDate: item.event_date, eventName: item.event_name, amount: formatAmount(item.amount) })) ?? []);
    setShowForm(true);
  }

  async function saveContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/affair-expenses', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing?.id, name, relation, phone: phone.replace(/\D/g, ''), transactions: transactions.map((item) => ({ ...item, amount: item.amount.replace(/\D/g, '') })) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '저장하지 못했습니다.');
      await loadContacts();
      setShowForm(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '저장하지 못했습니다.');
    } finally { setSaving(false); }
  }

  async function deleteContact(contact: AffairContact) {
    if (!window.confirm(`${contact.name}님의 경조사 기록을 모두 삭제할까요?`)) return;
    try {
      const response = await fetch(`/api/affair-expenses?id=${encodeURIComponent(contact.id)}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '삭제하지 못했습니다.');
      setContacts((current) => current.filter((item) => item.id !== contact.id));
      setError('');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '삭제하지 못했습니다.');
    }
  }

  if (loading) return <main className="loading-screen"><LoadingDots /></main>;
  if (!authenticated) return <main className="app"><section className="container"><div className="feature-placeholder"><h2>접근할 수 없습니다.</h2><p>먼저 Passcode를 입력해주세요.</p><Link href="/" className="back-link">처음으로</Link></div></section></main>;

  return (
    <main className="app">
      <section className="container affair-expenses-container">
        <header className="header">
          <div><p className="eyebrow brand-eyebrow">Master 3.0</p><h1>경조사비</h1></div>
          <div className="routine-header-actions">
            <button type="button" className="routine-add-button" onClick={() => openForm()} aria-label="경조사비 추가" title="경조사비 추가">+</button>
            <Link href="/" className="logout-button">처음으로</Link>
          </div>
        </header>

        {error && !showForm && <p className="family-event-error" role="alert">{error}</p>}
        {sortedContacts.length === 0 ? <div className="empty affair-expenses-empty"><p>아직 등록된 경조사 기록이 없습니다.</p><span>+ 버튼을 눌러 연락처와 행사 내역을 추가해보세요.</span></div> : (
          <section className="affair-contact-list" aria-label="경조사 연락처 목록">
            {sortedContacts.map((contact) => <article className="affair-contact-card" key={contact.id}>
              <button type="button" className="affair-contact-open" onClick={() => openForm(contact)} aria-label={`${contact.name} 정보 수정`}>
                <span className="affair-contact-identity">
                  <strong>{contact.name}</strong>
                  {contact.relation && <span>{contact.relation}</span>}
                  {contact.phone && <span className="affair-contact-phone">{formatPhone(contact.phone)}</span>}
                </span>
                {contact.transactions.length > 0 && <span className="affair-transaction-list">
                  {contact.transactions.map((item) => <span className="affair-transaction-row" key={item.id}>
                    <span className={`affair-flow-badge ${item.flow}`}>{item.flow === 'expense' ? '보낸 부조' : '받은 부조'}</span>
                    <span className="affair-transaction-date">{formatDate(item.event_date)}</span>
                    <span className="affair-transaction-event">{item.event_name}</span>
                    <strong className="affair-transaction-amount">{Number(item.amount).toLocaleString('ko-KR')}원</strong>
                  </span>)}
                </span>}
              </button>
              <button type="button" className="affair-contact-delete" onClick={() => void deleteContact(contact)} aria-label={`${contact.name} 삭제`} title="삭제">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M5.5 7l1 14h11l1-14M9 7V4h6v3" /></svg>
              </button>
            </article>)}
          </section>
        )}
      </section>

      {showForm && <div className="family-event-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setShowForm(false); }}>
        <section className="family-event-modal affair-expense-modal" role="dialog" aria-modal="true" aria-labelledby="affair-form-title">
          <div className="family-event-modal-heading"><div><p className="eyebrow">{editing ? 'EDIT CONTACT' : 'NEW CONTACT'}</p><h2 id="affair-form-title">경조사비 {editing ? '수정' : '추가'}</h2></div><button type="button" onClick={() => setShowForm(false)} aria-label="닫기">×</button></div>
          <form className="family-event-form affair-expense-form" onSubmit={(event) => void saveContact(event)}>
            <label>이름<input autoFocus maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="이름" required /></label>
            <div className="affair-contact-fields">
              <label>관계<select value={relation} onChange={(event) => setRelation(event.target.value)} required><option value="">선택</option><option value="가족">가족</option><option value="직장">직장</option><option value="친구">친구</option><option value="기타">기타</option></select></label>
              <label>전화번호<input type="tel" inputMode="numeric" maxLength={13} value={phone} onChange={(event) => setPhone(formatPhone(event.target.value))} placeholder="010-1234-5678" pattern="\d{3}-\d{4}-\d{4}" title="전화번호 11자리를 입력해주세요." required /></label>
            </div>
            <div className="affair-transaction-editor">
              <div className="affair-transaction-editor-heading"><strong>행사 내역</strong><button type="button" className="affair-add-transaction" onClick={() => setTransactions((current) => [...current, emptyTransaction()])} aria-label="행사 내역 추가">+</button></div>
              {transactions.length === 0 && <p className="affair-transaction-hint">필요한 경우 + 버튼으로 입출금 내역을 추가하세요.</p>}
              {transactions.map((item, index) => <div className="affair-transaction-editor-row" key={index}>
                <span className="affair-transaction-index">{index + 1} / {transactions.length}</span>
                <div className="affair-transaction-editor-top">
                  <label className="affair-flow-field"><span>구분</span><select value={item.flow} onChange={(event) => setTransactions((current) => current.map((entry, i) => i === index ? { ...entry, flow: event.target.value as TransactionDraft['flow'] } : entry))} required={Boolean(item.eventDate || item.eventName || item.amount)}>
                    <option value="">선택</option><option value="expense">보낸 부조</option><option value="income">받은 부조</option>
                  </select></label>
                  <label>날짜<input type="date" value={item.eventDate} onChange={(event) => setTransactions((current) => current.map((entry, i) => i === index ? { ...entry, eventDate: event.target.value } : entry))} required={Boolean(item.flow || item.eventName || item.amount)} /></label>
                </div>
                <div className="affair-transaction-editor-bottom">
                  <label>행사명<input maxLength={100} value={item.eventName} onChange={(event) => setTransactions((current) => current.map((entry, i) => i === index ? { ...entry, eventName: event.target.value } : entry))} placeholder="예: 결혼식" required={Boolean(item.flow || item.eventDate || item.amount)} /></label>
                  <label>금액<input type="text" inputMode="numeric" value={item.amount} onChange={(event) => setTransactions((current) => current.map((entry, i) => i === index ? { ...entry, amount: formatAmount(event.target.value) } : entry))} placeholder="금액" required={Boolean(item.flow || item.eventDate || item.eventName)} /></label>
                </div>
                <button type="button" className="affair-remove-transaction" onClick={() => setTransactions((current) => current.filter((_, i) => i !== index))} aria-label="항목 삭제" title="항목 삭제">삭제</button>
              </div>)}
            </div>
            {error && <p className="family-event-error" role="alert">{error}</p>}
            <button type="submit" className="family-event-save" disabled={saving || !name.trim()}>{saving ? '저장 중...' : editing ? '수정 완료' : '등록하기'}</button>
          </form>
        </section>
      </div>}
    </main>
  );
}
