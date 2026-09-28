'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Memo = {
  id: number;
  title: string;
  content: string;
  created_at: string;
};

export default function SharedMemoPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const authResponse = await fetch('/api/auth', {
      cache: 'no-store',
    });

    const authData = await authResponse.json();

    setAuthenticated(authData.authenticated);

    if (authData.authenticated) {
      loadMemos();
    } else {
      setLoading(false);
    }
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
      setMemos((current) =>
        current.filter((memo) => memo.id !== id)
      );
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
          <div className="feature-placeholder">
            <h2>접근할 수 없습니다.</h2>
            <p>먼저 Passcode를 입력해주세요.</p>

            <Link href="/" className="back-link">
              처음으로
            </Link>
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
            <p className="eyebrow brand-eyebrow">Master 3.0</p>
            <h1>메모공유</h1>
          </div>

          <Link href="/" className="logout-button">
            처음으로
          </Link>
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
            {saving ? '저장 중...' : '메모 저장'}
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

                  <p className="memo-content">
                    {memo.content}
                  </p>

                  <p className="memo-date">
                    {new Date(memo.created_at).toLocaleString(
                      'ko-KR'
                    )}
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
