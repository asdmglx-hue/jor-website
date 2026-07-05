'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { slugify } from '@/lib/categories';
import { MIN_CATEGORY_PROFILES } from '@/lib/supabase';

export default function CitySlider({ cities }: { cities: { city: string; count: number }[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(0);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false); // real React state now, purely for the cursor style

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

  // Global (window-level) listeners, only attached while a real drag is
  // in progress — added in handlePointerDown's move check below, removed
  // on release. Deliberately NOT using setPointerCapture: capturing the
  // pointer on this container can, in some browsers, prevent the click
  // that follows from ever reaching the Link nested inside it — which is
  // exactly what broke click-to-filter last time. Global listeners give
  // the same "keep tracking even if the cursor leaves the slider" benefit
  // without that side effect.
  const handleWindowPointerMove = (e: PointerEvent) => {
    if (!trackRef.current) return;
    const deltaX = dragStartXRef.current - e.clientX;
    const half = trackRef.current.scrollWidth / 2;
    let next = (dragStartPosRef.current + deltaX) % half;
    if (next < 0) next += half;
    posRef.current = next;
    trackRef.current.style.transform = `translateX(-${next}px)`;
  };

  const stopDragging = () => {
    window.removeEventListener('pointermove', handleWindowPointerMove);
    window.removeEventListener('pointerup', stopDragging);
    isDraggingRef.current = false;
    setIsDragging(false);
    setPaused(false); // resume auto-scroll from the current position
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    hasDraggedRef.current = false;
    dragStartXRef.current = e.clientX;
    dragStartPosRef.current = posRef.current;
    const startX = e.clientX;

    // Waits for real movement before committing to a drag — a plain
    // click never exceeds this, so it's left completely alone and
    // reaches the Link normally.
    const checkForDragStart = (moveEvent: PointerEvent) => {
      if (Math.abs(moveEvent.clientX - startX) < 8) return;
      window.removeEventListener('pointermove', checkForDragStart);
      isDraggingRef.current = true;
      hasDraggedRef.current = true;
      setIsDragging(true);
      setPaused(true);
      window.addEventListener('pointermove', handleWindowPointerMove);
      window.addEventListener('pointerup', stopDragging);
    };
    const cancelIfReleasedEarly = () => {
      window.removeEventListener('pointermove', checkForDragStart);
      window.removeEventListener('pointerup', cancelIfReleasedEarly);
    };
    window.addEventListener('pointermove', checkForDragStart);
    window.addEventListener('pointerup', cancelIfReleasedEarly);
  };

  // Prevents an accidental navigation on the Link the pointer happens to
  // release over, but only for a genuine drag — an ordinary click always
  // passes through untouched.
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
      style={{ overflow: 'hidden', position: 'relative', cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'pan-y' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => { if (!isDraggingRef.current) setPaused(false); }}
      onPointerDown={handlePointerDown}
      onClickCapture={handleClickCapture}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 60, background: 'linear-gradient(to right, #F5F4FF, transparent)', zIndex: 1, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 60, background: 'linear-gradient(to left, #F5F4FF, transparent)', zIndex: 1, pointerEvents: 'none' }} />
      <div ref={trackRef} style={{ display: 'flex', gap: 10, width: 'max-content', padding: '4px 0' }}>
        {doubled.map((item, i) => (
          <Link
            key={i}
            href={item.count >= MIN_CATEGORY_PROFILES ? `/proposals/${slugify(item.city)}` : `/proposals?city=${item.city}`}
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
