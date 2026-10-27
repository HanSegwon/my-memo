'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import LoadingDots from '../../components/LoadingDots';
import { formatQuitTimer, getQuitDuration, getRandomQuitMessage } from '../../lib/smokingQuit';

const CIGARETTE_PRICE = 4900;
const CIGARETTES_PER_PACK = 20;
const ACTIVE_HOURS_START = 6;
const ACTIVE_HOURS_END = 22;

function getAvoidedCigarettes(startedAt: string, now: number) {
  const start = new Date(startedAt).getTime();
  if (!Number.isFinite(start) || now <= start) return 0;

  let activeMilliseconds = 0;
  let day = new Date(start);
  day = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  while (day.getTime() < now) {
    const activeStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), ACTIVE_HOURS_START).getTime();
    const activeEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), ACTIVE_HOURS_END).getTime();
    activeMilliseconds += Math.max(0, Math.min(now, activeEnd) - Math.max(start, activeStart));
    day.setDate(day.getDate() + 1);
  }
  return Math.floor(activeMilliseconds / 3_600_000);
}

export default function SmokingPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [quitStartedAt, setQuitStartedAt] = useState<string | null>(null);
  const [quitNow, setQuitNow] = useState(0);
  const [quitMessage, setQuitMessage] = useState('');
  const [quitError, setQuitError] = useState('');
  const [quitSaving, setQuitSaving] = useState(false);
  const [quitStatusLoaded, setQuitStatusLoaded] = useState(false);
  const [showSavingsHelp, setShowSavingsHelp] = useState(false);

  const loadQuitStatus = useCallback(async () => {
    setQuitError('');
    try {
      const response = await fetch('/api/smoking/quit', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '금연 시작 정보를 불러오지 못했습니다.');
      setQuitStartedAt(data.quitStartedAt ?? null);
      setQuitNow(Date.now());
      setQuitMessage(data.quitStartedAt ? getRandomQuitMessage(getQuitDuration(data.quitStartedAt)) : '');
    } catch (error) {
      setQuitError(error instanceof Error ? error.message : '금연 시작 정보를 불러오지 못했습니다.');
    } finally {
      setQuitStatusLoaded(true);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/auth', { cache: 'no-store' });
        const data = await response.json();
        if (!data.authenticated) {
          router.replace('/');
          return;
        }
        setAuthenticated(true);
        await loadQuitStatus();
      } catch {
        setQuitError('로그인 상태를 확인하지 못했습니다.');
        setQuitStatusLoaded(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadQuitStatus, router]);

  useEffect(() => {
    if (!quitStartedAt) return;
    const timer = window.setInterval(() => setQuitNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [quitStartedAt]);

  async function startQuitting() {
    if (quitSaving) return;
    setQuitSaving(true);
    setQuitError('');
    try {
      const response = await fetch('/api/smoking/quit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '금연 시작 시간을 저장하지 못했습니다.');
      setQuitStartedAt(data.quitStartedAt);
      setQuitNow(Date.now());
      setQuitMessage(getRandomQuitMessage(0));
    } catch (error) {
      setQuitError(error instanceof Error ? error.message : '금연을 시작하지 못했습니다.');
    } finally {
      setQuitSaving(false);
    }
  }

  async function markQuitFailed() {
    if (quitSaving || !window.confirm('금연 실패로 기록하고 현재 타이머를 초기화할까요?')) return;
    setQuitSaving(true);
    setQuitError('');
    try {
      const response = await fetch('/api/smoking/quit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fail' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '금연 상태를 저장하지 못했습니다.');
      setQuitStartedAt(null);
      setQuitMessage('');
    } catch (error) {
      setQuitError(error instanceof Error ? error.message : '금연 실패를 기록하지 못했습니다.');
    } finally {
      setQuitSaving(false);
    }
  }

  if (authenticated === null || loading || !quitStatusLoaded) return <main className="loading-screen"><LoadingDots /></main>;

  const avoidedCigarettes = quitStartedAt ? getAvoidedCigarettes(quitStartedAt, quitNow || Date.now()) : 0;
  const savedAmount = avoidedCigarettes * (CIGARETTE_PRICE / CIGARETTES_PER_PACK);
  const timerText = quitStartedAt ? formatQuitTimer(getQuitDuration(quitStartedAt, quitNow || Date.now())) : '';

  return (
    <main className="app">
      <section className="container stock-container weight-container smoking-container">
        <header className="stock-header">
          <div><p className="eyebrow brand-eyebrow">Master 3.0</p><h1>금연관리</h1></div>
          <Link href="/" className="logout-button">처음으로</Link>
        </header>

        <section className={`smoking-quit-panel ${quitStartedAt ? 'smoking-quit-active' : 'smoking-not-started'}`} aria-label="금연 타이머">
          {quitStartedAt ? <>
            <div className="smoking-quit-timer-content">
              <p className="smoking-quit-eyebrow">금연 시간</p>
              <strong className="smoking-quit-timer">{timerText.split(/(일|시간|분|초)/g).map((part, index) => /^(일|시간|분|초)$/.test(part) ? <span className="smoking-quit-timer-unit" key={`${part}-${index}`}>{part}</span> : part)}</strong>
            </div>
            {quitMessage && <p className="smoking-quit-message" aria-live="polite">{quitMessage}</p>}
            <div className="smoking-savings" aria-live="polite">
              <strong>{savedAmount.toLocaleString('ko-KR')}원 절약</strong>
              <span className={`smoking-savings-help${showSavingsHelp ? ' is-open' : ''}`}>
                <button type="button" aria-label="절약 금액 계산 기준" aria-expanded={showSavingsHelp} onClick={() => setShowSavingsHelp((open) => !open)}>?</button>
                {showSavingsHelp && <span className="smoking-savings-tooltip" role="status">22:00~06:00는 제외하고, 06:00~22:00 동안 시간당 1개비를 피운 것으로 계산합니다. 한 갑(20개비)은 4,900원 기준입니다.</span>}
              </span>
            </div>
          </> : <button type="button" className="smoking-quit-start" onClick={() => void startQuitting()} disabled={quitSaving}>{quitSaving ? '시작 중...' : '금연 시작'}</button>}
          {quitError && <p className="smoking-quit-error" role="alert">{quitError}<button type="button" onClick={() => void loadQuitStatus()}>다시 시도</button></p>}
        </section>
        {quitStartedAt && <button type="button" className="logout-button smoking-quit-fail" onClick={() => void markQuitFailed()} disabled={quitSaving}>{quitSaving ? '저장 중...' : '금연 실패'}</button>}
      </section>
    </main>
  );
}
