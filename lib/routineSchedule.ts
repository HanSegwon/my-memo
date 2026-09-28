import KoreanLunarCalendar from 'korean-lunar-calendar';

export type RoutineDayType = 'weekday' | 'holiday';
export type ScheduledRoutine = {
  id: string;
  start_time: string;
  end_time: string;
  title: string;
  day_type: RoutineDayType;
};

export function getKoreanDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function addDays(isoDate: string, amount: number) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function lunarDate(year: number, month: number, day: number) {
  const calendar = new KoreanLunarCalendar();
  if (!calendar.setLunarDate(year, month, day, false)) return null;
  const solar = calendar.getSolarCalendar();
  return `${solar.year}-${String(solar.month).padStart(2, '0')}-${String(solar.day).padStart(2, '0')}`;
}

export function getKoreanHolidayDates(year: number) {
  const fixed = [
    { date: `${year}-01-01`, substitute: false },
    { date: `${year}-03-01`, substitute: true },
    { date: `${year}-05-01`, substitute: true },
    { date: `${year}-05-05`, substitute: true },
    { date: `${year}-06-06`, substitute: false },
    { date: `${year}-07-17`, substitute: true },
    { date: `${year}-08-15`, substitute: true },
    { date: `${year}-10-03`, substitute: true },
    { date: `${year}-10-09`, substitute: true },
    { date: `${year}-12-25`, substitute: true },
  ];
  const holidays = new Set(fixed.map((item) => item.date));
  const lunarDays = [[1, 1], [1, 2], [12, 30], [4, 8], [8, 14], [8, 15], [8, 16]];
  const lunarSubstitute = new Set<string>();
  for (const lunarYear of [year - 1, year]) {
    for (const [month, day] of lunarDays) {
      const date = lunarDate(lunarYear, month, day) ?? (month === 12 && day === 30 ? lunarDate(lunarYear, 12, 29) : null);
      if (date?.startsWith(`${year}-`)) {
        holidays.add(date);
        lunarSubstitute.add(date);
      }
    }
  }
  const eligible = new Set([...fixed.filter((item) => item.substitute).map((item) => item.date), ...lunarSubstitute]);
  // Substitute holidays are assigned to the next weekday not already a holiday.
  // Repeating handles adjacent holiday periods such as Seollal and Chuseok.
  const originalDates = [...eligible];
  for (const holiday of originalDates) {
    const date = new Date(`${holiday}T00:00:00Z`);
    const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
    const overlapsHoliday = lunarSubstitute.has(holiday) &&
      (holidays.has(addDays(holiday, -1)) || holidays.has(addDays(holiday, 1)));
    if (!weekend && !overlapsHoliday) continue;
    let substitute = addDays(holiday, 1);
    while (holidays.has(substitute) || [0, 6].includes(new Date(`${substitute}T00:00:00Z`).getUTCDay())) {
      substitute = addDays(substitute, 1);
    }
    holidays.add(substitute);
  }
  return holidays;
}

export function getRoutineDayType(date = new Date()): RoutineDayType {
  const koreanDate = getKoreanDate(date);
  const dayOfWeek = new Date(`${koreanDate}T00:00:00Z`).getUTCDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return 'holiday';
  return getKoreanHolidayDates(Number(koreanDate.slice(0, 4))).has(koreanDate) ? 'holiday' : 'weekday';
}

export function getActiveRoutine<T extends ScheduledRoutine>(routines: T[], date = new Date(), dayType = getRoutineDayType(date)) {
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(date);
  const current = time.slice(0, 5);
  return routines.find((routine) => {
    if (routine.day_type !== dayType) return false;
    const start = routine.start_time.slice(0, 5);
    const end = routine.end_time.slice(0, 5);
    if (start === end) return false;
    return start < end ? current >= start && current < end : current >= start || current < end;
  }) ?? null;
}
