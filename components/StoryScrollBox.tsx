'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';

const VISIBLE_COUNT = 2;
// How long a pause in wheel events means "this gesture actually ended" —
// see the gesture-stickiness note below. 150ms is comfortably longer
// than the gap between ticks in a single continuous scroll, even a fast
// one, but short enough that a genuinely new, separate scroll starting
// elsewhere isn't wrongly captured by a stale gesture.
const GESTURE_END_DELAY = 150;

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
// same way. It's also draggable directly with the left mouse button, for
// people who'd rather grab and pull than use a wheel/trackpad.
//
// A few browser behaviors fought against the "feels like part of the
// page" goal and needed working around:
//
// 1. Wheel/trackpad gestures get locked to whichever element they
//    started on and don't retarget mid-gesture, even once that element
//    visually slides back under a stationary cursor as the page scrolls.
//    Fixed by listening on the window instead of the box, and deciding
//    whether to act on each event by checking the box's live on-screen
//    position against the cursor for that exact event, which is
//    unaffected by gesture-target locking.
//
// 2. Native scroll chaining can kick in WHILE the box still has room
//    left, running alongside the manual forwarding below rather than
//    instead of it, which made the page visibly move at the same time as
//    the box. Fixed with `overscroll-behavior-y: contain` in the CSS, so
//    the browser never does any of that on its own.
//
// 3. During a fast flick, the cursor can drift a few pixels outside the
//    box's exact bounds mid-gesture (ordinary hand jitter) — with only
//    the position check from #1, those individual events would leak
//    straight to the page even though the box still has plenty of room
//    left, which showed up as the page jumping before the box had
//    actually finished scrolling. Fixed by treating a scroll as "still
//    the box's gesture" for a short grace period after the last event
//    that was genuinely over the box, rather than re-deciding fresh on
//    pixel-perfect position every single tick.
export default function StoryScrollBox({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);
  const [dragging, setDragging] = useState(false);

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
    let gestureActive = false;
    let gestureEndTimer: ReturnType<typeof setTimeout> | null = null;

    function handleWheel(e: WheelEvent) {
      const el = containerRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const overBox = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;

      if (!overBox && !gestureActive) return; // a genuinely separate scroll elsewhere — leave it alone

      if (overBox) {
        // Confirmed over the box for this event — (re)start the grace
        // period so brief drift outside it during the same flick still
        // counts as this gesture.
        gestureActive = true;
        if (gestureEndTimer) clearTimeout(gestureEndTimer);
        gestureEndTimer = setTimeout(() => { gestureActive = false; }, GESTURE_END_DELAY);
      }

      if (e.deltaY === 0) return;
      if (consumeScroll(el, e.deltaY)) e.preventDefault();
    }

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', handleWheel);
      if (gestureEndTimer) clearTimeout(gestureEndTimer);
    };
  }, []);

  // Touch (phones/tablets) — a finger physically starting on the box IS
  // the box's own gesture, so unlike wheel this can listen directly on
  // the element itself; there's no stationary-cursor/gesture-locking or
  // drift wrinkle to work around here, since the finger doesn't leave
  // the screen mid-gesture.
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

  // Click-and-drag with the left mouse button — grab anywhere on the box
  // and pull up/down to scroll it, the same motion as dragging a
  // scrollbar thumb, without needing the scrollbar itself visible.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let isDragging = false;
    let startY = 0;
    let startScrollTop = 0;

    function handleMouseDown(e: MouseEvent) {
      if (e.button !== 0) return; // left click only
      isDragging = true;
      startY = e.clientY;
      startScrollTop = el!.scrollTop;
      setDragging(true);
      // Dragging text inside the box would otherwise start a text
      // selection instead of a scroll — this is the standard trade-off
      // for click-and-drag scrolling (same as e.g. Google Maps).
      e.preventDefault();
    }

    function handleMouseMove(e: MouseEvent) {
      if (!isDragging) return;
      const maxScroll = el!.scrollHeight - el!.clientHeight;
      el!.scrollTop = Math.min(Math.max(startScrollTop + (startY - e.clientY), 0), maxScroll);
    }

    function handleMouseUp() {
      if (!isDragging) return;
      isDragging = false;
      setDragging(false);
    }

    el.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      el.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="testi-scroll"
      style={{
        ...(maxHeight ? { maxHeight } : undefined),
        cursor: dragging ? 'grabbing' : 'grab',
        userSelect: dragging ? 'none' : undefined,
      }}
    >
      {children}
    </div>
  );
}
