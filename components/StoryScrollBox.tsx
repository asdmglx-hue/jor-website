'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';

const VISIBLE_COUNT = 2;

// Earlier version of this manually forwarded wheel events into the box to
// get hover-to-scroll working without a click first, and to hand off into
// the page scroll at the box's edges. That reimplementation was the actual
// cause of a follow-up bug — scrolling back up after reaching the bottom
// frequently didn't register, and the motion felt laggy compared to
// native scrolling. Plain `overflow-y: auto` already scrolls on hover
// with no click needed in every current browser, and already hands off to
// the page's own scroll at its boundary (that's the default
// `overscroll-behavior: auto` — scroll chaining is on unless something
// turns it off) — with correct, GPU-smooth momentum and reversal in both
// directions, for free. So this component's only remaining job is sizing
// the box to fit exactly VISIBLE_COUNT stories before that native
// scrolling kicks in.
export default function StoryScrollBox({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function measure() {
      const rows = el!.querySelectorAll<HTMLElement>('.testi-row');
      // Strictly MORE than VISIBLE_COUNT rows is required before capping —
      // exactly VISIBLE_COUNT rows already fits with nothing left to
      // scroll to, so leave it uncapped in that case (this was the actual
      // bug: with VISIBLE_COUNT previously set to 6 and exactly 6 sample
      // stories on the page, this comparison was true and the box never
      // got a max-height at all, so there was nothing to scroll).
      if (rows.length <= VISIBLE_COUNT) { setMaxHeight(undefined); return; }
      const lastVisibleRow = rows[VISIBLE_COUNT - 1];
      const elTop = el!.getBoundingClientRect().top;
      const rowBottom = lastVisibleRow.getBoundingClientRect().bottom;
      // Bottom edge of the last visible story, measured from the box's
      // own top — exactly enough room for VISIBLE_COUNT regardless of how
      // long any one quote happens to run, plus a little breathing room
      // to match the box's own top/bottom padding.
      setMaxHeight(Math.ceil(rowBottom - elTop) + 8);
    }

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [children]);

  return (
    <div
      ref={containerRef}
      className="testi-scroll"
      style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}
    >
      {children}
    </div>
  );
}
