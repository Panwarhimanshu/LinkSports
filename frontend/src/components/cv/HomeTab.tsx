'use client';

import { useEffect, useRef, useState } from 'react';
import { toJpeg, toPng } from 'html-to-image';
import toast from 'react-hot-toast';
import { FileText, ImageIcon, Loader2 } from 'lucide-react';
import { eventAPI, profileAPI } from '@/lib/api';
import { buildStoryData, toDataUrl, type StoryData } from '@/lib/cv';
import StoryCard, { STORY_H, STORY_W } from './StoryCard';
import { btnPrimary } from './ui';

// Home tab: the player's Story card plus the two export actions (PDF CV and Story image).
export default function HomeTab({ profile }: { profile: Record<string, any> }) {
  const [story, setStory] = useState<StoryData | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [format, setFormat] = useState<'png' | 'jpg'>('png');
  const [busy, setBusy] = useState<'pdf' | 'story' | 'share' | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.35);

  // inline photo + logo as data URLs so the export never fails on CORS
  useEffect(() => {
    let alive = true;
    (async () => {
      const [photo, logoUrl] = await Promise.all([toDataUrl(profile.photo), toDataUrl('/logo.png')]);
      if (!alive) return;
      setLogo(logoUrl);
      setStory({ ...buildStoryData(profile), photo });
    })();
    return () => { alive = false; };
  }, [profile]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / STORY_W));
    ro.observe(el);
    return () => ro.disconnect();
  }, [story]);

  const fileName = `${(profile.fullName || 'player').replace(/\s+/g, '_')}_LinkSports_Story.${format}`;

  const render = async (): Promise<Blob> => {
    if (!exportRef.current) throw new Error('Card not ready');
    await document.fonts?.ready;
    // make sure the photo and logo are fully decoded before drawing
    await Promise.all(Array.from(exportRef.current.querySelectorAll('img')).map((img) => img.decode?.().catch(() => undefined)));
    const opts = { width: STORY_W, height: STORY_H, pixelRatio: 1, canvasWidth: STORY_W, canvasHeight: STORY_H, backgroundColor: '#0f172a' };
    const shoot = () => (format === 'png' ? toPng(exportRef.current!, opts) : toJpeg(exportRef.current!, { ...opts, quality: 0.95 }));
    // Safari (iPhone) often leaves images blank on the first capture; the second pass is reliable
    await shoot().catch(() => undefined);
    const dataUrl = await shoot();
    return await (await fetch(dataUrl)).blob();
  };

  // Phones: a website can't write to the gallery directly. The share sheet can ("Save Image" on
  // iPhone, save/gallery targets on Android), but iOS only opens it right after a tap — so the
  // image is rendered ahead of time and the tap just hands it over.
  const isPhone = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
  const prepared = useRef<{ format: string; blob: Blob } | null>(null);
  const [savePreview, setSavePreview] = useState<string | null>(null);

  useEffect(() => {
    prepared.current = null;
    if (!story || !isPhone) return;
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const blob = await render();
        if (alive) prepared.current = { format, blob };
      } catch { /* rendered again on tap */ }
    }, 800);
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story, logo, format, isPhone]);

  const closePreview = () => {
    if (savePreview) URL.revokeObjectURL(savePreview);
    setSavePreview(null);
  };

  const downloadStory = async () => {
    setBusy('story');
    try {
      const blob = prepared.current?.format === format ? prepared.current.blob : await render();

      if (isPhone) {
        const file = new File([blob], fileName, { type: blob.type });
        if (navigator.canShare?.({ files: [file] })) {
          toast('Choose "Save Image" to add it to your gallery', { icon: '📲', duration: 5000 });
          try {
            await navigator.share({ files: [file] });
            void eventAPI.log('STORY_CARD_EXPORTED', { sport: profile.primarySport, format });
            return;
          } catch (e: any) {
            if (e?.name === 'AbortError') return; // closed the sheet
            // not allowed / unsupported → fall back to press-and-hold save below
          }
        }
        setSavePreview(URL.createObjectURL(blob));
        void eventAPI.log('STORY_CARD_EXPORTED', { sport: profile.primarySport, format });
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      void eventAPI.log('STORY_CARD_EXPORTED', { sport: profile.primarySport, format });
      toast.success('Story card saved');
    } catch {
      toast.error('Could not create the image. Please try again.');
    } finally { setBusy(null); }
  };

  const downloadPdf = async () => {
    setBusy('pdf');
    try {
      const res = await profileAPI.downloadAthleteCV(profile._id);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = `${(profile.fullName || 'player').replace(/\s+/g, '_')}_Sports_CV.pdf`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      void eventAPI.log('PDF_DOWNLOADED', { sport: profile.primarySport });
    } catch {
      toast.error('Could not download the PDF.');
    } finally { setBusy(null); }
  };

  return (
    <div className="flex flex-1 flex-col px-4 pb-8 pt-5">
      {/* hero player card: the same 9:16 card that gets exported as the Story */}
      <div
        ref={wrapRef}
        className="relative mx-auto w-full max-w-[320px] overflow-hidden rounded-3xl bg-slate-900 shadow-[0_32px_70px_-28px_rgba(0,35,90,0.6)] ring-1 ring-black/5"
        style={{ aspectRatio: '9 / 16' }}
      >
        {story ? (
          <div style={{ width: STORY_W, height: STORY_H, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
            <StoryCard data={story} logoSrc={logo} />
          </div>
        ) : <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-white" /></div>}
      </div>

      {/* off-screen full-size copy that is actually captured */}
      {story && (
        <div aria-hidden style={{ position: 'fixed', left: -10000, top: 0, pointerEvents: 'none' }}>
          <StoryCard ref={exportRef} data={story} logoSrc={logo} />
        </div>
      )}

      <div className="mx-auto mt-5 grid w-full max-w-[320px] grid-cols-2 gap-3">
        <button className={btnPrimary} onClick={downloadPdf} disabled={busy !== null}>
          {busy === 'pdf' ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}PDF CV
        </button>
        <button className={btnPrimary} onClick={downloadStory} disabled={busy !== null || !story}>
          {busy === 'story' ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" />}Story
        </button>
      </div>

      <div className="mt-3 flex items-center justify-center gap-1.5">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-soft">Story image</span>
        {(['png', 'jpg'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFormat(f)}
            aria-pressed={format === f}
            className={`h-9 rounded-full border px-4 font-mono text-[11px] font-bold uppercase tracking-[0.16em] transition-colors ${format === f ? 'border-ink bg-ink text-white' : 'border-line text-ink-soft hover:border-ink'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* fallback when the share sheet isn't available: long-press saves an <img> to the gallery */}
      {savePreview && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 p-4" role="dialog" aria-label="Save your Story card">
          <p className="max-w-xs text-center text-sm font-semibold text-white">
            Press and hold the image, then tap <span className="text-blue-300">&ldquo;Save to Photos&rdquo;</span> or <span className="text-blue-300">&ldquo;Download image&rdquo;</span>
          </p>
          <img src={savePreview} alt="Your LinkSports Story card" className="mt-4 max-h-[72vh] w-auto rounded-lg shadow-2xl" />
          <button onClick={closePreview} className="mt-5 h-11 rounded-full bg-white px-8 font-semibold text-slate-900">Done</button>
        </div>
      )}
    </div>
  );
}
