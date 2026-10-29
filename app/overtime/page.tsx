'use client';

import { useState } from 'react';
import { useEffect } from 'react';
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

type OvertimeRecord = {
  record_date: string;
  worked: boolean;
  attendance: string | null;
  weekday_total_minutes: number | null;
  weekday_night_minutes: number | null;
  weekend_total_minutes: number | null;
  weekend_overtime_minutes: number | null;
  weekend_night_minutes: number | null;
};

const emptyRecord = (recordDate: string): OvertimeRecord => ({
  record_date: recordDate,
  worked: false,
  attendance: null,
  weekday_total_minutes: null,
  weekday_night_minutes: null,
  weekend_total_minutes: null,
  weekend_overtime_minutes: null,
  weekend_night_minutes: null,
});

function formatMinutes(value: number | null) {
  if (value === null) return '';
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

function parseMinutes(value: string) {
  if (!value) return null;
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  if (hours > 23) return null;
  return hours * 60 + Number(match[2]);
}

export default function OvertimePage() {
  const [month, setMonth] = useState(currentGeneratedMonth);
  const [hourlyWage, setHourlyWage] = useState('26117');
  const [draftWage, setDraftWage] = useState('26117');
  const [wageDialogOpen, setWageDialogOpen] = useState(false);
  const [records, setRecords] = useState<Record<string, OvertimeRecord>>({});
  const [recordDialog, setRecordDialog] = useState<OvertimeRecord | null>(null);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const range = monthRange();
  const [year, monthNumber] = month.split('-').map(Number);
  const formattedDraftWage = draftWage ? Number(draftWage).toLocaleString('ko-KR') : '';
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  useEffect(() => {
    let cancelled = false;
    setLoadingRecords(true);
    setError('');
    fetch(`/api/overtime?month=${encodeURIComponent(month)}`, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || '초과근무 데이터를 불러오지 못했습니다.');
        return data as { records: OvertimeRecord[]; hourlyWage: number };
      })
      .then((data) => {
        if (cancelled) return;
        setRecords(Object.fromEntries((data.records ?? []).map((record) => [record.record_date, record])));
        setHourlyWage(String(data.hourlyWage ?? 26117));
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : '초과근무 데이터를 불러오지 못했습니다.');
      })
      .finally(() => { if (!cancelled) setLoadingRecords(false); });
    return () => { cancelled = true; };
  }, [month]);

  function openWageDialog() {
    setDraftWage(hourlyWage);
    setWageDialogOpen(true);
  }

  async function saveWage() {
    const wage = Number(draftWage);
    if (!Number.isSafeInteger(wage) || wage < 0) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/overtime', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'settings', hourlyWage: wage }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '시급을 저장하지 못했습니다.');
      setHourlyWage(String(data.hourlyWage));
      setWageDialogOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '시급을 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  }

  function openRecordDialog(day: number) {
    const date = `${month}-${String(day).padStart(2, '0')}`;
    setRecordDialog(records[date] ? { ...records[date] } : emptyRecord(date));
  }

  async function saveRecord() {
    if (!recordDialog) return;
    const isEmpty = !recordDialog.worked && !recordDialog.attendance?.trim() && recordDialog.weekday_total_minutes === null && recordDialog.weekday_night_minutes === null && recordDialog.weekend_total_minutes === null && recordDialog.weekend_overtime_minutes === null && recordDialog.weekend_night_minutes === null;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(isEmpty ? '/api/overtime' : '/api/overtime', {
        method: isEmpty ? 'DELETE' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEmpty ? { recordDate: recordDialog.record_date } : { type: 'record', ...recordDialog, attendance: recordDialog.attendance?.trim() || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '근무 기록을 저장하지 못했습니다.');
      setRecords((current) => {
        const next = { ...current };
        if (isEmpty) delete next[recordDialog.record_date];
        else next[recordDialog.record_date] = data.record as OvertimeRecord;
        return next;
      });
      setRecordDialog(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '근무 기록을 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
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
        {error && <p className="routine-error" role="alert">{error}</p>}
        <div className="overtime-record-heading"><h2>일별 근무 기록</h2><span>날짜 행을 누르면 입력·수정할 수 있어요.</span></div>
        <div className="overtime-record-wrap">
          <table className="overtime-record-table">
            <thead>
              <tr><th rowSpan={2}>날짜</th><th rowSpan={2}>근무</th><th rowSpan={2}>근태</th><th colSpan={2}>평일근무</th><th colSpan={3}>주말근무</th></tr>
              <tr><th>전체</th><th>심야</th><th>전체</th><th>초과</th><th>심야</th></tr>
            </thead>
            <tbody>
              {Array.from({ length: daysInMonth }, (_, index) => {
                const date = `${month}-${String(index + 1).padStart(2, '0')}`;
                const record = records[date];
                return <tr key={date} tabIndex={0} onClick={() => openRecordDialog(index + 1)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openRecordDialog(index + 1); } }} aria-label={`${index + 1}일 근무 기록 ${record ? '수정' : '입력'}`}>
                  <td>{index + 1}</td><td>{record?.worked ? 'O' : ''}</td><td>{record?.attendance ?? ''}</td>
                  <td>{formatMinutes(record?.weekday_total_minutes ?? null)}</td><td>{formatMinutes(record?.weekday_night_minutes ?? null)}</td>
                  <td>{formatMinutes(record?.weekend_total_minutes ?? null)}</td><td>{formatMinutes(record?.weekend_overtime_minutes ?? null)}</td><td>{formatMinutes(record?.weekend_night_minutes ?? null)}</td>
                </tr>;
              })}
            </tbody>
          </table>
          {loadingRecords && <div className="overtime-table-loading">불러오는 중…</div>}
        </div>
      </section>
      {wageDialogOpen && <div className="modal-backdrop overtime-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setWageDialogOpen(false); }}>
        <section className="settings-modal overtime-wage-dialog" role="dialog" aria-modal="true" aria-labelledby="overtime-wage-title">
          <div className="settings-modal-header"><h2 id="overtime-wage-title">시급 입력</h2><button type="button" className="app-picker-close" onClick={() => setWageDialogOpen(false)} aria-label="닫기">×</button></div>
          <label className="overtime-wage-field"><input autoFocus type="text" inputMode="numeric" value={formattedDraftWage} onChange={(event) => setDraftWage(event.target.value.replace(/\D/g, ''))} /><span>원</span></label>
          <div className="overtime-wage-actions"><button type="button" className="secondary-button" onClick={() => setWageDialogOpen(false)}>취소</button><button type="button" className="settings-save-button" disabled={!draftWage} onClick={saveWage}>입력</button></div>
        </section>
      </div>}
      {recordDialog && <div className="modal-backdrop overtime-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setRecordDialog(null); }}>
        <section className="settings-modal overtime-record-dialog" role="dialog" aria-modal="true" aria-labelledby="overtime-record-title">
          <div className="settings-modal-header"><h2 id="overtime-record-title">{Number(recordDialog.record_date.slice(-2))}일 근무 기록</h2><button type="button" className="app-picker-close" onClick={() => setRecordDialog(null)} aria-label="닫기" disabled={saving}>×</button></div>
          <div className="overtime-record-form">
            <div className="overtime-form-row"><span>근무</span><button type="button" className={`overtime-work-toggle${recordDialog.worked ? ' is-on' : ''}`} aria-pressed={recordDialog.worked} onClick={() => setRecordDialog({ ...recordDialog, worked: !recordDialog.worked })}>{recordDialog.worked ? 'O' : '—'}</button></div>
            <label className="overtime-form-row"><span>근태</span><input type="text" list="overtime-attendance-options" maxLength={40} value={recordDialog.attendance ?? ''} onChange={(event) => setRecordDialog({ ...recordDialog, attendance: event.target.value || null })} placeholder="예: 연차, 교육4h" /><datalist id="overtime-attendance-options"><option value="연차" /><option value="D-Day" /><option value="건강검진" /><option value="교육4h" /><option value="교육8h" /><option value="GWP" /></datalist></label>
            <div className="overtime-form-section-label">평일근무</div>
            <label className="overtime-form-row"><span>전체</span><input type="time" value={formatMinutes(recordDialog.weekday_total_minutes)} onChange={(event) => setRecordDialog({ ...recordDialog, weekday_total_minutes: parseMinutes(event.target.value) })} /></label>
            <label className="overtime-form-row"><span>심야</span><input type="time" value={formatMinutes(recordDialog.weekday_night_minutes)} onChange={(event) => setRecordDialog({ ...recordDialog, weekday_night_minutes: parseMinutes(event.target.value) })} /></label>
            <div className="overtime-form-section-label">주말근무</div>
            <label className="overtime-form-row"><span>전체</span><input type="time" value={formatMinutes(recordDialog.weekend_total_minutes)} onChange={(event) => setRecordDialog({ ...recordDialog, weekend_total_minutes: parseMinutes(event.target.value) })} /></label>
            <label className="overtime-form-row"><span>초과</span><input type="time" value={formatMinutes(recordDialog.weekend_overtime_minutes)} onChange={(event) => setRecordDialog({ ...recordDialog, weekend_overtime_minutes: parseMinutes(event.target.value) })} /></label>
            <label className="overtime-form-row"><span>심야</span><input type="time" value={formatMinutes(recordDialog.weekend_night_minutes)} onChange={(event) => setRecordDialog({ ...recordDialog, weekend_night_minutes: parseMinutes(event.target.value) })} /></label>
          </div>
          <div className="overtime-wage-actions"><button type="button" className="secondary-button" disabled={saving} onClick={() => setRecordDialog(null)}>취소</button><button type="button" className="settings-save-button" disabled={saving} onClick={() => void saveRecord()}>{saving ? '저장 중' : '저장'}</button></div>
        </section>
      </div>}
    </main>
  );
}
