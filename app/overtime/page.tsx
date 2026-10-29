'use client';

import { useState } from 'react';
import Link from 'next/link';

const FIRST_MONTH = '2026-10';

function shiftMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function currentGeneratedMonth() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const calendarMonth = `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}`;
  const generatedMonth = Number(parts.find((part) => part.type === 'day')?.value) >= 21 ? calendarMonth : shiftMonth(calendarMonth, -1);
  return generatedMonth < FIRST_MONTH ? FIRST_MONTH : generatedMonth;
}

function monthRange() {
  const latest = currentGeneratedMonth();
  const earliestCandidate = shiftMonth(latest, -11);
  return { earliest: earliestCandidate < FIRST_MONTH ? FIRST_MONTH : earliestCandidate, latest };
}

export default function OvertimePage() {
  const [month, setMonth] = useState(currentGeneratedMonth);
  const range = monthRange();
  const [year, monthNumber] = month.split('-').map(Number);

  return (
    <main className="app">
      <section className="container stock-container fixed-expenses-container">
        <header className="header">
          <div>
            <p className="eyebrow brand-eyebrow">Master 3.0</p>
            <h1>초과수당</h1>
          </div>

          <Link href="/" className="logout-button">
            처음으로
          </Link>
        </header>

        <div className="fixed-expenses-monthbar">
          <button type="button" aria-label="이전 달" disabled={month <= range.earliest} onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
          <h2>{year}년 {monthNumber}월</h2>
          <button type="button" aria-label="다음 달" disabled={month >= range.latest} onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
        </div>
      </section>
    </main>
  );
}
