import React from 'react';

// logo.png is a 1024×1024 square with the blue LINKSPORTS.IN wordmark in a band across the middle.
// Showing the whole square leaves a tiny wordmark inside a white box, so crop to the band exactly.
// Band position, as fractions of the image (measured from the file): left 8.98%, top 36.33%,
// width 82.03%, height 27.15%  →  aspect ratio 3.02 : 1.
const BAND = { left: 0.0898, top: 0.3633, width: 0.8203, height: 0.2715 };
const ASPECT = BAND.width / BAND.height;

export default function Logo({ className = '', height = 34 }: { className?: string; height?: number }) {
  const width = Math.round(height * ASPECT);
  const imageSize = width / BAND.width; // rendered size of the full square
  return (
    <span
      className={`relative inline-block overflow-hidden rounded-[3px] shrink-0 ${className}`}
      style={{ width, height }}
      role="img"
      aria-label="LinkSports.in"
    >
      <img
        src="/logo.png"
        alt=""
        draggable={false}
        style={{
          position: 'absolute', maxWidth: 'none', width: imageSize, height: imageSize,
          left: -BAND.left * imageSize, top: -BAND.top * imageSize,
        }}
      />
    </span>
  );
}
