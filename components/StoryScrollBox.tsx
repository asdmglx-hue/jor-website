'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';

const VISIBLE_COUNT = 2;

// Consumes as much of `delta` as the box has room for in its own
// scrollTop, then sends whatever's left straight into the page's scroll
// in that same event — so there's no gap where a scroll tick does
// nothing (stuck), and no moment where the box and the page both move
// for the same tick (simultaneous scroll). Shared by both the wheel and
// touch handlers below so they behave identically.
function consumeScroll(el: HTMLDivElement, delta: number) {
  const maxScroll = el.scrollHeight - el.clientHeight;
  if (maxScroll <= 0) return false; // nothing to scroll in the box — let the caller fall back to native behavior

  const current = el.scrollTop;
  const target = Math.min(Math.max(current + delta, 0), maxScroll);
  const consumed = target - current;
  el.scrollTop = target;

  const leftover = delta - consumed;
  if (leftover !== 0) window.scrollBy(0, leftover);
  return true;
}

// This box needs to feel like part of the page's own scroll, not a
// separate walled-off widget — scroll down through it, and once it's
// exhausted, keep going straight into the rest of the page in the same
// gesture; scroll back up from below it and it un-scrolls itself the
// same way.
//
// Two browser behaviors fought against that goal and needed working
// around:
//
// 1. Wheel/trackpad gestures get locked to whichever element they
//    started on and don't retarget mid-gesture, even once that element
//    visually slides back under a stationary cursor as the page scrolls.
//    Scrolling down "just worked" because the gesture naturally starts
//    with the cursor over this box. Scrolling back up from further down
//    the page starts the gesture over whatever's under the cursor down
//    there instead, and stays locked there even once the box scrolls
//    back into view — so this box's own event listener never fired for
//    it. Fixed by listening on the window instead of the box, and
//    deciding whether to act on each event by checking the box's live
//    on-screen position against the cursor for that exact event, which
//    is unaffected by gesture-target locking.
//
// 2. Native scroll chaining (the browser's own handoff from a maxed-out
//    inner scrollable to the outer page) can kick in WHILE this box still
//    has room left, running alongside the manual forwarding below rather
//    than instead of it — which is what made the page visibly move at
//    the same time as the box. Fixed with `overscroll-behavior-y:
//    contain` in the CSS, so the browser never does any of that on its
//    own; this component is the only thing deciding when to hand off.
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

  // Mouse wheel / trackpad
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

      if (e.deltaY === 0) return;
      if (consumeScroll(el, e.deltaY)) e.preventDefault();
    }

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  // Touch (phones/tablets) — a finger physically starting on the box IS
  // the box's own gesture, so unlike wheel this can listen directly on
  // the element itself; there's no stationary-cursor/gesture-locking
  // wrinkle to work around here.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let lastY = 0;

    function handleTouchStart(e: TouchEvent) {
      lastY = e.touches[0].clientY;
    }

    function handleTouchMove(e: TouchEvent) {
      const currentY = e.touches[0].clientY;
      const delta = lastY - currentY; // finger moving up the screen = scrolling down
      lastY = currentY;
      if (delta === 0) return;
      if (consumeScroll(el!, delta)) e.preventDefault();
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  return (
    <div ref={containerRef} className="testi-scroll" style={maxHeight ? { maxHeight } : undefined}>
      {children}
    </div>
  );
}
