'use client';
import { useState, useEffect } from 'react';
import { getSession } from '@/lib/auth';
import { isSubscriptionActive } from '@/lib/supabase';
import PhotoLightbox from './PhotoLightbox';

// Matches the exact locked-avatar treatment already used on browse cards
// (blurred photo + lock icon, or a locked initial if there's no photo) —
// this was previously only applied on the cards, not the profile detail
// page itself, so a non-subscriber could see a full, unlocked avatar just
// by opening a profile directly. Starts locked by default (rather than
// briefly showing unlocked while we check) since that's the safer default.
export default function ProfileAvatar({ initial, bgColor, photoUrl, maskedLabel }: {
  initial: string;
  bgColor: string;
  photoUrl?: string;
  maskedLabel: string;
}) {
  const [locked, setLocked] = useState(true);

  useEffect(() => {
    const session = getSession();
    setLocked(!(session && isSubscriptionActive(session)));
  }, []);

  if (photoUrl) {
    if (!locked) return <PhotoLightbox src={photoUrl} name={maskedLabel} />;
    return (
      <div style={{ width: 100, height: 100, borderRadius: 16, overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
        <img src={photoUrl} alt="" width={100} height={100} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(10px)', transform: 'scale(1.15)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,24,48,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      width: 100, height: 100, borderRadius: 16, flexShrink: 0, background: bgColor,
      display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden',
    }}>
      <span style={{ fontSize: 40, color: '#fff', fontWeight: 900 }}>{initial}</span>
      {locked && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,24,48,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
        </div>
      )}
    </div>
  );
}
