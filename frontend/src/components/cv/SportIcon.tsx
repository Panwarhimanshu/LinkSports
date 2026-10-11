import type { ReactNode } from 'react';

// Line icons for the sport picker, drawn on lucide's 24px grid with round 1.75 strokes so they
// sit naturally next to the lucide icons used elsewhere. lucide has no cricket/kabaddi/kho kho.
const ICONS: Record<string, ReactNode> = {
  Football: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5l4.3 3.1-1.6 5H9.3l-1.6-5z" />
      <path d="M12 7.5V3M16.3 10.6l4.3-1.4M14.7 15.6l2.6 3.7M9.3 15.6l-2.6 3.7M7.7 10.6L3.4 9.2" />
    </>
  ),
  Cricket: (
    <>
      <path d="M14 3l3 3-8.5 8.5-3-3z" />
      <path d="M7 13l-4 4 1.5 1.5 4-4" />
      <circle cx="18" cy="18" r="2.5" />
    </>
  ),
  Badminton: (
    <>
      <circle cx="12" cy="18.5" r="2.5" />
      <path d="M9.8 17.3L6 4h12l-3.8 13.3" />
      <path d="M10.3 4l1 12.5M13.7 4l-1 12.5M7.2 9h9.6" />
    </>
  ),
  Athletics: (
    <>
      <circle cx="15" cy="4.5" r="2" />
      <path d="M7 10l3.5-3 3.5 1 2 3h3" />
      <path d="M14 8l-2.5 5 3 2.5-1 5" />
      <path d="M11.5 13l-2 3H5" />
    </>
  ),
  Kabaddi: (
    <>
      <circle cx="8" cy="4.5" r="2" />
      <path d="M8 7.5l-1 5.5 3 3v5" />
      <path d="M7 13l-3 3v5" />
      <path d="M8 9l4 2h5" />
      <path d="M21 3v2M21 8v2M21 13v2M21 18v2" />
    </>
  ),
  Basketball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3v18" />
      <path d="M5.6 5.6a9 9 0 0 1 0 12.8M18.4 5.6a9 9 0 0 0 0 12.8" />
    </>
  ),
  Hockey: (
    <>
      <path d="M16 3L9 17a3 3 0 0 1-5.2-.6" />
      <circle cx="17" cy="19" r="2" />
    </>
  ),
  Volleyball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M7.5 4.2C11 6 13 9 13 12" />
      <path d="M13 12c3 .2 6-1 7.8-3.4" />
      <path d="M13 12c-1.6 2.6-4.6 4.4-8.6 4.6" />
    </>
  ),
  Tennis: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M6 5.3a9 9 0 0 1 0 13.4M18 5.3a9 9 0 0 0 0 13.4" />
    </>
  ),
  'Table Tennis': (
    <>
      <circle cx="12" cy="9" r="6.5" fill="currentColor" fillOpacity={0.15} />
      <path d="M9.5 15l-3 5.5" strokeWidth="3.5" />
      <circle cx="19" cy="18.5" r="1.8" />
    </>
  ),
  Swimming: (
    <>
      <circle cx="17" cy="6" r="2" />
      <path d="M4 12l4.5-3.5 4 2 3-2.5" />
      <path d="M2 16c1.7 0 1.7 1.2 3.3 1.2S7 16 8.7 16s1.7 1.2 3.3 1.2S13.7 16 15.3 16s1.7 1.2 3.4 1.2S20.3 16 22 16" />
      <path d="M2 20c1.7 0 1.7 1.2 3.3 1.2S7 20 8.7 20s1.7 1.2 3.3 1.2S13.7 20 15.3 20s1.7 1.2 3.4 1.2S20.3 20 22 20" />
    </>
  ),
  Boxing: (
    <>
      <path d="M7 11V7a4 4 0 0 1 4-4h3a4 4 0 0 1 4 4v5a5 5 0 0 1-5 5H9a2 2 0 0 1-2-2z" />
      <path d="M7 11h3a2 2 0 0 1 0 4H7" />
      <path d="M9 17v4h6v-4" />
    </>
  ),
  Wrestling: (
    <>
      <circle cx="6" cy="4.5" r="2" />
      <circle cx="18" cy="4.5" r="2" />
      <path d="M6 7.5V13l-2 8M6 13l2 8" />
      <path d="M18 7.5V13l2 8M18 13l-2 8" />
      <path d="M6 9l6 2.5L18 9" />
    </>
  ),
  'Kho Kho': (
    <>
      <circle cx="11" cy="4.5" r="2" />
      <path d="M4 10l3.5-3 3 1 2 3h2.5" />
      <path d="M10 8l-2.5 5 3 2.5-1 5" />
      <path d="M7.5 13l-2 3H2" />
      <path d="M20 3v18M18 21h4" />
    </>
  ),
  Archery: (
    <>
      <circle cx="10" cy="14" r="7" />
      <circle cx="10" cy="14" r="3" />
      <path d="M10 14L20 4M16 4h4v4" />
    </>
  ),
  Shooting: (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    </>
  ),
  Weightlifting: (
    <>
      <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
    </>
  ),
  Judo: (
    <>
      <path d="M3 9h18v3H3z" />
      <path d="M10.5 8h3v5h-3z" />
      <path d="M10.5 13l-2.5 7.5M13.5 13l2.5 7.5" />
    </>
  ),
  Chess: (
    <>
      <circle cx="12" cy="5.5" r="2.5" />
      <path d="M9 10h6M10 10l-1 7h6l-1-7" />
      <path d="M7 17h10v4H7z" />
    </>
  ),
  Cycling: (
    <>
      <circle cx="5.5" cy="16.5" r="3.5" />
      <circle cx="18.5" cy="16.5" r="3.5" />
      <path d="M5.5 16.5L9.5 9h6l3 7.5M9.5 9l3.5 7.5H5.5" />
      <path d="M8 6h3M15.5 9l-1-3h2.5" />
    </>
  ),
  Gymnastics: (
    <>
      <circle cx="12" cy="4" r="2" />
      <path d="M4 5.5l8 3.5 8-3.5" />
      <path d="M12 9v5l-6.5 6.5M12 14l6.5 6.5" />
    </>
  ),
  Squash: (
    <>
      <ellipse cx="9.5" cy="9.5" rx="5" ry="6.5" transform="rotate(-45 9.5 9.5)" />
      <path d="M6 6l7 7M5.2 10.4l5.2-5.2M8.6 13.8l5.2-5.2" strokeWidth="1" />
      <path d="M13.5 13.5l6.5 6.5" strokeWidth="3" />
      <circle cx="19" cy="5" r="1.8" />
    </>
  ),
  Handball: (
    <>
      <circle cx="8" cy="5" r="2" />
      <path d="M8 8l-1 6 2.5 3v4M7 14l-3 3.5" />
      <path d="M8 9l4.5-1 3-3" />
      <circle cx="18.5" cy="4" r="2" />
    </>
  ),
  Other: (
    <>
      <circle cx="12" cy="15" r="5.5" />
      <path d="M8.3 11L6 3h4l2 5 2-5h4l-2.3 8" />
      <path d="M12 12.5v5" />
    </>
  ),
};

export default function SportIcon({ name, className = 'w-8 h-8' }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden>
      {ICONS[name] ?? ICONS.Other}
    </svg>
  );
}
