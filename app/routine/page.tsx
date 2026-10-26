'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import LoadingDots from '../../components/LoadingDots';
import { getActiveRoutine, getKoreanDate, getRoutineDayType, type RoutineDayType } from '../../lib/routineSchedule';

type RoutineItem = {
  id: string;
  start_time: string;
  end_time: string;
  title: string;
  details: string | null;
  day_type: RoutineDayType;
  routine_tab_id: string;
  created_at: string;
};

type RoutineTab = {
  id: string;
  title: string;
  day_type: RoutineDayType;
  sort_order: number;
};

function formatTime(value: string) { return value.slice(0, 5); }
function formatDuration(start: string, end: string) {
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  let minutes = endHour * 60 + endMinute - (startHour * 60 + startMinute);
  if (minutes < 0) minutes += 24 * 60;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return [hours > 0 ? `${hours}h` : '', remainingMinutes > 0 ? `${remainingMinutes}m` : '']
    .filter(Boolean)
    .join(' ') || '0m';
}
function formatTabTitle(value: string) {
  const characters = Array.from(value);
  return characters.length > 5 ? `${characters.slice(0, 5).join('')}…` : value;
}

export default function RoutinePage() {
  const [routines, setRoutines] = useState<RoutineItem[]>([]);
  const [tabs, setTabs] = useState<RoutineTab[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RoutineItem | null>(null);
  const [selectedTabId, setSelectedTabId] = useState('weekday');
  const [todayType, setTodayType] = useState<RoutineDayType>('weekday');
  const [clock, setClock] = useState(new Date());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [saving, setSaving] = useState(false);
  const [renamingTab, setRenamingTab] = useState<RoutineTab | null>(null);
  const [tabNameDraft, setTabNameDraft] = useState('');
  const [savingTabName, setSavingTabName] = useState(false);
  const [deletingTab, setDeletingTab] = useState(false);
  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);

  const loadRoutines = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/routine', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '생활루틴을 불러오지 못했습니다.');
      setRoutines(data.routines ?? []);
      setTabs(data.tabs ?? []);
      const detected = getRoutineDayType();
      const defaultTab = (data.tabs ?? []).find((tab: RoutineTab) => tab.day_type === detected);
      if (defaultTab) {
        setSelectedTabId(defaultTab.id);
      }
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '생활루틴을 불러오지 못했습니다.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const now = new Date();
    const detected = getRoutineDayType(now);
    setTodayType(detected);
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

  function startTabLongPress(tab: RoutineTab) {
    longPressFired.current = false;
    if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      setTabNameDraft(tab.title);
      setRenamingTab(tab);
    }, 650);
  }

  function cancelTabLongPress() {
    if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  }

  async function addRoutineTab() {
    if (tabs.length >= 3) return;
    setError('');
    try {
      const response = await fetch('/api/routine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'new-tab' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '루틴을 추가하지 못했습니다.');
      setTabs((current) => [...current, data.tab].sort((a, b) => a.sort_order - b.sort_order));
      setSelectedTabId(data.tab.id);
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : '루틴을 추가하지 못했습니다.');
    }
  }

  async function saveTabName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!renamingTab || !tabNameDraft.trim() || savingTabName) return;
    setSavingTabName(true);
    setError('');
    try {
      const response = await fetch('/api/routine', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'tab', id: renamingTab.id, title: tabNameDraft }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '루틴 이름을 변경하지 못했습니다.');
      setTabs((current) => current.map((tab) => tab.id === data.tab.id ? data.tab : tab));
      setRenamingTab(null);
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : '루틴 이름을 변경하지 못했습니다.');
    } finally {
      setSavingTabName(false);
    }
  }

  async function deleteRoutineTab() {
    if (!renamingTab || deletingTab) return;
    if (!window.confirm(`“${renamingTab.title}” 루틴과 그 안의 일정을 모두 삭제할까요?`)) return;
    setDeletingTab(true);
    setError('');
    try {
      const response = await fetch(`/api/routine?type=tab&id=${encodeURIComponent(renamingTab.id)}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '루틴을 삭제하지 못했습니다.');
      const remainingTabs = tabs.filter((tab) => tab.id !== renamingTab.id);
      setTabs(remainingTabs);
      setRoutines((current) => current.filter((routine) => routine.routine_tab_id !== renamingTab.id));
      if (selectedTabId === renamingTab.id) {
        const fallback = remainingTabs.find((tab) => tab.id === todayType) ?? remainingTabs[0];
        setSelectedTabId(fallback?.id ?? '');
      }
      setRenamingTab(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '루틴을 삭제하지 못했습니다.');
    } finally {
      setDeletingTab(false);
    }
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
        body: JSON.stringify({ id: editing?.id, startTime, endTime, title, details, routineTabId: selectedTabId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '생활루틴을 저장하지 못했습니다.');
      setRoutines((current) => {
        const updated = editing ? current.map((item) => item.id === editing.id ? data.routine : item) : [...current, data.routine];
        return updated.sort((a, b) => a.routine_tab_id.localeCompare(b.routine_tab_id) || a.start_time.localeCompare(b.start_time) || a.created_at.localeCompare(b.created_at));
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

  const selectedTab = tabs.find((tab) => tab.id === selectedTabId) ?? null;
  const visibleRoutines = routines.filter((item) => item.routine_tab_id === selectedTabId);
  const todayLabel = getKoreanDate(clock);
  const activeRoutine = selectedTab ? getActiveRoutine(visibleRoutines, clock, selectedTab.day_type) : null;

  if (loading) return <main className="loading-screen"><LoadingDots /></main>;

  return (
    <main className="app">
      <section className="container stock-container routine-container">
        <header className="stock-header">
          <div><p className="eyebrow brand-eyebrow">Master 3.0</p><h1>생활루틴</h1></div>
          <div className="routine-header-actions">
            <Link href="/" className="logout-button">처음으로</Link>
          </div>
        </header>

        <div className="routine-day-switch" role="group" aria-label="루틴 종류 선택">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`routine-tab-button${selectedTabId === tab.id ? ' is-selected' : ''}`}
              title={`${tab.title} (길게 눌러 이름 변경)`}
              aria-label={`${tab.title}, 길게 눌러 이름 변경`}
              onPointerDown={() => startTabLongPress(tab)}
              onPointerUp={cancelTabLongPress}
              onPointerLeave={cancelTabLongPress}
              onPointerCancel={cancelTabLongPress}
              onContextMenu={(event) => event.preventDefault()}
              onClick={() => {
                if (longPressFired.current) { longPressFired.current = false; return; }
                setSelectedTabId(tab.id);
              }}
            >
              {formatTabTitle(tab.title)}
            </button>
          ))}
          {tabs.length < 3 && <button type="button" className="routine-tab-add" onClick={() => void addRoutineTab()} aria-label="루틴 추가" title="루틴 추가">+</button>}
          <span className="routine-today-type">오늘 {todayLabel.slice(5).replace('-', '.')} · {todayType === 'weekday' ? '평일' : '휴일'}</span>
        </div>

        {activeRoutine && <p className="routine-now">지금은 <strong>{activeRoutine.title}</strong> 시간입니다.</p>}
        {error && !showForm && <p className="routine-error" role="alert">{error}</p>}
        <section className="routine-list" aria-label={`${selectedTab?.title ?? '생활'} 목록`}>
          {loading ? <div className="loading-inline"><LoadingDots /></div> : visibleRoutines.length === 0 ? (
            <div className="routine-empty-state"><h2>{selectedTab?.title ?? '생활루틴'}의 리듬을 만들어 보세요</h2><p>상단 + 버튼으로 일정을 추가할 수 있습니다.</p></div>
          ) : visibleRoutines.map((routine) => {
            const start = formatTime(routine.start_time);
            const end = formatTime(routine.end_time);
            return (
              <article className={`routine-item${activeRoutine?.id === routine.id ? ' is-current' : ''}`} key={routine.id}>
                <div className="routine-time"><div className="routine-time-range"><span>{start}</span><i aria-hidden="true" /><span>{end}</span></div><span className="routine-duration">({formatDuration(start, end)})</span></div>
                <div className="routine-description">{activeRoutine?.id === routine.id && <span className="routine-current-badge">진행 중</span>}<h2><span className="routine-title-text">{routine.title}</span></h2>{routine.details && <p>{routine.details}</p>}</div>
                <div className="routine-item-actions">
                  <button type="button" className="routine-edit-button" onClick={() => openForm(routine)} aria-label={`${routine.title} 수정`}>수정</button>
                  <button type="button" className="routine-delete-button" onClick={() => void deleteRoutine(routine)} aria-label={`${routine.title} 삭제`}>삭제</button>
                </div>
              </article>
            );
          })}
          <button type="button" className="routine-add-button" onClick={() => openForm()} aria-label="생활루틴 추가" title="생활루틴 추가">+</button>
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

      {renamingTab && (
        <div className="family-event-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setRenamingTab(null); }}>
          <section className="family-event-modal routine-rename-modal" role="dialog" aria-modal="true" aria-labelledby="routine-tab-name-title">
            <div className="family-event-modal-heading"><div><p className="eyebrow">RENAME ROUTINE</p><h2 id="routine-tab-name-title">이름 변경하기</h2></div><button type="button" onClick={() => setRenamingTab(null)} aria-label="닫기">×</button></div>
            <form className="family-event-form" onSubmit={(event) => void saveTabName(event)}>
              <label>루틴 이름<input autoFocus maxLength={30} value={tabNameDraft} onChange={(event) => setTabNameDraft(event.target.value)} placeholder="최대 30자" required /></label>
              {error && <p className="routine-error" role="alert">{error}</p>}
              <div className="routine-tab-dialog-actions">
                <button type="button" className="routine-tab-delete" onClick={() => void deleteRoutineTab()} disabled={deletingTab}>{deletingTab ? '삭제 중...' : '루틴 삭제'}</button>
                <button type="submit" className="family-event-save" disabled={savingTabName || !tabNameDraft.trim()}>{savingTabName ? '저장 중...' : '이름 저장'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
