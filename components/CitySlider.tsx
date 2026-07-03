'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export default function CitySlider({ cities }: { cities: { city: string; count: number }[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(0);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);

  // Drag state — a hold-and-drag pauses the auto-scroll and lets the user
  // manually move the track; releasing resumes auto-scroll from wherever
  // it was left, rather than snapping back or restarting.
  const isDraggingRef = useRef(false);
  const isPointerDownRef = useRef(false); // true only while the pointer is actually held — without this, plain hovering (no press at all) was being misread as a drag
  const dragStartXRef = useRef(0);
  const dragStartPosRef = useRef(0);
  const hasDraggedRef = useRef(false); // distinguishes a real drag from a simple click

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let raf: number;
    const speed = 0.5;

    const animate = () => {
      if (!pausedRef.current) {
        posRef.current += speed;
        const half = track.scrollWidth / 2;
        if (posRef.current >= half) posRef.current = 0;
        track.style.transform = `translateX(-${posRef.current}px)`;
      }
      raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    isPointerDownRef.current = true;
    hasDraggedRef.current = false;
    dragStartXRef.current = e.clientX;
    dragStartPosRef.current = posRef.current;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    // Deliberately NOT setting isDraggingRef/paused here — see
    // handlePointerMove. Doing it on press alone meant even a simple
    // click (with a pixel or two of natural hand tremor before release)
    // could get misread as a drag and have its navigation suppressed.
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    // Without this check, this fires on every mouse movement over the
    // slider — including just hovering with no press at all — which was
    // being misread as a drag purely from ordinary mouse travel.
    if (!isPointerDownRef.current || !trackRef.current) return;
    const deltaX = dragStartXRef.current - e.clientX; // dragging left → content moves left, matches natural drag feel
    if (!isDraggingRef.current) {
      // Only start actually dragging once movement clearly exceeds
      // normal click jitter — a real, deliberate drag, not a shaky click.
      if (Math.abs(deltaX) < 8) return;
      isDraggingRef.current = true;
      hasDraggedRef.current = true;
      setPaused(true);
    }
    const half = trackRef.current.scrollWidth / 2;
    // Wrap correctly for drags in either direction, not just forward.
    let next = (dragStartPosRef.current + deltaX) % half;
    if (next < 0) next += half;
    posRef.current = next;
    trackRef.current.style.transform = `translateX(-${next}px)`;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isPointerDownRef.current = false;
    if (isDraggingRef.current) setPaused(false); // resume auto-scroll from the current position
    isDraggingRef.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };


  // Prevents an accidental navigation on the Link the pointer happens to
  // release over, but only for a genuine drag (see the 8px threshold
  // above) — an ordinary click always passes through untouched.
  const handleClickCapture = (e: React.MouseEvent) => {
    if (hasDraggedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      hasDraggedRef.current = false;
    }
  };

  const doubled = [...cities, ...cities];

  return (
    <div
      style={{ overflow: 'hidden', position: 'relative', cursor: isDraggingRef.current ? 'grabbing' : 'grab', touchAction: 'pan-y' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => { if (!isDraggingRef.current) setPaused(false); }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClickCapture={handleClickCapture}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 60, background: 'linear-gradient(to right, #F5F4FF, transparent)', zIndex: 1, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 60, background: 'linear-gradient(to left, #F5F4FF, transparent)', zIndex: 1, pointerEvents: 'none' }} />
      <div ref={trackRef} style={{ display: 'flex', gap: 10, width: 'max-content', padding: '4px 0' }}>
        {doubled.map((item, i) => (
          <Link
            key={i}
            href={`/proposals?city=${item.city}`}
            draggable={false}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 18px', borderRadius: 12,
              background: '#fff', border: '1.5px solid #E8E6F5',
              color: '#534AB7', fontWeight: 700, fontSize: 14,
              textDecoration: 'none', whiteSpace: 'nowrap',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              userSelect: 'none',
            }}
          >
            <img src="https://flagcdn.com/20x15/pk.png" width="20" height="15" alt="Pakistan" draggable={false} style={{ borderRadius: 2, objectFit: 'cover' }} />
            {item.city}
            <span style={{ fontSize: 11, fontWeight: 600, color: '#B0ADCB' }}>{item.count}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
