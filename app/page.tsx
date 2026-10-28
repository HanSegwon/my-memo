'use client';

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';
import Link from 'next/link';
import LoadingDots from '../components/LoadingDots';
import { daysUntilEvent, getNextEventDate, type FamilyEvent } from '../lib/familyEvents';
import { getActiveRoutine, type ScheduledRoutine } from '../lib/routineSchedule';
import { getNextQuitSummary } from '../lib/smokingQuit';

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

type AcademyScheduleSummary = {
  child_name: '한유준' | '한이준';
  weekday: number;
  title: string;
  start_time: string;
  end_time: string;
};

type HomeTab = 'health' | 'asset' | 'family';
const homeTabs: HomeTab[] = ['health', 'asset', 'family'];
let hasStartedHomeTabSession = false;

function HomeTabIcon({ tab }: { tab: HomeTab }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (tab === 'health') return <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 16, height: 16, flex: '0 0 auto' }} {...common}><path d="M20.8 8.8c0 5.1-8.8 11-8.8 11s-8.8-5.9-8.8-11A4.8 4.8 0 0 1 12 6.3a4.8 4.8 0 0 1 8.8 2.5Z" /><path d="M7.5 12h2.3l1.3-2.2 2 4.3 1.3-2.1h2.1" /></svg>;
  if (tab === 'asset') return <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 16, height: 16, flex: '0 0 auto' }} {...common}><path d="M4 19.5h16" /><path d="M7 16v-5M12 16V6M17 16V9" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 16, height: 16, flex: '0 0 auto' }} {...common}><circle cx="9" cy="8" r="3" /><path d="M3.5 19v-1.5A4.5 4.5 0 0 1 8 13h2a4.5 4.5 0 0 1 4.5 4.5V19" /><path d="M16 5.4a3 3 0 0 1 0 5.8M17 13h.5a3.5 3.5 0 0 1 3.5 3.5V19" /></svg>;
}

function getInitialHomeTab(): HomeTab {
  if (typeof window === 'undefined') return 'health';
  if (!hasStartedHomeTabSession) {
    hasStartedHomeTabSession = true;
    try {
      window.sessionStorage.setItem('master-home-tab', 'health');
    } catch {}
    return 'health';
  }

  try {
    const savedTab = window.sessionStorage.getItem('master-home-tab');
    if (savedTab === 'asset' || savedTab === 'family') return savedTab;
  } catch {}
  return 'health';
}

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

