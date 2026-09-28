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

export function getRoutineDayType(date = new Date()): RoutineDayType {
  const koreanDate = getKoreanDate(date);
  const dayOfWeek = new Date(`${koreanDate}T00:00:00Z`).getUTCDay();
  return dayOfWeek === 0 || dayOfWeek === 6 ? 'holiday' : 'weekday';
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
