'use client';
import { useState, useEffect } from 'react';
import { isSubscriptionActive } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export default function PhotoLightbox({ src, name }: { src: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const session = getSession();
    setIsActive(session ? isSubscriptionActive(session) : false);
  }, []);

  if (!isActive) {
    return (
      <div style={{
        width: 100, height: 100, borderRadius: 16, flexShrink: 0,
        background: '#E8E6F5', border: '2px solid #E8E6F5',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Blurred placeholder */}
        <img src={src} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(12px)', transform: 'scale(1.1)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,24,48,0.45)' }} />
        <svg style={{ position: 'relative', zIndex: 1 }} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0110 0v4"/>
        </svg>
      </div>
    );
  }

  return (
    <>
      <img
        src={src}
        alt="Profile"
        onClick={() => setOpen(true)}
        style={{ width: 100, height: 100, borderRadius: 16, objectFit: 'cover', border: '2px solid #E8E6F5', flexShrink: 0, cursor: 'zoom-in' }}
      />
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, cursor: 'zoom-out',
          }}
        >
          <img
            src={src}
            alt={name}
            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 16, objectFit: 'contain', boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }}
          />
        </div>
      )}
    </>
  );
}
