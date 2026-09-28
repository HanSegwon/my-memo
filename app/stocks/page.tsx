'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type StockSettings = {
  initial_investment: number;
  monthly_return_rate: number;
  display_rounds: number;
};

type StockRecord = {
  id: number;
  round_no: number;
  record_date: string;
  profit: number;
  deposit: number;
  withdrawal: number;
};

type DraftRecord = {
  profit: string;
  deposit: string;
  withdrawal: string;
};

type FieldName = 'profit' | 'deposit' | 'withdrawal';

const MAX_INPUT_AMOUNT = 1_000_000_000;

const emptyDraft: DraftRecord = {
  profit: '0',
  deposit: '0',
  withdrawal: '0',
};

function formatMoney(value: number) {
  return Math.round(value).toLocaleString('ko-KR');
}

function formatChartAmount(value: number) {
  const absolute = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absolute >= 100_000_000) {
    return `${sign}${(absolute / 100_000_000)
      .toFixed(1)
      .replace(/\.0$/, '')}억`;
  }

  if (absolute >= 10_000) {
    return `${sign}${Math.round(absolute / 10_000).toLocaleString('ko-KR')}만`;
  }

  return formatMoney(value);
}

function getNumberClass(value: number) {
  if (value > 0) return 'positive';
  if (value < 0) return 'negative';
  return 'zero';
}

function formatMonth(roundNo: number) {
  const date = new Date(2025, 8 + roundNo - 1, 1);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  return `${year}.${month}`;
}

function getCurrentRound() {
  const now = new Date();

  const startYear = 2025;
  const startMonth = 8;

  const currentMonth =
    now.getFullYear() * 12 + now.getMonth();

  const startMonthIndex =
    startYear * 12 + startMonth;

  return currentMonth - startMonthIndex + 1;
}

function cleanMoneyInput(value: string) {
  // 모바일 키보드에서 들어오는 유니코드 마이너스를
  // 일반 하이픈(-)으로 통일
  const normalized = value
    .replace(/−/g, '-')
    .replace(/﹣/g, '-')
    .replace(/－/g, '-');

  if (normalized === '') return '';
  if (normalized === '-') return '-';

  const withoutComma = normalized.replace(/,/g, '');
  const negative = withoutComma.startsWith('-');
  const digits = withoutComma.replace(/[^\d]/g, '');

  if (!digits) {
    return negative ? '-' : '';
  }

  return `${negative ? '-' : ''}${digits}`;
}

function normalizeMoneyValue(value: string) {
  const cleaned = cleanMoneyInput(value);

  if (cleaned === '' || cleaned === '-') {
    return '0';
  }

  const number = Number(cleaned);

  if (!Number.isFinite(number)) {
    return '0';
  }

  const limited = Math.max(
    -MAX_INPUT_AMOUNT,
    Math.min(MAX_INPUT_AMOUNT, Math.trunc(number))
  );

  return String(limited);
}

function formatInputValue(value: string, focused: boolean) {
  if (focused) {
    return value;
  }

  if (value === '' || value === '-') {
    return value;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return value;
  }

  return number.toLocaleString('ko-KR');
}

