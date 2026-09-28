'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import KoreanLunarCalendar from 'korean-lunar-calendar';
import { daysUntilEvent, getEventDateInYear, getNextEventDate, type FamilyEvent } from '../../lib/familyEvents';

function localDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function fromDateString(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}
function formatEventDate(value: string) {
  const date = fromDateString(value);
  const dateText = new Intl.DateTimeFormat('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' }).format(date);
  const weekday = new Intl.DateTimeFormat('ko-KR', { weekday: 'short' }).format(date);
  return `${dateText} (${weekday})`;
}
function formatRegisteredEventDate(event: FamilyEvent) {
  const registeredDate = `${event.event_year}-${String(event.event_month).padStart(2, '0')}-${String(event.event_day).padStart(2, '0')}`;
  if (event.calendar_type === 'solar') return formatEventDate(registeredDate);
  const convertedDate = getEventDateInYear(event, event.event_year) ?? registeredDate;
  const weekday = new Intl.DateTimeFormat('ko-KR', { weekday: 'short' }).format(fromDateString(convertedDate));
  const dateText = new Intl.DateTimeFormat('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' }).format(fromDateString(registeredDate));
  return `${dateText} (${weekday})`;
}
function formatEventTitle(title: string) {
  const characters = Array.from(title);
  return characters.length > 7 ? `${characters.slice(0, 7).join('')}…` : title;
}

