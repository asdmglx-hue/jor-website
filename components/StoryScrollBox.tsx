'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';

const VISIBLE_COUNT = 2;

// This box needs to feel like part of the page's own scroll, not a
// separate walled-off widget — scroll down through it, and once it's
// exhausted, keep going straight into the rest of the page in the exact
// same gesture; scroll back up from below it and it un-scrolls itself the
// same way. Plain native `overflow-y: auto` gets partway there but has a
// real, well-known gap: once a wheel/trackpad gesture is already
// "captured" by this inner box, browsers (Safari and trackpad-driven
// momentum scrolling especially) don't reliably hand the remainder of
// that same gesture off to the page — you have to end the gesture and
// move the pointer before scrolling resumes. That's exactly the "stuck
// until I reposition the pointer" and "doesn't work scrolling back up"
// behavior this replaces.
//
// The fix: handle every wheel tick manually. Scroll the box itself while
// it has room; the instant a tick would overflow past its top or bottom,
// spill just the leftover amount into the page's own scroll — in that
// same event, not the next one — so there's no dead zone to get stuck in
// and no dependence on the browser's own (unreliable, here) scroll
// chaining.
//
// This uses a real addEventListener (not React's onWheel JSX prop)
// specifically so it can be registered as non-passive — React's onWheel
// attaches a passive listener by default, which silently ignores
// preventDefault(). With that ignored, the manual scrollTop assignment
// below and the browser's own native scroll would both fire for the same
// gesture and fight each other, which reads as exactly the laggy,
// stuttery feeling this is meant to fix.
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
      // scroll to, so leave it uncapped in that case.
      if (rows.length <= VISIBLE_COUNT) { setMaxHeight(undefined); return; }
      const lastVisibleRow = rows[VISIBLE_COUNT - 1];
      const elTop = el!.getBoundingClientRect().top;
      const rowBottom = lastVisibleRow.getBoundingClientRect().bottom;
      setMaxHeight(Math.ceil(rowBottom - elTop));
    }

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [children]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function handleWheel(e: WheelEvent) {
      const delta = e.deltaY;
      if (delta === 0) return;

      const maxScroll = el!.scrollHeight - el!.clientHeight;
      if (maxScroll <= 0) return; // nothing to scroll in the box — let the page handle it natively

      const current = el!.scrollTop;
      const target = Math.min(Math.max(current + delta, 0), maxScroll);
      const consumed = target - current;
      el!.scrollTop = target;

      const leftover = delta - consumed;
      if (leftover !== 0) {
        // Box is already maxed in this direction — send exactly what's
        // left of this same scroll tick straight into the page right
        // now, instead of waiting for a future event to (maybe) get
        // chained there on its own.
        window.scrollBy(0, leftover);
      }
      e.preventDefault();
    }

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <div ref={containerRef} className="testi-scroll" style={maxHeight ? { maxHeight } : undefined}>
      {children}
    </div>
  );
}
