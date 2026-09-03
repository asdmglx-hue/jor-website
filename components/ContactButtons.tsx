'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { isSubscriptionActive, supabase, Proposal, phoneDisplay } from '@/lib/supabase';
import { getSession, saveSession } from '@/lib/auth';
import { trackEvent } from '@/lib/analytics';

const WA_SVG = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const PHONE_SVG = (color = 'white') => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6.6 10.8a15.4 15.4 0 006.6 6.6l2.2-2.2a1 1 0 011-.24 11.4 11.4 0 003.58.57 1 1 0 011 1V21a1 1 0 01-1 1A17 17 0 013 5a1 1 0 011-1h3.5a1 1 0 011 1 11.4 11.4 0 00.57 3.57 1 1 0 01-.25 1.02z"/>
  </svg>
);

const LOCK_SVG = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#68629C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6.6 10.8a15.4 15.4 0 006.6 6.6l2.2-2.2a1 1 0 011-.24 11.4 11.4 0 003.58.57 1 1 0 011 1V21a1 1 0 01-1 1A17 17 0 013 5a1 1 0 011-1h3.5a1 1 0 011 1 11.4 11.4 0 00.57 3.57 1 1 0 01-.25 1.02z"/>
  </svg>
);

function rawDigits(phone: string) {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+92')) return '92' + cleaned.slice(3);
  if (cleaned.startsWith('92')) return cleaned;
  if (cleaned.startsWith('0')) return '92' + cleaned.slice(1);
  return '92' + cleaned;
}

