'use client';

import { useEffect, useState } from 'react';

type AppTimePickerProps = { value: string; onChange: (value: string) => void; label: string; minuteStep?: number; placeholder?: string; twelveHour?: boolean };

export default function AppTimePicker({ value, onChange, label, minuteStep = 1, placeholder = '시간 선택', twelveHour = false }: AppTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [draftHour, setDraftHour] = useState((value || '09:00').slice(0, 2));
  const [draftMinute, setDraftMinute] = useState((value || '09:00').slice(3, 5));
  const hours = Array.from({ length: twelveHour ? 12 : 24 }, (_, index) => String(twelveHour ? index + 1 : index).padStart(2, '0'));
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

  const valueHour = Number(value.slice(0, 2));
  const formattedValue = value && twelveHour
    ? `${valueHour < 12 ? '오전' : '오후'} ${String(valueHour % 12 || 12).padStart(2, '0')}시 ${value.slice(3, 5)}분`
    : value;
  const draftHour12 = Number(draftHour) % 12 || 12;
  const draftPeriod = Number(draftHour) < 12 ? '오전' : '오후';

  return <>
    <button type="button" className="app-select-trigger app-time-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={showPicker}>
      <span className={value ? '' : 'is-placeholder'}>{formattedValue || placeholder}</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7.5 5 5 5-5" /></svg>
    </button>
    {open && <div className="modal-backdrop app-picker-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="settings-modal app-picker-dialog" role="dialog" aria-modal="true" aria-label={`${label} 선택`}>
        <div className="app-picker-heading"><div><p className="eyebrow">TIME SETTING</p><h2>{label}</h2></div><button type="button" className="app-picker-close" onClick={() => setOpen(false)} aria-label="닫기">×</button></div>
        <div className="app-time-columns">
          <div><p>시</p>{twelveHour && <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>{['오전', '오후'].map((period) => { const selected = draftPeriod === period; return <button type="button" key={period} aria-pressed={selected} onClick={() => setDraftHour(String((Number(draftHour) % 12) + (period === '오후' ? 12 : 0)).padStart(2, '0'))} style={{ flex: 1, minHeight: 34, border: `1px solid ${selected ? '#d9e5f5' : '#e8ebef'}`, borderRadius: 9, background: selected ? '#f1f6fc' : '#fff', color: selected ? '#376aab' : '#687381', fontSize: 13, fontWeight: selected ? 600 : 400, cursor: 'pointer' }}>{period}</button>; })}</div>}<div className="app-time-options">{hours.map((hour) => { const selected = twelveHour ? Number(hour) === draftHour12 : hour === draftHour; return <button type="button" key={hour} className={selected ? 'is-selected' : ''} aria-pressed={selected} onClick={() => setDraftHour(String((Number(hour) % 12) + (draftPeriod === '오후' ? 12 : 0)).padStart(2, '0'))}>{hour}</button>; })}</div></div>
          <div><p>분</p><div className="app-time-options">{minutes.map((minute) => <button type="button" key={minute} className={minute === draftMinute ? 'is-selected' : ''} aria-pressed={minute === draftMinute} onClick={() => setDraftMinute(minute)}>{minute}</button>)}</div></div>
        </div>
        <button type="button" className="app-picker-apply" onClick={() => { onChange(`${draftHour}:${draftMinute}`); setOpen(false); }}>시간 적용</button>
      </section>
    </div>}
  </>;
}
