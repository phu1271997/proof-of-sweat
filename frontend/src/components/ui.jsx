import React from 'react';

export function Badge({ tone = 'muted', children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Spinner({ size = 16 }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-hidden />;
}

export function Button({ variant = 'primary', busy, children, className = '', ...rest }) {
  return (
    <button className={`btn btn-${variant} ${className}`} disabled={busy || rest.disabled} {...rest}>
      {busy && <Spinner />}
      <span>{children}</span>
    </button>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Meter({ value = 0, tone = 'cyan', label }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="meter-wrap">
      {label && (
        <div className="meter-top">
          <span>{label}</span>
          <span className="mono">{v}</span>
        </div>
      )}
      <div className="meter">
        <div className={`meter-fill meter-${tone}`} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

export function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        {children}
      </div>
    </div>
  );
}

export function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`toast toast-${toast.tone || 'info'}`}>
      {toast.busy && <Spinner />}
      <span>{toast.msg}</span>
      {toast.href && (
        <a href={toast.href} target="_blank" rel="noreferrer" className="toast-link">
          view tx ↗
        </a>
      )}
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="empty">
      <div className="empty-glyph">💧</div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
