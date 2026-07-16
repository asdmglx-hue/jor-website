'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';

const VISIBLE_COUNT = 2;

// This box needs to feel like part of the page's own scroll, not a
// separate walled-off widget — scroll down through it, and once it's
// exhausted, keep going straight into the rest of the page in the same
// gesture; scroll back up from below it and it un-scrolls itself the
// same way.
//
// The wrinkle that broke the "scroll back up" direction specifically:
// browsers lock a wheel/trackpad gesture to whichever element it started
// on and don't retarget mid-gesture, even once that element visually
// slides back under a stationary cursor as the page scrolls. Scrolling
// down "just worked" because the gesture naturally starts with the
// cursor over this box. Scrolling back up from further down the page
// starts the gesture over whatever's under the cursor down there
// instead — by the time the box scrolls back into view under the
// cursor, the gesture is still locked to that other element, so this
// box's own event listener never fires for it at all.
//
// Fix: don't listen on the box itself — listen on the window, so every
// wheel event on the page is seen regardless of what the browser thinks
// its "real" target is, and decide whether to act on it by checking the
// box's live on-screen position against the cursor for that event. That
// geometric check is unaffected by gesture-target locking.
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
    function handleWheel(e: WheelEvent) {
      const el = containerRef.current;
      if (!el) return;

      // Is the cursor currently over the box, right now, for this exact
      // event — independent of which element the gesture "officially"
      // started on.
      const rect = el.getBoundingClientRect();
      const overBox = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (!overBox) return; // not over the box — leave this event alone, let the page scroll natively

      const delta = e.deltaY;
      if (delta === 0) return;

      const maxScroll = el.scrollHeight - el.clientHeight;
      if (maxScroll <= 0) return; // nothing to scroll in the box — let the page handle it natively

      const current = el.scrollTop;
      const target = Math.min(Math.max(current + delta, 0), maxScroll);
      const consumed = target - current;
      el.scrollTop = target;

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

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <div ref={containerRef} className="testi-scroll" style={maxHeight ? { maxHeight } : undefined}>
      {children}
    </div>
  );
}
