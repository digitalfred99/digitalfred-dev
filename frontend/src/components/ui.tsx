"use client";

import { createContext, useContext, useId, useState } from "react";

export function FormField({ label, htmlFor, error, hint, children, required }: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  const hintId = useId();
  const errorId = useId();
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}{required && <span aria-hidden="true"> *</span>}</label>
      {children}
      {hint && !error && <small id={hintId}>{hint}</small>}
      {error && <small id={errorId} className="field-error" role="alert">{error}</small>}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="empty-state"><span className="empty-mark" aria-hidden="true">✳</span><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function ConfirmDialog({ open, title, description, confirmLabel = "Confirm", onConfirm, onCancel, destructive = false }: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <section className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description">
        <h2 id="confirm-title">{title}</h2><p id="confirm-description">{description}</p>
        <div className="button-row"><button type="button" className="button button-quiet" onClick={onCancel}>Cancel</button><button type="button" className={destructive ? "button button-danger" : "button button-primary"} onClick={onConfirm}>{confirmLabel}</button></div>
      </section>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState("");
  return (
    <ToastContext.Provider value={(text) => {
      setMessage(text);
      window.setTimeout(() => setMessage(""), 3200);
    }}>
      {children}
      <div className="toast" role="status" aria-live="polite" hidden={!message}>{message}</div>
    </ToastContext.Provider>
  );
}

const ToastContext = createContext<(message: string) => void>(() => undefined);
export const useToast = () => useContext(ToastContext);
