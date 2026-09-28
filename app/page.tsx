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

export default function Home() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [passcode, setPasscode] = useState('');
  const [loginError, setLoginError] = useState('');
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
        <section className="container">
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
        <section className="container">
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
      <section className="container">
        <header className="home-header">
          <div>
            <p className="eyebrow">Master Planner 3.0</p>
            <h1>{greeting}</h1>
          </div>

          <button className="logout-button" onClick={logout}>
            나가기
          </button>
        </header>

        <section className="home-grid">
          <Link href="/stocks" className="home-button">
            주식관리
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
            className="home-button home-button-wide"
          >
            메모공유
          </Link>
        </section>
      </section>
    </main>
  );
}
