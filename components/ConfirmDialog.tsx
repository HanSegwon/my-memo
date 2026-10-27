'use client';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '삭제',
  cancelLabel = '취소',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="modal-backdrop app-confirm-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onCancel();
    }}>
      <section className="settings-modal app-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="app-confirm-title">
        <p className="eyebrow">CONFIRM</p>
        <h2 id="app-confirm-title">{title}</h2>
        {description && <p className="app-confirm-description">{description}</p>}
        <div className="app-confirm-actions">
          <button type="button" className="app-confirm-cancel" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button type="button" className="app-confirm-submit" onClick={onConfirm} disabled={busy}>{busy ? '처리 중...' : confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