export default function ContactButtons({
  phone: rawPhone, phone2: rawPhone2,
  contactPerson, contactPerson2,
  proposalNumber,
}: {
  phone: string; phone2?: string;
  contactPerson?: string; contactPerson2?: string;
  proposalNumber?: number;
}) {
  const phone  = phoneDisplay(rawPhone);
  const phone2 = rawPhone2 ? phoneDisplay(rawPhone2) : undefined;
  const hasTwo = !!phone2;

  const [activeIdx, setActiveIdx]   = useState(0);
  const [revealed, setRevealed]     = useState(false);
  const [isActive, setIsActive]     = useState(() => { const s = getSession(); return s ? isSubscriptionActive(s) : false; });
  const [isPaused, setIsPaused]     = useState(() => getSession()?.status === 'paused');
  const [pausedToast, setPausedToast] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (!session) { setIsActive(false); return; }
    supabase.from('proposals').select('subscription_tier, subscription_expiry, is_boosted').eq('id', session.id).maybeSingle().then(({ data }) => {
      if (data) {
        const fresh = { ...session, ...data } as Proposal;
        saveSession(fresh);
        setIsActive(isSubscriptionActive(fresh));
        setIsPaused(fresh.status === 'paused');
      } else {
        setIsActive(isSubscriptionActive(session));
      }
    });
  }, []);

  const contacts = [
    { phone, display: phone, wa: rawDigits(rawPhone), person: contactPerson },
    ...(hasTwo ? [{ phone: phone2!, display: phone2!, wa: rawDigits(rawPhone2!), person: contactPerson2 }] : []),
  ];

  const active = contacts[activeIdx];
  const headingLabel = 'Contact Family';

  function showPausedToast() {
    setPausedToast(true);
    setTimeout(() => setPausedToast(false), 4000);
  }

  // ── Locked ──
  if (!isActive) {
    return (
      <div style={{ marginBottom: 16 }}>
        {/* Masked numbers */}
        {contacts.map((c, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            width: '100%', padding: '13px', borderRadius: 12,
            background: '#F5F5F8', border: '1.5px dashed #C4C2D8',
            color: '#68629C', fontWeight: 700, fontSize: 15, marginBottom: 10, userSelect: 'none',
          }}>
            {LOCK_SVG}
            {c.display.slice(0, 4)} •••• {c.display.slice(-3)}
          </div>
        ))}
        {/* Locked WhatsApp */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          width: '100%', padding: '13px', borderRadius: 12,
          background: '#F5F5F8', border: '1.5px dashed #C4C2D8',
          color: '#68629C', fontWeight: 700, fontSize: 15, marginBottom: 10,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#68629C"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          WhatsApp
        </div>
        <Link href="/plans?plan=rishta-profile" onClick={() => trackEvent('subscribe_prompt_click', { proposal_number: proposalNumber ?? 0 })} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          width: '100%', padding: '11px', borderRadius: 12, boxSizing: 'border-box',
          background: '#534AB7', color: '#fff', fontWeight: 700, fontSize: 13,
          textDecoration: 'none', marginBottom: 8,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          Subscribe to View Contact
        </Link>
      </div>
    );
  }

  // ── Unlocked ──
  return (
    <>
      {/* Paused toast */}
      {pausedToast && (
        <div style={{ background: '#FFF3CD', border: '1px solid #FFC107', borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontSize: 13, fontWeight: 600, color: '#856404', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#856404" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Please resume your profile to view contacts.
        </div>
      )}

      {/* Contact person pill(s) inline — single pill or 2-pill toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        {hasTwo ? (
          <div style={{ display: 'flex', background: '#EEEDFE', border: '1px solid #C4C2D8', borderRadius: 20, padding: 2, gap: 2 }}>
            {contacts.map((c, i) => (
              <button key={i} onClick={() => { setActiveIdx(i); if (isPaused) { showPausedToast(); } else { setRevealed(true); trackEvent('contact_reveal', { proposal_number: proposalNumber ?? 0 }); } }} style={{
                padding: '3px 10px', borderRadius: 20, border: 'none', cursor: 'pointer',
                background: activeIdx === i ? '#534AB7' : 'transparent',
                color: activeIdx === i ? '#fff' : '#534AB7',
                fontWeight: 600, fontSize: 11, transition: 'all .18s', whiteSpace: 'nowrap',
              }}>
                {c.person || `#${i + 1}`}
              </button>
            ))}
          </div>
        ) : contacts[0].person ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: '#EEEDFE', color: '#534AB7', border: '1px solid #C4C2D8',
            fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            {contacts[0].person}
          </span>
        ) : null}
      </div>

      {/* Reveal / Call button */}
      {!revealed ? (
        <button onClick={() => {
          if (isPaused) { showPausedToast(); return; }
          setRevealed(true);
          trackEvent('contact_reveal', { proposal_number: proposalNumber ?? 0 });
        }} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          width: '100%', padding: '13px', borderRadius: 12,
          background: '#534AB7', color: '#fff', fontWeight: 800, fontSize: 15,
          border: 'none', cursor: 'pointer', marginBottom: 10,
          boxShadow: '0 4px 14px rgba(83,74,183,0.3)',
        }}>
          {PHONE_SVG()}
          View Contact
        </button>
      ) : (
        <a href={isPaused ? '#' : `tel:${active.phone}`}
          onClick={isPaused ? (e) => { e.preventDefault(); showPausedToast(); } : () => trackEvent('phone_call', { proposal_number: proposalNumber ?? 0, phone_index: activeIdx + 1 })}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            width: '100%', padding: '13px', borderRadius: 12,
            background: '#534AB7', color: '#fff', fontWeight: 800, fontSize: 17,
            textDecoration: 'none', marginBottom: 10,
            boxShadow: '0 4px 14px rgba(83,74,183,0.3)', letterSpacing: 1,
          }}
        >
          {PHONE_SVG()}
          {active.display}
        </a>
      )}

      {/* WhatsApp */}
      <a
        href={isPaused ? '#' : `https://wa.me/${active.wa}`}
        onClick={isPaused
          ? (e) => { e.preventDefault(); showPausedToast(); }
          : () => trackEvent('whatsapp_click', { proposal_number: proposalNumber ?? 0, phone_index: activeIdx + 1 })}
        target="_blank" rel="noopener noreferrer"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          width: '100%', padding: '13px', borderRadius: 12,
          background: '#16A34A', color: '#fff', fontWeight: 800, fontSize: 15,
          textDecoration: 'none', marginBottom: 16, boxSizing: 'border-box',
        }}
      >
        {WA_SVG}
        WhatsApp
      </a>
    </>
  );
}