function getAcademySummary(schedules: AcademyScheduleSummary[], now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const weekdayLabel = parts.find((part) => part.type === 'weekday')?.value;
  const weekday = ({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 } as Record<string, number>)[weekdayLabel ?? ''] ?? 0;
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  if (hour < 6 || hour >= 22) return null;

  const currentMinute = hour * 60 + minute;
  const minutesUntil = (targetMinute: number) => {
    return Math.max(0, targetMinute - currentMinute);
  };
  const formatUntilNextClass = (targetMinute: number) => {
    const remaining = minutesUntil(targetMinute);
    const hours = Math.floor(remaining / 60);
    const minutes = remaining % 60;
    return hours > 0 ? `${hours}시간${minutes > 0 ? ` ${minutes}분` : ''}` : `${minutes}분`;
  };
  const formatUntilClassEnds = (targetMinute: number) => {
    const remaining = minutesUntil(targetMinute);
    const hours = Math.floor(remaining / 60);
    const minutes = remaining % 60;
    if (hours === 0) return `${minutes}분`;
    return `${hours}시간${minutes > 0 ? ` ${minutes}분` : ''}`;
  };
  const describeChild = (childName: AcademyScheduleSummary['child_name']) => {
    const todaySchedules = schedules
      .filter((schedule) => schedule.child_name === childName && schedule.weekday === weekday)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    const current = todaySchedules.find((schedule) => {
      const start = Number(schedule.start_time.slice(0, 2)) * 60 + Number(schedule.start_time.slice(3, 5));
      const end = Number(schedule.end_time.slice(0, 2)) * 60 + Number(schedule.end_time.slice(3, 5));
      return start <= currentMinute && currentMinute < end;
    });
    if (current) {
      const end = Number(current.end_time.slice(0, 2)) * 60 + Number(current.end_time.slice(3, 5));
      return `${childName} (${current.title} 수업중 / ${formatUntilClassEnds(end)} 뒤 마침)`;
    }

    const next = todaySchedules.find((schedule) => Number(schedule.start_time.slice(0, 2)) * 60 + Number(schedule.start_time.slice(3, 5)) > currentMinute);
    if (!next) return `${childName} (일정 종료)`;
    const start = Number(next.start_time.slice(0, 2)) * 60 + Number(next.start_time.slice(3, 5));
    return `${childName} (집 / ${formatUntilNextClass(start)} 뒤 ${next.title})`;
  };

  return [describeChild('한유준'), describeChild('한이준')].join(' · ');
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
  const [smokingSummary, setSmokingSummary] = useState<string | null>(null);
  const [familyEventSummary, setFamilyEventSummary] = useState<string | null>(null);
  const [academySummary, setAcademySummary] = useState<string | null>(null);
  const [routineSummary, setRoutineSummary] = useState<string | null>(null);
  const [todoMemoSummary, setTodoMemoSummary] = useState<string | null>(null);
  const [leavingTimeSummary, setLeavingTimeSummary] = useState<string | null>(null);
  const [greeting, setGreeting] = useState('한세권님, 오늘도 멋진 하루예요!');
  const [activeHomeTab, setActiveHomeTab] = useState<HomeTab>(getInitialHomeTab);
  const homeGridRef = useRef<HTMLElement | null>(null);
  const homeTabsRef = useRef<HTMLDivElement | null>(null);
  const tabSwipeStart = useRef<{ x: number; y: number; horizontal: boolean } | null>(null);
  const suppressSwipeClick = useRef(false);
  const [homePanelWidth, setHomePanelWidth] = useState(0);
  const [homeTabStride, setHomeTabStride] = useState(0);
  const [homeLayoutMeasured, setHomeLayoutMeasured] = useState(false);
  const [tabDragOffset, setTabDragOffset] = useState(0);
  const [isDraggingHomeTabs, setIsDraggingHomeTabs] = useState(false);

  useEffect(() => {
    setGreeting(greetings[Math.floor(Math.random() * greetings.length)]);
    checkAuth();
  }, []);

  useEffect(() => {
    if (!dashboardReady || !authenticated) return;
    const panel = homeGridRef.current;
    const tabs = homeTabsRef.current;
    if (!panel || !tabs) return;

    const measure = () => {
      setHomePanelWidth(panel.clientWidth);
      const firstTab = tabs.querySelector('button');
      setHomeTabStride(firstTab ? firstTab.getBoundingClientRect().width + 5 : 0);
      setHomeLayoutMeasured(true);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    observer.observe(tabs);
    return () => observer.disconnect();
  }, [dashboardReady, authenticated]);

  function selectHomeTab(tab: HomeTab) {
    setActiveHomeTab(tab);
    try {
      window.sessionStorage.setItem('master-home-tab', tab);
    } catch {}
  }

  function handleHomePanelPointerDown(event: PointerEvent<HTMLElement>) {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const tabsBottom = homeTabsRef.current?.getBoundingClientRect().bottom ?? 0;
    if (event.clientY < tabsBottom) return;
    tabSwipeStart.current = { x: event.clientX, y: event.clientY, horizontal: false };
  }

  function handleHomePanelPointerMove(event: PointerEvent<HTMLElement>) {
    const start = tabSwipeStart.current;
    if (!start) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (!start.horizontal) {
      if (Math.abs(deltaX) < 8 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;
      start.horizontal = true;
      setIsDraggingHomeTabs(true);
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
    }

    event.preventDefault();
    const currentIndex = homeTabs.indexOf(activeHomeTab);
    const atEdge = (currentIndex === 0 && deltaX > 0) || (currentIndex === homeTabs.length - 1 && deltaX < 0);
    const dragLimit = homePanelWidth || Number.POSITIVE_INFINITY;
    const boundedDelta = Math.max(-dragLimit, Math.min(dragLimit, deltaX));
    setTabDragOffset(atEdge ? boundedDelta * 0.24 : boundedDelta);
  }

  function handleHomePanelPointerUp(event: PointerEvent<HTMLElement>, cancelled = false) {
    const start = tabSwipeStart.current;
    tabSwipeStart.current = null;
    if (!start) return;

    if (start.horizontal && !cancelled) {
      const deltaX = event.clientX - start.x;
      const shouldChangeTab = Math.abs(deltaX) > Math.max(55, homePanelWidth * 0.16);
      if (shouldChangeTab) {
        const currentIndex = homeTabs.indexOf(activeHomeTab);
        const nextIndex = Math.max(0, Math.min(homeTabs.length - 1, currentIndex + (deltaX < 0 ? 1 : -1)));
        if (nextIndex !== currentIndex) selectHomeTab(homeTabs[nextIndex]);
      }
      suppressSwipeClick.current = true;
      window.setTimeout(() => { suppressSwipeClick.current = false; }, 350);
    }

    setTabDragOffset(0);
    setIsDraggingHomeTabs(false);
  }

  function preventSwipeNavigation(event: MouseEvent<HTMLElement>) {
    if (!suppressSwipeClick.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressSwipeClick.current = false;
  }

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
        loadSmokingSummary(),
        loadFamilyEventSummary(),
        loadAcademySummary(),
        loadRoutineSummary(),
        loadTodoMemoSummary(),
        loadLeavingTimeSummary(),
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
      loadSmokingSummary(),
      loadFamilyEventSummary(),
      loadAcademySummary(),
      loadRoutineSummary(),
      loadTodoMemoSummary(),
      loadLeavingTimeSummary(),
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
      setLeavingTimeSummary(null);
      return;
    }
    const refresh = () => void loadLeavingTimeSummary();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
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

  useEffect(() => {
    if (authenticated !== true || !dashboardReady) {
      setAcademySummary(null);
      return;
    }
    const refresh = () => void loadAcademySummary();
    let interval: number | undefined;
    const firstRefresh = window.setTimeout(() => {
      refresh();
      interval = window.setInterval(refresh, 60_000);
    }, 60_000 - (Date.now() % 60_000));
    window.addEventListener('focus', refresh);
    return () => {
      window.clearTimeout(firstRefresh);
      if (interval !== undefined) window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
    };
  }, [authenticated, dashboardReady]);

  useEffect(() => {
    if (authenticated !== true || !dashboardReady) {
      setSmokingSummary(null);
      return;
    }
    const refresh = () => void loadSmokingSummary();
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

  async function loadSmokingSummary() {
    try {
      const response = await fetch('/api/smoking/quit', { cache: 'no-store' });
      if (!response.ok) {
        setSmokingSummary(null);
        return;
      }
      const data = await response.json() as { quitStartedAt?: string | null };
      setSmokingSummary(data.quitStartedAt ? getNextQuitSummary(data.quitStartedAt, Date.now()) : null);
    } catch {
      setSmokingSummary(null);
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

  async function loadAcademySummary() {
    try {
      const response = await fetch('/api/children-academy', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json() as { schedules: AcademyScheduleSummary[] };
      setAcademySummary(getAcademySummary(data.schedules ?? []));
    } catch {
      // 학원 요약을 불러오지 못해도 대시보드의 다른 메뉴는 사용할 수 있습니다.
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

  async function loadLeavingTimeSummary() {
    try {
      const response = await fetch('/api/leaving-time', { cache: 'no-store' });
      if (!response.ok) {
        setLeavingTimeSummary(null);
        return;
      }
      const data = await response.json() as {
        plan?: { startTime?: string; goalHours?: string | number; goalMinutes?: string | number; exclusions?: Array<{ hours: string | number; minutes: string | number }> } | null;
      };
      const plan = data.plan;
      if (!plan?.startTime || !/^([01]\d|2[0-3]):[0-5]\d$/.test(plan.startTime)) {
        setLeavingTimeSummary(null);
        return;
      }

      const now = new Date();
      const [startHour, startMinute] = plan.startTime.split(':').map(Number);
      const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, startMinute);
      const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - startDate.getTime()) / 60_000));
      const statutoryBreakMinutes = elapsedMinutes >= 510 ? 60 : elapsedMinutes >= 270 ? 30 : 0;
      const targetMinutes = Number(plan.goalHours ?? 0) * 60 + Number(plan.goalMinutes ?? 0);
      const manualExclusionMinutes = (plan.exclusions ?? []).reduce(
        (sum, exclusion) => sum + Number(exclusion.hours ?? 0) * 60 + Number(exclusion.minutes ?? 0),
        0,
      );
      const leaveAt = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      leaveAt.setMinutes(startHour * 60 + startMinute + targetMinutes + statutoryBreakMinutes + manualExclusionMinutes, 0, 0);
      const hour = leaveAt.getHours();
      setLeavingTimeSummary(`오늘은 ${hour < 12 ? '오전' : '오후'} ${String(hour % 12 || 12).padStart(2, '0')}시 ${String(leaveAt.getMinutes()).padStart(2, '0')}분에 퇴근하세요`);
    } catch {
      setLeavingTimeSummary(null);
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
    setSmokingSummary(null);
    setFamilyEventSummary(null);
    setRoutineSummary(null);
    setTodoMemoSummary(null);
    setLeavingTimeSummary(null);
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

  const activeTabIndex = homeTabs.indexOf(activeHomeTab);
  const visualTabPosition = Math.max(0, Math.min(homeTabs.length - 1, activeTabIndex - (homePanelWidth ? tabDragOffset / homePanelWidth : 0)));
  const tabMotionStyle = {
    '--home-tab-offset': `${activeTabIndex * homeTabStride + (homePanelWidth ? (-tabDragOffset / homePanelWidth) * homeTabStride : 0)}px`,
    transition: isDraggingHomeTabs || !homeLayoutMeasured ? 'none' : undefined,
  } as CSSProperties;
  const homeTrackStyle = {
    '--home-panel-offset': `${-activeTabIndex * homePanelWidth + tabDragOffset}px`,
    transition: isDraggingHomeTabs || !homeLayoutMeasured ? 'none' : undefined,
  } as CSSProperties;

  return (
    <main
      className="app home-dashboard-app"
      onPointerDown={handleHomePanelPointerDown}
      onPointerMove={handleHomePanelPointerMove}
      onPointerUp={(event) => handleHomePanelPointerUp(event)}
      onPointerCancel={(event) => handleHomePanelPointerUp(event, true)}
      onClickCapture={preventSwipeNavigation}
    >
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

        <div ref={homeTabsRef} className="home-category-tabs" role="tablist" aria-label="생활 관리 분류" style={tabMotionStyle}>
          <span className="home-category-tab-indicator" aria-hidden="true" />
          {homeTabs.map((tab, index) => {
            const highlight = isDraggingHomeTabs
              ? Math.max(0, 1 - Math.abs(visualTabPosition - index))
              : activeHomeTab === tab ? 1 : 0;
            const color = [97, 113, 138]
              .map((inactive) => Math.round(inactive + (255 - inactive) * highlight))
              .join(', ');
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeHomeTab === tab}
                className={activeHomeTab === tab ? 'is-selected' : ''}
                style={{ color: `rgb(${color})`, transition: isDraggingHomeTabs ? 'none' : undefined, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                onClick={() => selectHomeTab(tab)}
              >
                <HomeTabIcon tab={tab} />
                <span>{tab === 'health' ? '건강관리' : tab === 'asset' ? '자산관리' : '가족관리'}</span>
              </button>
            );
          })}
        </div>

        <section
          ref={homeGridRef}
          className="home-grid"
          role="tabpanel"
          aria-label={activeHomeTab === 'health' ? '건강관리' : activeHomeTab === 'asset' ? '자산관리' : '가족관리'}
        >
          <div className="home-grid-track" style={homeTrackStyle}>
            <div className="home-grid-panel" aria-hidden={activeHomeTab !== 'health'} inert={activeHomeTab !== 'health'}>
              <Link href="/weight" className="home-button">
                <span className="home-button-title">체중관리</span>
                {weightSummary && <><span className="home-button-divider" aria-hidden="true">|</span><SlidingSummary text={weightSummary} /></>}
              </Link>
              <Link href="/smoking" className="home-button">
                <span className="home-button-title">금연관리</span>
                {smokingSummary && <><span className="home-button-divider" aria-hidden="true">|</span><SlidingSummary text={smokingSummary} /></>}
              </Link>
              <Link href="/health-routine" className="home-button">헬스루틴</Link>
              <Link href="/routine" className="home-button">
                <span className="home-button-title">생활루틴</span>
                {routineSummary && <><span className="home-button-divider" aria-hidden="true">|</span><SlidingSummary text={routineSummary} /></>}
              </Link>
            </div>

            <div className="home-grid-panel" aria-hidden={activeHomeTab !== 'asset'} inert={activeHomeTab !== 'asset'}>
              <Link href="/stocks" className="home-button">
                <span className="home-button-title">주식성과</span>
                {stockSummary && <><span className="home-button-divider" aria-hidden="true">|</span><SlidingSummary text={stockSummary} /></>}
              </Link>
              <Link href="/salary" className="home-button">
                <span className="home-button-title">급여추이</span>
                {salarySummary && <><span className="home-button-divider" aria-hidden="true">|</span><SlidingSummary text={salarySummary} /></>}
              </Link>
              <button type="button" className="home-button" disabled>고정지출</button>
              <Link href="/overtime" className="home-button">초과수당</Link>
            </div>

            <div className="home-grid-panel" aria-hidden={activeHomeTab !== 'family'} inert={activeHomeTab !== 'family'}>
              <Link href="/leaving-time" className="home-button">
                <span className="home-button-title">퇴근시간</span>
                {leavingTimeSummary && <><span className="home-button-divider" aria-hidden="true">|</span><SlidingSummary text={leavingTimeSummary} /></>}
              </Link>
              <Link href="/shared-memo" className="home-button">
                <span className="home-button-title">공유메모</span>
                {todoMemoSummary && <><span className="home-button-divider" aria-hidden="true">|</span><SlidingSummary text={todoMemoSummary} /></>}
              </Link>
              <Link href="/family-events" className="home-button">
                <span className="home-button-title">집안행사</span>
                {familyEventSummary && <><span className="home-button-divider" aria-hidden="true">|</span><SlidingSummary text={familyEventSummary} /></>}
              </Link>
              <Link href="/children-academy" className="home-button">
                <span className="home-button-title">자녀학원</span>
                {academySummary && <><span className="home-button-divider" aria-hidden="true">|</span><SlidingSummary text={academySummary} /></>}
              </Link>
              <Link href="/affair-expenses" className="home-button">경조사비</Link>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
