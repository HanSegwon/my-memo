'use client';

import { useState } from 'react';
import { useEffect } from 'react';

export type AppSelectOption = { value: string; label: string; disabled?: boolean };

type AppSelectProps = {
  value: string;
  options: AppSelectOption[];
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  required?: boolean;
};

export default function AppSelect({ value, options, onChange, label, placeholder = '선택', required = false }: AppSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  return <>
    <button type="button" className="app-select-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <span className={selected ? '' : 'is-placeholder'}>{selected?.label ?? placeholder}</span>
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7.5 5 5 5-5" /></svg>
      {required && <span className="app-select-required" aria-hidden="true">필수</span>}
    </button>
    {open && <div className="modal-backdrop app-picker-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="settings-modal app-picker-dialog" role="dialog" aria-modal="true" aria-label={`${label} 선택`}>
        <div className="app-picker-heading"><div><p className="eyebrow">SELECT</p><h2>{label}</h2></div><button type="button" className="app-picker-close" onClick={() => setOpen(false)} aria-label="닫기">×</button></div>
        <div className="app-picker-options" role="listbox" aria-label={label}>
          {options.map((option) => <button
            type="button"
            role="option"
            aria-selected={option.value === value}
            className={`app-picker-option${option.value === value ? ' is-selected' : ''}`}
            key={option.value}
            disabled={option.disabled}
            onClick={() => { onChange(option.value); setOpen(false); }}
          >{option.label}{option.value === value && <span aria-hidden="true">✓</span>}</button>)}
        </div>
      </section>
    </div>}
  </>;
}
