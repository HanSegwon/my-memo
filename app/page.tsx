'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import LoadingDots from '../components/LoadingDots';
import { daysUntilEvent, getNextEventDate, type FamilyEvent } from '../lib/familyEvents';
import { getActiveRoutine, type ScheduledRoutine } from '../lib/routineSchedule';

const greetings = [
  '한세권님, 오늘도 힘차게 시작해요!',
  '한세권님, 오늘도 잘 해낼 거예요!',
  '한세권님, 작은 시작이 큰 변화를 만들어요.',
  '한세권님, 오늘도 당신을 응원해요!',
  '한세권님, 한 걸음이면 충분해요.',
  '한세권님, 오늘은 좋은 일이 생길 거예요!',
  '한세권님, 지금도 충분히 잘하고 있어요.',
  '한세권님, 서두르지 않아도 괜찮아요.',
  '한세권님, 오늘의 노력이 내일을 바꿔요.',
  '한세권님, 자신을 믿고 나아가요!',
  '한세권님, 오늘도 멋진 하루를 만들어요!',
  '한세권님, 쉬어 가도 괜찮습니다.',
  '한세권님, 할 수 있는 만큼 하면 돼요.',
  '한세권님, 오늘의 작은 성취를 축하해요!',
  '한세권님, 좋은 마음으로 하루를 열어요.',
  '한세권님, 어려움 뒤에는 배움이 있어요.',
  '한세권님, 한 번 더 도전해봐요!',
  '한세권님, 오늘도 분명 괜찮아질 거예요.',
  '한세권님, 당신의 속도로 가면 됩니다.',
  '한세권님, 밝은 마음이 좋은 하루를 만들어요.',
  '한세권님, 오늘도 충분히 빛나고 있어요.',
  '한세권님, 지금 시작해도 늦지 않았어요.',
  '한세권님, 스스로에게 다정한 하루 보내세요.',
  '한세권님, 꾸준함은 큰 힘이 됩니다.',
  '한세권님, 오늘도 한 가지씩 해내봐요!',
  '한세권님, 먼저 상대의 말을 끝까지 들어주세요.',
  '한세권님, 고맙다는 말은 아끼지 마세요.',
  '한세권님, 작은 친절이 하루를 바꿉니다.',
  '한세권님, 다른 생각에도 귀 기울여봐요.',
  '한세권님, 약속 시간은 서로의 신뢰입니다.',
  '한세권님, 부탁할 때는 정중하게 말해요.',
  '한세권님, 실수했다면 솔직히 사과해요.',
  '한세권님, 상대의 수고를 알아봐 주세요.',
  '한세권님, 다정한 말 한마디를 건네봐요.',
  '한세권님, 대화 중에는 화면보다 사람을 봐요.',
  '한세권님, 의견이 달라도 존중은 지켜요.',
  '한세권님, 먼저 인사하면 마음이 가까워져요.',
  '한세권님, 잘못을 지적하기 전에 마음을 헤아려요.',
  '한세권님, 누구에게나 예의를 다해요.',
  '한세권님, 고마움을 표현하면 관계가 따뜻해져요.',
  '한세권님, 상대의 입장에서 한 번 생각해봐요.',
  '한세권님, 대답하기 전에 잠깐 생각해요.',
  '한세권님, 뒷말보다 직접 따뜻하게 전해요.',
  '한세권님, 도움을 받았다면 꼭 감사 인사를 해요.',
  '한세권님, 사람마다 다른 속도를 존중해요.',
  '한세권님, 말하기보다 먼저 이해해봐요.',
  '한세권님, 친절은 언제나 좋은 선택이에요.',
  '한세권님, 공공장소에서는 서로 배려해요.',
  '한세권님, 작은 배려가 큰 존중을 전해요.',
  '한세권님, 오늘도 예쁜 말로 마음을 나눠요.',
  '한세권님, 해야 할 일은 하나씩 차근차근 해요.',
  '한세권님, 잠깐 쉬면 다시 힘이 납니다.',
  '한세권님, 완벽보다 꾸준함을 선택해요.',
  '한세권님, 오늘 할 수 있는 일에 집중해요.',
  '한세권님, 마음이 복잡하면 숨을 천천히 쉬어요.',
  '한세권님, 작은 계획부터 실천해봐요.',
  '한세권님, 충분히 자고 건강을 챙겨요.',
  '한세권님, 지나간 일보다 다음 한 걸음을 봐요.',
  '한세권님, 잘한 일도 스스로 알아주세요.',
  '한세권님, 모르는 것은 편하게 물어봐도 돼요.',
  '한세권님, 오늘의 경험은 모두 자산이에요.',
  '한세권님, 마음에 여유를 조금 남겨두세요.',
  '한세권님, 할 일을 마치면 스스로 칭찬해요.',
  '한세권님, 건강한 선택이 좋은 하루를 만들어요.',
  '한세권님, 걱정은 적고 희망은 크게 가져요.',
  '한세권님, 오늘은 어제보다 한 걸음 나아가요.',
  '한세권님, 잠시 멈춰도 괜찮습니다.',
  '한세권님, 필요한 도움은 용기 내어 요청해요.',
  '한세권님, 배움은 언제나 새로운 기회를 줘요.',
  '한세권님, 마음을 돌보는 시간도 중요해요.',
  '한세권님, 작은 정리가 큰 여유를 줍니다.',
  '한세권님, 오늘은 나에게도 친절하게 대해요.',
  '한세권님, 좋은 습관은 하루씩 만들어져요.',
  '한세권님, 먼저 미소 지으면 마음도 밝아져요.',
  '한세권님, 천천히 가도 방향이 맞으면 돼요.',
  '한세권님, 하루의 끝에는 수고했다고 말해요.',
  '한세권님, 좋은 생각을 오늘 행동으로 옮겨봐요.',
  '한세권님, 지금 가진 것에도 감사해봐요.',
  '한세권님, 오늘의 선택이 내일의 힘이 됩니다.',
  '한세권님, 마음을 담아 인사해보세요.',
  '한세권님, 상대의 경계를 존중해주세요.',
  '한세권님, 대화할 때 차례를 지켜주세요.',
  '한세권님, 의견은 부드럽고 분명하게 전해요.',
  '한세권님, 먼저 양보하면 길이 편안해져요.',
  '한세권님, 약속한 일은 책임감 있게 지켜요.',
  '한세권님, 칭찬은 구체적으로 전해보세요.',
  '한세권님, 상대를 부를 때 이름을 따뜻하게 불러요.',
  '한세권님, 사소한 배려도 잊지 말아요.',
  '한세권님, 다른 사람의 시간도 소중히 여겨요.',
  '한세권님, 힘든 사람에게 괜찮냐고 물어봐요.',
  '한세권님, 비밀은 신뢰를 담아 지켜주세요.',
  '한세권님, 친한 사이에도 예의를 잊지 말아요.',
  '한세권님, 오늘도 배려와 존중을 나눠요.',
  '한세권님, 다름을 인정하면 마음이 넓어져요.',
  '한세권님, 감사와 사과는 제때 전하는 게 좋아요.',
  '한세권님, 먼저 듣고 따뜻하게 답해보세요.',
  '한세권님, 모두에게 공평하고 다정하게 대해요.',
  '한세권님, 따뜻한 말은 오래 기억됩니다.',
  '한세권님, 당신의 친절이 누군가의 힘이 돼요.',
  '한세권님, 오늘도 좋은 마음으로 함께해요!',
];

