'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type FastingFrequency = 'weekly' | 'biweekly';
type Exercise = '상체' | '하체' | '코어' | '휴식';
type MealAmount = '금식' | '적게' | '중간' | '많이';

type WeightSettings = {
  id: number;
  fasting_frequency: FastingFrequency;
  fasting_weekdays: number[];
  fasting_anchor_date: string;
};

type WeightRecord = {
  record_date: string;
  weight_kg: number | null;
  exercise: Exercise | null;
  breakfast: MealAmount | null;
  lunch: MealAmount | null;
  dinner: MealAmount | null;
  other_food: string | null;
  updated_at: string;
};

type RecordDraft = {
  weightKg: string;
  exercise: Exercise | '';
  breakfast: MealAmount | '';
  lunch: MealAmount | '';
  dinner: MealAmount | '';
  otherFood: string;
};

const weekdays = [
  { number: 1, label: '월' },
  { number: 2, label: '화' },
  { number: 3, label: '수' },
  { number: 4, label: '목' },
  { number: 5, label: '금' },
  { number: 6, label: '토' },
  { number: 7, label: '일' },
];

const exercises: Exercise[] = ['상체', '하체', '코어', '휴식'];
const mealAmounts: MealAmount[] = ['금식', '적게', '중간', '많이'];

const emptyRecordDraft: RecordDraft = {
  weightKg: '',
  exercise: '',
  breakfast: '',
  lunch: '',
  dinner: '',
  otherFood: '',
};

