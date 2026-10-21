'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { buildStoryData, toDataUrl } from '@/lib/cv';
import StoryCard, { STORY_H, STORY_W } from './StoryCard';

/**
 * A small live copy of the player's Story card (always built from the saved profile, so it updates
 * right after each save). Used beside the Edit CV list on desktop.
 */
export default function StoryPreview({ profile, maxWidth = 300 }: { profile: Record<string, any>; maxWidth?: number }) {
  const [logo, setLogo] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [scale, setScale] = useState(maxWidth / STORY_W);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => { toDataUrl('/logo.png').then(setLogo); }, []);
  useEffect(() => {
    let alive = true;
    toDataUrl(profile.photo).then((p) => alive && setPhoto(p));
    return () => { alive = false; };
  }, [profile.photo]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / STORY_W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => ({ ...buildStoryData(profile), photo }), [profile, photo]);

  return (
    <div
      ref={wrap}
      className="relative w-full overflow-hidden rounded-3xl bg-slate-900 shadow-[0_32px_70px_-28px_rgba(0,35,90,0.6)] ring-1 ring-black/5"
      style={{ maxWidth, aspectRatio: '9 / 16' }}
    >
      <div style={{ width: STORY_W, height: STORY_H, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
        <StoryCard data={data} logoSrc={logo} />
      </div>
    </div>
  );
}
