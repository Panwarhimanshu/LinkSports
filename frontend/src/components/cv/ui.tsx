// Shared form styling for the CV screens: cream paper, ink text, pill buttons, mono labels.

export const inputCls =
  'w-full h-12 px-4 rounded-xl border border-line bg-cream/60 text-base text-ink placeholder:text-ink/35 focus:outline-none focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/15 transition';
export const textareaCls =
  'w-full px-4 py-3 rounded-xl border border-line bg-cream/60 text-base text-ink placeholder:text-ink/35 focus:outline-none focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/15 transition resize-none';
export const labelCls = 'block font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-soft mb-1.5';
export const btnPrimary =
  'flex-1 h-12 px-6 rounded-full bg-brand hover:bg-brand-dark text-white font-display text-[15px] font-semibold uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition';
export const btnSecondary =
  'flex-1 h-12 px-6 rounded-full border border-brand text-brand hover:bg-brand/5 font-display text-[15px] font-semibold uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.98] transition';
export const btnGhost =
  'h-12 px-5 rounded-full border border-line hover:border-ink text-ink font-display text-[15px] font-semibold uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.98] transition';

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
    </label>
  );
}

/** Heading with its last word picked out in the brand colour. */
export function AccentTitle({ children, className = '' }: { children: string; className?: string }) {
  const words = children.split(' ');
  const last = words.pop();
  return (
    <span className={className}>
      {words.length > 0 && `${words.join(' ')} `}
      <span className="text-brand">{last}</span>
    </span>
  );
}
