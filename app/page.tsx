'use client';

import { useEffect, useState } from 'react';

type Memo = {
  id: number;
  title: string;
  content: string;
  created_at: string;
};

export default function Home() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [passcode, setPasscode] = useState('');
  const [loginError, setLoginError] = useState('');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const response = await fetch('/api/auth', {
      cache: 'no-store',
    });

    const data = await response.json();

    setAuthenticated(data.authenticated);

    if (data.authenticated) {
      loadMemos();
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
      setLoginError(data.message || 'Passcode가 올바르지 않습니다.');
      return;
    }

    setPasscode('');
    setAuthenticated(true);
    loadMemos();
  }

  async function logout() {
    await fetch('/api/auth', {
      method: 'DELETE',
    });

    setAuthenticated(false);
    setMemos([]);
  }

  async function loadMemos() {
    setLoading(true);

    const response = await fetch('/api/memos', {
      cache: 'no-store',
    });

    const data = await response.json();

    if (response.ok) {
      setMemos(data.memos ?? []);
    }

    setLoading(false);
  }

  async function addMemo() {
    if (!content.trim()) {
      alert('메모 내용을 입력해주세요.');
      return;
    }

    setSaving(true);

    const response = await fetch('/api/memos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        content,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message || '저장에 실패했습니다.');
      setSaving(false);
      return;
    }

    setMemos((current) => [data.memo, ...current]);
    setTitle('');
    setContent('');
    setSaving(false);
  }

  async function deleteMemo(id: number) {
    const ok = confirm('이 메모를 삭제할까요?');

    if (!ok) return;

    const response = await fetch(`/api/memos?id=${id}`, {
      method: 'DELETE',
    });

    if (response.ok) {
      setMemos((current) => current.filter((memo) => memo.id !== id));
    }
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
            <p className="eyebrow">MY MEMO</p>

            <h1>나의 메모</h1>

            <p className="login-description">
              Passcode를 입력하면 메모를 사용할 수 있습니다.
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
        <header className="header">
          <div>
            <p className="eyebrow">MY MEMO</p>
            <h1>나의 메모</h1>
          </div>

          <div className="header-actions">
            <div className="count">{memos.length}개</div>

            <button className="logout-button" onClick={logout}>
              나가기
            </button>
          </div>
        </header>

        <section className="write-card">
          <input
            className="title-input"
            type="text"
            placeholder="메모 제목"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <textarea
            className="content-input"
            placeholder="무슨 생각이 떠올랐나요?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />

          <button
            className="save-button"
            onClick={addMemo}
            disabled={saving}
          >
            {saving ? '저장 중...' : '+ 메모 저장'}
          </button>
        </section>

        <section className="memo-section">
          <h2>내 메모</h2>

          {loading ? (
            <div className="empty">
              <p>메모를 불러오는 중...</p>
            </div>
          ) : memos.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">📝</div>
              <p>아직 작성한 메모가 없습니다.</p>
              <span>첫 번째 메모를 작성해보세요.</span>
            </div>
          ) : (
            <div className="memo-list">
              {memos.map((memo) => (
                <article className="memo-card" key={memo.id}>
                  <div className="memo-top">
                    <h3>{memo.title}</h3>

                    <button
                      className="delete-button"
                      onClick={() => deleteMemo(memo.id)}
                    >
                      삭제
                    </button>
                  </div>

                  <p className="memo-content">{memo.content}</p>

                  <p className="memo-date">
                    {new Date(memo.created_at).toLocaleString('ko-KR')}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}