'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import LoadingDots from '../../components/LoadingDots';
import AppTimePicker from '../../components/AppTimePicker';
import ConfirmDialog from '../../components/ConfirmDialog';

type Exclusion = { id: string; title: string; hours: string; minutes: string };
type Plan = { startTime: string; goalHours: string; goalMinutes: string; exclusions: Exclusion[] };

const STORAGE_KEY = 'master-leaving-time-plan-v1';
const emptyPlan: Plan = { startTime: '', goalHours: '00', goalMinutes: '00', exclusions: [] };

function numberValue(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function formatClock(date: Date) {
  const hour = date.getHours();
  const twelveHour = hour % 12 || 12;
  const period = hour < 12 ? '오전' : '오후';
  return `${period} ${String(twelveHour).padStart(2, '0')}시${String(date.getMinutes()).padStart(2, '0')}분${String(date.getSeconds()).padStart(2, '0')}초`;
}

function formatCountdown(milliseconds: number) {
  const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}시간 ${minutes}분 남았어요.`;
}

function formatDuration(hours: string, minutes: string) {
  return `${String(numberValue(hours)).padStart(2, '0')}시간 ${String(numberValue(minutes)).padStart(2, '0')}분`;
}

export default function LeavingTimePage() {
  const [plan, setPlan] = useState<Plan>(emptyPlan);
  const [now, setNow] = useState(() => new Date());
  const [loaded, setLoaded] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<Plan>;
        setPlan({
          ...emptyPlan,
          ...parsed,
          exclusions: Array.isArray(parsed.exclusions) ? parsed.exclusions : [],
        });
      }
    } catch {
      // 손상된 저장값이 있어도 기본 입력으로 페이지를 사용할 수 있습니다.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  }, [loaded, plan]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const targetWorkMinutes = numberValue(plan.goalHours) * 60 + numberValue(plan.goalMinutes);
  const statutoryBreakMinutes = !plan.startTime ? 0 : targetWorkMinutes >= 8 * 60 + 30 ? 60 : targetWorkMinutes >= 4 * 60 + 30 ? 30 : 0;
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
  }

  function updateExclusion(id: string, patch: Partial<Omit<Exclusion, 'id'>>) {
    setPlan((current) => ({ ...current, exclusions: current.exclusions.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  }

  function addExclusion() {
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    setPlan((current) => ({ ...current, exclusions: [...current.exclusions, { id, title: '', hours: '00', minutes: '00' }] }));
  }

  function resetDay() {
    setPlan((current) => ({ ...current, startTime: '', exclusions: [] }));
    setConfirmReset(false);
  }

  if (!loaded) return <main className="loading-screen"><LoadingDots /></main>;

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
            ? <strong className="leaving-time-clock is-ready">지금 퇴근하세요.</strong>
            : leavingAt
              ? <strong className="leaving-time-clock">{formatClock(leavingAt)}</strong>
              : <strong className="leaving-time-clock is-empty">출근시간을 입력해주세요</strong>}
          {remainingMs !== null && remainingMs > 0 && <p className="leaving-time-countdown">{formatCountdown(remainingMs)}</p>}
        </section>

        <section className="leaving-time-section" aria-label="출근시간 입력">
          <div className="leaving-time-section-heading"><div><p className="eyebrow">START TIME</p><h2>출근시간</h2></div></div>
          <div className="leaving-time-start-row">
            <span>출근시각</span>
            <AppTimePicker label="출근시각" value={plan.startTime} onChange={(value) => updatePlan('startTime', value)} />
          </div>
        </section>

        <section className="leaving-time-section" aria-label="제외시간 입력">
          <div className="leaving-time-section-heading">
            <div><p className="eyebrow">EXCLUDED TIME</p><h2>제외시간</h2></div>
            <button type="button" className="leaving-time-add" onClick={addExclusion} aria-label="제외시간 추가" title="제외시간 추가">+</button>
          </div>
          {statutoryBreakMinutes > 0 && <div className="leaving-time-exclusion-row is-automatic">
            <div className="leaving-time-exclusion-title"><span>법정 휴게시간</span><small>목표 근무시간 기준 자동 적용</small></div>
            <strong>{formatDuration(String(Math.floor(statutoryBreakMinutes / 60)), String(statutoryBreakMinutes % 60))}</strong>
          </div>}
          {plan.exclusions.map((item, index) => <div className="leaving-time-exclusion-row" key={item.id}>
            <label className="leaving-time-exclusion-title"><span className="sr-only">제외시간 {index + 1} 항목</span><input maxLength={40} value={item.title} onChange={(event) => updateExclusion(item.id, { title: event.target.value })} placeholder="항목" /></label>
            <div className="leaving-time-duration-inputs">
              <label><span className="sr-only">시간</span><input type="text" inputMode="numeric" maxLength={2} value={item.hours} onChange={(event) => updateExclusion(item.id, { hours: event.target.value.replace(/\D/g, '').slice(0, 2) })} onBlur={() => updateExclusion(item.id, { hours: String(numberValue(item.hours)).padStart(2, '0') })} aria-label="제외시간 시" /><small>시간</small></label>
              <label><span className="sr-only">분</span><input type="text" inputMode="numeric" maxLength={2} value={item.minutes} onChange={(event) => updateExclusion(item.id, { minutes: event.target.value.replace(/\D/g, '').slice(0, 2) })} onBlur={() => updateExclusion(item.id, { minutes: String(Math.min(59, numberValue(item.minutes))).padStart(2, '0') })} aria-label="제외시간 분" /><small>분</small></label>
            </div>
            <button type="button" className="leaving-time-remove" onClick={() => setPlan((current) => ({ ...current, exclusions: current.exclusions.filter((entry) => entry.id !== item.id) }))} aria-label={`${item.title || `제외시간 ${index + 1}`} 삭제`}>×</button>
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
          <p className="leaving-time-hint">4시간 30분부터 법정 휴게시간 30분, 8시간 30분부터 총 60분이 자동 반영됩니다.</p>
        </section>

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