type StockSettings = {
  initial_investment: number;
  monthly_return_rate: number;
  display_rounds: number;
};

type StockRecord = {
  round_no: number;
  profit: number;
  deposit: number;
  withdrawal: number;
};

type WeightRecordSummary = {
  record_date: string;
  weight_kg: number | null;
};

type MonthlyWeightGoalSummary = {
  goal_month: string;
  target_weight: number;
};

type SalaryRecordSummary = {
  income_year: number;
  income_month: number;
  monthly_salary: number | null;
};

function getPayrollMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);
  const payrollDate = new Date(Date.UTC(year, month - 1 - (day < 21 ? 1 : 0), 1));
  return { year: payrollDate.getUTCFullYear(), month: payrollDate.getUTCMonth() + 1 };
}

function SlidingSummary({ text }: { text: string }) {
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [motion, setMotion] = useState({ overflows: false, distance: 0, duration: 0 });

  useEffect(() => {
    const container = containerRef.current;
    const content = textRef.current;
    if (!container || !content) return;

    const measure = () => {
      const contentWidth = content.getBoundingClientRect().width;
      const overflows = contentWidth > container.clientWidth + 2;
      const distance = contentWidth + 32;
      setMotion({
        overflows,
        distance,
        duration: Math.max(7, distance / 32),
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(content);
    return () => observer.disconnect();
  }, [text]);

  const style = {
    '--summary-distance': `${motion.distance}px`,
    '--summary-duration': `${motion.duration}s`,
  } as CSSProperties;

  return (
    <span
      ref={containerRef}
      className={`home-button-summary${motion.overflows ? ' is-sliding' : ''}`}
      style={style}
      aria-label={text}
    >
      <span className="home-button-summary-track">
        <span ref={textRef}>{text}</span>
        {motion.overflows && <span aria-hidden="true">{text}</span>}
      </span>
    </span>
  );
}

export default function Home() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [dashboardReady, setDashboardReady] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [loginError, setLoginError] = useState('');
  const passcodeInputs = useRef<Array<HTMLInputElement | null>>([]);
  const isPasscodeComplete = /^\d{6}$/.test(passcode);
  const [stockSummary, setStockSummary] = useState<string | null>(null);
  const [salarySummary, setSalarySummary] = useState<string | null>(null);
  const [weightSummary, setWeightSummary] = useState<string | null>(null);
  const [familyEventSummary, setFamilyEventSummary] = useState<string | null>(null);
  const [routineSummary, setRoutineSummary] = useState<string | null>(null);
  const [todoMemoSummary, setTodoMemoSummary] = useState<string | null>(null);
  const [greeting, setGreeting] = useState('한세권님, 오늘도 멋진 하루예요!');

  useEffect(() => {
    setGreeting(greetings[Math.floor(Math.random() * greetings.length)]);
    checkAuth();
  }, []);

  async function checkAuth() {
    const response = await fetch('/api/auth', {
      cache: 'no-store',
    });

    const data = await response.json();
    if (data.authenticated) {
      setAuthenticated(true);
      setDashboardReady(false);
      await Promise.all([
        loadStockSummary(),
        loadSalarySummary(),
        loadWeightSummary(),
        loadFamilyEventSummary(),
        loadRoutineSummary(),
        loadTodoMemoSummary(),
      ]);
      setDashboardReady(true);
    } else {
      setAuthenticated(false);
      setDashboardReady(true);
    }
  }

  async function loadStockSummary() {
    try {
      const response = await fetch('/api/stocks', {
        cache: 'no-store',
      });

      if (!response.ok) return;

      const data = (await response.json()) as {
        settings: StockSettings;
        records: StockRecord[];
      };

      if (!data.settings || !Array.isArray(data.records)) return;

      const now = new Date();
      const currentRound =
        now.getFullYear() * 12 +
        now.getMonth() -
        (2025 * 12 + 8) +
        1;

      let previousTotal = data.settings.initial_investment;
      let previousGoal = data.settings.initial_investment;
      const monthlyRate = data.settings.monthly_return_rate / 100;
      let currentTotal: number | null = null;
      const goals: Array<{ roundNo: number; goal: number }> = [];

      for (let roundNo = 1; roundNo <= data.settings.display_rounds; roundNo += 1) {
        const record = data.records.find((item) => item.round_no === roundNo);
        const total =
          previousTotal +
          Number(record?.profit ?? 0) +
          Number(record?.deposit ?? 0) -
          Number(record?.withdrawal ?? 0);
        const goal = Math.round(previousGoal * (1 + monthlyRate));

        goals.push({ roundNo, goal });
        if (roundNo === currentRound) currentTotal = total;

        previousTotal = total;
        previousGoal = goal;
      }

      if (currentTotal === null) return;

      const achievedGoals = goals.filter((item) => item.goal < currentTotal!);
      if (achievedGoals.length === 0) return;

      const highlightedGoal = achievedGoals.reduce((highest, item) =>
        item.goal > highest.goal ? item : highest
      );
      const targetRound = highlightedGoal.roundNo + 1;
      const targetGoal = Math.round(
        highlightedGoal.goal * (1 + monthlyRate)
      );
      const remainingAmount = targetGoal - currentTotal;
      const targetDate = new Date(2025, 8 + targetRound - 1, 1);
      const targetMonth = `${String(targetDate.getFullYear()).slice(-2)}.${String(
        targetDate.getMonth() + 1
      ).padStart(2, '0')}월`;

      const formattedAmount = Math.abs(remainingAmount).toLocaleString('ko-KR');

      if (remainingAmount > 0) {
        setStockSummary(`’${targetMonth} 목표까지 ${formattedAmount}원 남았어요.`);
      } else if (remainingAmount < 0) {
        setStockSummary(
          `’${targetMonth} 목표를 ${formattedAmount}원 초과 달성했어요.`
        );
      } else {
        setStockSummary(`’${targetMonth} 목표를 달성했어요!`);
      }
    } catch {
      // 주식 요약을 불러오지 못해도 대시보드의 다른 메뉴는 사용할 수 있습니다.
    }
  }

  async function login() {
    if (!isPasscodeComplete) return;

    setLoginError('');

    const response = await fetch('/api/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ passcode }),
    });

    const data = await response.json();

    if (!response.ok) {
      setLoginError(
        data.message || 'Passcode가 올바르지 않습니다.'
      );
      return;
    }

    setPasscode('');
    setAuthenticated(true);
    setDashboardReady(false);
    await Promise.all([
      loadStockSummary(),
      loadSalarySummary(),
      loadWeightSummary(),
      loadFamilyEventSummary(),
      loadRoutineSummary(),
      loadTodoMemoSummary(),
    ]);
    setDashboardReady(true);
  }

  useEffect(() => {
    if (authenticated !== true || !dashboardReady) {
      setRoutineSummary(null);
      return;
    }
    const timer = window.setInterval(() => void loadRoutineSummary(), 60_000);
    return () => window.clearInterval(timer);
  }, [authenticated, dashboardReady]);

  useEffect(() => {
    if (authenticated !== true || !dashboardReady) {
      setTodoMemoSummary(null);
      return;
    }
    const refresh = () => void loadTodoMemoSummary();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [authenticated, dashboardReady]);

  async function loadWeightSummary() {
    try {
      const response = await fetch('/api/weight', { cache: 'no-store' });
      if (!response.ok) return;

      const data = (await response.json()) as {
        records: WeightRecordSummary[];
        monthlyGoals: MonthlyWeightGoalSummary[];
      };
      const currentMonth = new Date(Date.now() + 9 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 7);
      const target = data.monthlyGoals?.find(
        (goal) => goal.goal_month === `${currentMonth}-01`
      );
      const latestWeight = data.records
        ?.filter((record) => record.weight_kg !== null)
        .sort((a, b) => b.record_date.localeCompare(a.record_date))[0];
      if (!target || !latestWeight || latestWeight.weight_kg === null) return;

      const formatKg = (value: number) => String(Number(value.toFixed(2)));
      const remaining = Number((latestWeight.weight_kg - target.target_weight).toFixed(2));
      if (remaining > 0) {
        setWeightSummary(
          `이번 달 목표 ${formatKg(target.target_weight)}kg까지 ${formatKg(remaining)}kg 더 빼면 돼요.`
        );
      } else {
        setWeightSummary(`이번 달 목표 ${formatKg(target.target_weight)}kg를 달성했어요!`);
      }
    } catch {
      // 체중 요약을 불러오지 못해도 다른 메뉴는 사용할 수 있습니다.
    }
  }

  async function loadSalarySummary() {
    try {
      const response = await fetch('/api/salary-records', { cache: 'no-store' });
      if (!response.ok) return;
      const data = (await response.json()) as { records: SalaryRecordSummary[] };
      const { year, month } = getPayrollMonth();
      const previousDate = new Date(Date.UTC(year, month - 2, 1));
      const previousYear = previousDate.getUTCFullYear();
      const previousMonth = previousDate.getUTCMonth() + 1;
      const currentRecord = data.records?.find(
        (record) => record.income_year === year && record.income_month === month
      );
      if (currentRecord?.monthly_salary == null) {
        setSalarySummary(`${month}월 급여 기록을 입력해주세요.`);
        return;
      }

      const previousRecord = data.records?.find(
        (record) => record.income_year === previousYear && record.income_month === previousMonth
      );
      const currentSalary = Number(currentRecord.monthly_salary);
      const formatAmount = (amount: number) => Math.round(amount).toLocaleString('ko-KR');
      const monthLabel = `${month}월 급여는 ${formatAmount(currentSalary)}원이며`;
      if (previousRecord?.monthly_salary == null) {
        setSalarySummary(`${monthLabel}, 지난달 기록이 없어 비교할 수 없어요.`);
        return;
      }

      const difference = currentSalary - Number(previousRecord.monthly_salary);
      const comparison = difference === 0
        ? '지난달과 차이가 없어요.'
        : `지난달보다 ${formatAmount(Math.abs(difference))}원 ${difference > 0 ? '증가' : '감소'}했어요.`;
      setSalarySummary(`${monthLabel}, ${comparison}`);
    } catch {
      // 급여 요약을 불러오지 못해도 대시보드의 다른 메뉴는 사용할 수 있습니다.
    }
  }

  async function loadFamilyEventSummary() {
    try {
      const response = await fetch('/api/family-events', { cache: 'no-store' });
      if (!response.ok) return;
      const data = (await response.json()) as { events: FamilyEvent[] };
      const today = new Date();
      const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const upcoming = (data.events ?? []).flatMap((event) => {
        const date = getNextEventDate(event, todayString);
        return date ? [{ event, date }] : [];
      }).sort((a, b) => a.date.localeCompare(b.date))[0];
      if (!upcoming) {
        setFamilyEventSummary(null);
        return;
      }
      const daysLeft = daysUntilEvent(upcoming.date, todayString);
      setFamilyEventSummary(`${upcoming.event.title} ${daysLeft === 0 ? '오늘입니다.' : `${daysLeft}일 남았습니다.`}`);
    } catch {
      // 집안행사 요약을 불러오지 못해도 다른 메뉴는 사용할 수 있습니다.
    }
  }

  async function loadTodoMemoSummary() {
    try {
      const response = await fetch('/api/memos', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json() as { memos: Array<{ id: number; is_completed: boolean }> };
      const remaining = (data.memos ?? []).filter((memo) => !memo.is_completed).length;
      setTodoMemoSummary(`아직 못한 집안일이 총 ${remaining}건 있습니다.`);
    } catch {
      // 할 일 메모 요약을 불러오지 못해도 다른 메뉴는 사용할 수 있습니다.
    }
  }

  async function loadRoutineSummary() {
    try {
      const response = await fetch('/api/routine', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json() as {
        routines: Array<ScheduledRoutine & { routine_tab_id: string }>;
        tabs: Array<{ id: string; day_type: ScheduledRoutine['day_type']; is_featured: boolean }>;
      };
      const featuredTab = data.tabs?.find((tab) => tab.is_featured);
      if (!featuredTab) {
        setRoutineSummary(null);
        return;
      }
      const featuredRoutines = (data.routines ?? []).filter((routine) => routine.routine_tab_id === featuredTab.id);
      const active = getActiveRoutine(featuredRoutines, new Date(), featuredTab.day_type);
      setRoutineSummary(active ? `지금은 ${active.title} 시간입니다.` : null);
    } catch {
      // 생활루틴 요약을 불러오지 못해도 다른 메뉴는 사용할 수 있습니다.
    }
  }

  function updatePasscode(index: number, value: string) {
    const digits = value.replace(/\D/g, '');
    const next = passcode.padEnd(6, ' ').split('');

    if (!digits) {
      next[index] = ' ';
      setPasscode(next.join('').trimEnd());
      setLoginError('');
      return;
    }

    const pastedDigits = digits.slice(0, 6 - index);
    pastedDigits.split('').forEach((digit, offset) => {
      next[index + offset] = digit;
    });
    const nextPasscode = next.join('').trimEnd();
    setPasscode(nextPasscode);
    setLoginError('');
    if (/^\d{6}$/.test(nextPasscode)) {
      passcodeInputs.current[index]?.blur();
      return;
    }
    passcodeInputs.current[Math.min(index + pastedDigits.length, 5)]?.focus();
  }

  function pastePasscode(index: number, value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 6 - index);
    if (!digits) return;

    const next = passcode.padEnd(6, ' ').split('');
    digits.split('').forEach((digit, offset) => {
      next[index + offset] = digit;
    });
    const nextPasscode = next.join('').trimEnd();
    setPasscode(nextPasscode);
    setLoginError('');
    if (/^\d{6}$/.test(nextPasscode)) {
      passcodeInputs.current[index]?.blur();
      return;
    }
    passcodeInputs.current[Math.min(index + digits.length, 5)]?.focus();
  }

  async function logout() {
    await fetch('/api/auth', {
      method: 'DELETE',
    });

    setAuthenticated(false);
    setDashboardReady(true);
    setWeightSummary(null);
    setFamilyEventSummary(null);
    setRoutineSummary(null);
    setTodoMemoSummary(null);
  }

  if (authenticated === null) {
    return <main className="loading-screen"><LoadingDots /></main>;
  }

  if (authenticated && !dashboardReady) {
    return <main className="loading-screen"><LoadingDots /></main>;
  }

  if (!authenticated) {
    return (
      <main className="app">
        <section className="container home-container login-container">
          <div className="login-card">
            <div className="login-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="5" y="10" width="14" height="11" rx="2.5" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                <path d="M12 14.5v2" />
              </svg>
            </div>

            <h1>Master 3.0</h1>

            <p className="login-description">
              계속하려면 6자리 비밀번호를 입력해 주세요.
            </p>

            <form
              className="login-form"
              autoComplete="off"
              onSubmit={(event) => {
                event.preventDefault();
                void login();
              }}
            >
              <div className="passcode-digits" role="group" aria-label="6자리 비밀번호">
                {Array.from({ length: 6 }, (_, index) => (
                  <input
                    key={index}
                    ref={(element) => {
                      passcodeInputs.current[index] = element;
                    }}
                    className="passcode-digit"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    aria-label={`비밀번호 ${index + 1}번째 숫자`}
                    value={passcode[index] ?? ''}
                    onChange={(event) =>
                      updatePasscode(index, event.target.value)
                    }
                    onPaste={(event) => {
                      event.preventDefault();
                      pastePasscode(index, event.clipboardData.getData('text'));
                    }}
                    onKeyDown={(event) => {
                      if (
                        event.key === 'Backspace' &&
                        !passcode[index] &&
                        index > 0
                      ) {
                        passcodeInputs.current[index - 1]?.focus();
                      }
                    }}
                  />
                ))}
              </div>

              <button
                className="login-submit"
                type="submit"
                disabled={!isPasscodeComplete}
              >
                계속하기
              </button>
            </form>

            {loginError && (
              <p className="login-error" role="alert">{loginError}</p>
            )}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app">
      <section className="container home-container">
        <header className="home-header">
          <div>
            <p className="eyebrow brand-eyebrow">Master 3.0</p>
            <h1>{greeting}</h1>
          </div>

          <button
            className="logout-button"
            onClick={logout}
            aria-label="나가기"
            title="나가기"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="m16 17 5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
          </button>
        </header>

        <section className="home-grid">
          <Link href="/stocks" className="home-button">
            <span className="home-button-title">주식성과</span>
            {stockSummary && (
              <>
                <span className="home-button-divider" aria-hidden="true">
                  |
                </span>
                <SlidingSummary text={stockSummary} />
              </>
            )}
          </Link>

          <Link href="/salary" className="home-button">
            <span className="home-button-title">급여추이</span>
            {salarySummary && (
              <>
                <span className="home-button-divider" aria-hidden="true">|</span>
                <SlidingSummary text={salarySummary} />
              </>
            )}
          </Link>

          <Link href="/overtime" className="home-button">
            초과수당
          </Link>

          <Link href="/weight" className="home-button">
            <span className="home-button-title">체중관리</span>
            {weightSummary && (
              <>
                <span className="home-button-divider" aria-hidden="true">|</span>
                <SlidingSummary text={weightSummary} />
              </>
            )}
          </Link>

          <Link href="/smoking" className="home-button">
            금연관리
          </Link>

          <Link href="/routine" className="home-button">
            <span className="home-button-title">생활루틴</span>
            {routineSummary && (
              <>
                <span className="home-button-divider" aria-hidden="true">|</span>
                <SlidingSummary text={routineSummary} />
              </>
            )}
          </Link>

          <Link
            href="/shared-memo"
            className="home-button"
          >
            <span className="home-button-title">할일메모</span>
            {todoMemoSummary && <><span className="home-button-divider" aria-hidden="true">|</span><SlidingSummary text={todoMemoSummary} /></>}
          </Link>

          <Link href="/family-events" className="home-button">
            <span className="home-button-title">집안행사</span>
            {familyEventSummary && (
              <>
                <span className="home-button-divider" aria-hidden="true">|</span>
                <SlidingSummary text={familyEventSummary} />
              </>
            )}
          </Link>

          <Link href="/children-academy" className="home-button">
            자녀학원
          </Link>

          <Link href="/affair-expenses" className="home-button">
            경조사비
          </Link>
        </section>
      </section>
    </main>
  );
}
