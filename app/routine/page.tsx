import Link from 'next/link';

export default function RoutinePage() {
  return (
    <main className="app">
      <section className="container">
        <header className="header">
          <div>
            <p className="eyebrow">MY MEMO</p>
            <h1>생활루틴</h1>
          </div>

          <Link href="/" className="logout-button">
            처음으로
          </Link>
        </header>

        <div className="feature-placeholder">
          <h2>생활루틴</h2>
          <p>이 기능은 준비 중입니다.</p>
        </div>
      </section>
    </main>
  );
}