export default function FamilyEventsPage() {
  const [today, setToday] = useState(() => new Date());
  const todayString = localDateString(today);
  const [displayMonth, setDisplayMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [calendarType, setCalendarType] = useState<'solar' | 'lunar'>('solar');
  const [solarDate, setSolarDate] = useState(todayString);
  const [referenceYear, setReferenceYear] = useState(today.getFullYear());
  const [eventMonth, setEventMonth] = useState(1);
  const [eventDay, setEventDay] = useState(1);
  const [isLeapMonth, setIsLeapMonth] = useState(false);
  const [repeatYearly, setRepeatYearly] = useState(true);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/family-events', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '집안행사를 불러오지 못했습니다.');
      setEvents(data.events ?? []);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '집안행사를 불러오지 못했습니다.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const current = new Date();
    setToday(current);
    setDisplayMonth(new Date(current.getFullYear(), current.getMonth(), 1));
    void loadEvents();
  }, [loadEvents]);

  const monthTitle = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long' }).format(displayMonth);
  const calendarDays = useMemo(() => {
    const year = displayMonth.getFullYear();
    const month = displayMonth.getMonth();
    const cells: Array<{ date: string; day: number } | null> = Array(new Date(year, month, 1).getDay()).fill(null);
    for (let day = 1; day <= new Date(year, month + 1, 0).getDate(); day += 1) cells.push({ date: localDateString(new Date(year, month, day)), day });
    while (cells.length % 7) cells.push(null);
    return cells;
  }, [displayMonth]);
  const eventsInDisplayMonth = useMemo(() => events.flatMap((event) => {
    const date = getEventDateInYear(event, displayMonth.getFullYear());
    return date ? [{ event, date }] : [];
  }), [events, displayMonth]);
  const upcomingEvents = useMemo(() => events.flatMap((event) => {
    const date = getNextEventDate(event, todayString) ??
      (!event.repeat_yearly ? getEventDateInYear(event, event.event_year) : null);
    return date ? [{ event, date }] : [];
  }).sort((a, b) => a.date.localeCompare(b.date)), [events, todayString]);
  const lunarPreview = useMemo(() => {
    const converter = new KoreanLunarCalendar();
    if (!converter.setLunarDate(referenceYear, eventMonth, eventDay, isLeapMonth)) return null;
    const date = converter.getSolarCalendar();
    return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
  }, [referenceYear, eventMonth, eventDay, isLeapMonth]);

  function changeMonth(amount: number) {
    setDisplayMonth((month) => new Date(month.getFullYear(), month.getMonth() + amount, 1));
  }
  function openForm() {
    setError(''); setTitle(''); setSolarDate(todayString); setReferenceYear(today.getFullYear());
    setEventMonth(1); setEventDay(1); setIsLeapMonth(false); setCalendarType('solar');
    setRepeatYearly(true); setEditingEventId(null); setShowForm(true);
  }
  function openEditForm(event: FamilyEvent) {
    setError(''); setEditingEventId(event.id); setTitle(event.title);
    setCalendarType(event.calendar_type); setReferenceYear(event.event_year);
    setEventMonth(event.event_month); setEventDay(event.event_day);
    setIsLeapMonth(event.is_leap_month); setRepeatYearly(event.repeat_yearly);
    setSolarDate(`${event.event_year}-${String(event.event_month).padStart(2, '0')}-${String(event.event_day).padStart(2, '0')}`);
    setShowForm(true);
  }
  async function saveEvent(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!title.trim() || saving) return;
    const [year, month, day] = calendarType === 'solar' ? solarDate.split('-').map(Number) : [referenceYear, eventMonth, eventDay];
    setSaving(true); setError('');
    try {
      const response = await fetch('/api/family-events', {
        method: editingEventId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingEventId, title, eventMonth: month, eventDay: day, referenceYear: year, calendarType, isLeapMonth, repeatYearly }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '행사를 저장하지 못했습니다.');
      const saved = data.event as FamilyEvent;
      setEvents((current) => [...current.filter((item) => item.id !== saved.id), saved]);
      const occurrence = getEventDateInYear(saved, today.getFullYear());
      if (occurrence) { const date = fromDateString(occurrence); setDisplayMonth(new Date(date.getFullYear(), date.getMonth(), 1)); }
      setShowForm(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '행사를 저장하지 못했습니다.');
    } finally { setSaving(false); }
  }
  async function deleteEvent(event: FamilyEvent) {
    if (!window.confirm(`“${event.title}” 행사를 삭제할까요?`)) return;
    const response = await fetch(`/api/family-events?id=${encodeURIComponent(event.id)}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) { setError(data.message || '행사를 삭제하지 못했습니다.'); return; }
    setEvents((current) => current.filter((item) => item.id !== event.id));
  }

  return (
    <main className="app">
      <section className="container stock-container family-events-container">
        <header className="stock-header">
          <div><p className="eyebrow brand-eyebrow">Master 3.0</p><h1>집안행사</h1></div>
          <Link href="/" className="logout-button">처음으로</Link>
        </header>

        <section className="family-calendar-panel" aria-label="집안행사 달력">
          <div className="family-calendar-heading">
            <h2>{monthTitle}</h2>
            <div className="family-calendar-nav">
              <button type="button" onClick={() => changeMonth(-1)} aria-label="이전 달">‹</button>
              <button type="button" onClick={() => setDisplayMonth(new Date(today.getFullYear(), today.getMonth(), 1))}>오늘</button>
              <button type="button" onClick={() => changeMonth(1)} aria-label="다음 달">›</button>
            </div>
          </div>
          <div className="family-calendar-grid family-calendar-weekdays" aria-hidden="true">{['일', '월', '화', '수', '목', '금', '토'].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="family-calendar-grid">
            {calendarDays.map((cell, index) => {
              const dayEvents = cell ? eventsInDisplayMonth.filter((item) => item.date === cell.date) : [];
              return <div key={cell?.date ?? `blank-${index}`} className={`family-calendar-cell${cell?.date === todayString ? ' is-today' : ''}${index % 7 === 0 ? ' is-sunday' : ''}${index % 7 === 6 ? ' is-saturday' : ''}`}>
                {cell && <span className="family-calendar-day">{cell.day}</span>}
                {dayEvents.slice(0, 2).map(({ event }) => <span key={event.id} className="family-calendar-event" title={`${event.title} (${event.calendar_type === 'lunar' ? '음력' : '양력'})`}>{event.title}</span>)}
                {dayEvents.length > 2 && <span className="family-calendar-more">+{dayEvents.length - 2}</span>}
              </div>;
            })}
          </div>
        </section>

        <section className="family-event-list" aria-labelledby="family-event-list-title">
          <div className="family-event-list-heading">
            <div><h2 id="family-event-list-title">등록된 행사</h2><p>가족의 소중한 날을 기록해 보세요.</p></div>
            <button className="family-event-add-button" type="button" onClick={openForm} aria-label="행사 추가" title="행사 추가">+</button>
          </div>
          {error && !showForm && <p className="family-event-error" role="alert">{error}</p>}
          {loading ? <p className="family-event-empty">행사를 불러오는 중입니다.</p> : upcomingEvents.length === 0 ? <p className="family-event-empty">아직 등록된 행사가 없습니다.</p> : <ul className="family-event-items">
            {upcomingEvents.map(({ event, date }) => {
              const daysLeft = daysUntilEvent(date, todayString);
              return <li key={event.id} className="family-event-item">
                <strong title={`${event.title} · ${event.repeat_yearly ? '매년 반복' : '1회 행사'}`}>{formatEventTitle(event.title)}</strong>
                <span className="family-event-date" title={`${event.repeat_yearly ? '매년 반복' : '1회 행사'}`}>
                  {formatRegisteredEventDate(event)}
                </span>
                <span className="family-event-calendar-type">{event.calendar_type === 'lunar' ? '음력' : '양력'}</span>
                <span className="family-event-countdown">{daysLeft === 0 ? '오늘' : daysLeft < 0 ? `${Math.abs(daysLeft)}일 지남` : `${daysLeft}일 남음`}</span>
                <button type="button" className="family-event-delete" onClick={() => openEditForm(event)} aria-label={`${event.title} 수정`}>수정</button>
                <button type="button" className="family-event-delete" onClick={() => void deleteEvent(event)} aria-label={`${event.title} 삭제`}>삭제</button>
              </li>;
            })}
          </ul>}
        </section>
      </section>

      {showForm && <div className="family-event-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}>
        <section className="family-event-modal" role="dialog" aria-modal="true" aria-labelledby="family-event-form-title">
          <div className="family-event-modal-heading"><div><p className="eyebrow">{editingEventId ? 'EDIT EVENT' : 'NEW EVENT'}</p><h2 id="family-event-form-title">행사 {editingEventId ? '수정' : '추가'}</h2></div><button type="button" onClick={() => setShowForm(false)} aria-label="닫기">×</button></div>
          <form onSubmit={saveEvent} className="family-event-form">
            <label>행사 내용<input autoFocus maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="예: 어머니 생신" required /></label>
            <fieldset><legend>달력 기준</legend><div className="family-event-calendar-types">
              <button type="button" className={calendarType === 'solar' ? 'is-selected' : ''} onClick={() => setCalendarType('solar')}>양력</button>
              <button type="button" className={calendarType === 'lunar' ? 'is-selected' : ''} onClick={() => setCalendarType('lunar')}>음력</button>
            </div></fieldset>
            <div className="family-event-repeat-row">
              <span>매년 반복</span>
              <button type="button" role="switch" aria-checked={repeatYearly} className={`family-event-switch${repeatYearly ? ' is-on' : ''}`} onClick={() => setRepeatYearly((value) => !value)}>
                <span />
              </button>
            </div>
            {calendarType === 'solar' ? <label>날짜<input type="date" value={solarDate} onChange={(event) => setSolarDate(event.target.value)} required /></label> : <>
              <div className="family-event-lunar-date">
                <label>기준 연도<select value={referenceYear} onChange={(event) => setReferenceYear(Number(event.target.value))}>{Array.from({ length: 2051 - Math.max(1940, today.getFullYear() - 80) }, (_, index) => Math.max(1940, today.getFullYear() - 80) + index).map((year) => <option key={year} value={year}>{year}년</option>)}</select></label>
                <label>월<select value={eventMonth} onChange={(event) => { setEventMonth(Number(event.target.value)); setIsLeapMonth(false); }}>{Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option key={month} value={month}>{month}월</option>)}</select></label>
                <label>일<select value={eventDay} onChange={(event) => setEventDay(Number(event.target.value))}>{Array.from({ length: 30 }, (_, index) => index + 1).map((day) => <option key={day} value={day}>{day}일</option>)}</select></label>
              </div>
              <label className="family-event-leap-toggle"><input type="checkbox" checked={isLeapMonth} onChange={(event) => setIsLeapMonth(event.target.checked)} /> 윤달</label>
              <p className="family-event-preview">{lunarPreview ? `${referenceYear}년에는 ${formatEventDate(lunarPreview)}에 표시됩니다.` : '선택한 연도에 없는 음력 날짜입니다. 연도나 날짜를 확인해주세요.'}</p>
            </>}
            {error && <p className="family-event-error" role="alert">{error}</p>}
            <button type="submit" className="family-event-save" disabled={saving || !title.trim() || (calendarType === 'lunar' && !lunarPreview)}>{saving ? '저장 중...' : editingEventId ? '수정 완료' : '행사 등록'}</button>
          </form>
        </section>
      </div>}
    </main>
  );
}
