'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import LoadingDots from '../../components/LoadingDots';

type ChildName = '한유준' | '한이준';
type Schedule = { id: string; child_name: ChildName; weekday: number; title: string; start_time: string; end_time: string };
type Draft = { weekday: number; title: string; startTime: string; endTime: string };

const CHILDREN: ChildName[] = ['한유준', '한이준'];
const WEEKDAYS = ['월', '화', '수', '목', '금'];
const GRID_START_MINUTES = 9 * 60;
const GRID_END_MINUTES = 20 * 60;
const SLOT_HEIGHT = 6.5;
const GRID_TOP_PADDING = 12;
const timeOptions = Array.from({ length: (GRID_END_MINUTES - GRID_START_MINUTES) / 10 + 1 }, (_, index) => {
  const minutes = GRID_START_MINUTES + index * 10;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});

function minutesOf(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatTime(value: string) { return value.slice(0, 5); }

export default function ChildrenAcademyPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [child, setChild] = useState<ChildName>('한유준');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [draft, setDraft] = useState<Draft>({ weekday: 1, title: '', startTime: '15:00', endTime: '16:00' });
  const [saving, setSaving] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  const loadSchedules = useCallback(async () => {
    const response = await fetch('/api/children-academy', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || '시간표를 불러오지 못했습니다.');
    setSchedules(data.schedules ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const authResponse = await fetch('/api/auth', { cache: 'no-store' });
        const authData = await authResponse.json();
        if (cancelled) return;
        setAuthenticated(Boolean(authData.authenticated));
        if (authData.authenticated) await loadSchedules();
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : '시간표를 불러오지 못했습니다.');
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [loadSchedules]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const childSchedules = useMemo(() => schedules.filter((item) => item.child_name === child), [schedules, child]);
  const hours = useMemo(() => Array.from({ length: 12 }, (_, index) => 9 + index), []);
  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  const todayWeekday = currentTime.getDay();
  const currentTimeTop = GRID_TOP_PADDING + ((currentMinutes - GRID_START_MINUTES) / 10) * SLOT_HEIGHT;

  function openForm(schedule?: Schedule) {
    setError('');
    setEditing(schedule ?? null);
    setDraft(schedule ? {
      weekday: schedule.weekday,
      title: schedule.title,
      startTime: formatTime(schedule.start_time),
      endTime: formatTime(schedule.end_time),
    } : { weekday: 1, title: '', startTime: '15:00', endTime: '16:00' });
    setShowForm(true);
  }

  function changeStartTime(startTime: string) {
    setDraft((current) => ({
      ...current,
      startTime,
      endTime: minutesOf(current.endTime) <= minutesOf(startTime)
        ? timeOptions.find((time) => minutesOf(time) > minutesOf(startTime)) ?? '20:00'
        : current.endTime,
    }));
  }

  async function saveSchedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/children-academy', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing?.id, childName: child, ...draft }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '일정을 저장하지 못했습니다.');
      setSchedules((current) => [...current.filter((item) => item.id !== data.schedule.id), data.schedule]);
      setShowForm(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '일정을 저장하지 못했습니다.');
    } finally { setSaving(false); }
  }

  async function deleteSchedule() {
    if (!editing || saving || !window.confirm('이 일정을 삭제할까요?')) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/children-academy?id=${encodeURIComponent(editing.id)}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '일정을 삭제하지 못했습니다.');
      setSchedules((current) => current.filter((item) => item.id !== editing.id));
      setShowForm(false);
      setError('');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '일정을 삭제하지 못했습니다.');
    } finally { setSaving(false); }
  }

  if (loading || authenticated === null) return <main className="loading-screen"><LoadingDots /></main>;
  if (!authenticated) return <main className="app"><section className="container"><div className="feature-placeholder"><h2>접근할 수 없습니다.</h2><p>먼저 Passcode를 입력해주세요.</p><Link href="/" className="back-link">처음으로</Link></div></section></main>;

  return <main className="app">
    <section className="container children-academy-container">
      <header className="header">
        <div><p className="eyebrow brand-eyebrow">Master 3.0</p><h1>자녀학원</h1></div>
        <div className="routine-header-actions">
          <button type="button" className="routine-add-button" onClick={() => openForm()} aria-label="일정 추가" title="일정 추가">+</button>
          <Link href="/" className="logout-button">처음으로</Link>
        </div>
      </header>

      {error && !showForm && <p className="routine-error" role="alert">{error}</p>}
      <div className="children-timetable-toolbar">
        <div className="routine-day-switch children-select" role="group" aria-label="자녀 선택">
          {CHILDREN.map((name) => <button type="button" key={name} className={child === name ? 'is-selected' : ''} aria-pressed={child === name} onClick={() => setChild(name)}>{name}</button>)}
        </div>
      </div>

      <section className="children-timetable-scroll" aria-label={`${child} 주간 시간표`}>
        <div className="children-timetable">
          <div className="children-timetable-heading"><span aria-hidden="true" />{WEEKDAYS.map((day, index) => <span key={day}><span className={todayWeekday === index + 1 ? 'children-today-label' : undefined}>{day}</span></span>)}</div>
          <div className="children-timetable-body">
            <div className="children-time-axis" aria-hidden="true">
              {hours.map((hour) => <span className="children-hour-label" key={hour} style={{ top: `${GRID_TOP_PADDING + (hour - 9) * 6 * SLOT_HEIGHT}px` }}>{String(hour).padStart(2, '0')}:00</span>)}
            </div>
            {currentMinutes >= GRID_START_MINUTES && currentMinutes <= GRID_END_MINUTES && <div className="children-current-time-line" style={{ top: currentTimeTop }} aria-hidden="true" />}
            {WEEKDAYS.map((day, index) => {
              const weekday = index + 1;
              const daySchedules = childSchedules.filter((item) => item.weekday === weekday);
              return <div className="children-day-column" key={day}>
                <div className="children-slot-lines" aria-hidden="true">{Array.from({ length: 66 }, (_, slot) => <i key={slot} className={(slot + 1) % 6 === 0 ? 'is-hour' : ''} />)}</div>
                {daySchedules.map((schedule) => {
                  const top = GRID_TOP_PADDING + ((minutesOf(formatTime(schedule.start_time)) - GRID_START_MINUTES) / 10) * SLOT_HEIGHT;
                  const height = ((minutesOf(formatTime(schedule.end_time)) - minutesOf(formatTime(schedule.start_time))) / 10) * SLOT_HEIGHT;
                  return <button type="button" className="children-schedule-block" key={schedule.id} style={{ top, height: Math.max(height, SLOT_HEIGHT) }} onClick={() => openForm(schedule)} aria-label={`${schedule.title}, ${formatTime(schedule.start_time)}부터 ${formatTime(schedule.end_time)}까지, 수정`}>
                    <strong>{schedule.title}</strong>{height >= SLOT_HEIGHT * 6 && <span>{formatTime(schedule.start_time)}–{formatTime(schedule.end_time)}</span>}
                  </button>;
                })}
              </div>;
            })}
          </div>
        </div>
      </section>
      {childSchedules.length === 0 && <p className="children-timetable-empty">아직 등록된 일정이 없습니다. + 버튼으로 일정을 추가해보세요.</p>}
    </section>

    {showForm && <div className="family-event-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setShowForm(false); }}>
      <section className="family-event-modal" role="dialog" aria-modal="true" aria-labelledby="children-schedule-title">
        <div className="family-event-modal-heading"><div><p className="eyebrow">{editing ? 'EDIT SCHEDULE' : 'NEW SCHEDULE'}</p><h2 id="children-schedule-title">{child} 일정 {editing ? '수정' : '추가'}</h2></div><button type="button" onClick={() => setShowForm(false)} aria-label="닫기">×</button></div>
        <form className="family-event-form" onSubmit={(event) => void saveSchedule(event)}>
          <label>일정<input autoFocus maxLength={100} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="예: 수학 학원" required /></label>
          <label>요일<select value={draft.weekday} onChange={(event) => setDraft((current) => ({ ...current, weekday: Number(event.target.value) }))}>{WEEKDAYS.map((day, index) => <option value={index + 1} key={day}>{day}요일</option>)}</select></label>
          <div className="routine-time-fields children-time-fields">
            <label>시작 시간<select value={draft.startTime} onChange={(event) => changeStartTime(event.target.value)}>{timeOptions.slice(0, -1).map((time) => <option key={time} value={time}>{time}</option>)}</select></label>
            <label>종료 시간<select value={draft.endTime} onChange={(event) => setDraft((current) => ({ ...current, endTime: event.target.value }))}>{timeOptions.filter((time) => minutesOf(time) > minutesOf(draft.startTime)).map((time) => <option key={time} value={time}>{time}</option>)}</select></label>
          </div>
          {error && <p className="routine-error" role="alert">{error}</p>}
          {editing && <button type="button" className="routine-delete-button children-schedule-delete" onClick={() => void deleteSchedule()} disabled={saving}>일정 삭제</button>}
          <button type="submit" className="family-event-save" disabled={saving || !draft.title.trim()}>{saving ? '저장 중...' : editing ? '수정 완료' : '일정 등록'}</button>
        </form>
      </section>
    </div>}
  </main>;
}
