'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import LoadingDots from '../components/LoadingDots';
import { daysUntilEvent, getNextEventDate, type FamilyEvent } from '../lib/familyEvents';
import { getActiveRoutine, getRoutineDayType, type ScheduledRoutine } from '../lib/routineSchedule';

const greetings = [
  '한세권님, 오늘도 파이팅!',
  '한세권님, 멋진 하루 보내세요!',
  '한세권님, 오늘도 잘될 거예요!',
  '한세권님, 힘차게 시작해봐요!',
  '한세권님, 오늘도 응원합니다!',
];

type StockSettings = {
  initial_investment: number;
  monthly_return_rate: number;
  display_rounds: number;
};

type StockRecord = {
  round_no: number;
  profit: number;
  deposit: number;
  withdrawal: number;
};

type WeightRecordSummary = {
  record_date: string;
  weight_kg: number | null;
};

type MonthlyWeightGoalSummary = {
  goal_month: string;
  target_weight: number;
};

export default function Home() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [dashboardReady, setDashboardReady] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [loginError, setLoginError] = useState('');
  const passcodeInputs = useRef<Array<HTMLInputElement | null>>([]);
  const isPasscodeComplete = /^\d{6}$/.test(passcode);
  const [stockSummary, setStockSummary] = useState<string | null>(null);
  const [weightSummary, setWeightSummary] = useState<string | null>(null);
  const [familyEventSummary, setFamilyEventSummary] = useState<string | null>(null);
  const [routineSummary, setRoutineSummary] = useState<string | null>(null);
  const [todoMemoSummary, setTodoMemoSummary] = useState<string | null>(null);
  const [greeting, setGreeting] = useState('한세권님, 오늘도 멋진 하루예요!');

  useEffect(() => {
    setGreeting(greetings[Math.floor(Math.random() * greetings.length)]);
    checkAuth();
  }, []);

  async function checkAuth() {
    const response = await fetch('/api/auth', {
      cache: 'no-store',
    });

    const data = await response.json();
    if (data.authenticated) {
      setAuthenticated(true);
      setDashboardReady(false);
      await Promise.all([
        loadStockSummary(),
        loadWeightSummary(),
        loadFamilyEventSummary(),
        loadRoutineSummary(),
        loadTodoMemoSummary(),
      ]);
      setDashboardReady(true);
    } else {
      setAuthenticated(false);
      setDashboardReady(true);
    }
  }

  async function loadStockSummary() {
    try {
      const response = await fetch('/api/stocks', {
        cache: 'no-store',
      });

      if (!response.ok) return;

      const data = (await response.json()) as {
        settings: StockSettings;
        records: StockRecord[];
      };

      if (!data.settings || !Array.isArray(data.records)) return;

      const now = new Date();
      const currentRound =
        now.getFullYear() * 12 +
        now.getMonth() -
        (2025 * 12 + 8) +
        1;

      let previousTotal = data.settings.initial_investment;
      let previousGoal = data.settings.initial_investment;
      const monthlyRate = data.settings.monthly_return_rate / 100;
      let currentTotal: number | null = null;
      const goals: Array<{ roundNo: number; goal: number }> = [];

      for (let roundNo = 1; roundNo <= data.settings.display_rounds; roundNo += 1) {
        const record = data.records.find((item) => item.round_no === roundNo);
        const total =
          previousTotal +
          Number(record?.profit ?? 0) +
          Number(record?.deposit ?? 0) -
          Number(record?.withdrawal ?? 0);
        const goal = Math.round(previousGoal * (1 + monthlyRate));

        goals.push({ roundNo, goal });
        if (roundNo === currentRound) currentTotal = total;

        previousTotal = total;
        previousGoal = goal;
      }

      if (currentTotal === null) return;

      const achievedGoals = goals.filter((item) => item.goal < currentTotal!);
      if (achievedGoals.length === 0) return;

      const highlightedGoal = achievedGoals.reduce((highest, item) =>
        item.goal > highest.goal ? item : highest
      );
      const targetRound = highlightedGoal.roundNo + 1;
      const targetGoal = Math.round(
        highlightedGoal.goal * (1 + monthlyRate)
      );
      const remainingAmount = targetGoal - currentTotal;
      const targetDate = new Date(2025, 8 + targetRound - 1, 1);
      const targetMonth = `${String(targetDate.getFullYear()).slice(-2)}.${String(
        targetDate.getMonth() + 1
      ).padStart(2, '0')}월`;

      const formattedAmount = Math.abs(remainingAmount).toLocaleString('ko-KR');

      if (remainingAmount > 0) {
        setStockSummary(`’${targetMonth} 목표까지 ${formattedAmount}원 남았어요.`);
      } else if (remainingAmount < 0) {
        setStockSummary(
          `’${targetMonth} 목표를 ${formattedAmount}원 초과 달성했어요.`
        );
      } else {
        setStockSummary(`’${targetMonth} 목표를 달성했어요!`);
      }
    } catch {
      // 주식 요약을 불러오지 못해도 대시보드의 다른 메뉴는 사용할 수 있습니다.
    }
  }

  async function login() {
    if (!isPasscodeComplete) return;

    setLoginError('');

    const response = await fetch('/api/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ passcode }),
    });

    const data = await response.json();

    if (!response.ok) {
      setLoginError(
        data.message || 'Passcode가 올바르지 않습니다.'
      );
      return;
    }

    setPasscode('');
    setAuthenticated(true);
    setDashboardReady(false);
    await Promise.all([
      loadStockSummary(),
      loadWeightSummary(),
      loadFamilyEventSummary(),
      loadRoutineSummary(),
      loadTodoMemoSummary(),
    ]);
    setDashboardReady(true);
  }

  useEffect(() => {
    if (authenticated !== true || !dashboardReady) {
      setRoutineSummary(null);
      return;
    }
    const timer = window.setInterval(() => void loadRoutineSummary(), 60_000);
    return () => window.clearInterval(timer);
  }, [authenticated, dashboardReady]);

  useEffect(() => {
    if (authenticated !== true || !dashboardReady) {
      setTodoMemoSummary(null);
      return;
    }
    const refresh = () => void loadTodoMemoSummary();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [authenticated, dashboardReady]);

  async function loadWeightSummary() {
    try {
      const response = await fetch('/api/weight', { cache: 'no-store' });
      if (!response.ok) return;

      const data = (await response.json()) as {
        records: WeightRecordSummary[];
        monthlyGoals: MonthlyWeightGoalSummary[];
      };
      const currentMonth = new Date(Date.now() + 9 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 7);
      const target = data.monthlyGoals?.find(
        (goal) => goal.goal_month === `${currentMonth}-01`
      );
      const latestWeight = data.records
        ?.filter((record) => record.weight_kg !== null)
        .sort((a, b) => b.record_date.localeCompare(a.record_date))[0];
      if (!target || !latestWeight || latestWeight.weight_kg === null) return;

      const formatKg = (value: number) => String(Number(value.toFixed(2)));
      const remaining = Number((latestWeight.weight_kg - target.target_weight).toFixed(2));
      if (remaining > 0) {
        setWeightSummary(
          `이번 달 목표 ${formatKg(target.target_weight)}kg까지 ${formatKg(remaining)}kg 더 빼면 돼요.`
        );
      } else {
        setWeightSummary(`이번 달 목표 ${formatKg(target.target_weight)}kg를 달성했어요!`);
      }
    } catch {
      // 체중 요약을 불러오지 못해도 다른 메뉴는 사용할 수 있습니다.
    }
  }

  async function loadFamilyEventSummary() {
    try {
      const response = await fetch('/api/family-events', { cache: 'no-store' });
      if (!response.ok) return;
      const data = (await response.json()) as { events: FamilyEvent[] };
      const today = new Date();
      const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const upcoming = (data.events ?? []).flatMap((event) => {
        const date = getNextEventDate(event, todayString);
        return date ? [{ event, date }] : [];
      }).sort((a, b) => a.date.localeCompare(b.date))[0];
      if (!upcoming) {
        setFamilyEventSummary(null);
        return;
      }
      const daysLeft = daysUntilEvent(upcoming.date, todayString);
      setFamilyEventSummary(`${upcoming.event.title} ${daysLeft === 0 ? '오늘입니다.' : `${daysLeft}일 남았습니다.`}`);
    } catch {
      // 집안행사 요약을 불러오지 못해도 다른 메뉴는 사용할 수 있습니다.
    }
  }

  async function loadTodoMemoSummary() {
    try {
      const response = await fetch('/api/memos', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json() as { memos: Array<{ id: number; is_completed: boolean }> };
      const remaining = (data.memos ?? []).filter((memo) => !memo.is_completed).length;
      setTodoMemoSummary(`아직 못한 집안일이 총 ${remaining}건 있습니다.`);
    } catch {
      // 할 일 메모 요약을 불러오지 못해도 다른 메뉴는 사용할 수 있습니다.
    }
  }

  async function loadRoutineSummary() {
    try {
      const response = await fetch('/api/routine', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json() as { routines: ScheduledRoutine[] };
      const active = getActiveRoutine(data.routines ?? [], new Date(), getRoutineDayType());
      setRoutineSummary(active ? `지금은 ${active.title} 시간입니다.` : null);
    } catch {
      // 생활루틴 요약을 불러오지 못해도 다른 메뉴는 사용할 수 있습니다.
    }
  }

  function updatePasscode(index: number, value: string) {
    const digits = value.replace(/\D/g, '');
    const next = passcode.padEnd(6, ' ').split('');

    if (!digits) {
      next[index] = ' ';
      setPasscode(next.join('').trimEnd());
      setLoginError('');
      return;
    }

    const pastedDigits = digits.slice(0, 6 - index);
    pastedDigits.split('').forEach((digit, offset) => {
      next[index + offset] = digit;
    });
    const nextPasscode = next.join('').trimEnd();
    setPasscode(nextPasscode);
    setLoginError('');
    if (/^\d{6}$/.test(nextPasscode)) {
      passcodeInputs.current[index]?.blur();
      return;
    }
    passcodeInputs.current[Math.min(index + pastedDigits.length, 5)]?.focus();
  }

  function pastePasscode(index: number, value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 6 - index);
    if (!digits) return;

    const next = passcode.padEnd(6, ' ').split('');
    digits.split('').forEach((digit, offset) => {
      next[index + offset] = digit;
    });
    const nextPasscode = next.join('').trimEnd();
    setPasscode(nextPasscode);
    setLoginError('');
    if (/^\d{6}$/.test(nextPasscode)) {
      passcodeInputs.current[index]?.blur();
      return;
    }
    passcodeInputs.current[Math.min(index + digits.length, 5)]?.focus();
  }

  async function logout() {
    await fetch('/api/auth', {
      method: 'DELETE',
    });

    setAuthenticated(false);
    setDashboardReady(true);
    setWeightSummary(null);
    setFamilyEventSummary(null);
    setRoutineSummary(null);
    setTodoMemoSummary(null);
  }

  if (authenticated === null) {
    return <main className="loading-screen"><LoadingDots /></main>;
  }

  if (authenticated && !dashboardReady) {
    return <main className="loading-screen"><LoadingDots /></main>;
  }

  if (!authenticated) {
    return (
      <main className="app">
        <section className="container home-container login-container">
          <div className="login-card">
            <div className="login-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="5" y="10" width="14" height="11" rx="2.5" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                <path d="M12 14.5v2" />
              </svg>
            </div>

            <h1>Master 3.0</h1>

            <p className="login-description">
              계속하려면 6자리 비밀번호를 입력해 주세요.
            </p>

            <form
              className="login-form"
              autoComplete="off"
              onSubmit={(event) => {
                event.preventDefault();
                void login();
              }}
            >
              <div className="passcode-digits" role="group" aria-label="6자리 비밀번호">
                {Array.from({ length: 6 }, (_, index) => (
                  <input
                    key={index}
                    ref={(element) => {
                      passcodeInputs.current[index] = element;
                    }}
                    className="passcode-digit"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    aria-label={`비밀번호 ${index + 1}번째 숫자`}
                    value={passcode[index] ?? ''}
                    onChange={(event) =>
                      updatePasscode(index, event.target.value)
                    }
                    onPaste={(event) => {
                      event.preventDefault();
                      pastePasscode(index, event.clipboardData.getData('text'));
                    }}
                    onKeyDown={(event) => {
                      if (
                        event.key === 'Backspace' &&
                        !passcode[index] &&
                        index > 0
                      ) {
                        passcodeInputs.current[index - 1]?.focus();
                      }
                    }}
                  />
                ))}
              </div>

              <button
                className="login-submit"
                type="submit"
                disabled={!isPasscodeComplete}
              >
                계속하기
              </button>
            </form>

            {loginError && (
              <p className="login-error" role="alert">{loginError}</p>
            )}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app">
      <section className="container home-container">
        <header className="home-header">
          <div>
            <p className="eyebrow brand-eyebrow">Master 3.0</p>
            <h1>{greeting}</h1>
          </div>

          <button
            className="logout-button"
            onClick={logout}
            aria-label="나가기"
            title="나가기"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="m16 17 5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
          </button>
        </header>

        <section className="home-grid">
          <Link href="/stocks" className="home-button">
            <span className="home-button-title">주식성과</span>
            {stockSummary && (
              <>
                <span className="home-button-divider" aria-hidden="true">
                  |
                </span>
                <span className="home-button-summary">
                  {stockSummary}
                </span>
              </>
            )}
          </Link>

          <Link href="/salary" className="home-button">
            연봉추이
          </Link>

          <Link href="/overtime" className="home-button">
            초과수당
          </Link>

          <Link href="/weight" className="home-button">
            <span className="home-button-title">체중관리</span>
            {weightSummary && (
              <>
                <span className="home-button-divider" aria-hidden="true">|</span>
                <span className="home-button-summary">{weightSummary}</span>
              </>
            )}
          </Link>

          <Link href="/smoking" className="home-button">
            금연관리
          </Link>

          <Link href="/routine" className="home-button">
            <span className="home-button-title">생활루틴</span>
            {routineSummary && (
              <>
                <span className="home-button-divider" aria-hidden="true">|</span>
                <span className="home-button-summary">{routineSummary}</span>
              </>
            )}
          </Link>

          <Link
            href="/shared-memo"
            className="home-button"
          >
            <span className="home-button-title">할일메모</span>
            {todoMemoSummary && <><span className="home-button-divider" aria-hidden="true">|</span><span className="home-button-summary">{todoMemoSummary}</span></>}
          </Link>

          <Link href="/family-events" className="home-button">
            <span className="home-button-title">집안행사</span>
            {familyEventSummary && (
              <>
                <span className="home-button-divider" aria-hidden="true">|</span>
                <span className="home-button-summary">{familyEventSummary}</span>
              </>
            )}
          </Link>

          <Link href="/children-academy" className="home-button">
            자녀학원
          </Link>

          <Link href="/affair-expenses" className="home-button">
            경조사비
          </Link>
        </section>
      </section>
    </main>
  );
}
