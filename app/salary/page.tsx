'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import LoadingDots from '../../components/LoadingDots';

type SalaryRecord = {
  income_year: number;
  income_month: number;
  monthly_salary: number | null;
  base_bonus: number | null;
  extra_bonus: number | null;
  is_sample: boolean;
  updated_at: string;
};

type ChartKind = 'income' | 'average' | 'bonus';
type ChartRow = { year: number; value: number };
type IncomeDraft = { monthlySalary: string; baseBonus: string; extraBonus: string };

const EMPTY_DRAFT: IncomeDraft = { monthlySalary: '', baseBonus: '', extraBonus: '' };
const CHART_OPTIONS: Array<{ value: ChartKind; label: string; title: string }> = [
  { value: 'income', label: '총 소득', title: '년도별 총 소득 추이' },
  { value: 'average', label: '평균 급여', title: '년도별 평균 급여' },
  { value: 'bonus', label: '총 상여금', title: '년도별 총 상여금' },
];

function currentKoreanYear() {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', year: 'numeric' }).format(new Date()));
}

function currentKoreanMonth() {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', month: 'numeric' }).format(new Date()));
}

function formatAmount(value: number) { return Math.round(value).toLocaleString('ko-KR'); }

export default function SalaryPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [selectedYear, setSelectedYear] = useState(currentKoreanYear());
  const [chartKind, setChartKind] = useState<ChartKind>('income');
  const [editingMonth, setEditingMonth] = useState<number | null>(null);
  const [draft, setDraft] = useState<IncomeDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const chartScrollRef = useRef<HTMLDivElement | null>(null);
  const thisYear = currentKoreanYear();
  const thisMonth = currentKoreanMonth();
  const years = useMemo(() => Array.from({ length: thisYear - 2015 + 1 }, (_, index) => 2015 + index), [thisYear]);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/salary-records', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '연봉추이 자료를 불러오지 못했습니다.');
      setRecords(data.records ?? []);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '연봉추이 자료를 불러오지 못했습니다.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/auth', { cache: 'no-store' });
        const data = await response.json();
        if (cancelled) return;
        setAuthenticated(Boolean(data.authenticated));
        if (data.authenticated) await loadRecords();
        else setLoading(false);
      } catch {
        if (!cancelled) { setAuthenticated(false); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [loadRecords]);

  const recordsByMonth = useMemo(() => new Map(records.map((record) => [`${record.income_year}-${record.income_month}`, record])), [records]);
  const selectedRows = useMemo(() => Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const record = recordsByMonth.get(`${selectedYear}-${month}`);
    const past = selectedYear < thisYear || (selectedYear === thisYear && month < thisMonth);
    const preEmployment = selectedYear === 2015 && month <= 8;
    const salary = preEmployment ? null : record?.monthly_salary ?? null;
    const base = preEmployment ? null : record?.base_bonus ?? null;
    const extra = preEmployment ? null : record?.extra_bonus ?? null;
    const hasEntry = salary !== null || base !== null || extra !== null;
    const total = preEmployment ? null : hasEntry ? Number(salary ?? 0) + Number(base ?? 0) + Number(extra ?? 0) : past ? 0 : null;
    return { month, record, salary, base, extra, total, past, preEmployment };
  }), [recordsByMonth, selectedYear, thisYear, thisMonth]);

  const totals = useMemo(() => {
    const elapsedMonths = selectedYear < thisYear ? 12 : selectedYear === thisYear ? thisMonth : 0;
    const elapsed = selectedRows.slice(0, elapsedMonths);
    const salaryTotal = elapsed.reduce((sum, row) => sum + Number(row.salary ?? 0), 0);
    const baseBonusTotal = elapsed.reduce((sum, row) => sum + Number(row.base ?? 0), 0);
    const extraBonusTotal = elapsed.reduce((sum, row) => sum + Number(row.extra ?? 0), 0);
    return { salary: salaryTotal, baseBonus: baseBonusTotal, extraBonus: extraBonusTotal, total: salaryTotal + baseBonusTotal + extraBonusTotal };
  }, [selectedRows, selectedYear, thisYear, thisMonth]);

  const chartRows = useMemo<ChartRow[]>(() => years.map((year) => {
    const monthsCount = year < thisYear ? 12 : thisMonth;
    const firstIncomeMonth = year === 2015 ? 9 : 1;
    const incomeMonthsCount = Math.max(0, monthsCount - firstIncomeMonth + 1);
    const yearRecords = records.filter((record) => record.income_year === year);
    const salary = Array.from({ length: incomeMonthsCount }, (_, index) => Number(yearRecords.find((record) => record.income_month === firstIncomeMonth + index)?.monthly_salary ?? 0)).reduce((sum, value) => sum + value, 0);
    const bonus = yearRecords.filter((record) => record.income_month >= firstIncomeMonth && record.income_month <= monthsCount).reduce((sum, record) => sum + Number(record.base_bonus ?? 0) + Number(record.extra_bonus ?? 0), 0);
    const value = chartKind === 'income' ? salary + bonus : chartKind === 'average' ? (incomeMonthsCount ? salary / incomeMonthsCount : 0) : bonus;
    return { year, value };
  }), [years, thisYear, thisMonth, records, chartKind]);

  const chartWidth = Math.max(chartRows.length * 32 + 20, 360);
  const chartHeight = 274;
  const chartLeft = 58;
  const chartTop = 18;
  const chartBottom = 42;
  const plotWidth = chartWidth;
  const plotHeight = chartHeight - chartTop - chartBottom;
  const maxDataValue = Math.max(...chartRows.map((row) => row.value), 0);
  const chartMax = maxDataValue > 0 ? maxDataValue * 1.1 : 1;
  const chartY = (value: number) => chartTop + (1 - value / chartMax) * plotHeight;
  const points = chartRows.map((row, index) => ({ year: row.year, value: row.value, x: plotWidth * ((index + 0.5) / chartRows.length), y: chartY(row.value) }));
  const currentYearX = points.find((point) => point.year === thisYear)?.x;
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const chartLineColor = chartKind === 'income' ? '#218b69' : chartKind === 'average' ? '#426b9a' : '#d1843d';

  useEffect(() => {
    const chart = chartScrollRef.current;
    if (!chart || loading || !records.length) return;
    const frame = requestAnimationFrame(() => { chart.scrollLeft = chart.scrollWidth; });
    return () => cancelAnimationFrame(frame);
  }, [chartRows.length, loading, records.length]);

  function openMonth(month: number) {
    const record = recordsByMonth.get(`${selectedYear}-${month}`);
    setDraft({
      monthlySalary: record?.monthly_salary === null || record?.monthly_salary === undefined ? '' : String(record.monthly_salary),
      baseBonus: record?.base_bonus === null || record?.base_bonus === undefined ? '' : String(record.base_bonus),
      extraBonus: record?.extra_bonus === null || record?.extra_bonus === undefined ? '' : String(record.extra_bonus),
    });
    setEditingMonth(month);
    setError('');
  }

  async function saveMonth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingMonth === null || saving) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/salary-records', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: selectedYear, month: editingMonth, ...draft }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '월별 수입을 저장하지 못했습니다.');
      setRecords((current) => {
        const withoutMonth = current.filter((item) => !(item.income_year === selectedYear && item.income_month === editingMonth));
        return data.record ? [...withoutMonth, data.record] : withoutMonth;
      });
      setEditingMonth(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '월별 수입을 저장하지 못했습니다.');
    } finally { setSaving(false); }
  }

  function displayedValue(value: number | null, past: boolean, preEmployment = false) {
    return preEmployment ? '' : value === null ? (past ? '0' : '') : formatAmount(value);
  }

  if (authenticated === null || loading) return <main className="loading-screen"><LoadingDots /></main>;
  if (!authenticated) return <main className="app"><section className="container"><div className="feature-placeholder"><h2>접근할 수 없습니다.</h2><p>먼저 Passcode를 입력해주세요.</p><Link href="/" className="back-link">처음으로</Link></div></section></main>;

  return (
    <main className="app">
      <section className="container stock-container salary-container">
        <header className="stock-header">
          <div><p className="eyebrow brand-eyebrow">Master 3.0</p><h1>연봉추이</h1></div>
          <Link href="/" className="logout-button">처음으로</Link>
        </header>

        {error && <p className="salary-error" role="alert">{error}</p>}

        <section className="stock-chart-panel salary-chart-panel">
          <div className="stock-chart-heading">
            <h2>{CHART_OPTIONS.find((option) => option.value === chartKind)?.title}</h2>
          </div>
          <div className="routine-day-switch salary-chart-options" role="group" aria-label="차트 종류 선택">
            {CHART_OPTIONS.map((option) => <button key={option.value} type="button" className={chartKind === option.value ? 'is-selected' : ''} aria-pressed={chartKind === option.value} onClick={() => setChartKind(option.value)}>{option.label}</button>)}
          </div>
          <div className="stock-chart-layout salary-chart-layout">
            <svg className="stock-chart-y-axis" aria-hidden="true" width={chartLeft} height={chartHeight} viewBox={`0 0 ${chartLeft} ${chartHeight}`}>
              {[0, 1, 2, 3, 4].map((index) => {
                const y = chartTop + plotHeight * (index / 4);
                const value = chartMax * (1 - index / 4);
                return <text key={index} x={chartLeft - 8} y={y + 3} fill="#737d8b" fontSize="9" textAnchor="end">{formatAmount(value / 1000)}</text>;
              })}
              <text x={chartLeft - 8} y="10" fill="#737d8b" fontSize="8" textAnchor="end">천원</text>
            </svg>
            <div ref={chartScrollRef} className="stock-chart-scroll salary-chart-scroll" aria-label={`${CHART_OPTIONS.find((option) => option.value === chartKind)?.title} 차트`}>
              <svg className="salary-chart-svg" role="img" aria-label={`${CHART_OPTIONS.find((option) => option.value === chartKind)?.title} 막대 및 꺾은선 그래프`} width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
                {[0, 1, 2, 3, 4].map((index) => {
                  const y = chartTop + plotHeight * (index / 4);
                  return <line key={index} x1="0" x2={chartWidth} y1={y} y2={y} stroke="#edf0f4" />;
                })}
                {currentYearX !== undefined && <line x1={currentYearX} x2={currentYearX} y1={chartTop} y2={chartHeight - chartBottom} stroke="#3478df" strokeDasharray="3 4" strokeWidth="1.5" />}
                {points.map((point) => <rect key={`bar-${point.year}`} x={point.x - 10} y={point.y} width="20" height={chartTop + plotHeight - point.y} rx="3" fill="#c5d1e1" />)}
                <path d={linePath} fill="none" stroke={chartLineColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {points.map((point) => <g key={`point-${point.year}`}><circle cx={point.x} cy={point.y} r="3.5" fill="#fff" stroke={chartLineColor} strokeWidth="2" /><text x={point.x} y={chartHeight - 13} fill="#7d8592" fontSize="9" textAnchor="middle">’{String(point.year).slice(-2)}</text></g>)}
              </svg>
            </div>
          </div>
          <div className="salary-chart-legend"><span><i className="chart-legend-bar" />금액</span><span><i className="chart-legend-line" style={{ background: chartLineColor }} />추이</span></div>
        </section>

        <div className="salary-year-select-row">
          <label htmlFor="salary-year">년도</label>
          <select id="salary-year" value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))}>
            {[...years].reverse().map((year) => <option value={year} key={year}>{year}년</option>)}
          </select>
        </div>

        {selectedYear <= 2017 && <p className="salary-sample-note">2015~2017년에는 화면 확인용 가상 데이터가 들어 있습니다.</p>}
        <div className="stock-table-wrap salary-table-wrap">
          <table className="stock-table salary-table">
            <thead><tr><th>년도</th><th>월</th><th>월급여</th><th>기본상여</th><th>추가상여</th><th>총합</th></tr></thead>
            <tbody>
              <tr className="salary-total-row"><td colSpan={2}>Total</td><td>{formatAmount(totals.salary)}</td><td>{formatAmount(totals.baseBonus)}</td><td>{formatAmount(totals.extraBonus)}</td><td>{formatAmount(totals.total)}</td></tr>
              {selectedRows.map((row) => (
              <tr key={row.month} className={`salary-row${row.record?.is_sample ? ' is-sample' : ''}${row.preEmployment ? ' is-pre-employment' : ''}`} onClick={() => { if (!row.preEmployment) openMonth(row.month); }} tabIndex={row.preEmployment ? -1 : 0} onKeyDown={(event) => { if (!row.preEmployment && (event.key === 'Enter' || event.key === ' ')) openMonth(row.month); }} aria-disabled={row.preEmployment} aria-label={`${selectedYear}년 ${row.month}월 수입${row.preEmployment ? '' : ' 수정'}`}>
                <td className="salary-year-cell">{selectedYear}</td><td className="salary-month-cell">{row.month}월</td>
                <td>{displayedValue(row.salary, row.past, row.preEmployment)}</td><td>{displayedValue(row.base, row.past, row.preEmployment)}</td><td>{displayedValue(row.extra, row.past, row.preEmployment)}</td><td className="salary-total-cell">{displayedValue(row.total, row.past, row.preEmployment)}</td>
              </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editingMonth !== null && (
        <div className="family-event-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEditingMonth(null); }}>
          <section className="family-event-modal" role="dialog" aria-modal="true" aria-labelledby="salary-form-title">
            <div className="family-event-modal-heading"><div><p className="eyebrow">MONTHLY INCOME</p><h2 id="salary-form-title">{selectedYear}년 {editingMonth}월 수입</h2></div><button type="button" onClick={() => setEditingMonth(null)} aria-label="닫기">×</button></div>
            <form className="family-event-form routine-form" onSubmit={(event) => void saveMonth(event)}>
              <label>월급여<input inputMode="numeric" value={draft.monthlySalary} onChange={(event) => setDraft((current) => ({ ...current, monthlySalary: event.target.value.replace(/[^\d,]/g, '') }))} placeholder="금액 입력" /></label>
              <label>기본상여<input inputMode="numeric" value={draft.baseBonus} onChange={(event) => setDraft((current) => ({ ...current, baseBonus: event.target.value.replace(/[^\d,]/g, '') }))} placeholder="금액 입력" /></label>
              <label>추가상여<input inputMode="numeric" value={draft.extraBonus} onChange={(event) => setDraft((current) => ({ ...current, extraBonus: event.target.value.replace(/[^\d,]/g, '') }))} placeholder="금액 입력" /></label>
              {error && <p className="routine-error" role="alert">{error}</p>}
              <button type="submit" className="family-event-save" disabled={saving}>{saving ? '저장 중...' : '저장'}</button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
