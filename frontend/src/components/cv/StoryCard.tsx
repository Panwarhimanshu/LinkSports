'use client';

import { forwardRef, useState } from 'react';
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
 *
 * Layout is three fixed regions — header, a flexible middle, and a footer pinned to the bottom —
 * so long names, a club line and three two-line highlights can never push the QR code off the card.
 */
const StoryCard = forwardRef<HTMLDivElement, Props>(({ data, logoSrc }, ref) => {
  const [photoFailed, setPhotoFailed] = useState(false);
  const initials = data.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const sportLine = [data.sport, data.position].filter(Boolean).join(' • ');
  const stats = data.stats.slice(0, 3);

  // scale the showcase down a little when the card is busy
  const busy = stats.length + (data.club ? 1 : 0) + (data.fullName.length > 18 ? 1 : 0);
  const photoSize = busy >= 4 ? 360 : busy >= 3 ? 400 : 440;
  const nameSize = data.fullName.length > 22 ? 72 : data.fullName.length > 16 ? 84 : 100;
  const showPhoto = Boolean(data.photo) && !photoFailed;

  return (
    <div
      ref={ref}
      style={{
        width: STORY_W, height: STORY_H, position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(160deg, #0f172a 0%, #1e3a8a 100%)',
        fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, sans-serif', color: '#fff',
        display: 'flex', flexDirection: 'column', padding: '96px 90px 84px', boxSizing: 'border-box',
      }}
    >
      {/* decorative glow */}
      <div style={{ position: 'absolute', top: -300, right: -300, width: 900, height: 900, borderRadius: '50%', background: 'radial-gradient(circle, rgba(96,165,250,0.35), transparent 65%)' }} />
      <div style={{ position: 'absolute', bottom: -350, left: -350, width: 1000, height: 1000, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.25), transparent 65%)' }} />

      {/* header: real logo (white badge) + label */}
      <div style={{ flexShrink: 0, width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
        {logoSrc ? (
          // logo.png is a square with the blue wordmark band in the middle; crop to the band
          <div style={{ width: 330, height: 104, borderRadius: 18, overflow: 'hidden', background: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }}>
            <img src={logoSrc} alt="LinkSports.in" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }} />
          </div>
        ) : (
          <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: -0.5 }}>LinkSports.in</span>
        )}
        <div style={{ border: '3px solid #60a5fa', color: '#93c5fd', borderRadius: 999, padding: '14px 32px', fontSize: 30, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>
          Player Profile
        </div>
      </div>

      {/* flexible middle: showcase + highlights, centred in whatever space is left */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative', padding: '36px 0' }}>
        <div style={{ width: photoSize, height: photoSize, flexShrink: 0, borderRadius: '50%', padding: 10, background: 'linear-gradient(135deg, #60a5fa, #1d4ed8)', boxShadow: '0 30px 80px rgba(0,0,0,0.45)', boxSizing: 'border-box' }}>
          <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: '#1e293b' }}>
            {/* initials sit underneath, so a photo that fails to load still leaves a finished card */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: photoSize * 0.4, fontWeight: 800, color: '#93c5fd' }}>
              {initials}
            </div>
            {showPhoto && (
              <img
                src={data.photo!}
                alt=""
                onError={() => setPhotoFailed(true)}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
              />
            )}
          </div>
        </div>

        <div style={{ flexShrink: 0, marginTop: 36, fontSize: nameSize, fontWeight: 800, textAlign: 'center', lineHeight: 1.05, letterSpacing: -2, maxWidth: '100%' }}>
          {data.fullName}
        </div>
        {sportLine && <div style={{ flexShrink: 0, marginTop: 18, fontSize: 46, fontWeight: 600, color: '#93c5fd', textAlign: 'center' }}>{sportLine}</div>}
        {data.club && (
          <div style={{ flexShrink: 0, marginTop: 10, fontSize: 36, lineHeight: 1.3, color: '#cbd5e1', textAlign: 'center', maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {data.club}
          </div>
        )}

        {stats.length > 0 && (
          <div style={{ flexShrink: 0, marginTop: 44, width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 4, color: '#60a5fa', textTransform: 'uppercase' }}>Career Highlights</div>
            {stats.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 26, background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(255,255,255,0.15)', borderRadius: 26, padding: '20px 30px' }}>
                <div style={{ width: 58, height: 58, flexShrink: 0, borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 800 }}>{i + 1}</div>
                <div style={{ fontSize: 36, fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{s}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CTA footer + QR — never shrinks, always fully visible */}
      <div style={{ flexShrink: 0, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40, position: 'relative' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.2 }}>Create your Free Sports CV at</div>
          <div style={{ fontSize: 54, fontWeight: 800, color: '#60a5fa', marginTop: 8 }}>linksports.in</div>
          <div style={{ fontSize: 28, color: '#94a3b8', marginTop: 14 }}>Scan to view my live profile</div>
        </div>
        <div style={{ background: '#fff', padding: 20, borderRadius: 26, lineHeight: 0 }}>
          <QRCodeSVG value={data.shareUrl} size={240} level="M" bgColor="#ffffff" fgColor="#0f172a" />
        </div>
      </div>
    </div>
  );
});

StoryCard.displayName = 'StoryCard';
export default StoryCard;
