'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { isSubscriptionActive, supabase, Proposal, phoneDisplay } from '@/lib/supabase';
import { getSession, saveSession } from '@/lib/auth';

export default function ContactButtons({ phone: rawPhone, phone2: rawPhone2 }: { phone: string; phone2?: string }) {
  const phone = phoneDisplay(rawPhone);
  const phone2 = rawPhone2 ? phoneDisplay(rawPhone2) : rawPhone2;
  const [revealed, setRevealed] = useState(false);
  const [isActive, setIsActive] = useState(() => {
    const session = getSession();
    return session ? isSubscriptionActive(session) : false;
  });
  const waNumber = phone.replace(/\D/g, '');

  useEffect(() => {
    const session = getSession();
    if (!session) { setIsActive(false); return; }
    // Always fetch fresh subscription status from DB
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

  // Locked state — not subscribed
  if (!isActive) {
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          width: '100%', padding: '13px', borderRadius: 12,
          background: '#F5F5F8', border: '1.5px dashed #C4C2D8',
          color: '#68629C', fontWeight: 700, fontSize: 15, marginBottom: 10,
          userSelect: 'none',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#68629C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6.6 10.8a15.4 15.4 0 006.6 6.6l2.2-2.2a1 1 0 011-.24 11.4 11.4 0 003.58.57 1 1 0 011 1V21a1 1 0 01-1 1A17 17 0 013 5a1 1 0 011-1h3.5a1 1 0 011 1 11.4 11.4 0 00.57 3.57 1 1 0 01-.25 1.02z"/>
          </svg>
          {phone.slice(0, 4)} •••• {phone.slice(-3)}
        </div>
        {phone2 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            width: '100%', padding: '13px', borderRadius: 12,
            background: '#F5F5F8', border: '1.5px dashed #C4C2D8',
            color: '#68629C', fontWeight: 700, fontSize: 15, marginBottom: 10,
            userSelect: 'none',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#68629C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6.6 10.8a15.4 15.4 0 006.6 6.6l2.2-2.2a1 1 0 011-.24 11.4 11.4 0 003.58.57 1 1 0 011 1V21a1 1 0 01-1 1A17 17 0 013 5a1 1 0 011-1h3.5a1 1 0 011 1 11.4 11.4 0 00.57 3.57 1 1 0 01-.25 1.02z"/>
            </svg>
            {phone2.slice(0, 4)} •••• {phone2.slice(-3)}
          </div>
        )}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          width: '100%', padding: '13px', borderRadius: 12,
          background: '#F5F5F8', border: '1.5px dashed #C4C2D8',
          color: '#68629C', fontWeight: 700, fontSize: 15, marginBottom: 10,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#68629C" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          WhatsApp
        </div>
        <Link href="/plans?plan=rishta-profile" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          width: '100%', padding: '11px', borderRadius: 12, boxSizing: 'border-box',
          background: '#534AB7', color: '#fff', fontWeight: 700, fontSize: 13,
          textDecoration: 'none', marginBottom: 8,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
          Subscribe to View Contact
        </Link>
      </div>
    );
  }

  // Unlocked state
  return (
    <>
      {!revealed ? (
        <button
          onClick={() => setRevealed(true)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '13px', borderRadius: 12,
            background: '#534AB7', color: '#fff', fontWeight: 800, fontSize: 15,
            textAlign: 'center', border: 'none', cursor: 'pointer', marginBottom: 10,
            boxShadow: '0 4px 14px rgba(83,74,183,0.3)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.64A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z" />
          </svg>
          View Contact
        </button>
      ) : (
        <>
          <a href={`tel:${phone}`} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            width: '100%', padding: '13px', borderRadius: 12,
            background: '#534AB7', color: '#fff', fontWeight: 800, fontSize: 17,
            textDecoration: 'none', marginBottom: 10,
            boxShadow: '0 4px 14px rgba(83,74,183,0.3)', letterSpacing: 1,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6.6 10.8a15.4 15.4 0 006.6 6.6l2.2-2.2a1 1 0 011-.24 11.4 11.4 0 003.58.57 1 1 0 011 1V21a1 1 0 01-1 1A17 17 0 013 5a1 1 0 011-1h3.5a1 1 0 011 1 11.4 11.4 0 00.57 3.57 1 1 0 01-.25 1.02z"/>
            </svg>
            {phone}
          </a>
          {phone2 && (
            <a href={`tel:${phone2}`} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              width: '100%', padding: '13px', borderRadius: 12,
              background: '#534AB7', color: '#fff', fontWeight: 800, fontSize: 17,
              textDecoration: 'none', marginBottom: 10,
              boxShadow: '0 4px 14px rgba(83,74,183,0.3)', letterSpacing: 1,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6.6 10.8a15.4 15.4 0 006.6 6.6l2.2-2.2a1 1 0 011-.24 11.4 11.4 0 003.58.57 1 1 0 011 1V21a1 1 0 01-1 1A17 17 0 013 5a1 1 0 011-1h3.5a1 1 0 011 1 11.4 11.4 0 00.57 3.57 1 1 0 01-.25 1.02z"/>
              </svg>
              {phone2}
            </a>
          )}
        </>
      )}

      <a
        href={`https://wa.me/${waNumber}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          width: '100%', padding: '13px', borderRadius: 12,
          background: '#16A34A', color: '#fff', fontWeight: 800, fontSize: 15,
          textDecoration: 'none', marginBottom: 16, boxSizing: 'border-box',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
        WhatsApp
      </a>
    </>
  );
}
