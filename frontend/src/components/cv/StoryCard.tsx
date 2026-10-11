'use client';

import { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { StoryData } from '@/lib/cv';

export const STORY_W = 1080;
export const STORY_H = 1920;

interface Props {
  data: StoryData;
  logoSrc: string | null; // data URL (inlined so export never hits CORS)
}

/**
 * 1080×1920 (9:16) Instagram Story card. Always rendered at native size with inline styles;
 * the preview scales it with a CSS transform and the exporter captures the unscaled node.
 */
const StoryCard = forwardRef<HTMLDivElement, Props>(({ data, logoSrc }, ref) => {
  const initials = data.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const sportLine = [data.sport, data.position].filter(Boolean).join(' • ');

  return (
    <div
      ref={ref}
      style={{
        width: STORY_W, height: STORY_H, position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(160deg, #0f172a 0%, #1e3a8a 100%)',
        fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, sans-serif', color: '#fff',
        display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '110px 90px 90px',
        boxSizing: 'border-box',
      }}
    >
      {/* decorative glow */}
      <div style={{ position: 'absolute', top: -300, right: -300, width: 900, height: 900, borderRadius: '50%', background: 'radial-gradient(circle, rgba(96,165,250,0.35), transparent 65%)' }} />
      <div style={{ position: 'absolute', bottom: -350, left: -350, width: 1000, height: 1000, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.25), transparent 65%)' }} />

      {/* header: logo + badge */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {logoSrc && <img src={logoSrc} alt="" style={{ height: 76, width: 'auto' }} />}
          <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: -0.5 }}>LinkSports.in</span>
        </div>
        <div style={{ border: '3px solid #60a5fa', color: '#93c5fd', borderRadius: 999, padding: '14px 34px', fontSize: 32, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>
          Player Profile
        </div>
      </div>

      {/* athlete showcase */}
      <div style={{ marginTop: 130, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        <div style={{ width: 460, height: 460, borderRadius: '50%', padding: 10, background: 'linear-gradient(135deg, #60a5fa, #1d4ed8)', boxShadow: '0 30px 80px rgba(0,0,0,0.45)' }}>
          {data.photo ? (
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', backgroundImage: `url("${data.photo}")`, backgroundSize: 'cover', backgroundPosition: 'center top', backgroundColor: '#1e293b' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 190, fontWeight: 800, color: '#93c5fd' }}>
              {initials}
            </div>
          )}
        </div>

        <div style={{ marginTop: 64, fontSize: data.fullName.length > 20 ? 84 : 104, fontWeight: 800, textAlign: 'center', lineHeight: 1.05, letterSpacing: -2 }}>
          {data.fullName}
        </div>
        {sportLine && <div style={{ marginTop: 26, fontSize: 50, fontWeight: 600, color: '#93c5fd', textAlign: 'center' }}>{sportLine}</div>}
        {data.club && <div style={{ marginTop: 14, fontSize: 40, color: '#cbd5e1', textAlign: 'center' }}>{data.club}</div>}
      </div>

      {/* top 3 stats / medals */}
      <div style={{ marginTop: 80, width: '100%', display: 'flex', flexDirection: 'column', gap: 24, position: 'relative' }}>
        {data.stats.length > 0 && (
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 4, color: '#60a5fa', textTransform: 'uppercase', marginBottom: 4 }}>Career Highlights</div>
        )}
        {data.stats.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 28, background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(255,255,255,0.15)', borderRadius: 28, padding: '30px 36px' }}>
            <div style={{ width: 64, height: 64, flexShrink: 0, borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, fontWeight: 800 }}>{i + 1}</div>
            <div style={{ fontSize: 40, fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{s}</div>
          </div>
        ))}
      </div>

      {/* CTA footer + QR */}
      <div style={{ marginTop: 'auto', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40, position: 'relative' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 46, fontWeight: 800, lineHeight: 1.2 }}>Create your Free Sports CV at</div>
          <div style={{ fontSize: 56, fontWeight: 800, color: '#60a5fa', marginTop: 8 }}>linksports.in</div>
          <div style={{ fontSize: 28, color: '#94a3b8', marginTop: 16 }}>Scan to view my live profile</div>
        </div>
        <div style={{ background: '#fff', padding: 22, borderRadius: 28, lineHeight: 0 }}>
          <QRCodeSVG value={data.shareUrl} size={260} level="M" bgColor="#ffffff" fgColor="#0f172a" />
        </div>
      </div>
    </div>
  );
});

StoryCard.displayName = 'StoryCard';
export default StoryCard;
