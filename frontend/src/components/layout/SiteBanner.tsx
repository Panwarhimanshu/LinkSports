'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Megaphone, Wrench, X } from 'lucide-react';
import { settingsAPI } from '@/lib/api';

type PublicSettings = {
  banner: { text: string; link?: string; tone: 'info' | 'success' | 'warning' } | null;
  maintenance: { message: string } | null;
  supportEmail?: string;
};

/** Banner + maintenance notice controlled from Admin → Site & App Settings. */
export default function SiteBanner() {
  const pathname = usePathname() || '/';
  const [s, setS] = useState<PublicSettings | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => { settingsAPI.get().then((r) => setS(r.data.data)).catch(() => undefined); }, []);

  if (!s || pathname.startsWith('/admin')) return null;

  const tone = { info: 'bg-brand', success: 'bg-green-600', warning: 'bg-amber-500' }[s.banner?.tone || 'info'];
  const link = s.banner?.link;
  const external = link && /^https?:\/\//.test(link);

  return (
    <>
      {s.maintenance && (
        <div role="status" className="bg-amber-50 border-b border-amber-200 text-amber-900 text-sm px-4 py-2 flex items-center justify-center gap-2 text-center">
          <Wrench className="w-4 h-4 shrink-0" />
          <span>{s.maintenance.message}{s.supportEmail ? <> Questions? <a className="underline" href={`mailto:${s.supportEmail}`}>{s.supportEmail}</a></> : null}</span>
        </div>
      )}
      {s.banner && !hidden && (
        <div className={`${tone} text-white text-sm px-10 py-2 relative text-center`}>
          <Megaphone className="w-4 h-4 inline -mt-0.5 mr-2" />
          {link ? (
            external
              ? <a href={link} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 font-medium">{s.banner.text}</a>
              : <Link href={link} className="underline underline-offset-2 font-medium">{s.banner.text}</Link>
          ) : <span className="font-medium">{s.banner.text}</span>}
          <button onClick={() => setHidden(true)} aria-label="Dismiss" className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full hover:bg-white/15 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
      )}
    </>
  );
}
