import Link from 'next/link';
import Logo from './Logo';

/** Footer for the standalone pages (Privacy, Terms). */
export default function Footer() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 md:flex-row md:px-8">
        <Logo height={26} />
        <nav className="flex items-center gap-6 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-soft">
          <Link href="/terms" className="hover:text-ink">Terms</Link>
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <a href="mailto:support@linksports.in" className="hover:text-ink">Support</a>
        </nav>
        <p className="text-xs text-ink-soft">© {new Date().getFullYear()} LinkSports</p>
      </div>
    </footer>
  );
}
