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
  const [hourlyWage, setHourlyWage] = useState('26117');
  const [draftWage, setDraftWage] = useState('26117');
  const [wageDialogOpen, setWageDialogOpen] = useState(false);
  const range = monthRange();
  const [year, monthNumber] = month.split('-').map(Number);
  const formattedDraftWage = draftWage ? Number(draftWage).toLocaleString('ko-KR') : '';

  function openWageDialog() {
    setDraftWage(hourlyWage);
    setWageDialogOpen(true);
  }

  function saveWage() {
    setHourlyWage(draftWage);
    setWageDialogOpen(false);
  }

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
        <div className="overtime-total-amount">861,950 <span>원</span></div>
        <section className="overtime-dashboard" aria-label="초과수당 월간 현황">
          <div className="overtime-metric-row">
            <div className="overtime-metric"><span>최대근무시간</span><strong>222:00</strong></div>
            <div className="overtime-metric"><span>필수근무시간</span><strong>160:00</strong></div>
            <div className="overtime-metric"><span>누적근무시간</span><strong>189:45</strong></div>
            <div className="overtime-metric"><span>잔여근무시간</span><strong>32:15</strong></div>
            <div className="overtime-metric"><span>잔여하루평균</span><strong>12:02</strong></div>
          </div>
          <div className="overtime-metric-row">
            <div className="overtime-metric"><span>누적평일초과</span><strong>29:45</strong></div>
            <div className="overtime-metric"><span>누적심야근무</span><strong>03:44</strong></div>
            <div className="overtime-metric"><span>누적휴일근무</span><strong>01:33</strong></div>
            <div className="overtime-metric"><span>누적휴일초과</span><strong>00:20</strong></div>
            <div className="overtime-metric overtime-metric-empty" aria-hidden="true" />
          </div>
          <div className="overtime-metric-row">
            <div className="overtime-metric"><span>시급</span><button type="button" className="overtime-wage-value" onClick={openWageDialog}>{Number(hourlyWage || 0).toLocaleString('ko-KR')}</button></div>
            <div className="overtime-metric"><span>분급</span><strong>435.28</strong></div>
            <div className="overtime-metric"><span>평일초과수당</span><strong>617,610</strong></div>
            <div className="overtime-metric"><span>심야근로수당</span><strong>223,000</strong></div>
            <div className="overtime-metric"><span>휴일근로수당</span><strong>21,340</strong></div>
          </div>
        </section>
      </section>
      {wageDialogOpen && <div className="modal-backdrop overtime-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setWageDialogOpen(false); }}>
        <section className="settings-modal overtime-wage-dialog" role="dialog" aria-modal="true" aria-labelledby="overtime-wage-title">
          <div className="settings-modal-header"><h2 id="overtime-wage-title">시급 입력</h2><button type="button" className="app-picker-close" onClick={() => setWageDialogOpen(false)} aria-label="닫기">×</button></div>
          <label className="overtime-wage-field"><input autoFocus type="text" inputMode="numeric" value={formattedDraftWage} onChange={(event) => setDraftWage(event.target.value.replace(/\D/g, ''))} /><span>원</span></label>
          <div className="overtime-wage-actions"><button type="button" className="secondary-button" onClick={() => setWageDialogOpen(false)}>취소</button><button type="button" className="settings-save-button" disabled={!draftWage} onClick={saveWage}>입력</button></div>
        </section>
      </div>}
    </main>
  );
}
