'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export default function CitySlider({ cities }: { cities: { city: string; count: number }[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(0);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);

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

  const doubled = [...cities, ...cities];

  return (
    <div
      style={{ overflow: 'hidden', position: 'relative' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 60, background: 'linear-gradient(to right, #F5F4FF, transparent)', zIndex: 1, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 60, background: 'linear-gradient(to left, #F5F4FF, transparent)', zIndex: 1, pointerEvents: 'none' }} />
      <div ref={trackRef} style={{ display: 'flex', gap: 10, width: 'max-content', padding: '4px 0' }}>
        {doubled.map((item, i) => (
          <Link
            key={i}
            href={`/proposals?city=${item.city}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 18px', borderRadius: 12,
              background: '#fff', border: '1.5px solid #E8E6F5',
              color: '#534AB7', fontWeight: 700, fontSize: 14,
              textDecoration: 'none', whiteSpace: 'nowrap',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            }}
          >
            <img src="https://flagcdn.com/20x15/pk.png" width="20" height="15" alt="Pakistan" style={{ borderRadius: 2, objectFit: 'cover' }} />
            {item.city}
            <span style={{ fontSize: 11, fontWeight: 600, color: '#B0ADCB' }}>{item.count}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
