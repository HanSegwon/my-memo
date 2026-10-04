'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import LoadingDots from '../../components/LoadingDots';

type SmokingRecord = {
  record_date: string;
  regular_count: number | null;
  electronic_count: number | null;
  updated_at: string;
};

type SmokingDraft = { regularCount: string; electronicCount: string };

const emptyDraft: SmokingDraft = { regularCount: '', electronicCount: '' };
const BAR_COLORS = { regular: '#8194ae', electronic: '#78aa98' };
const TOTAL_LINE_COLOR = '#d28b45';

function koreanToday() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function addDays(date: string, days: number) {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function formatDate(date: string) {
  const [year, month, day] = date.split('-');
  return `'${year.slice(-2)}.${month}.${day}`;
}

function formatTableDate(date: string) {
  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return `${formatDate(date)} (${['일', '월', '화', '수', '목', '금', '토'][weekday]})`;
}

function formatCount(value: number) {
  return Math.round(value).toLocaleString('ko-KR');
}

function niceCountStep(value: number) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const multiplier = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return multiplier * magnitude;
}

export default function SmokingPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [today, setToday] = useState('');
  const [records, setRecords] = useState<SmokingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [draft, setDraft] = useState<SmokingDraft>(emptyDraft);
  const [recordError, setRecordError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setPageError('');
    try {
      const response = await fetch('/api/smoking', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '금연관리 기록을 불러오지 못했습니다.');
      setRecords(data.records ?? []);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : '금연관리 기록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setToday(koreanToday());
    const timer = window.setInterval(() => setToday(koreanToday()), 60_000);
    void (async () => {
      try {
        const response = await fetch('/api/auth', { cache: 'no-store' });
        const data = await response.json();
        if (!data.authenticated) {
          router.replace('/');
          return;
        }
        setAuthenticated(true);
        await loadRecords();
      } catch {
        setPageError('로그인 상태를 확인하지 못했습니다.');
        setLoading(false);
      }
    })();
    return () => window.clearInterval(timer);
  }, [loadRecords, router]);

  useEffect(() => {
    const closeDialog = () => {
      setActiveDate(null);
      if (window.history.state?.smokingDialog === true) {
        window.history.replaceState({ ...window.history.state, smokingDialog: false }, '', window.location.pathname);
      }
    };
    window.addEventListener('smoking:close-dialog', closeDialog);
    return () => window.removeEventListener('smoking:close-dialog', closeDialog);
  }, []);

  const recordMap = useMemo(() => new Map(records.map((record) => [record.record_date, record])), [records]);
  const visibleDates = useMemo(() => today ? Array.from({ length: 6 }, (_, index) => addDays(today, -index)) : [], [today]);
  const chartRows = useMemo(() => [...records]
    .filter((record) => record.regular_count !== null || record.electronic_count !== null)
    .sort((a, b) => a.record_date.localeCompare(b.record_date)), [records]);

  function openRecord(date: string) {
    window.history.pushState({ ...window.history.state, smokingDialog: true }, '', window.location.pathname);
    const record = recordMap.get(date);
    setDraft(record ? {
      regularCount: record.regular_count === null ? '' : String(record.regular_count),
      electronicCount: record.electronic_count === null ? '' : String(record.electronic_count),
    } : { ...emptyDraft });
    setRecordError('');
    setActiveDate(date);
  }

  function closeRecord() {
    if (saving) return;
    setActiveDate(null);
    if (window.history.state?.smokingDialog === true) {
      window.history.replaceState({ ...window.history.state, smokingDialog: false }, '', window.location.pathname);
    }
  }

  function adjustCount(field: keyof SmokingDraft, amount: number) {
    setDraft((current) => {
      const value = Number(current[field]) || 0;
      return { ...current, [field]: String(Math.min(9999, Math.max(0, value + amount))) };
    });
  }

  async function saveRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeDate || saving) return;
    setSaving(true);
    setRecordError('');
    try {
      const response = await fetch('/api/smoking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordDate: activeDate, ...draft }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '금연 기록을 저장하지 못했습니다.');
      setRecords((current) => data.record
        ? [...current.filter((record) => record.record_date !== activeDate), data.record].sort((a, b) => a.record_date.localeCompare(b.record_date))
        : current.filter((record) => record.record_date !== activeDate));
      setActiveDate(null);
      if (window.history.state?.smokingDialog === true) {
        window.history.replaceState({ ...window.history.state, smokingDialog: false }, '', window.location.pathname);
      }
    } catch (error) {
      setRecordError(error instanceof Error ? error.message : '금연 기록을 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  }

  const chartMaxCount = Math.max(...chartRows.map((record) => Number(record.regular_count ?? 0) + Number(record.electronic_count ?? 0)), 0);
  const chartStep = niceCountStep((chartMaxCount * 1.1 || 4) / 4);
  const chartMax = Math.ceil((chartMaxCount * 1.1 || 4) / chartStep) * chartStep;
  const chartTicks = Array.from({ length: 5 }, (_, index) => chartMax * (1 - index / 4));
  const chartHeight = 276;
  const chartTop = 18;
  const chartBottom = 42;
  const plotHeight = chartHeight - chartTop - chartBottom;
  const chartWidth = Math.max(chartRows.length * 48 + 20, 360);
  const chartBaseline = chartHeight - chartBottom;
  const barWidth = 20;
  const currentDateX = chartRows.findIndex((record) => record.record_date === today) >= 0
    ? chartRows.findIndex((record) => record.record_date === today) * 48 + 24
    : undefined;
  const totalPoints = chartRows.map((record, index) => {
    const total = Number(record.regular_count ?? 0) + Number(record.electronic_count ?? 0);
    return `${index * 48 + 24},${chartBaseline - (total / chartMax) * plotHeight}`;
  }).join(' ');

  if (authenticated === null || loading) return <main className="loading-screen"><LoadingDots /></main>;

  return (
    <main className="app">
      <section className="container stock-container weight-container smoking-container">
        <header className="stock-header">
          <div><p className="eyebrow brand-eyebrow">Master 3.0</p><h1>금연관리</h1></div>
          <Link href="/" className="logout-button">처음으로</Link>
        </header>

        {pageError && <div className="weight-inline-error" role="alert"><span>{pageError}</span><button type="button" onClick={() => void loadRecords()}>다시 시도</button></div>}

        <section className="stock-chart-panel weight-chart-panel smoking-chart-panel">
          <div className="stock-chart-heading">
            <h2>일별 흡연량</h2>
            <div className="stock-chart-legend" aria-label="차트 범례">
              <span><i className="smoking-legend-regular" />연초</span>
              <span><i className="smoking-legend-electronic" />전자담배</span>
              <span><i className="smoking-legend-total" />하루 총량 추이</span>
            </div>
          </div>
          {chartRows.length === 0 ? (
            <div className="weight-chart-empty">일별 흡연량을 입력하면 차트가 표시됩니다.</div>
          ) : (
            <div className="stock-chart-layout">
              <svg className="stock-chart-y-axis" aria-hidden="true" width="58" height={chartHeight} viewBox={`0 0 58 ${chartHeight}`}>
                {chartTicks.map((tick, index) => {
                  const y = chartTop + plotHeight * (index / 4);
                  return <text key={index} x="50" y={y + 3} fill="#737d8b" fontSize="9" textAnchor="end">{formatCount(tick)}</text>;
                })}
              </svg>
              <div className="stock-chart-scroll smoking-chart-scroll" aria-label="날짜별 연초와 전자담배 흡연량 누적 막대 그래프">
                <svg className="stock-chart-svg" width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="일별 연초와 전자담배 흡연량 누적 막대 그래프">
                  {chartTicks.map((tick, index) => {
                    const y = chartTop + plotHeight * (index / 4);
                    return <line key={index} x1="0" x2={chartWidth} y1={y} y2={y} stroke="#edf0f4" />;
                  })}
                  {currentDateX !== undefined && <line x1={currentDateX} x2={currentDateX} y1={chartTop} y2={chartBaseline} stroke="#3478df" strokeDasharray="3 4" strokeWidth="1.5" />}
                  {chartRows.map((record, index) => {
                    const regular = Number(record.regular_count ?? 0);
                    const electronic = Number(record.electronic_count ?? 0);
                    const regularHeight = (regular / chartMax) * plotHeight;
                    const electronicHeight = (electronic / chartMax) * plotHeight;
                    const x = index * 48 + 24;
                    const total = regular + electronic;
                    return <g key={record.record_date}>
                      {regular > 0 && <rect x={x - barWidth / 2} y={chartBaseline - regularHeight} width={barWidth} height={regularHeight} rx="2" fill={BAR_COLORS.regular} />}
                      {electronic > 0 && <rect x={x - barWidth / 2} y={chartBaseline - regularHeight - electronicHeight} width={barWidth} height={electronicHeight} rx="2" fill={BAR_COLORS.electronic} />}
                      <text x={x} y={chartHeight - 12} fill="#7d8592" fontSize="9" textAnchor="middle">{formatDate(record.record_date)}</text>
                      <title>{`${formatTableDate(record.record_date)} · 연초 ${formatCount(regular)}개 · 전자담배 ${formatCount(electronic)}개 · 하루 총 ${formatCount(total)}개`}</title>
                    </g>;
                  })}
                  {chartRows.length > 1 && <polyline points={totalPoints} fill="none" stroke={TOTAL_LINE_COLOR} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
                  {chartRows.map((record, index) => {
                    const total = Number(record.regular_count ?? 0) + Number(record.electronic_count ?? 0);
                    const x = index * 48 + 24;
                    const y = chartBaseline - (total / chartMax) * plotHeight;
                    return <circle key={`total-${record.record_date}`} cx={x} cy={y} r="3.5" fill="#fff" stroke={TOTAL_LINE_COLOR} strokeWidth="2" />;
                  })}
                </svg>
              </div>
            </div>
          )}
        </section>

        <section className="smoking-table-wrap" aria-label="금연관리 일별 기록">
          <table className="smoking-table">
            <thead><tr><th>날짜</th><th>연초</th><th>전자담배</th><th>하루 총량</th></tr></thead>
            <tbody>{visibleDates.map((date) => {
              const record = recordMap.get(date);
              const total = record ? Number(record.regular_count ?? 0) + Number(record.electronic_count ?? 0) : null;
              return <tr key={date} className={`smoking-day-row${date === today ? ' smoking-today-row' : ''}`} tabIndex={0} role="button" aria-label={`${formatTableDate(date)} 금연 기록 입력`} onClick={() => openRecord(date)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openRecord(date); } }}>
                <td>{formatTableDate(date)}</td><td>{record?.regular_count == null ? '' : formatCount(record.regular_count)}</td><td>{record?.electronic_count == null ? '' : formatCount(record.electronic_count)}</td><td className="smoking-total-cell">{total === null ? '' : `${formatCount(total)}개`}</td>
              </tr>;
            })}</tbody>
          </table>
        </section>
        <p className="weight-table-hint">날짜를 터치하면 흡연량을 입력할 수 있습니다.</p>
      </section>

      {activeDate && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeRecord(); }}>
        <form className="settings-modal weight-dialog smoking-dialog smoking-record-dialog" onSubmit={(event) => void saveRecord(event)} onMouseDown={(event) => event.stopPropagation()}>
          <div className="settings-modal-header"><div><p className="eyebrow">DAILY RECORD</p><h2>{formatTableDate(activeDate)} 흡연량</h2></div><button className="modal-close" type="button" onClick={closeRecord}>닫기</button></div>
          <label className="weight-form-field"><span>연초</span><div className="smoking-input-with-unit"><button type="button" aria-label="연초 수량 줄이기" onClick={() => adjustCount('regularCount', -1)}>−</button><input type="text" inputMode="numeric" maxLength={4} placeholder="0" value={draft.regularCount} onChange={(event) => { const value = event.target.value; if (/^\d{0,4}$/.test(value)) setDraft((current) => ({ ...current, regularCount: value })); }} /><button type="button" aria-label="연초 수량 늘리기" onClick={() => adjustCount('regularCount', 1)}>+</button><span>개</span></div></label>
          <label className="weight-form-field"><span>전자담배</span><div className="smoking-input-with-unit"><button type="button" aria-label="전자담배 수량 줄이기" onClick={() => adjustCount('electronicCount', -1)}>−</button><input type="text" inputMode="numeric" maxLength={4} placeholder="0" value={draft.electronicCount} onChange={(event) => { const value = event.target.value; if (/^\d{0,4}$/.test(value)) setDraft((current) => ({ ...current, electronicCount: value })); }} /><button type="button" aria-label="전자담배 수량 늘리기" onClick={() => adjustCount('electronicCount', 1)}>+</button><span>개</span></div></label>
          <div className="smoking-total-preview"><span>하루 총 흡연량</span><strong>{formatCount((Number(draft.regularCount) || 0) + (Number(draft.electronicCount) || 0))}개</strong></div>
          {recordError && <p className="weight-dialog-error" role="alert">{recordError}</p>}
          <button className="settings-save-button weight-save-button" type="submit" disabled={saving}>{saving ? '저장 중...' : '기록 저장'}</button>
        </form>
      </div>}
    </main>
  );
}
