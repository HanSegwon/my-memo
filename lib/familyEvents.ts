import KoreanLunarCalendar from 'korean-lunar-calendar';

export type FamilyEvent = {
  id: string;
  title: string;
  event_year: number;
  event_month: number;
  event_day: number;
  calendar_type: 'solar' | 'lunar';
  is_leap_month: boolean;
  repeat_yearly: boolean;
  created_at: string;
};

export function getEventDateInYear(event: FamilyEvent, year: number): string | null {
  if (!event.repeat_yearly && year !== event.event_year) return null;
  if (event.calendar_type === 'solar') {
    const eventYear = event.repeat_yearly ? year : event.event_year;
    const date = new Date(eventYear, event.event_month - 1, event.event_day);
    if (date.getFullYear() !== eventYear || date.getMonth() !== event.event_month - 1 || date.getDate() !== event.event_day) return null;
    return `${eventYear}-${String(event.event_month).padStart(2, '0')}-${String(event.event_day).padStart(2, '0')}`;
  }

  const calendar = new KoreanLunarCalendar();
  const eventYear = event.repeat_yearly ? year : event.event_year;
  let valid = calendar.setLunarDate(eventYear, event.event_month, event.event_day, event.is_leap_month);
  if (!valid && event.event_day === 30 && !event.is_leap_month) {
    valid = calendar.setLunarDate(eventYear, event.event_month, 29, false);
  }
  if (!valid) return null;
  const solar = calendar.getSolarCalendar();
  return `${solar.year}-${String(solar.month).padStart(2, '0')}-${String(solar.day).padStart(2, '0')}`;
}

export function getNextEventDate(event: FamilyEvent, today: string): string | null {
  const firstYear = Number(today.slice(0, 4));
  for (let year = firstYear; year <= 2050; year += 1) {
    const date = getEventDateInYear(event, year);
    if (date && date >= today) return date;
  }
  return null;
}

export function daysUntilEvent(eventDate: string, today: string) {
  const event = new Date(`${eventDate}T00:00:00.000Z`);
  const current = new Date(`${today}T00:00:00.000Z`);
  return Math.round((event.getTime() - current.getTime()) / 86_400_000);
}
