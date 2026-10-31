'use client';

import { LogOut, MapPin, Play } from 'lucide-react';
import { ageFromDob, photosOf, realName, videosOf } from '@/lib/cv';
import { getInitials, getPhotoUrl, safeUrl } from '@/lib/utils';
import { AccentTitle } from './ui';

type Profile = Record<string, any>;

/** YouTube thumbnail for a link, or null for other hosts. */
function youtubeThumb(url: string): string | null {
  try {
    const u = new URL(url);
    let id = '';
    if (u.hostname.includes('youtu.be')) id = u.pathname.slice(1);
    else if (u.hostname.includes('youtube.com')) id = u.searchParams.get('v') || u.pathname.split('/').filter(Boolean).pop() || '';
    return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
  } catch {
    return null;
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-4 pt-6">
      <h2 className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-ink-soft">{title}</h2>
      {children}
    </section>
  );
}

/**
 * The public Sports CV page, exactly what scouts and coaches see from the share link:
 * header card, key stats, teams, achievements, 2×2 photo gallery, highlight videos, custom sections.
 * Contact details are deliberately not shown here.
 */
export default function PublicCv({ profile, onLogout }: { profile: Profile; onLogout?: () => void }) {
  const name = realName(profile.fullName) || 'Player';
  const avatar = getPhotoUrl(profile.photo);
  const age = ageFromDob(profile.dob);
  const place = [profile.location?.city, profile.location?.state].filter(Boolean).join(', ');
  const position = [profile.position, profile.secondaryPosition].filter(Boolean).join(' / ');

  const stats: { label: string; value: string }[] = [
    ...(age ? [{ label: 'Age', value: String(age) }] : []),
    ...(profile.height ? [{ label: 'Height', value: `${profile.height} ${profile.heightUnit || 'cm'}` }] : []),
    ...(profile.weight ? [{ label: 'Weight', value: `${profile.weight} kg` }] : []),
    ...(profile.dominantSide ? [{ label: 'Strong side', value: String(profile.dominantSide).replace(/^./, (c: string) => c.toUpperCase()) }] : []),
    ...(profile.nationality ? [{ label: 'Nationality', value: String(profile.nationality) }] : []),
    ...(profile.yearsOfExperience ? [{ label: 'Experience', value: `${profile.yearsOfExperience} yrs` }] : []),
    ...((profile.careerStats as { label: string; value: string }[]) || []),
  ];

  const history: any[] = [...(profile.playingHistory || [])].sort((a, b) => Number(!!b.current) - Number(!!a.current));
  const achievements: any[] = profile.achievements || [];
  const tournaments: any[] = profile.tournaments || [];
  const photos = photosOf(profile).slice(0, 4);
  const videos = videosOf(profile);
  const custom: any[] = profile.customSections || [];
  const education: any[] = profile.education || [];
  const certificates: any[] = profile.certifications || [];
  const skills: string[] = profile.skills || [];
  const others: string[] = profile.secondarySports || [];
  const socials = Object.entries(profile.socialLinks || {}).filter(([k, v]) => v && k !== 'whatsapp') as [string, string][];
  const prose: [string, string][] = ([['Career highlights', profile.careerHighlights], ['Strengths', profile.strengths], ['Goals', profile.goalsAspirations]] as [string, string][]).filter(([, v]) => !!v);

  return (
    <div className="mx-auto w-full max-w-3xl pb-10 md:px-6">
      {/* header card */}
      <div className="px-4 pt-5">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-[#0b2a5c] to-brand p-6 text-white md:p-8 shadow-[0_28px_60px_-30px_rgba(0,35,90,0.7)]">
          <div className="flex items-center gap-4">
            {avatar
              ? <img src={avatar} alt={name} className="h-20 w-20 shrink-0 rounded-full object-cover ring-4 ring-white/25" />
              : <span className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-white/15 font-display text-3xl font-bold ring-4 ring-white/25">{getInitials(name)}</span>}
            <div className="min-w-0">
              <h1 className="font-display text-[28px] font-semibold leading-tight">{name}</h1>
              <p className="mt-0.5 text-sm font-semibold text-blue-100">{[profile.primarySport, position].filter(Boolean).join(' · ')}</p>
              {place && <p className="mt-1 flex items-center gap-1 text-xs text-blue-200"><MapPin className="h-3.5 w-3.5" />{place}</p>}
            </div>
          </div>
          {profile.tagline && <p className="mt-4 text-sm leading-relaxed text-blue-50">{profile.tagline}</p>}
        </div>
      </div>

      {profile.aboutBio && (
        <Section title="About"><p className="whitespace-pre-line text-[15px] leading-relaxed text-ink">{profile.aboutBio}</p></Section>
      )}

      {prose.map(([title, text]) => (
        <Section key={title} title={title}><p className="whitespace-pre-line text-[15px] leading-relaxed text-ink">{text}</p></Section>
      ))}

      {(skills.length > 0 || others.length > 0) && (
        <Section title="Skills">
          <div className="flex flex-wrap gap-2">
            {skills.map((k) => <span key={k} className="rounded-full border border-line bg-cream px-3 py-1.5 text-sm font-semibold text-ink">{k}</span>)}
            {others.map((k) => <span key={k} className="rounded-full border border-dashed border-line px-3 py-1.5 text-sm text-ink-soft">Also plays {k}</span>)}
          </div>
        </Section>
      )}

      {stats.length > 0 && (
        <Section title="Key stats">
          <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
            {stats.map((s, i) => (
              <div key={`${s.label}-${i}`} className="rounded-2xl border border-line bg-cream/60 px-3 py-3 text-center">
                <p className="truncate font-display text-xl font-semibold text-ink">{s.value}</p>
                <p className="mt-0.5 truncate font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-soft">{s.label}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {(history.length > 0 || profile.institutionName) && (
        <Section title="Teams & academies">
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {history.map((h, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-display text-base font-semibold text-ink">{h.organization}</p>
                  {h.role && <p className="truncate text-sm text-ink-soft">{h.role}</p>}
                </div>
                {h.current && <span className="shrink-0 rounded-full bg-brand/10 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-brand">Current</span>}
              </li>
            ))}
            {profile.institutionName && (
              <li className="px-4 py-3">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-soft">School / college</p>
                <p className="font-display text-base font-semibold text-ink">{profile.institutionName}</p>
              </li>
            )}
          </ul>
        </Section>
      )}

      {(education.length > 0 || certificates.length > 0 || profile.currentEducation) && (
        <Section title="Education">
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {profile.currentEducation && (
              <li className="px-4 py-3"><p className="font-display text-base font-semibold text-ink">{profile.currentEducation}</p><p className="text-sm text-ink-soft">Currently studying</p></li>
            )}
            {education.map((e, i) => (
              <li key={`e${i}`} className="px-4 py-3">
                <p className="font-display text-base font-semibold text-ink">{e.institution}</p>
                {(e.degree || e.endYear || e.year) && <p className="text-sm text-ink-soft">{[e.degree, e.endYear || e.year].filter(Boolean).join(' · ')}</p>}
              </li>
            ))}
            {certificates.map((c, i) => (
              <li key={`c${i}`} className="px-4 py-3">
                <p className="font-display text-base font-semibold text-ink">{c.name}</p>
                {(c.issuer || c.year) && <p className="text-sm text-ink-soft">{[c.issuer, c.year].filter(Boolean).join(' · ')}</p>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(achievements.length > 0 || tournaments.length > 0) && (
        <Section title="Achievements">
          <ul className="space-y-2">
            {achievements.map((a, i) => (
              <li key={`a${i}`} className="flex items-start gap-3 rounded-2xl border border-line px-4 py-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-semibold text-ink">{a.title}</p>
                  {(a.level || a.year) && <p className="text-sm text-ink-soft">{[a.level, a.year].filter(Boolean).join(' · ')}</p>}
                </div>
              </li>
            ))}
            {tournaments.map((t, i) => (
              <li key={`t${i}`} className="flex items-start gap-3 rounded-2xl border border-line px-4 py-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-orange-500" />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-semibold text-ink">{t.name}</p>
                  {(t.result || t.year) && <p className="text-sm text-ink-soft">{[t.result, t.year].filter(Boolean).join(' · ')}</p>}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {photos.length > 0 && (
        <Section title="In action">
          <div className="grid grid-cols-2 gap-2">
            {photos.map((p, i) => (
              <a key={i} href={safeUrl(getPhotoUrl(p.url) || p.url)} target="_blank" rel="noopener noreferrer" className="block aspect-[4/3] overflow-hidden rounded-2xl bg-cream">
                <img src={getPhotoUrl(p.url) || p.url} alt={`${name} in action ${i + 1}`} loading="lazy" className="h-full w-full object-cover transition hover:scale-105" />
              </a>
            ))}
          </div>
        </Section>
      )}

      {profile.featuredVideoUrl && (
        <Section title="Featured video">
          <a href={safeUrl(profile.featuredVideoUrl)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3 transition hover:border-brand">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/10 text-brand"><Play className="h-4 w-4 fill-current" /></span>
            <span className="min-w-0 truncate text-sm font-semibold text-ink">{profile.featuredVideoUrl.replace(/^https?:[/][/](www[.])?/, '')}</span>
          </a>
        </Section>
      )}

      {videos.length > 0 && (
        <Section title="Highlight videos">
          <ul className="space-y-2">
            {videos.map((v, i) => {
              const thumb = youtubeThumb(v.url);
              return (
                <li key={i}>
                  <a href={safeUrl(v.url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 overflow-hidden rounded-2xl border border-line transition hover:border-brand">
                    <span className="relative grid h-20 w-32 shrink-0 place-items-center bg-slate-900">
                      {thumb && <img src={thumb} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-80" />}
                      <span className="relative grid h-9 w-9 place-items-center rounded-full bg-white/90 text-brand"><Play className="h-4 w-4 fill-current" /></span>
                    </span>
                    <span className="min-w-0 flex-1 pr-3">
                      <span className="block font-display text-base font-semibold text-ink">{v.platform || 'Video'} highlight</span>
                      <span className="block truncate text-xs text-ink-soft">{v.url.replace(/^https?:[/][/](www[.])?/, '')}</span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {custom.map((c, i) => (
        <Section key={i} title={c.title}>
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {(c.items || []).map((it: any, j: number) => (
              <li key={j} className="flex items-baseline justify-between gap-3 px-4 py-3">
                <span className="text-sm text-ink-soft">{it.label || ''}</span>
                <span className="text-right font-display text-base font-semibold text-ink">{it.value}</span>
              </li>
            ))}
          </ul>
        </Section>
      ))}

      {socials.length > 0 && (
        <Section title="Find me online">
          <div className="flex flex-wrap gap-2">
            {socials.map(([k, url]) => (
              <a key={k} href={safeUrl(url)} target="_blank" rel="noopener noreferrer nofollow" className="rounded-full border border-line px-4 py-2 text-sm font-semibold capitalize text-ink transition hover:border-brand hover:text-brand">
                {k === 'twitter' ? 'X' : k}
              </a>
            ))}
          </div>
        </Section>
      )}

      {onLogout && (
        <div className="px-4 pt-8">
          <button onClick={onLogout} className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-line font-display text-[15px] font-semibold uppercase tracking-wider text-ink transition hover:border-red-500 hover:text-red-600">
            <LogOut className="h-4 w-4" />Log out
          </button>
        </div>
      )}
    </div>
  );
}

/** Heading used by the public page when a profile can't be shown. */
export function CvMessage({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <h1 className="font-display text-3xl font-semibold text-ink"><AccentTitle>{title}</AccentTitle></h1>
      <p className="text-ink-soft">{text}</p>
    </div>
  );
}
