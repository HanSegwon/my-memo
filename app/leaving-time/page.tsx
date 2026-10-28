'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import LoadingDots from '../../components/LoadingDots';
import AppTimePicker from '../../components/AppTimePicker';
import ConfirmDialog from '../../components/ConfirmDialog';

type Exclusion = { id: string; title: string; hours: string; minutes: string };
type Plan = { startTime: string; goalHours: string; goalMinutes: string; exclusions: Exclusion[] };

const STORAGE_KEY = 'master-leaving-time-plan-v1';
const emptyPlan: Plan = { startTime: '', goalHours: '00', goalMinutes: '00', exclusions: [] };

function normalizePlan(value: unknown): Plan | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Partial<Plan>;
  const numericText = (input: unknown, max: number) => {
    const parsed = Number.parseInt(String(input ?? ''), 10);
    return String(Math.min(max, Math.max(0, Number.isFinite(parsed) ? parsed : 0))).padStart(2, '0');
  };
  const startTime = typeof source.startTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(source.startTime) ? source.startTime : '';
  const exclusions = Array.isArray(source.exclusions) ? source.exclusions.slice(0, 50).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const entry = item as Partial<Exclusion>;
    if (typeof entry.id !== 'string' || !entry.id) return [];
    return [{
      id: entry.id.slice(0, 80),
      title: typeof entry.title === 'string' ? entry.title.slice(0, 40) : '',
      hours: numericText(entry.hours, 99),
      minutes: numericText(entry.minutes, 59),
    }];
  }) : [];
  return {
    startTime,
    goalHours: numericText(source.goalHours, 99),
    goalMinutes: numericText(source.goalMinutes, 59),
    exclusions,
  };
}

