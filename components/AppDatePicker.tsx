'use client';

import { useEffect, useState } from 'react';

type AppDatePickerProps = { value: string; onChange: (value: string) => void; label: string; placeholder?: string };
const weekdays = ['월', '화', '수', '목', '금', '토', '일'];

function parseDate(value: string) {
  if (!value) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function dateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function AppDatePicker({ value, onChange, label, placeholder = '날짜 선택' }: AppDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => {
    const date = parseDate(value);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const firstWeekday = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const dateLabel = value ? `${value.slice(0, 4)}.${value.slice(5, 7)}.${value.slice(8, 10)}` : placeholder;

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  function showPicker() {
    const date = parseDate(value);
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setOpen(true);
  }

  return <>
    <button type="button" className="app-select-trigger app-date-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={showPicker}><span className={value ? '' : 'is-placeholder'}>{dateLabel}</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7.5 5 5 5-5" /></svg></button>
    {open && <div className="modal-backdrop app-picker-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="settings-modal app-picker-dialog app-date-dialog" role="dialog" aria-modal="true" aria-label={`${label} 선택`}>
        <div className="app-picker-heading"><div><p className="eyebrow">DATE SELECT</p><h2>{label}</h2></div><button type="button" className="app-picker-close" onClick={() => setOpen(false)} aria-label="닫기">×</button></div>
        <div className="app-calendar-heading"><button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="이전 달">‹</button><strong>{month.getFullYear()}년 {month.getMonth() + 1}월</strong><button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="다음 달">›</button></div>
        <div className="app-calendar-grid">
          {weekdays.map((day) => <span className="app-calendar-weekday" key={day}>{day}</span>)}
          {Array.from({ length: firstWeekday }, (_, index) => <span key={`empty-${index}`} />)}
          {Array.from({ length: daysInMonth }, (_, index) => {
            const day = index + 1;
            const nextDate = new Date(month.getFullYear(), month.getMonth(), day);
            const selected = value === dateValue(nextDate);
            return <button type="button" key={day} className={selected ? 'is-selected' : ''} aria-pressed={selected} onClick={() => { onChange(dateValue(nextDate)); setOpen(false); }}>{day}</button>;
          })}
        </div>
      </section>
    </div>}
  </>;
}