function getKoreanToday() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function addDays(date: string, days: number) {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function getWeekdayNumber(date: string) {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function getMonday(date: string) {
  const monday = new Date(`${date}T00:00:00.000Z`);
  monday.setUTCDate(monday.getUTCDate() - getWeekdayNumber(date) + 1);
  return monday.toISOString().slice(0, 10);
}

function formatDate(date: string) {
  const [year, month, day] = date.split('-');
  const weekday = weekdays[getWeekdayNumber(date) - 1].label;
  return `'${year.slice(-2)}.${month}.${day} (${weekday})`;
}

function formatOtherFood(value: string | null | undefined) {
  if (!value) return '—';
  const characters = Array.from(value);
  return characters.length > 4 ? `${characters.slice(0, 4).join('')}...` : value;
}

function formatChartDate(date: string) {
  const [, month, day] = date.split('-');
  return `${month}.${day}`;
}

function formatWeight(value: number) {
  return Number(value).toFixed(2).replace(/\.0+$|(?<=\.[0-9])0$/, '');
}

function isFastingDay(date: string, settings: WeightSettings | null) {
  if (!settings?.fasting_weekdays.includes(getWeekdayNumber(date))) {
    return false;
  }

  if (settings.fasting_frequency === 'weekly') return true;

  const currentMonday = getMonday(date);
  const anchorMonday = getMonday(settings.fasting_anchor_date);
  const weekDistance = Math.round(
    (Date.parse(`${currentMonday}T00:00:00.000Z`) -
      Date.parse(`${anchorMonday}T00:00:00.000Z`)) /
      (7 * 24 * 60 * 60 * 1000)
  );

  return weekDistance >= 0 && weekDistance % 2 === 0;
}

function formatChartWeight(value: number) {
  return `${value.toFixed(1)} kg`;
}

export default function WeightPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [today, setToday] = useState('');
  const [records, setRecords] = useState<WeightRecord[]>([]);
  const [settings, setSettings] = useState<WeightSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [schemaRequired, setSchemaRequired] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [recordDraft, setRecordDraft] =
    useState<RecordDraft>(emptyRecordDraft);
  const [recordError, setRecordError] = useState('');
  const [savingRecord, setSavingRecord] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<{
    frequency: FastingFrequency;
    weekdays: number[];
  }>({ frequency: 'weekly', weekdays: [] });
  const [settingsError, setSettingsError] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    setToday(getKoreanToday());
    const refreshDate = () => setToday(getKoreanToday());
    const timer = setInterval(refreshDate, 60_000);
    void checkAuth();

    return () => clearInterval(timer);
  }, []);

  async function checkAuth() {
    try {
      const response = await fetch('/api/auth', { cache: 'no-store' });
      const data = await response.json();
      if (!data.authenticated) {
        router.replace('/');
        return;
      }

      setAuthenticated(true);
      await loadWeightData();
    } catch {
      setPageError('로그인 상태를 확인하지 못했습니다. 다시 시도해주세요.');
      setLoading(false);
    }
  }

  async function loadWeightData() {
    setLoading(true);
    setPageError('');
    setSchemaRequired(false);

    try {
      const response = await fetch('/api/weight', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) {
        if (data.code === 'WEIGHT_SCHEMA_REQUIRED') {
          setSchemaRequired(true);
        }
        setPageError(data.message || '체중관리 정보를 불러오지 못했습니다.');
        return;
      }

      setSettings(data.settings as WeightSettings);
      setRecords((data.records ?? []) as WeightRecord[]);
    } catch {
      setPageError('체중관리 정보를 불러오지 못했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }

  const visibleDates = useMemo(
    () => (today ? Array.from({ length: 6 }, (_, index) => addDays(today, -index)) : []),
    [today]
  );

  const recordMap = useMemo(
    () => new Map(records.map((record) => [record.record_date, record])),
    [records]
  );

  const chartRows = useMemo(
    () =>
      records
        .filter((record) => record.weight_kg !== null)
        .sort((a, b) => a.record_date.localeCompare(b.record_date)),
    [records]
  );

  function openRecord(date: string) {
    const record = recordMap.get(date);
    setRecordDraft(
      record
        ? {
            weightKg: record.weight_kg === null ? '' : String(record.weight_kg),
            exercise: record.exercise ?? '',
            breakfast: record.breakfast ?? '',
            lunch: record.lunch ?? '',
            dinner: record.dinner ?? '',
            otherFood: record.other_food ?? '',
          }
        : { ...emptyRecordDraft }
    );
    setRecordError('');
    setActiveDate(date);
  }

  async function saveRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeDate) return;

    if (
      recordDraft.weightKg &&
      (!/^\d+(\.\d{1,2})?$/.test(recordDraft.weightKg) ||
        Number(recordDraft.weightKg) <= 0 ||
        Number(recordDraft.weightKg) > 500)
    ) {
      setRecordError('체중은 0보다 크고 500kg 이하로 입력해주세요.');
      return;
    }

    setSavingRecord(true);
    setRecordError('');
    try {
      const response = await fetch('/api/weight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'record',
          recordDate: activeDate,
          ...recordDraft,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setRecordError(data.message || '기록을 저장하지 못했습니다.');
        return;
      }

      setRecords((current) =>
        [...current.filter((record) => record.record_date !== activeDate), data.record]
          .sort((a, b) => a.record_date.localeCompare(b.record_date))
      );
      setActiveDate(null);
    } catch {
      setRecordError('기록을 저장하지 못했습니다. 다시 시도해주세요.');
    } finally {
      setSavingRecord(false);
    }
  }

  function openSettings() {
    if (!settings) return;
    setSettingsDraft({
      frequency: settings.fasting_frequency,
      weekdays: [...settings.fasting_weekdays],
    });
    setSettingsError('');
    setShowSettings(true);
  }

  function toggleWeekday(day: number) {
    setSettingsDraft((current) => ({
      ...current,
      weekdays: current.weekdays.includes(day)
        ? current.weekdays.filter((item) => item !== day)
        : [...current.weekdays, day].sort((a, b) => a - b),
    }));
  }

  async function saveSettings() {
    setSavingSettings(true);
    setSettingsError('');
    try {
      const response = await fetch('/api/weight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'settings',
          fastingFrequency: settingsDraft.frequency,
          fastingWeekdays: settingsDraft.weekdays,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setSettingsError(data.message || '설정을 저장하지 못했습니다.');
        return;
      }

      setSettings(data.settings as WeightSettings);
      setShowSettings(false);
    } catch {
      setSettingsError('설정을 저장하지 못했습니다. 다시 시도해주세요.');
    } finally {
      setSavingSettings(false);
    }
  }

  if (authenticated === null || loading) {
    return (
      <main className="app">
        <section className="container">
          <div className="empty"><p>불러오는 중...</p></div>
        </section>
      </main>
    );
  }

  if (!authenticated) return null;

  if (schemaRequired) {
    return (
      <main className="app">
        <section className="container stock-container">
          <WeightHeader />
          <div className="empty weight-setup-message">
            <p>체중관리 데이터베이스 설정이 필요합니다.</p>
            <span>{pageError}</span>
          </div>
        </section>
      </main>
    );
  }

  const chartWidth = Math.max(680, chartRows.length * 56 + 82);
  const chartHeight = 276;
  const axisWidth = 58;
  const chartRight = 22;
  const chartTop = 18;
  const chartBottom = 56;
  const plotWidth = chartWidth - axisWidth - chartRight;
  const plotHeight = chartHeight - chartTop - chartBottom;
  const minWeight = chartRows.length
    ? Math.max(0, Math.floor(Math.min(...chartRows.map((item) => Number(item.weight_kg))) - 1))
    : 0;
  const maxWeight = chartRows.length
    ? Math.ceil(Math.max(...chartRows.map((item) => Number(item.weight_kg))) + 1)
    : 1;
  const weightRange = Math.max(maxWeight - minWeight, 1);
  const chartY = (value: number) =>
    chartTop + ((maxWeight - value) / weightRange) * plotHeight;
  const slotWidth = chartRows.length ? plotWidth / chartRows.length : 0;
  const chartPoints = chartRows.map((row, index) => ({
    x: slotWidth * (index + 0.5),
    y: chartY(Number(row.weight_kg)),
    weight: Number(row.weight_kg),
    date: row.record_date,
  }));
  const weightLinePath = chartPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  return (
    <main className="app">
      <section className="container stock-container weight-container">
        <header className="stock-header">
          <div>
            <p className="eyebrow">Master 3.0</p>
            <h1>체중관리</h1>
          </div>

          <div className="stock-header-actions">
            <button
              className={`stock-chart-toggle${showChart ? ' is-active' : ''}`}
              type="button"
              onClick={() => setShowChart((visible) => !visible)}
              aria-expanded={showChart}
              aria-controls="weight-chart"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 16.5h14" />
                <path d="M5 14V9m5 5V5m5 9V7" />
                <path d="m4 7 5-3 5 2 3-3" />
              </svg>
              차트
            </button>
            <button className="settings-button" type="button" onClick={openSettings}>
              설정
            </button>
            <Link href="/" className="logout-button">처음으로</Link>
          </div>
        </header>

        {pageError && !schemaRequired && (
          <div className="weight-inline-error" role="alert">
            <span>{pageError}</span>
            <button type="button" onClick={() => void loadWeightData()}>다시 시도</button>
          </div>
        )}

        {showChart && (
          <section className="stock-chart-panel weight-chart-panel" id="weight-chart">
            <div className="stock-chart-heading">
              <div>
                <h2>날짜별 체중</h2>
                <p>기록한 날짜의 체중 변화를 확인하세요.</p>
              </div>
              <div className="stock-chart-legend" aria-label="차트 범례">
                <span><i className="chart-legend-bar" />체중</span>
                <span><i className="chart-legend-line" />변화</span>
              </div>
            </div>

            {chartRows.length === 0 ? (
              <div className="weight-chart-empty">
                체중을 기록하면 날짜별 차트가 표시됩니다.
              </div>
            ) : (
              <div className="stock-chart-layout">
                <svg
                  className="stock-chart-y-axis"
                  aria-hidden="true"
                  width={axisWidth}
                  height={chartHeight}
                  viewBox={`0 0 ${axisWidth} ${chartHeight}`}
                >
                  {[0, 1, 2, 3, 4].map((index) => {
                    const value = maxWeight - (weightRange * index) / 4;
                    return (
                      <text
                        key={index}
                        x={axisWidth - 8}
                        y={chartY(value) + 3}
                        fill="#737d8b"
                        fontSize="10"
                        textAnchor="end"
                      >
                        {value.toFixed(1)}
                      </text>
                    );
                  })}
                </svg>

                <div className="stock-chart-scroll" aria-label="날짜별 체중 그래프, 좌우로 스크롤할 수 있습니다">
                  <svg
                    className="stock-chart-svg"
                    role="img"
                    aria-label={`체중이 기록된 ${chartRows.length}일의 날짜별 체중 그래프`}
                    width={plotWidth + chartRight}
                    height={chartHeight}
                    viewBox={`0 0 ${plotWidth + chartRight} ${chartHeight}`}
                  >
                    {[0, 1, 2, 3, 4].map((index) => {
                      const value = maxWeight - (weightRange * index) / 4;
                      const y = chartY(value);
                      return (
                        <line
                          key={index}
                          x1="0"
                          x2={plotWidth}
                          y1={y}
                          y2={y}
                          stroke="#edf0f4"
                          strokeWidth="1"
                        />
                      );
                    })}

                    {chartPoints.map((point) => {
                      const barWidth = Math.min(38, slotWidth * 0.78);
                      const baseline = chartY(minWeight);
                      return (
                        <g key={point.date}>
                          <rect
                            x={point.x - barWidth / 2}
                            y={point.y}
                            width={barWidth}
                            height={Math.max(baseline - point.y, 1)}
                            rx="4"
                            fill="#9aacc7"
                            fillOpacity="0.48"
                          />
                          <text
                            x={point.x}
                            y={chartHeight - 28}
                            fill="#7d8592"
                            fontSize="10"
                            textAnchor="middle"
                          >
                            {formatChartDate(point.date)}
                          </text>
                        </g>
                      );
                    })}

                    <path
                      d={weightLinePath}
                      fill="none"
                      stroke="#218b69"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {chartPoints.map((point) => (
                      <circle
                        key={`weight-${point.date}`}
                        cx={point.x}
                        cy={point.y}
                        r="3.5"
                        fill="#fff"
                        stroke="#218b69"
                        strokeWidth="2"
                      />
                    ))}
                    <text
                      x={plotWidth / 2}
                      y={chartHeight - 8}
                      fill="#9aa1aa"
                      fontSize="10"
                      textAnchor="middle"
                    >
                      날짜
                    </text>
                  </svg>
                </div>
              </div>
            )}
            {chartRows.length > 0 && (
              <p className="stock-chart-hint">좌우로 밀어 전체 기록을 확인할 수 있어요.</p>
            )}
          </section>
        )}

        <section className="weight-table-wrap" aria-label="체중관리 일별 기록">
          <table className="weight-table">
            <thead>
              <tr>
                <th>날짜</th>
                <th>체중</th>
                <th>운동</th>
                <th>단식</th>
                <th>조식</th>
                <th>중식</th>
                <th>석식</th>
                <th>기타 취식</th>
              </tr>
            </thead>
            <tbody>
              {visibleDates.map((date) => {
                const record = recordMap.get(date);
                const fasting = isFastingDay(date, settings);
                return (
                  <tr
                    key={date}
                    className={`weight-day-row${date === today ? ' weight-today-row' : ''}`}
                    tabIndex={0}
                    role="button"
                    aria-label={`${formatDate(date)} 기록 입력`}
                    onClick={() => openRecord(date)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openRecord(date);
                      }
                    }}
                  >
                    <td className="weight-date-cell">
                      <span>{formatDate(date)}</span>
                    </td>
                    <td>{record?.weight_kg === null || !record ? '—' : formatWeight(record.weight_kg)}</td>
                    <td className={record?.exercise === '휴식' ? 'weight-muted-value' : undefined}>{record?.exercise ?? '—'}</td>
                    <td className={fasting ? 'weight-fasting-mark' : 'weight-fasting-empty'}>
                      {fasting ? '●' : '—'}
                    </td>
                    <td className={record?.breakfast === '금식' ? 'weight-muted-value' : undefined}>{record?.breakfast ?? '—'}</td>
                    <td className={record?.lunch === '금식' ? 'weight-muted-value' : undefined}>{record?.lunch ?? '—'}</td>
                    <td className={record?.dinner === '금식' ? 'weight-muted-value' : undefined}>{record?.dinner ?? '—'}</td>
                    <td className="weight-other-food-cell">{formatOtherFood(record?.other_food)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
        <p className="weight-table-hint">날짜를 터치하면 기록을 입력할 수 있습니다.</p>
      </section>

      {activeDate && (
        <div className="modal-backdrop" onMouseDown={() => setActiveDate(null)}>
          <form
            className="settings-modal weight-dialog"
            onSubmit={saveRecord}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="settings-modal-header">
              <div>
                <p className="eyebrow">DAILY RECORD</p>
                <h2>{formatDate(activeDate)} 기록</h2>
              </div>
              <button className="modal-close" type="button" onClick={() => setActiveDate(null)}>
                닫기
              </button>
            </div>

            <label className="weight-form-field">
              <span>체중</span>
              <div className="weight-input-with-unit">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="예: 68.5"
                  value={recordDraft.weightKg}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (/^\d*(\.\d{0,2})?$/.test(value)) {
                      setRecordDraft((current) => ({ ...current, weightKg: value }));
                    }
                  }}
                />
                <span>kg</span>
              </div>
            </label>

            <ChoiceField<Exercise>
              title="운동"
              values={exercises}
              selected={recordDraft.exercise}
              onSelect={(value) =>
                setRecordDraft((current) => ({ ...current, exercise: value }))
              }
            />

            <ChoiceField<MealAmount>
              title="조식"
              values={mealAmounts}
              selected={recordDraft.breakfast}
              onSelect={(value) =>
                setRecordDraft((current) => ({ ...current, breakfast: value }))
              }
            />
            <ChoiceField<MealAmount>
              title="중식"
              values={mealAmounts}
              selected={recordDraft.lunch}
              onSelect={(value) =>
                setRecordDraft((current) => ({ ...current, lunch: value }))
              }
            />
            <ChoiceField<MealAmount>
              title="석식"
              values={mealAmounts}
              selected={recordDraft.dinner}
              onSelect={(value) =>
                setRecordDraft((current) => ({ ...current, dinner: value }))
              }
            />

            <label className="weight-form-field">
              <span>기타 취식</span>
              <input
                type="text"
                maxLength={100}
                placeholder="예: 간식, 야식 등"
                value={recordDraft.otherFood}
                onChange={(event) =>
                  setRecordDraft((current) => ({ ...current, otherFood: event.target.value }))
                }
              />
            </label>

            {recordError && <p className="weight-dialog-error" role="alert">{recordError}</p>}

            <button className="settings-save-button weight-save-button" type="submit" disabled={savingRecord}>
              {savingRecord ? '저장 중...' : '기록 저장'}
            </button>
          </form>
        </div>
      )}

      {showSettings && (
        <div className="modal-backdrop" onMouseDown={() => setShowSettings(false)}>
          <div className="settings-modal weight-settings-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="settings-modal-header">
              <div>
                <p className="eyebrow">WEIGHT SETTINGS</p>
                <h2>간헐적 단식 설정</h2>
              </div>
              <button className="modal-close" type="button" onClick={() => setShowSettings(false)}>
                닫기
              </button>
            </div>

            <div className="weight-form-field">
              <span>반복 주기</span>
              <div className="weight-frequency-options">
                {([
                  ['weekly', '매주'],
                  ['biweekly', '격주'],
                ] as const).map(([frequency, label]) => (
                  <button
                    key={frequency}
                    type="button"
                    className={settingsDraft.frequency === frequency ? 'is-selected' : ''}
                    aria-pressed={settingsDraft.frequency === frequency}
                    onClick={() => setSettingsDraft((current) => ({ ...current, frequency }))}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="weight-form-field">
              <span>단식 요일</span>
              <div className="weight-weekday-options" role="group" aria-label="단식 요일 선택">
                {weekdays.map((day) => (
                  <button
                    key={day.number}
                    type="button"
                    className={settingsDraft.weekdays.includes(day.number) ? 'is-selected' : ''}
                    aria-pressed={settingsDraft.weekdays.includes(day.number)}
                    onClick={() => toggleWeekday(day.number)}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="weight-settings-help">
              {settingsDraft.frequency === 'biweekly'
                ? '격주는 설정한 주를 기준으로 2주마다 반복됩니다.'
                : '선택한 요일마다 간헐적 단식 표시가 반복됩니다.'}
            </p>
            {settingsError && <p className="weight-dialog-error" role="alert">{settingsError}</p>}
            <button className="settings-save-button weight-save-button" type="button" onClick={saveSettings} disabled={savingSettings}>
              {savingSettings ? '저장 중...' : '설정 저장'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function WeightHeader() {
  return (
    <header className="stock-header">
      <div>
        <p className="eyebrow">Master 3.0</p>
        <h1>체중관리</h1>
      </div>
      <Link href="/" className="logout-button">처음으로</Link>
    </header>
  );
}

function ChoiceField<T extends string>({
  title,
  values,
  selected,
  onSelect,
}: {
  title: string;
  values: T[];
  selected: T | '';
  onSelect: (value: T | '') => void;
}) {
  return (
    <fieldset className="weight-choice-field">
      <legend>{title}</legend>
      <div className="weight-choice-options">
        {values.map((value) => (
          <button
            key={value}
            type="button"
            className={selected === value ? 'is-selected' : ''}
            aria-pressed={selected === value}
            onClick={() => onSelect(selected === value ? '' : value)}
          >
            {value}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
