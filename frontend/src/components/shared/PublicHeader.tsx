import Link from 'next/link';
import Logo from './Logo';

/** Header for the standalone pages (Privacy, Terms). */
export default function PublicHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8">
        <Link href="/" aria-label="LinkSports home"><Logo height={30} /></Link>
        <Link href="/" className="btn-primary">Create your CV</Link>
      </div>
    </header>
  );
}
