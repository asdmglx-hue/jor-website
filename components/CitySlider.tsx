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
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    dragStartXRef.current = e.clientX;
    dragStartPosRef.current = posRef.current;
    setPaused(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !trackRef.current) return;
    const deltaX = dragStartXRef.current - e.clientX; // dragging left → content moves left, matches natural drag feel
    if (Math.abs(deltaX) > 3) hasDraggedRef.current = true;
    const half = trackRef.current.scrollWidth / 2;
    // Wrap correctly for drags in either direction, not just forward.
    let next = (dragStartPosRef.current + deltaX) % half;
    if (next < 0) next += half;
    posRef.current = next;
    trackRef.current.style.transform = `translateX(-${next}px)`;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    setPaused(false); // resume auto-scroll from the current position
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  // Prevents an accidental navigation on the Link the pointer happens to
  // release over, if the user was actually dragging rather than clicking.
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
