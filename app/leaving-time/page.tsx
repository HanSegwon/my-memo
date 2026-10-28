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
  return `${period} ${twelveHour}시 ${date.getMinutes()}분 퇴근`;
}

function formatCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}시간 ${String(minutes).padStart(2, '0')}분 ${String(seconds).padStart(2, '0')}초 남음`;
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
    const adjustedWorkMinutes = Math.max(0, targetWorkMinutes - statutoryBreakMinutes - manualExclusionMinutes);
    date.setMinutes(hours * 60 + minutes + adjustedWorkMinutes, 0, 0);
    return date;
  }, [now, plan.startTime, targetWorkMinutes, statutoryBreakMinutes, manualExclusionMinutes]);

  const remainingMs = leavingAt ? leavingAt.getTime() - now.getTime() : null;

  function updatePlan<K extends keyof Plan>(key: K, value: Plan[K]) {
    setPlan((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  function updateExclusion(id: string, patch: Partial<Omit<Exclusion, 'id'>>) {
    setPlan((current) => ({ ...current, exclusions: current.exclusions.map((item) => item.id === id ? { ...item, ...patch } : item) }));
    setDirty(true);
  }

  function addExclusion() {
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    setPlan((current) => ({ ...current, exclusions: [...current.exclusions, { id, title: '', hours: '00', minutes: '00' }] }));
    setDirty(true);
  }

  function resetDay() {
    setPlan((current) => ({ ...current, startTime: '', exclusions: [] }));
    setDirty(true);
    setConfirmReset(false);
  }

  if (!loaded) return <main className="loading-screen"><LoadingDots /></main>;
  if (error && saveStatus === 'idle') return <main className="app"><section className="container"><div className="feature-placeholder"><h2>퇴근시간 설정을 불러오지 못했습니다.</h2><p role="alert">{error}</p><Link href="/" className="back-link">처음으로</Link></div></section></main>;
  if (!authenticated) return <main className="app"><section className="container"><div className="feature-placeholder"><h2>접근할 수 없습니다.</h2><p>먼저 Passcode를 입력해주세요.</p><Link href="/" className="back-link">처음으로</Link></div></section></main>;

  return (
    <main className="app">
      <section className="container leaving-time-container">
        <header className="header leaving-time-header">
          <div><p className="eyebrow brand-eyebrow">Master 3.0</p><h1>퇴근시간</h1></div>
          <Link href="/" className="logout-button">처음으로</Link>
        </header>

        <section className="leaving-time-main" aria-live="polite">
          <p className="leaving-time-label">오늘 퇴근시간</p>
          {remainingMs !== null && remainingMs <= 0
            ? null
            : <p className="leaving-time-countdown">{formatCountdown(remainingMs ?? 0)}</p>}
          {remainingMs !== null && remainingMs <= 0
            ? <strong className="leaving-time-clock is-ready">지금 퇴근하세요.</strong>
            : leavingAt
              ? <strong className="leaving-time-clock">{formatClock(leavingAt)}</strong>
              : <strong className="leaving-time-clock is-empty">출근시간을 입력해주세요</strong>}
        </section>

        <section className="leaving-time-section" aria-label="출근시간 입력">
          <div className="leaving-time-section-heading"><div><p className="eyebrow">START TIME</p><h2>출근시간</h2></div></div>
          <div className="leaving-time-start-row">
            <span>출근시각</span>
            <AppTimePicker label="출근시각" value={plan.startTime} onChange={(value) => updatePlan('startTime', value)} twelveHour />
          </div>
        </section>

        <section className="leaving-time-section" aria-label="제외시간 입력">
          <div className="leaving-time-section-heading">
            <div><p className="eyebrow">EXCLUDED TIME</p><h2>제외시간</h2></div>
            <button type="button" className="leaving-time-add" onClick={addExclusion} aria-label="제외시간 추가" title="제외시간 추가">+</button>
          </div>
          {statutoryBreakMinutes > 0 && <div className="leaving-time-exclusion-row is-automatic">
            <div className="leaving-time-exclusion-title"><span>법정근로시간</span><small>출근 후 4시간 30분 / 8시간 30분 경과 시 자동 적용</small></div>
            <strong>{formatDuration(String(Math.floor(statutoryBreakMinutes / 60)), String(statutoryBreakMinutes % 60))}</strong>
          </div>}
          {plan.exclusions.map((item, index) => <div className="leaving-time-exclusion-row" key={item.id}>
            <label className="leaving-time-exclusion-title"><span className="sr-only">제외시간 {index + 1} 항목</span><input maxLength={40} value={item.title} onChange={(event) => updateExclusion(item.id, { title: event.target.value })} placeholder="항목" /></label>
            <div className="leaving-time-duration-inputs">
              <label><span className="sr-only">시간</span><input type="text" inputMode="numeric" maxLength={2} value={item.hours} onChange={(event) => updateExclusion(item.id, { hours: event.target.value.replace(/\D/g, '').slice(0, 2) })} onBlur={() => updateExclusion(item.id, { hours: String(numberValue(item.hours)).padStart(2, '0') })} aria-label="제외시간 시" /><small>시간</small></label>
              <label><span className="sr-only">분</span><input type="text" inputMode="numeric" maxLength={2} value={item.minutes} onChange={(event) => updateExclusion(item.id, { minutes: event.target.value.replace(/\D/g, '').slice(0, 2) })} onBlur={() => updateExclusion(item.id, { minutes: String(Math.min(59, numberValue(item.minutes))).padStart(2, '0') })} aria-label="제외시간 분" /><small>분</small></label>
            </div>
            <button type="button" className="leaving-time-remove" onClick={() => { setPlan((current) => ({ ...current, exclusions: current.exclusions.filter((entry) => entry.id !== item.id) })); setDirty(true); }} aria-label={`${item.title || `제외시간 ${index + 1}`} 삭제`}>×</button>
          </div>)}
          {statutoryBreakMinutes === 0 && plan.exclusions.length === 0 && <p className="leaving-time-hint">필요한 제외시간이 있으면 + 버튼으로 추가하세요.</p>}
        </section>

        <section className="leaving-time-section leaving-time-goal-section" aria-label="목표 근무시간 입력">
          <div className="leaving-time-section-heading"><div><p className="eyebrow">TARGET WORK TIME</p><h2>목표 근무시간</h2></div></div>
          <div className="leaving-time-goal-inputs">
            <label><span className="sr-only">목표 근무시간 시</span><input type="text" inputMode="numeric" maxLength={2} value={plan.goalHours} onChange={(event) => updatePlan('goalHours', event.target.value.replace(/\D/g, '').slice(0, 2))} onBlur={() => updatePlan('goalHours', String(numberValue(plan.goalHours)).padStart(2, '0'))} aria-label="목표 근무시간 시" /><small>시간</small></label>
            <span className="leaving-time-goal-colon">:</span>
            <label><span className="sr-only">목표 근무시간 분</span><input type="text" inputMode="numeric" maxLength={2} value={plan.goalMinutes} onChange={(event) => updatePlan('goalMinutes', event.target.value.replace(/\D/g, '').slice(0, 2))} onBlur={() => updatePlan('goalMinutes', String(Math.min(59, numberValue(plan.goalMinutes))).padStart(2, '0'))} aria-label="목표 근무시간 분" /><small>분</small></label>
          </div>
          <p className="leaving-time-hint">출근 후 4시간 30분이 지나면 30분, 8시간 30분이 지나면 총 60분이 자동으로 제외됩니다.</p>
        </section>

        <p className="leaving-time-save-status" role="status" aria-live="polite">
          {saveStatus === 'saving' ? 'Supabase에 저장 중...' : saveStatus === 'saved' ? 'Supabase에 저장됨' : ''}
        </p>
        {saveStatus === 'error' && <p className="family-event-error" role="alert">{error}</p>}
        <button type="button" className="leaving-time-reset" onClick={() => setConfirmReset(true)}>오늘 입력 초기화</button>
      </section>
      <ConfirmDialog
        open={confirmReset}
        title="오늘 입력을 초기화할까요?"
        description="출근시간과 제외시간이 삭제됩니다. 목표 근무시간은 유지됩니다."
        confirmLabel="초기화"
        onCancel={() => setConfirmReset(false)}
        onConfirm={resetDay}
      />
    </main>
  );
}
