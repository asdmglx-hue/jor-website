'use client';
import { useState, useEffect } from 'react';
import { isSubscriptionActive, supabase, Proposal } from '@/lib/supabase';
import { getSession, saveSession } from '@/lib/auth';

// Same pattern as ContactButtons: check the *viewer's own* session and
// subscription status, not the profile being viewed. Non-subscribers
// still see the "View" link (so they know a certificate exists) but it's
// muted and does nothing — same idea as the locked contact buttons above
// it, just without a fresh redirect-to-subscribe on every use.
export default function CertificateViewLink({ url }: { url: string }) {
  const [isActive, setIsActive] = useState(() => {
    const session = getSession();
    return session ? isSubscriptionActive(session) : false;
  });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (!session) { setIsActive(false); return; }
    supabase.from('proposals').select('subscription_tier, subscription_expiry, is_boosted').eq('id', session.id).maybeSingle().then(({ data }) => {
      if (data) {
        const fresh = { ...session, ...data } as Proposal;
        saveSession(fresh);
        setIsActive(isSubscriptionActive(fresh));
      } else {
        setIsActive(isSubscriptionActive(session));
      }
    });
  }, []);

  return (
    <>
      <a
        onClick={(e) => { e.preventDefault(); if (isActive) setOpen(true); }}
        href={isActive ? url : undefined}
        style={{
          fontSize: 13, fontWeight: 600, textDecoration: 'underline', marginLeft: 'auto',
          color: isActive ? '#534AB7' : '#B7B4CC',
          cursor: isActive ? 'pointer' : 'default',
        }}
      >
        View
      </a>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'zoom-out' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setOpen(false)} style={{ position: 'fixed', top: 20, right: 20, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 20, padding: '6px 14px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>✕ Close</button>
        </div>
      )}
    </>
  );
}