export default function StocksPage() {

  const [showNegativeDialog, setShowNegativeDialog] =
    useState(false);

  const [pendingProfitRound, setPendingProfitRound] =
    useState<number | null>(null);

  const longPressTimer =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const router = useRouter();

  const [authenticated, setAuthenticated] =
    useState<boolean | null>(null);

  const [settings, setSettings] =
    useState<StockSettings | null>(null);

  const [records, setRecords] =
    useState<StockRecord[]>([]);

  const [drafts, setDrafts] =
    useState<Record<number, DraftRecord>>({});

  const [focusedField, setFocusedField] =
    useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingRound, setSavingRound] =
    useState<number | null>(null);

  const [showSettings, setShowSettings] =
    useState(false);

  const [showChart, setShowChart] = useState(false);

  const [savingSettings, setSavingSettings] =
    useState(false);

  const [settingsForm, setSettingsForm] = useState({
    initialInvestment: '',
    monthlyReturnRate: '',
    displayRounds: '',
  });

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const response = await fetch('/api/auth', {
      cache: 'no-store',
    });

    const data = await response.json();

    if (!data.authenticated) {
      router.replace('/');
      return;
    }

    setAuthenticated(true);
    await loadStocks();
  }

  async function loadStocks() {
    setLoading(true);

    const response = await fetch('/api/stocks', {
      cache: 'no-store',
    });

    const data = await response.json();

    if (!response.ok) {
      alert(
        data.message ||
          '주식성과 데이터를 불러오지 못했습니다.'
      );

      setLoading(false);
      return;
    }

    const loadedSettings =
      data.settings as StockSettings;

    const loadedRecords =
      data.records as StockRecord[];

    setSettings(loadedSettings);
    setRecords(loadedRecords);

    setSettingsForm({
      initialInvestment: String(
        loadedSettings.initial_investment
      ),
      monthlyReturnRate: String(
        loadedSettings.monthly_return_rate
      ),
      displayRounds: String(
        loadedSettings.display_rounds
      ),
    });

    const nextDrafts: Record<
      number,
      DraftRecord
    > = {};

    loadedRecords.forEach((record) => {
      nextDrafts[record.round_no] = {
        profit: String(record.profit),
        deposit: String(record.deposit),
        withdrawal: String(record.withdrawal),
      };
    });

    setDrafts(nextDrafts);
    setLoading(false);
  }

  function updateDraft(
    roundNo: number,
    field: FieldName,
    value: string
  ) {
    const cleaned = cleanMoneyInput(value);

    setDrafts((current) => ({
      ...current,
      [roundNo]: {
        ...(current[roundNo] ?? emptyDraft),
        [field]: cleaned,
      },
    }));
  }

  function startProfitLongPress(
    e: React.PointerEvent<HTMLInputElement>,
    roundNo: number
  ) {
    if (e.pointerType !== 'touch') {
      return;
    }

    longPressTimer.current =
      setTimeout(() => {
        const current =
          drafts[roundNo]?.profit ?? '0';

        const value = Number(current);

        if (
          Number.isFinite(value) &&
          value > 0
        ) {
          setPendingProfitRound(roundNo);
          setShowNegativeDialog(true);
        }
      }, 700);
  }

  function cancelProfitLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  async function convertProfitToNegative() {
    if (pendingProfitRound === null) {
      return;
    }

    const roundNo = pendingProfitRound;

    const current =
      drafts[roundNo]?.profit ?? '0';

    const value = Math.abs(
      Number(current)
    );

    const nextValue =
      Number.isFinite(value)
        ? `-${Math.trunc(value)}`
        : '0';

    const currentDraft =
      drafts[roundNo] ?? emptyDraft;

    const nextDraft: DraftRecord = {
      ...currentDraft,
      profit: nextValue,
    };

    // 화면의 값을 음수로 변경
    setDrafts((previous) => ({
      ...previous,
      [roundNo]: nextDraft,
    }));

    // 같은 음수값을 바로 DB에 저장
    await saveRecord(
      roundNo,
      nextDraft
    );

    setShowNegativeDialog(false);
    setPendingProfitRound(null);
  }



  async function saveRecord(
    roundNo: number,
    draft: DraftRecord
  ) {
    const profit = Number(draft.profit || 0);
    const deposit = Number(draft.deposit || 0);
    const withdrawal = Number(draft.withdrawal || 0);

    if (
      Math.abs(profit) > MAX_INPUT_AMOUNT ||
      Math.abs(deposit) > MAX_INPUT_AMOUNT ||
      Math.abs(withdrawal) > MAX_INPUT_AMOUNT
    ) {
      alert(
        '수익·입금·출금은 각각 10억원까지 입력할 수 있습니다.'
      );
      return;
    }

    setSavingRound(roundNo);

    const response = await fetch('/api/stocks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'record',
        roundNo,
        profit,
        deposit,
        withdrawal,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(
        data.message ||
          '자동 저장에 실패했습니다.'
      );

      setSavingRound(null);
      return;
    }

    setRecords((current) => {
      const others = current.filter(
        (record) =>
          record.round_no !== roundNo
      );

      return [...others, data.record].sort(
        (a, b) =>
          a.round_no - b.round_no
      );
    });

    setSavingRound(null);
  }

  async function handleFieldBlur(
    roundNo: number,
    field: FieldName
  ) {
    const current =
      drafts[roundNo] ?? emptyDraft;

    const normalizedValue =
      normalizeMoneyValue(current[field]);

    const nextDraft: DraftRecord = {
      ...current,
      [field]: normalizedValue,
    };

    setDrafts((previous) => ({
      ...previous,
      [roundNo]: nextDraft,
    }));

    setFocusedField(null);

    await saveRecord(roundNo, nextDraft);
  }

  async function saveSettings() {
    const initialInvestment = Number(
      settingsForm.initialInvestment.replace(/,/g, '')
    );

    const monthlyReturnRate = Number(
      settingsForm.monthlyReturnRate
    );

    const displayRounds = Number(
      settingsForm.displayRounds
    );

    if (
      !Number.isInteger(initialInvestment) ||
      initialInvestment < 0 ||
      initialInvestment > 100_000_000
    ) {
      alert(
        '초기투자금은 0원부터 1억원까지 입력할 수 있습니다.'
      );
      return;
    }

    if (
      !/^\d+(\.\d{1,2})?$/.test(
        settingsForm.monthlyReturnRate
      )
    ) {
      alert(
        '월간수익률은 소수점 둘째 자리까지 입력해주세요.'
      );
      return;
    }

    if (
      !Number.isInteger(displayRounds) ||
      displayRounds < 1 ||
      displayRounds > 999
    ) {
      alert(
        '표시 회차는 1회부터 999회까지 입력할 수 있습니다.'
      );
      return;
    }

    setSavingSettings(true);

    const response = await fetch('/api/stocks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'settings',
        initialInvestment,
        monthlyReturnRate,
        displayRounds,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(
        data.message ||
          '설정 저장에 실패했습니다.'
      );

      setSavingSettings(false);
      return;
    }

    setSettings(data.settings);

    setSettingsForm({
      initialInvestment: String(
        data.settings.initial_investment
      ),
      monthlyReturnRate: String(
        data.settings.monthly_return_rate
      ),
      displayRounds: String(
        data.settings.display_rounds
      ),
    });

    setShowSettings(false);
    setSavingSettings(false);
  }

  function getCurrentRound() {
    const now = new Date();

    const startYear = 2025;
    const startMonth = 8; // 2025년 9월 (0부터 시작)

    const currentMonth =
      now.getFullYear() * 12 + now.getMonth();

    const startMonthIndex =
      startYear * 12 + startMonth;

    return currentMonth - startMonthIndex + 1;
  }

  const calculatedRows = useMemo(() => {
    if (!settings) return [];

    const result = [];

    let previousTotal =
      settings.initial_investment;

    let previousGoal =
      settings.initial_investment;

    const rate =
      settings.monthly_return_rate / 100;

    for (
      let round = 1;
      round <= settings.display_rounds;
      round += 1
    ) {
      const record = records.find(
        (item) => item.round_no === round
      );

      const draft =
        drafts[round] ?? {
          profit: String(record?.profit ?? 0),
          deposit: String(record?.deposit ?? 0),
          withdrawal: String(
            record?.withdrawal ?? 0
          ),
        };

      const profit = Number(
        draft.profit || 0
      );

      const deposit = Number(
        draft.deposit || 0
      );

      const withdrawal = Number(
        draft.withdrawal || 0
      );

      const total =
        previousTotal +
        profit +
        deposit -
        withdrawal;

      const goal = Math.round(
        previousGoal * (1 + rate)
      );

      result.push({
        roundNo: round,
        date: formatMonth(round),
        profit,
        deposit,
        withdrawal,
        total,
        goal,
      });

      previousTotal = total;
      previousGoal = goal;
    }

    return result;
  }, [settings, records, drafts]);


    const currentRoundNo = getCurrentRound();

  const highlightedGoalRoundNo = useMemo(() => {
    const currentRoundData = calculatedRows.find(
      (row) => row.roundNo === currentRoundNo
    );

    if (!currentRoundData) {
      return null;
    }

    const currentTotal = currentRoundData.total;

    const candidates = calculatedRows.filter(
      (row) => row.goal < currentTotal
    );

    if (candidates.length === 0) {
      return null;
    }

    return candidates.reduce((highest, row) => {
      return row.goal > highest.goal
        ? row
        : highest;
    }).roundNo;
  }, [calculatedRows, currentRoundNo]);


  const summary = useMemo(() => {
    return calculatedRows.reduce(
      (sum, row) => ({
        profit: sum.profit + row.profit,
        deposit:
          sum.deposit + row.deposit,
        withdrawal:
          sum.withdrawal + row.withdrawal,
      }),
      {
        profit: 0,
        deposit: 0,
        withdrawal: 0,
      }
    );
  }, [calculatedRows]);

  const chartWidth = Math.max(720, calculatedRows.length * 72 + 82);
  const chartHeight = 276;
  const chartLeft = 58;
  const chartRight = 22;
  const chartTop = 18;
  const chartBottom = 56;
  const chartPlotWidth = chartWidth - chartLeft - chartRight;
  const chartPlotHeight = chartHeight - chartTop - chartBottom;
  const chartMin = Math.min(0, ...calculatedRows.map((row) => row.total));
  const chartMax = Math.max(0, ...calculatedRows.map((row) => row.total));
  const chartRange = Math.max(chartMax - chartMin, 1);
  const chartY = (value: number) =>
    chartTop + ((chartMax - value) / chartRange) * chartPlotHeight;
  const chartZeroY = chartY(0);
  const chartSlotWidth = calculatedRows.length
    ? chartPlotWidth / calculatedRows.length
    : 0;
  const chartPoints = calculatedRows.map((row, index) => ({
    x: chartLeft + chartSlotWidth * (index + 0.5),
    y: chartY(row.total),
    total: row.total,
    date: row.date,
    roundNo: row.roundNo,
  }));
  const chartLinePath = chartPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  if (
    authenticated === null ||
    loading ||
    !settings
  ) {
    return (
      <main className="app">
        <section className="container">
          <div className="empty">
            <p>불러오는 중...</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app">
      <section className="container stock-container">
        <header className="stock-header">
          <div>
            <p className="eyebrow">Master 3.0</p>
            <h1>주식성과</h1>
          </div>

          <div className="stock-header-actions">
            <button
              className={`stock-chart-toggle${showChart ? ' is-active' : ''}`}
              type="button"
              onClick={() => setShowChart((visible) => !visible)}
              aria-expanded={showChart}
              aria-controls="stock-total-chart"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 16.5h14" />
                <path d="M5 14V9m5 5V5m5 9V7" />
                <path d="m4 7 5-3 5 2 3-3" />
              </svg>
              차트
            </button>

            <button
              className="settings-button"
              onClick={() =>
                setShowSettings(true)
              }
            >
              설정
            </button>

            <Link
              href="/"
              className="logout-button"
            >
              처음으로
            </Link>
          </div>
        </header>

        {showChart && (
          <section className="stock-chart-panel" id="stock-total-chart">
            <div className="stock-chart-heading">
              <div>
                <h2>회차별 총액</h2>
                <p>회차 날짜를 기준으로 자산 흐름을 확인하세요.</p>
              </div>
              <div className="stock-chart-legend" aria-label="차트 범례">
                <span><i className="chart-legend-bar" />총액</span>
                <span><i className="chart-legend-line" />추이</span>
              </div>
            </div>

            <div className="stock-chart-scroll" aria-label="회차별 총액 차트, 좌우로 스크롤할 수 있습니다">
              <svg
                className="stock-chart-svg"
                role="img"
                aria-label={`전체 ${calculatedRows.length}회차의 총액 막대 및 추이 그래프`}
                width={chartWidth}
                height={chartHeight}
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              >
                {[0, 1, 2, 3, 4].map((step) => {
                  const value = chartMax - (chartRange * step) / 4;
                  const y = chartY(value);

                  return (
                    <g key={step}>
                      <line
                        x1={chartLeft}
                        x2={chartWidth - chartRight}
                        y1={y}
                        y2={y}
                        stroke="#edf0f4"
                        strokeWidth="1"
                      />
                      <text
                        x={chartLeft - 10}
                        y={y + 3}
                        fill="#8a929e"
                        fontSize="10"
                        textAnchor="end"
                      >
                        {formatChartAmount(value)}
                      </text>
                    </g>
                  );
                })}

                {chartPoints.map((point) => {
                  const barWidth = Math.min(30, chartSlotWidth * 0.42);
                  const barHeight = Math.max(Math.abs(chartZeroY - point.y), 1);

                  return (
                    <g key={point.roundNo}>
                      <rect
                        x={point.x - barWidth / 2}
                        y={Math.min(point.y, chartZeroY)}
                        width={barWidth}
                        height={barHeight}
                        rx="4"
                        fill="#9aacc7"
                        fillOpacity="0.42"
                      />
                      <text
                        x={point.x}
                        y={chartHeight - 28}
                        fill="#7d8592"
                        fontSize="10"
                        textAnchor="middle"
                      >
                        {point.date.slice(2)}
                      </text>
                    </g>
                  );
                })}

                {chartLinePath && (
                  <>
                    <path
                      d={chartLinePath}
                      fill="none"
                      stroke="#218b69"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {chartPoints.map((point) => (
                      <circle
                        key={`point-${point.roundNo}`}
                        cx={point.x}
                        cy={point.y}
                        r="3.5"
                        fill="#fff"
                        stroke="#218b69"
                        strokeWidth="2"
                      />
                    ))}
                  </>
                )}

                <text
                  x={chartLeft + chartPlotWidth / 2}
                  y={chartHeight - 8}
                  fill="#9aa1aa"
                  fontSize="10"
                  textAnchor="middle"
                >
                  회차 날짜
                </text>
              </svg>
            </div>

            <p className="stock-chart-hint">좌우로 밀어 전체 회차를 확인할 수 있어요.</p>
          </section>
        )}

        <section className="stock-summary">
          <div className="summary-card">
            <span>누적 수익</span>
            <strong
              className={getNumberClass(
                summary.profit
              )}
            >
              {formatMoney(summary.profit)}
            </strong>
          </div>

          <div className="summary-card">
            <span>누적 입금</span>
            <strong
              className={getNumberClass(
                summary.deposit
              )}
            >
              {formatMoney(summary.deposit)}
            </strong>
          </div>

          <div className="summary-card">
            <span>누적 출금</span>
            <strong className="negative">
              {formatMoney(summary.withdrawal)}
            </strong>
          </div>
        </section>

        <section className="stock-table-wrap">
          <table className="stock-table">
            <thead>
              <tr>
                <th>회차</th>
                <th>날짜</th>
                <th>수익</th>
                <th>입금</th>
                <th>출금</th>
                <th>총액</th>
                <th>목표</th>
              </tr>
            </thead>

            <tbody>
              {calculatedRows.map((row) => {
                const draft =
                  drafts[row.roundNo] ?? emptyDraft;

                const isCurrentRound =
                  row.roundNo === getCurrentRound();

                return (
                  <tr
                    key={row.roundNo}
                    className={[
                      isCurrentRound
                        ? 'current-round-values'
                        : '',
                      row.roundNo === highlightedGoalRoundNo
                        ? 'goal-milestone-row'
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <td className="round-cell">
                      {row.roundNo}회차
                    </td>

                    <td className="date-cell">
                      {row.date}
                    </td>

                    <td>
                      <input
                        className={`money-input ${getNumberClass(
                          Number(draft.profit || 0)
                        )}`}
                        inputMode="numeric"
                        value={formatInputValue(
                          draft.profit,
                          focusedField ===
                            `${row.roundNo}-profit`
                        )}
                        onPointerDown={(e) =>
                          startProfitLongPress(
                            e,
                            row.roundNo
                          )
                        }
                        onPointerUp={cancelProfitLongPress}
                        onPointerCancel={cancelProfitLongPress}
                        onContextMenu={(e) => {
                          e.preventDefault();
                        }}
                        onFocus={() =>
                          setFocusedField(
                            `${row.roundNo}-profit`
                          )
                        }
                        onBlur={() =>
                          handleFieldBlur(
                            row.roundNo,
                            'profit'
                          )
                        }
                        onChange={(e) =>
                          updateDraft(
                            row.roundNo,
                            'profit',
                            e.target.value
                          )
                        }
                      />
                    </td>

                    <td>
                      <input
                        className={`money-input ${getNumberClass(
                          Number(draft.deposit || 0)
                        )}`}
                        inputMode="decimal"
                        value={formatInputValue(
                          draft.deposit,
                          focusedField ===
                            `${row.roundNo}-deposit`
                        )}
                        onFocus={() =>
                          setFocusedField(
                            `${row.roundNo}-deposit`
                          )
                        }
                        onBlur={() =>
                          handleFieldBlur(
                            row.roundNo,
                            'deposit'
                          )
                        }
                        onChange={(e) =>
                          updateDraft(
                            row.roundNo,
                            'deposit',
                            e.target.value
                          )
                        }
                      />
                    </td>

                    <td>
                      <input
                        className="money-input negative"
                        inputMode="decimal"
                        value={formatInputValue(
                          draft.withdrawal,
                          focusedField ===
                            `${row.roundNo}-withdrawal`
                        )}
                        onFocus={() =>
                          setFocusedField(
                            `${row.roundNo}-withdrawal`
                          )
                        }
                        onBlur={() =>
                          handleFieldBlur(
                            row.roundNo,
                            'withdrawal'
                          )
                        }
                        onChange={(e) =>
                          updateDraft(
                            row.roundNo,
                            'withdrawal',
                            e.target.value
                          )
                        }
                      />
                    </td>

                    <td>
                      <strong className="result-value">
                        {formatMoney(row.total)}
                      </strong>
                    </td>

                    <td>
                      <strong className="result-value">
                        {formatMoney(row.goal)}
                      </strong>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </section>

      {showSettings && (
        <div className="modal-backdrop">
          <div className="settings-modal">
            <div className="settings-modal-header">
              <div>
                <p className="eyebrow">
                  STOCK SETTINGS
                </p>
                <h2>주식성과 설정</h2>
              </div>

              <button
                className="modal-close"
                onClick={() =>
                  setShowSettings(false)
                }
              >
                닫기
              </button>
            </div>

            <div className="settings-form">
              <label>
                <span>초기투자금 (원)</span>

                <input
                  inputMode="numeric"
                  value={Number(
                    settingsForm.initialInvestment
                  ).toLocaleString('ko-KR')}
                  onChange={(e) =>
                    setSettingsForm(
                      (current) => ({
                        ...current,
                        initialInvestment:
                          cleanMoneyInput(
                            e.target.value
                          ),
                      })
                    )
                  }
                />
              </label>

              <label>
                <span>월간수익률 (%)</span>

                <input
                  inputMode="decimal"
                  value={
                    settingsForm.monthlyReturnRate
                  }
                  onChange={(e) =>
                    setSettingsForm(
                      (current) => ({
                        ...current,
                        monthlyReturnRate:
                          e.target.value.replace(
                            /[^0-9.]/g,
                            ''
                          ),
                      })
                    )
                  }
                />
              </label>

              <label>
                <span>표시 회차</span>

                <input
                  inputMode="numeric"
                  value={
                    settingsForm.displayRounds
                  }
                  onChange={(e) =>
                    setSettingsForm(
                      (current) => ({
                        ...current,
                        displayRounds:
                          e.target.value.replace(
                            /\D/g,
                            ''
                          ),
                      })
                    )
                  }
                />
              </label>
            </div>

            <div className="settings-help">
              <p>초기투자금: 최대 1억원</p>
              <p>
                월간수익률: 소수점 둘째 자리까지
              </p>
              <p>
                표시 회차: 최대 999회
              </p>
            </div>

            <button
              className="settings-save-button"
              onClick={saveSettings}
              disabled={savingSettings}
            >
              {savingSettings
                ? '저장 중...'
                : '설정 저장'}
            </button>
          </div>
        </div>
      )}

      {showNegativeDialog && (
        <div className="negative-dialog-backdrop">
          <div className="negative-dialog">
            <h3>음수로 변환하시겠습니까?</h3>

            <p>
              현재 수익값에 마이너스 부호를
              적용합니다.
            </p>

            <div className="negative-dialog-actions">
              <button
                type="button"
                className="negative-dialog-cancel"
                onClick={() => {
                  setShowNegativeDialog(false);
                  setPendingProfitRound(null);
                }}
              >
                취소
              </button>

              <button
                type="button"
                className="negative-dialog-confirm"
                onClick={convertProfitToNegative}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}


    </main>
  );
}
