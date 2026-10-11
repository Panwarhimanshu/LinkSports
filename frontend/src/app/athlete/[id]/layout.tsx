import type { Metadata } from 'next';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.linksports.in').replace(/\/$/, '');

async function getProfile(id: string): Promise<Record<string, any> | null> {
  try {
    const res = await fetch(`${API}/profiles/athlete/${encodeURIComponent(id)}`, { next: { revalidate: 300 } });
    if (!res.ok) return null; // private / missing profiles get generic metadata
    const json = await res.json();
    return json?.data?.profile || null;
  } catch {
    return null;
  }
}

const abs = (u?: string) => (!u ? undefined : /^https?:\/\//.test(u) ? u : `${API.replace('/api/v1', '')}/${u}`);

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const p = await getProfile(params.id);
  if (!p) return { title: 'Sports CV | LinkSports.in', robots: { index: false } };

  const place = [p.location?.city, p.location?.state].filter(Boolean).join(', ');
  const title = `${p.fullName} — ${[p.primarySport, p.position].filter(Boolean).join(' · ') || 'Athlete'} | Sports CV`;
  const description =
    p.tagline ||
    `${p.fullName} is a ${p.primarySport || 'sports'} player${place ? ` from ${place}` : ''}. View the verified digital sports CV on LinkSports.in.`;
  const url = `${SITE}/athlete/${p.profileUrl || params.id}`;
  const image = abs(p.photo);

  return {
    title,
    description,
    keywords: ['Sports CV', 'Digital Sports Resume', `${p.primarySport || 'Athlete'} Player Profile`, 'Athlete Portfolio India', 'Scout Verification Link', p.fullName],
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'profile', siteName: 'LinkSports', locale: 'en_IN', images: image ? [{ url: image, alt: p.fullName }] : undefined },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description, images: image ? [image] : undefined },
    robots: p.visibility === 'public' ? { index: true, follow: true } : { index: false },
  };
}

export default async function AthleteLayout({ children, params }: { children: React.ReactNode; params: { id: string } }) {
  const p = await getProfile(params.id);
  const jsonLd = p && {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: p.fullName,
    description: p.tagline,
    image: abs(p.photo),
    url: `${SITE}/athlete/${p.profileUrl || params.id}`,
    jobTitle: [p.primarySport, p.position].filter(Boolean).join(' '),
    address: p.location?.city ? { '@type': 'PostalAddress', addressLocality: p.location.city, addressRegion: p.location.state, addressCountry: 'IN' } : undefined,
    sameAs: [p.socialLinks?.instagram, p.socialLinks?.youtube].filter(Boolean),
    award: (p.achievements || []).map((a: { title: string }) => a.title).filter(Boolean),
  };
  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
      {children}
    </>
  );
}
