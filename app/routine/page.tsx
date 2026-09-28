'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type RoutineItem = {
  id: string;
  start_time: string;
  end_time: string;
  title: string;
  details: string | null;
  created_at: string;
};

function formatTime(value: string) {
  return value.slice(0, 5);
}

export default function RoutinePage() {
  const [routines, setRoutines] = useState<RoutineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadRoutines(); }, [loadRoutines]);

  function openForm() {
    setStartTime('09:00');
    setEndTime('10:00');
    setTitle('');
    setDetails('');
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startTime, endTime, title, details }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '생활루틴을 저장하지 못했습니다.');
      setRoutines((current) => [...current, data.routine].sort((a, b) =>
        a.start_time.localeCompare(b.start_time) || a.created_at.localeCompare(b.created_at)
      ));
      setShowForm(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '생활루틴을 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteRoutine(routine: RoutineItem) {
    if (!window.confirm(`“${routine.title}” 생활루틴을 삭제할까요?`)) return;
    const response = await fetch(`/api/routine?id=${encodeURIComponent(routine.id)}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) {
      setError(data.message || '생활루틴을 삭제하지 못했습니다.');
      return;
    }
    setRoutines((current) => current.filter((item) => item.id !== routine.id));
  }

  return (
    <main className="app">
      <section className="container stock-container routine-container">
        <header className="stock-header">
          <div>
            <p className="eyebrow brand-eyebrow">Master 3.0</p>
            <h1>생활루틴</h1>
          </div>
          <div className="routine-header-actions">
            <button type="button" className="routine-add-button" onClick={openForm} aria-label="생활루틴 추가" title="생활루틴 추가">+</button>
            <Link href="/" className="logout-button">처음으로</Link>
          </div>
        </header>

        {error && !showForm && <p className="routine-error" role="alert">{error}</p>}
        <section className="routine-list" aria-label="생활루틴 목록">
          {loading ? <p className="routine-empty">생활루틴을 불러오는 중입니다.</p> : routines.length === 0 ? (
            <div className="routine-empty-state">
              <h2>하루의 리듬을 만들어 보세요</h2>
              <p>+ 버튼을 눌러 첫 생활루틴을 추가할 수 있습니다.</p>
            </div>
          ) : routines.map((routine) => (
            <article className="routine-item" key={routine.id}>
              <div className="routine-time">
                <span>{formatTime(routine.start_time)}</span>
                <i aria-hidden="true" />
                <span>{formatTime(routine.end_time)}</span>
              </div>
              <div className="routine-description">
                <h2>{routine.title}</h2>
                {routine.details && <p>{routine.details}</p>}
              </div>
              <button type="button" className="routine-delete-button" onClick={() => void deleteRoutine(routine)} aria-label={`${routine.title} 삭제`}>삭제</button>
            </article>
          ))}
        </section>
      </section>

      {showForm && (
        <div className="family-event-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}>
          <section className="family-event-modal" role="dialog" aria-modal="true" aria-labelledby="routine-form-title">
            <div className="family-event-modal-heading">
              <div><p className="eyebrow">NEW ROUTINE</p><h2 id="routine-form-title">생활루틴 추가</h2></div>
              <button type="button" onClick={() => setShowForm(false)} aria-label="닫기">×</button>
            </div>
            <form className="family-event-form routine-form" onSubmit={saveRoutine}>
              <div className="routine-time-fields">
                <label>시작 시간<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required /></label>
                <label>종료 시간<input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required /></label>
              </div>
              <label>제목<input maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="예: 아침 운동" required /></label>
              <label>세부 계획<textarea className="routine-detail-input" maxLength={2000} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="세부 계획은 비워두어도 됩니다." /></label>
              {error && <p className="routine-error" role="alert">{error}</p>}
              <button type="submit" className="family-event-save" disabled={saving || !title.trim()}>{saving ? '저장 중...' : '루틴 추가'}</button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
