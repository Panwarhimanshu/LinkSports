const ITEMS = ['Free for every player', 'PDF CV', 'Instagram Story card', 'One shareable link', '50+ sports', 'Made in India'];

/** Solid brand band with a slow scrolling line of text. Decorative, so hidden from screen readers. */
export default function Ticker() {
  return (
    <div aria-hidden className="bg-brand text-white overflow-hidden">
      <div className="flex w-max animate-marquee motion-reduce:animate-none py-3">
        {[0, 1].map((copy) => (
          <ul key={copy} className="flex shrink-0 items-center">
            {ITEMS.map((text) => (
              <li key={text} className="flex items-center whitespace-nowrap font-display text-sm font-semibold uppercase tracking-[0.18em]">
                <span className="px-6">{text}</span>
                <span className="text-white/45">✦</span>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
