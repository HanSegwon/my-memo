'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getKoreanDate, getRoutineDayType, type RoutineDayType } from '../../lib/routineSchedule';

type RoutineItem = {
  id: string;
  start_time: string;
  end_time: string;
  title: string;
  details: string | null;
  day_type: RoutineDayType;
  created_at: string;
};

function formatTime(value: string) { return value.slice(0, 5); }

export default function RoutinePage() {
  const [routines, setRoutines] = useState<RoutineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RoutineItem | null>(null);
  const [dayType, setDayType] = useState<RoutineDayType>('weekday');
  const [todayType, setTodayType] = useState<RoutineDayType>('weekday');
  const [clock, setClock] = useState(new Date());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [saving, setSaving] = useState(false);

  const loadRoutines = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/routine', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '생활루틴을 불러오지 못했습니다.');
      setRoutines(data.routines ?? []);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '생활루틴을 불러오지 못했습니다.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const now = new Date();
    const detected = getRoutineDayType(now);
    setTodayType(detected);
    setDayType(detected);
    setClock(now);
    void loadRoutines();
    const timer = window.setInterval(() => setClock(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, [loadRoutines]);

  function openForm(routine?: RoutineItem) {
    setEditing(routine ?? null);
    setStartTime(routine ? formatTime(routine.start_time) : '09:00');
    setEndTime(routine ? formatTime(routine.end_time) : '10:00');
    setTitle(routine?.title ?? '');
    setDetails(routine?.details ?? '');
    setError('');
    setShowForm(true);
  }

  async function saveRoutine(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/routine', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing?.id, startTime, endTime, title, details, dayType }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '생활루틴을 저장하지 못했습니다.');
      setRoutines((current) => {
        const updated = editing ? current.map((item) => item.id === editing.id ? data.routine : item) : [...current, data.routine];
        return updated.sort((a, b) => a.day_type.localeCompare(b.day_type) || a.start_time.localeCompare(b.start_time) || a.created_at.localeCompare(b.created_at));
      });
      setShowForm(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '생활루틴을 저장하지 못했습니다.');
    } finally { setSaving(false); }
  }

  async function deleteRoutine(routine: RoutineItem) {
    if (!window.confirm(`“${routine.title}” 생활루틴을 삭제할까요?`)) return;
    const response = await fetch(`/api/routine?id=${encodeURIComponent(routine.id)}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) { setError(data.message || '생활루틴을 삭제하지 못했습니다.'); return; }
    setRoutines((current) => current.filter((item) => item.id !== routine.id));
  }

  const visibleRoutines = routines.filter((item) => item.day_type === dayType);
  const todayLabel = getKoreanDate(clock);
  const currentTime = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(clock);
  const activeRoutine = todayType === dayType ? visibleRoutines.find((item) => {
    const now = currentTime;
    const start = formatTime(item.start_time);
    const end = formatTime(item.end_time);
    if (start === end) return false;
    return start < end ? now >= start && now < end : now >= start || now < end;
  }) : null;

  return (
    <main className="app">
      <section className="container stock-container routine-container">
        <header className="stock-header">
          <div><p className="eyebrow brand-eyebrow">Master 3.0</p><h1>생활루틴</h1></div>
          <div className="routine-header-actions">
            <button type="button" className="routine-add-button" onClick={() => openForm()} aria-label="생활루틴 추가" title="생활루틴 추가">+</button>
            <Link href="/" className="logout-button">처음으로</Link>
          </div>
        </header>

        <div className="routine-day-switch" role="group" aria-label="루틴 종류 선택">
          {(['weekday', 'holiday'] as const).map((type) => (
            <button key={type} type="button" className={dayType === type ? 'is-selected' : ''} onClick={() => setDayType(type)}>
              {type === 'weekday' ? '평일 루틴' : '휴일 루틴'}
            </button>
          ))}
          <span className="routine-today-type">오늘 {todayLabel.slice(5).replace('-', '.')} · {todayType === 'weekday' ? '평일' : '휴일'}</span>
        </div>

        {activeRoutine && <p className="routine-now">지금은 <strong>{activeRoutine.title}</strong> 할 시간입니다.</p>}
        {error && !showForm && <p className="routine-error" role="alert">{error}</p>}
        <section className="routine-list" aria-label={`${dayType === 'weekday' ? '평일' : '휴일'} 생활루틴 목록`}>
          {loading ? <p className="routine-empty">생활루틴을 불러오는 중입니다.</p> : visibleRoutines.length === 0 ? (
            <div className="routine-empty-state"><h2>{dayType === 'weekday' ? '평일' : '휴일'}의 리듬을 만들어 보세요</h2><p>+ 버튼으로 이 루틴을 추가할 수 있습니다.</p></div>
          ) : visibleRoutines.map((routine) => {
            const start = formatTime(routine.start_time);
            const end = formatTime(routine.end_time);
            const active = todayType === dayType && start !== end && (start < end ? currentTime >= start && currentTime < end : currentTime >= start || currentTime < end);
            return (
              <article className={`routine-item${active ? ' is-current' : ''}`} key={routine.id}>
                <div className="routine-time"><span>{start}</span><i aria-hidden="true" /><span>{end}</span></div>
                <div className="routine-description"><h2>{routine.title}</h2>{routine.details && <p>{routine.details}</p>}</div>
                <div className="routine-item-actions">
                  <button type="button" className="routine-edit-button" onClick={() => openForm(routine)} aria-label={`${routine.title} 수정`}>수정</button>
                  <button type="button" className="routine-delete-button" onClick={() => void deleteRoutine(routine)} aria-label={`${routine.title} 삭제`}>삭제</button>
                </div>
              </article>
            );
          })}
        </section>
      </section>

      {showForm && (
        <div className="family-event-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}>
          <section className="family-event-modal" role="dialog" aria-modal="true" aria-labelledby="routine-form-title">
            <div className="family-event-modal-heading"><div><p className="eyebrow">{editing ? 'EDIT ROUTINE' : 'NEW ROUTINE'}</p><h2 id="routine-form-title">생활루틴 {editing ? '수정' : '추가'}</h2></div><button type="button" onClick={() => setShowForm(false)} aria-label="닫기">×</button></div>
            <form className="family-event-form routine-form" onSubmit={saveRoutine}>
              <div className="routine-time-fields"><label>시작 시간<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required /></label><label>종료 시간<input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required /></label></div>
              <label>제목<input maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="예: 아침 운동" required /></label>
              <label>세부 계획<textarea className="routine-detail-input" maxLength={2000} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="세부 계획은 비워두어도 됩니다." /></label>
              {error && <p className="routine-error" role="alert">{error}</p>}
              <button type="submit" className="family-event-save" disabled={saving || !title.trim()}>{saving ? '저장 중...' : editing ? '수정 저장' : '루틴 추가'}</button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
