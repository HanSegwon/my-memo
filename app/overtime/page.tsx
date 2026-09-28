import Link from 'next/link';

export default function OvertimePage() {
  return (
    <main className="app">
      <section className="container">
        <header className="header">
          <div>
            <p className="eyebrow brand-eyebrow">Master 3.0</p>
            <h1>초과수당</h1>
          </div>

          <Link href="/" className="logout-button">
            처음으로
          </Link>
        </header>

        <div className="feature-placeholder">
          <h2>초과수당</h2>
          <p>이 기능은 준비 중입니다.</p>
        </div>
      </section>
    </main>
  );
}
