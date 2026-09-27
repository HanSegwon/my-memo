'use client';

import { useEffect, useMemo, useState } from 'react';
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
  if (value === '') return '';
  if (value === '-') return '-';

  const withoutComma = value.replace(/,/g, '');
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
          '주식관리 데이터를 불러오지 못했습니다.'
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
            <p className="eyebrow">MY MEMO</p>
            <h1>주식관리</h1>
          </div>

          <div className="stock-header-actions">
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
                    className={
                      isCurrentRound
                        ? 'current-round-values'
                        : ''
                    }
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
                        inputMode="decimal"
                        value={formatInputValue(
                          draft.profit,
                          focusedField ===
                            `${row.roundNo}-profit`
                        )}
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
                <h2>주식관리 설정</h2>
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
    </main>
  );
}