'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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

export default function Home() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [passcode, setPasscode] = useState('');
  const [loginError, setLoginError] = useState('');
  const [stockSummary, setStockSummary] = useState<string | null>(null);
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
    setAuthenticated(data.authenticated);

    if (data.authenticated) {
      await loadStockSummary();
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

      const highlightedRound = achievedGoals.reduce((highest, item) =>
        item.goal > highest.goal ? item : highest
      ).roundNo;

      if (highlightedRound === currentRound) {
        setStockSummary('이번 회차엔 꼭 수익을 내야 해요.');
        return;
      }

      const targetDate = new Date(2025, 8 + highlightedRound - 1, 1);
      const targetMonth = `${String(targetDate.getFullYear()).slice(-2)}.${String(
        targetDate.getMonth() + 1
      ).padStart(2, '0')}월`;

      setStockSummary(
        highlightedRound < currentRound
          ? `’${targetMonth} 이후 주식 성과가 없어요.`
          : `’${targetMonth} 목표를 향해 나아가고 있어요.`
      );
    } catch {
      // 주식 요약을 불러오지 못해도 대시보드의 다른 메뉴는 사용할 수 있습니다.
    }
  }

  async function login() {
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
    await loadStockSummary();
  }

  async function logout() {
    await fetch('/api/auth', {
      method: 'DELETE',
    });

    setAuthenticated(false);
  }

  if (authenticated === null) {
    return (
      <main className="app">
        <section className="container home-container">
          <div className="empty">
            <p>확인 중...</p>
          </div>
        </section>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="app">
        <section className="container home-container">
          <div className="login-card">
            <p className="eyebrow">Master Planner 3.0</p>

            <h1>나의 메모</h1>

            <p className="login-description">
              Passcode를 입력하면 사용할 수 있습니다.
            </p>

            <input
              className="title-input"
              type="password"
              placeholder="Passcode"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  login();
                }
              }}
            />

            <button className="save-button" onClick={login}>
              들어가기
            </button>

            {loginError && (
              <p className="login-error">{loginError}</p>
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
            <p className="eyebrow">Master Planner 3.0</p>
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

          <Link href="/overtime" className="home-button">
            초과수당
          </Link>

          <Link href="/weight" className="home-button">
            체중관리
          </Link>

          <Link href="/routine" className="home-button">
            생활루틴
          </Link>

          <Link
            href="/shared-memo"
            className="home-button"
          >
            메모공유
          </Link>
        </section>
      </section>
    </main>
  );
}
