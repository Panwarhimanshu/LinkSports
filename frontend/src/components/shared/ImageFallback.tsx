'use client';

import { useEffect } from 'react';

// Many older profile photos point at files on a server that no longer exists. Instead of a
// broken-image icon, swap any failed avatar-sized image for a neutral LinkSports avatar:
// initials from the alt text when there is a name, otherwise a person silhouette.
const svg = (inner: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="#eef4fb"/>${inner}</svg>`,
  )}`;

const initialsOf = (name: string) =>
  name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

const avatarFor = (alt: string) => {
  const ini = alt && !/photo|logo|image|avatar/i.test(alt) ? initialsOf(alt) : '';
  return ini
    ? svg(`<text x="48" y="50" dy=".35em" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="36" font-weight="600" fill="#004fab">${ini.replace(/[<&>]/g, '')}</text>`)
    : svg('<circle cx="48" cy="38" r="16" fill="#7aa5d9"/><path d="M18 84c4-17 16-26 30-26s26 9 30 26" fill="#7aa5d9"/>');
};

export default function ImageFallback() {
  useEffect(() => {
    const onError = (e: Event) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement) || img.dataset.fallback || img.src.startsWith('data:')) return;
      // only avatar/logo-sized images; leave banners and content images alone
      const box = img.getBoundingClientRect();
      if (box.width > 240 || box.height > 240) return;
      img.dataset.fallback = '1';
      img.src = avatarFor(img.alt || '');
    };
    window.addEventListener('error', onError, true); // image errors don't bubble; listen in capture phase
    // images that already failed before this ran (server-rendered pages)
    Array.from(document.images).forEach((img) => {
      if (img.complete && img.naturalWidth === 0 && img.src) onError({ target: img } as unknown as Event);
    });
    return () => window.removeEventListener('error', onError, true);
  }, []);
  return null;
}
