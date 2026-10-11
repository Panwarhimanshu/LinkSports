'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Search, X } from 'lucide-react';

// Small shared building blocks for the admin panel pages.

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, hint }: {
  label: string; value: ReactNode; icon?: any; tone?: string; hint?: string;
}) {
  // one quiet style for every metric: the number carries the card, not a coloured icon
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        {Icon && <Icon className="w-4 h-4 text-gray-400" />}
      </div>
      <p className="text-2xl font-semibold text-gray-900 mt-2 tabular-nums">{value}</p>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}

export function Card({ title, actions, children, className = '' }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-gray-200">
          {title && <h2 className="font-semibold text-gray-900">{title}</h2>}
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

const BADGE: Record<string, string> = {
  published: 'bg-blue-100 text-blue-700', verified: 'bg-blue-100 text-blue-700', success: 'bg-blue-100 text-blue-700',
  active: 'bg-blue-100 text-blue-700', shortlisted: 'bg-blue-100 text-blue-700', selected: 'bg-blue-100 text-blue-700',
  pending: 'bg-orange-100 text-orange-700', draft: 'bg-gray-100 text-gray-600', applied: 'bg-blue-100 text-blue-700',
  closed: 'bg-gray-200 text-gray-700', completed: 'bg-gray-200 text-gray-700',
  rejected: 'bg-red-100 text-red-700', cancelled: 'bg-red-100 text-red-700', failed: 'bg-red-100 text-red-700',
  suspended: 'bg-red-100 text-red-700', withdrawn: 'bg-gray-100 text-gray-600', reported: 'bg-red-100 text-red-700',
  admin: 'bg-blue-100 text-blue-700', athlete: 'bg-blue-100 text-blue-700', coach: 'bg-blue-100 text-blue-700',
  professional: 'bg-blue-100 text-blue-700', organization: 'bg-orange-100 text-orange-700',
};
export function Badge({ value, label }: { value?: string; label?: string }) {
  if (!value) return null;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${BADGE[value] || 'bg-gray-100 text-gray-700'}`}>
      {(label || value).replace(/_/g, ' ')}
    </span>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  // debounced so typing doesn't fire a request per keystroke
  const [text, setText] = useState(value);
  useEffect(() => { const t = setTimeout(() => { if (text !== value) onChange(text); }, 350); return () => clearTimeout(t); }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="relative">
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder}
        className="h-10 w-full sm:w-64 pl-9 pr-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand" />
    </div>
  );
}

export function Select({ value, onChange, options, label }: {
  value: string; onChange: (v: string) => void; options: [string, string][]; label?: string;
}) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}
      className="h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:border-brand">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

export function Pagination({ page, pages, total, onPage }: { page: number; pages: number; total?: number; onPage: (p: number) => void }) {
  if (!pages || pages <= 1) return total !== undefined ? <p className="text-xs text-gray-400 mt-4">{total} total</p> : null;
  return (
    <div className="flex items-center justify-between mt-4 text-sm">
      <span className="text-gray-500">Page {page} of {pages}{total !== undefined ? ` · ${total} total` : ''}</span>
      <div className="flex gap-2">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="h-9 px-3 rounded-lg border border-gray-300 disabled:opacity-40 flex items-center gap-1"><ChevronLeft className="w-4 h-4" />Prev</button>
        <button disabled={page >= pages} onClick={() => onPage(page + 1)} className="h-9 px-3 rounded-lg border border-gray-300 disabled:opacity-40 flex items-center gap-1">Next<ChevronRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

export function Table({ head, children, empty, loading }: { head: string[]; children: ReactNode; empty?: boolean; loading?: boolean }) {
  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-100">
            {head.map((h) => <th key={h} className="px-5 py-3 font-semibold whitespace-nowrap">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {loading ? (
            <tr><td colSpan={head.length} className="px-5 py-10 text-center"><Loader2 className="w-6 h-6 animate-spin text-brand inline" /></td></tr>
          ) : empty ? (
            <tr><td colSpan={head.length} className="px-5 py-10 text-center text-gray-400">Nothing here yet.</td></tr>
          ) : children}
        </tbody>
      </table>
    </div>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}
        className={`bg-white rounded-lg shadow-xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} my-8`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

/** Button that asks for confirmation inline before running a destructive action. */
export function ConfirmButton({ label, confirmLabel = 'Confirm', onConfirm, tone = 'red', small }: {
  label: ReactNode; confirmLabel?: string; onConfirm: () => Promise<void> | void; tone?: 'red' | 'blue'; small?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const base = small ? 'h-8 px-2.5 text-xs' : 'h-9 px-3 text-sm';
  const color = tone === 'red' ? 'text-red-600 hover:bg-red-50 border-red-200' : 'text-brand hover:bg-blue-50 border-blue-200';
  if (!asking) return <button onClick={() => setAsking(true)} className={`${base} rounded-lg border font-medium ${color}`}>{label}</button>;
  return (
    <span className="inline-flex gap-1">
      <button disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); setAsking(false); } }}
        className={`${base} rounded-lg font-semibold text-white ${tone === 'red' ? 'bg-red-600' : 'bg-brand'} disabled:opacity-50`}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmLabel}
      </button>
      <button onClick={() => setAsking(false)} className={`${base} rounded-lg border border-gray-300 text-gray-600`}>Cancel</button>
    </span>
  );
}

export const Btn = ({ children, onClick, variant = 'primary', disabled, type = 'button' }: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'outline'; disabled?: boolean; type?: 'button' | 'submit';
}) => (
  <button type={type} onClick={onClick} disabled={disabled}
    className={`h-10 px-4 rounded-lg text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50 ${variant === 'primary' ? 'bg-brand hover:bg-brand-dark text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
    {children}
  </button>
);

export const fmtDate = (d?: string | Date) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const fmtMoney = (n?: number) => `₹${(n || 0).toLocaleString('en-IN')}`;
export const errMsg = (e: any, fallback = 'Something went wrong') => e?.response?.data?.error?.message || fallback;
