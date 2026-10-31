'use client';

import { LogOut, MapPin, Play } from 'lucide-react';
import { ageFromDob, realName } from '@/lib/cv';
import { getInitials, getPhotoUrl, safeUrl } from '@/lib/utils';

type Profile = Record<string, any>;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-4 pt-6">
      <h2 className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-ink-soft">{title}</h2>
      {children}
    </section>
  );
}

const month = (v?: string) => {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
};

const AVAILABILITY: Record<string, string> = { full_time: 'Full time', part_time: 'Part time', freelance: 'Freelance', consulting: 'Consulting', not_available: 'Not available' };

/** The public coach CV page, as academies, parents and players see it from the share link. Contact details stay private. */
export default function PublicCoachCv({ profile, onLogout }: { profile: Profile; onLogout?: () => void }) {
  const name = realName(profile.fullName) || 'Coach';
  const avatar = getPhotoUrl(profile.photo);
  const age = ageFromDob(profile.dob);
  const place = [profile.location?.city, profile.location?.state].filter(Boolean).join(', ');
  const sports: string[] = profile.sportsSpecialization || [];
  const ages: string[] = profile.ageGroupsCoached || [];

  const stats: { label: string; value: string }[] = [
    ...(profile.yearsOfExperience ? [{ label: 'Experience', value: `${profile.yearsOfExperience} yrs` }] : []),
    ...(age ? [{ label: 'Age', value: String(age) }] : []),
    ...(profile.availability ? [{ label: 'Availability', value: AVAILABILITY[profile.availability] || profile.availability }] : []),
    ...((profile.qualifications || []).length ? [{ label: 'Certificates', value: String(profile.qualifications.length) }] : []),
    ...((profile.playersTrained || []).length ? [{ label: 'Trained', value: String(profile.playersTrained.length) }] : []),
  ];

  const experience: any[] = [...(profile.experience || [])].sort((a, b) => Number(!!b.current) - Number(!!a.current));
  const qualifications: any[] = profile.qualifications || [];
  const education: any[] = profile.education || [];
  const trained: any[] = profile.playersTrained || [];
  const achievements: any[] = profile.achievements || [];
  const skills: string[] = profile.skills || [];
  const socials = Object.entries(profile.socialLinks || {}).filter(([k, v]) => v && k !== 'whatsapp') as [string, string][];

  return (
    <div className="mx-auto w-full max-w-3xl pb-10 md:px-6">
      <div className="px-4 pt-5">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-[#0b2a5c] to-brand p-6 text-white shadow-[0_28px_60px_-30px_rgba(0,35,90,0.7)] md:p-8">
          <div className="flex items-center gap-4">
            {avatar
              ? <img src={avatar} alt={name} className="h-20 w-20 shrink-0 rounded-full object-cover ring-4 ring-white/25" />
              : <span className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-white/15 font-display text-3xl font-bold ring-4 ring-white/25">{getInitials(name)}</span>}
            <div className="min-w-0">
              <span className="inline-block rounded-full border border-blue-300/60 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-blue-200">Coach</span>
              <h1 className="mt-1 font-display text-[28px] font-semibold leading-tight">{name}</h1>
              <p className="mt-0.5 text-sm font-semibold text-blue-100">{[profile.coachingLevel, sports.slice(0, 3).join(', ')].filter(Boolean).join(' · ')}</p>
              {place && <p className="mt-1 flex items-center gap-1 text-xs text-blue-200"><MapPin className="h-3.5 w-3.5" />{place}</p>}
            </div>
          </div>
          {profile.tagline && <p className="mt-4 text-sm leading-relaxed text-blue-50">{profile.tagline}</p>}
        </div>
      </div>

      {profile.aboutBio && <Section title="About"><p className="whitespace-pre-line text-[15px] leading-relaxed text-ink">{profile.aboutBio}</p></Section>}
      {profile.coachingPhilosophy && <Section title="Coaching philosophy"><p className="whitespace-pre-line text-[15px] leading-relaxed text-ink">{profile.coachingPhilosophy}</p></Section>}

      {stats.length > 0 && (
        <Section title="At a glance">
          <div className="grid grid-cols-3 gap-2 md:grid-cols-5">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-line bg-cream/60 px-3 py-3 text-center">
                <p className="truncate font-display text-xl font-semibold text-ink">{s.value}</p>
                <p className="mt-0.5 truncate font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-soft">{s.label}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {(sports.length > 0 || ages.length > 0) && (
        <Section title="Coaches">
          <div className="flex flex-wrap gap-2">
            {sports.map((k) => <span key={k} className="rounded-full bg-brand/10 px-3 py-1.5 text-sm font-semibold text-brand">{k}</span>)}
            {ages.map((k) => <span key={k} className="rounded-full border border-line px-3 py-1.5 text-sm text-ink-soft">{k}</span>)}
          </div>
        </Section>
      )}

      {experience.length > 0 && (
        <Section title="Coaching experience">
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {experience.map((e, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-display text-base font-semibold text-ink">{e.organization}</p>
                  <p className="truncate text-sm text-ink-soft">{[e.role, [month(e.startDate), e.current ? 'Present' : month(e.endDate)].filter(Boolean).join(' – ')].filter(Boolean).join(' · ')}</p>
                </div>
                {e.current && <span className="shrink-0 rounded-full bg-brand/10 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-brand">Current</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {qualifications.length > 0 && (
        <Section title="Certifications & licences">
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {qualifications.map((q, i) => (
              <li key={i} className="px-4 py-3">
                <p className="font-display text-base font-semibold text-ink">{q.name}</p>
                {(q.issuer || q.year) && <p className="text-sm text-ink-soft">{[q.issuer, q.year].filter(Boolean).join(' · ')}</p>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {trained.length > 0 && (
        <Section title="Players & teams trained">
          <ul className="space-y-2">
            {trained.map((t, i) => (
              <li key={i} className="flex items-start gap-3 rounded-2xl border border-line px-4 py-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-orange-500" />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-semibold text-ink">{t.name}</p>
                  {(t.result || t.year) && <p className="text-sm text-ink-soft">{[t.result, t.year].filter(Boolean).join(' · ')}</p>}
                  {t.description && <p className="mt-1 text-sm text-ink-soft">{t.description}</p>}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {achievements.length > 0 && (
        <Section title="Awards & achievements">
          <ul className="space-y-2">
            {achievements.map((a, i) => (
              <li key={i} className="flex items-start gap-3 rounded-2xl border border-line px-4 py-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-semibold text-ink">{a.title}</p>
                  {(a.level || a.year) && <p className="text-sm text-ink-soft">{[a.level, a.year].filter(Boolean).join(' · ')}</p>}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {education.length > 0 && (
        <Section title="Education">
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {education.map((e, i) => (
              <li key={i} className="px-4 py-3">
                <p className="font-display text-base font-semibold text-ink">{e.institution}</p>
                {(e.degree || e.endYear) && <p className="text-sm text-ink-soft">{[e.degree, e.fieldOfStudy, e.isCurrent ? 'Studying' : e.endYear].filter(Boolean).join(' · ')}</p>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {skills.length > 0 && (
        <Section title="Skills">
          <div className="flex flex-wrap gap-2">{skills.map((k) => <span key={k} className="rounded-full border border-line bg-cream px-3 py-1.5 text-sm font-semibold text-ink">{k}</span>)}</div>
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