function numberValue(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function formatClock(date: Date) {
  const hour = date.getHours();
  const twelveHour = hour % 12 || 12;
  const period = hour < 12 ? '오전' : '오후';
  return `${period} ${String(twelveHour).padStart(2, '0')}시 ${String(date.getMinutes()).padStart(2, '0')}분 퇴근`;
}

function formatCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatDuration(hours: string, minutes: string) {
  return `${String(numberValue(hours)).padStart(2, '0')}시간 ${String(numberValue(minutes)).padStart(2, '0')}분`;
}

export default function LeavingTimePage() {
  const [plan, setPlan] = useState<Plan>(emptyPlan);
  const [now, setNow] = useState(() => new Date());
  const [loaded, setLoaded] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [draftGoalHours, setDraftGoalHours] = useState('00');
  const [draftGoalMinutes, setDraftGoalMinutes] = useState('00');
  const [exclusionDialogOpen, setExclusionDialogOpen] = useState(false);
  const [editingExclusionId, setEditingExclusionId] = useState<string | null>(null);
  const [draftExclusionTitle, setDraftExclusionTitle] = useState('');
  const [draftExclusionHours, setDraftExclusionHours] = useState('00');
  const [draftExclusionMinutes, setDraftExclusionMinutes] = useState('00');
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const saveVersion = useRef(0);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/leaving-time', { cache: 'no-store' });
        if (response.status === 401) {
          setAuthenticated(false);
          return;
        }
        setAuthenticated(true);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || '퇴근시간 설정을 불러오지 못했습니다.');
        if (data.plan) {
          setPlan(normalizePlan(data.plan) ?? emptyPlan);
        } else {
          let legacyPlan: Plan | null = null;
          try {
            const saved = window.localStorage.getItem(STORAGE_KEY);
            if (saved) legacyPlan = normalizePlan(JSON.parse(saved));
          } catch {
            // 손상된 브라우저 저장값은 무시하고 DB 기본값으로 시작합니다.
          }
          setPlan(legacyPlan ?? normalizePlan(data.defaults) ?? emptyPlan);
          if (legacyPlan) setDirty(true);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : '퇴근시간 설정을 불러오지 못했습니다.');
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded || !authenticated || !dirty) return;
    const version = ++saveVersion.current;
    setSaveStatus('saving');
    setError('');
    const timeout = window.setTimeout(() => {
      const snapshot = plan;
      saveQueue.current = saveQueue.current.catch(() => undefined).then(async () => {
        const response = await fetch('/api/leaving-time', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(snapshot),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || '퇴근시간 설정을 저장하지 못했습니다.');
        if (version === saveVersion.current) {
          setDirty(false);
          setSaveStatus('saved');
          setError('');
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }).catch((saveError: unknown) => {
        if (version === saveVersion.current) {
          setSaveStatus('error');
          setError(saveError instanceof Error ? saveError.message : '퇴근시간 설정을 저장하지 못했습니다.');
        }
      });
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [authenticated, dirty, loaded, plan]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const targetWorkMinutes = numberValue(plan.goalHours) * 60 + numberValue(plan.goalMinutes);
  const startDate = plan.startTime ? (() => {
    const [hours, minutes] = plan.startTime.split(':').map(Number);
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
  })() : null;
  const elapsedMinutes = startDate ? Math.max(0, Math.floor((now.getTime() - startDate.getTime()) / 60_000)) : 0;
  const statutoryBreakMinutes = !plan.startTime ? 0 : elapsedMinutes >= 8 * 60 + 30 ? 60 : elapsedMinutes >= 4 * 60 + 30 ? 30 : 0;
  const manualExclusionMinutes = plan.exclusions.reduce((total, item) => total + numberValue(item.hours) * 60 + numberValue(item.minutes), 0);
  const leavingAt = useMemo(() => {
    if (!plan.startTime) return null;
    const [hours, minutes] = plan.startTime.split(':').map(Number);
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const adjustedWorkMinutes = targetWorkMinutes + statutoryBreakMinutes + manualExclusionMinutes;
    date.setMinutes(hours * 60 + minutes + adjustedWorkMinutes, 0, 0);
    return date;
  }, [now, plan.startTime, targetWorkMinutes, statutoryBreakMinutes, manualExclusionMinutes]);

  const remainingMs = leavingAt ? leavingAt.getTime() - now.getTime() : null;

  function updatePlan<K extends keyof Plan>(key: K, value: Plan[K]) {
    setPlan((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  function addExclusion() {
    setEditingExclusionId(null);
    setDraftExclusionTitle('');
    setDraftExclusionHours('00');
    setDraftExclusionMinutes('00');
    setExclusionDialogOpen(true);
  }

  function editExclusion(item: Exclusion) {
    setEditingExclusionId(item.id);
    setDraftExclusionTitle(item.title);
    setDraftExclusionHours(item.hours);
    setDraftExclusionMinutes(item.minutes);
    setExclusionDialogOpen(true);
  }

  function saveExclusion() {
    const item = {
      id: editingExclusionId || (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
      title: draftExclusionTitle.trim(),
      hours: String(Math.min(99, numberValue(draftExclusionHours))).padStart(2, '0'),
      minutes: String(Math.min(59, numberValue(draftExclusionMinutes))).padStart(2, '0'),
    };
    setPlan((current) => ({
      ...current,
      exclusions: editingExclusionId
        ? current.exclusions.map((entry) => entry.id === editingExclusionId ? item : entry)
        : [...current.exclusions, item],
    }));
    setDirty(true);
    setExclusionDialogOpen(false);
  }

  function resetDay() {
    setPlan((current) => ({ ...current, startTime: '', exclusions: [] }));
    setDirty(true);
    setConfirmReset(false);
  }

  function openGoalDialog() {
    setDraftGoalHours(plan.goalHours);
    setDraftGoalMinutes(plan.goalMinutes);
    setGoalDialogOpen(true);
  }

  function saveGoalDialog() {
    setPlan((current) => ({
      ...current,
      goalHours: String(Math.min(99, numberValue(draftGoalHours))).padStart(2, '0'),
      goalMinutes: String(Math.min(59, numberValue(draftGoalMinutes))).padStart(2, '0'),
    }));
    setDirty(true);
    setGoalDialogOpen(false);
  }

  if (!loaded) return <main className="loading-screen"><LoadingDots /></main>;
  if (error && saveStatus === 'idle') return <main className="app"><section className="container"><div className="feature-placeholder"><h2>퇴근시간 설정을 불러오지 못했습니다.</h2><p role="alert">{error}</p><Link href="/" className="back-link">처음으로</Link></div></section></main>;
  if (!authenticated) return <main className="app"><section className="container"><div className="feature-placeholder"><h2>접근할 수 없습니다.</h2><p>먼저 Passcode를 입력해주세요.</p><Link href="/" className="back-link">처음으로</Link></div></section></main>;

  return (
    <main className="app">
      <section className="container leaving-time-container">
        <header className="header leaving-time-header">
          <div><p className="eyebrow brand-eyebrow">Master 3.0</p><h1>퇴근시간</h1></div>
          <div className="leaving-time-header-actions">
            <button type="button" className="leaving-time-reset" onClick={() => setConfirmReset(true)}>초기화</button>
            <Link href="/" className="logout-button">처음으로</Link>
          </div>
        </header>

        <section className="leaving-time-main" aria-live="polite">
          <p className="leaving-time-label">End of work</p>
          {leavingAt
            ? <strong className="leaving-time-clock">{formatClock(leavingAt)}</strong>
            : <strong className="leaving-time-clock is-empty">출근시각을 입력해주세요</strong>}
          <p className="leaving-time-countdown">{formatCountdown(remainingMs ?? 0)}</p>
        </section>

        <section className="leaving-time-top-settings" aria-label="근무시간 설정">
          <div className="leaving-time-top-setting">
            <h2>출근시각</h2>
            <AppTimePicker label="출근시각" value={plan.startTime} onChange={(value) => updatePlan('startTime', value)} twelveHour textTrigger />
          </div>
          <div className="leaving-time-top-setting leaving-time-top-goal">
            <h2>목표 근무시간</h2>
            <button type="button" className="leaving-time-number-trigger leaving-time-goal-trigger" onClick={openGoalDialog} aria-haspopup="dialog">{plan.goalHours}시간 {plan.goalMinutes}분</button>
          </div>
        </section>

        <section className="leaving-time-section" aria-label="제외시간 입력">
          <div className="leaving-time-section-heading"><h2>제외시간</h2></div>
          {statutoryBreakMinutes > 0 && <div className="leaving-time-exclusion-row is-automatic">
            <div className="leaving-time-exclusion-title"><span>법정휴게시간</span></div>
            <strong>{formatDuration(String(Math.floor(statutoryBreakMinutes / 60)), String(statutoryBreakMinutes % 60))}</strong>
            <span className="leaving-time-exclusion-spacer" aria-hidden="true" />
          </div>}
          {plan.exclusions.map((item, index) => <div className="leaving-time-exclusion-row" key={item.id}>
            <button type="button" className="leaving-time-exclusion-edit" onClick={() => editExclusion(item)} aria-label={`${item.title || `제외시간 ${index + 1}`} 수정`}>
              <span>{item.title || '항목'}</span><strong>{formatDuration(item.hours, item.minutes)}</strong>
            </button>
            <button type="button" className="leaving-time-remove" onClick={() => { setPlan((current) => ({ ...current, exclusions: current.exclusions.filter((entry) => entry.id !== item.id) })); setDirty(true); }} aria-label={`${item.title || `제외시간 ${index + 1}`} 삭제`}>×</button>
          </div>)}
          <div className="leaving-time-exclusion-add-row">
            <button type="button" className="leaving-time-add routine-add-button" onClick={addExclusion} aria-label="제외시간 추가" title="제외시간 추가">+</button>
          </div>
        </section>

        {saveStatus === 'error' && <p className="family-event-error" role="alert">{error}</p>}
      </section>
      <ConfirmDialog
        open={confirmReset}
        title="오늘 입력을 초기화할까요?"
        description="출근시간과 제외시간이 삭제됩니다. 목표 근무시간은 유지됩니다."
        confirmLabel="초기화"
        onCancel={() => setConfirmReset(false)}
        onConfirm={resetDay}
      />
      {goalDialogOpen && <div className="modal-backdrop leaving-time-goal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setGoalDialogOpen(false); }}>
        <section className="settings-modal app-picker-dialog leaving-time-goal-dialog" role="dialog" aria-modal="true" aria-labelledby="leaving-goal-title">
          <div className="app-picker-heading"><div><p className="eyebrow">WORK TIME</p><h2 id="leaving-goal-title">목표 근무시간</h2></div><button type="button" className="app-picker-close" onClick={() => setGoalDialogOpen(false)} aria-label="닫기">×</button></div>
          <div className="leaving-time-goal-dialog-fields">
            <label><input type="text" inputMode="numeric" maxLength={2} aria-label="시간" value={draftGoalHours} onChange={(event) => setDraftGoalHours(event.target.value.replace(/\D/g, '').slice(0, 2))} /><span>시간</span></label>
            <label><input type="text" inputMode="numeric" maxLength={2} aria-label="분" value={draftGoalMinutes} onChange={(event) => setDraftGoalMinutes(event.target.value.replace(/\D/g, '').slice(0, 2))} /><span>분</span></label>
          </div>
          <button type="button" className="app-picker-apply" onClick={saveGoalDialog}>적용</button>
        </section>
      </div>}
      {exclusionDialogOpen && <div className="modal-backdrop leaving-time-goal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setExclusionDialogOpen(false); }}>
        <section className="settings-modal app-picker-dialog leaving-time-goal-dialog" role="dialog" aria-modal="true" aria-labelledby="leaving-exclusion-title">
          <div className="app-picker-heading"><div><p className="eyebrow">EXCLUDED TIME</p><h2 id="leaving-exclusion-title">제외시간 {editingExclusionId ? '수정' : '추가'}</h2></div><button type="button" className="app-picker-close" onClick={() => setExclusionDialogOpen(false)} aria-label="닫기">×</button></div>
          <label className="leaving-time-exclusion-dialog-title">항목<input autoFocus maxLength={40} value={draftExclusionTitle} onChange={(event) => setDraftExclusionTitle(event.target.value)} placeholder="예: 흡연, 식사" /></label>
          <div className="leaving-time-goal-dialog-fields">
            <label><input type="text" inputMode="numeric" maxLength={2} aria-label="시간" value={draftExclusionHours} onChange={(event) => setDraftExclusionHours(event.target.value.replace(/\D/g, '').slice(0, 2))} /><span>시간</span></label>
            <label><input type="text" inputMode="numeric" maxLength={2} aria-label="분" value={draftExclusionMinutes} onChange={(event) => setDraftExclusionMinutes(event.target.value.replace(/\D/g, '').slice(0, 2))} /><span>분</span></label>
          </div>
          <button type="button" className="app-picker-apply" onClick={saveExclusion}>{editingExclusionId ? '변경사항 저장' : '추가'}</button>
        </section>
      </div>}
    </main>
  );
}
