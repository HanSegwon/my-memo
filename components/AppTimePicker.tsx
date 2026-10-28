'use client';

import { useEffect, useState } from 'react';

type AppTimePickerProps = { value: string; onChange: (value: string) => void; label: string; minuteStep?: number; placeholder?: string };

export default function AppTimePicker({ value, onChange, label, minuteStep = 1, placeholder = '시간 선택' }: AppTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [draftHour, setDraftHour] = useState((value || '09:00').slice(0, 2));
  const [draftMinute, setDraftMinute] = useState((value || '09:00').slice(3, 5));
  const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, index) => String(index * minuteStep).padStart(2, '0'));

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  function showPicker() {
    const currentValue = value || '09:00';
    setDraftHour(currentValue.slice(0, 2));
    setDraftMinute(currentValue.slice(3, 5));
    setOpen(true);
  }

  return <>
    <button type="button" className="app-select-trigger app-time-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={showPicker}>
      <span className={value ? '' : 'is-placeholder'}>{value || placeholder}</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7.5 5 5 5-5" /></svg>
    </button>
    {open && <div className="modal-backdrop app-picker-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="settings-modal app-picker-dialog" role="dialog" aria-modal="true" aria-label={`${label} 선택`}>
        <div className="app-picker-heading"><div><p className="eyebrow">TIME SETTING</p><h2>{label}</h2></div><button type="button" className="app-picker-close" onClick={() => setOpen(false)} aria-label="닫기">×</button></div>
        <div className="app-time-columns">
          <div><p>시</p><div className="app-time-options">{hours.map((hour) => <button type="button" key={hour} className={hour === draftHour ? 'is-selected' : ''} aria-pressed={hour === draftHour} onClick={() => setDraftHour(hour)}>{hour}</button>)}</div></div>
          <div><p>분</p><div className="app-time-options">{minutes.map((minute) => <button type="button" key={minute} className={minute === draftMinute ? 'is-selected' : ''} aria-pressed={minute === draftMinute} onClick={() => setDraftMinute(minute)}>{minute}</button>)}</div></div>
        </div>
        <button type="button" className="app-picker-apply" onClick={() => { onChange(`${draftHour}:${draftMinute}`); setOpen(false); }}>시간 적용</button>
      </section>
    </div>}
  </>;
}
