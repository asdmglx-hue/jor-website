'use client';
import { Proposal, heightDisplay, isSubscriptionActive } from '@/lib/supabase';
import { getSavedIds, toggleSaved, addNotInterested, getNotInterestedIds, getSession } from '@/lib/auth';
import { buildProposalShareText } from '@/lib/shareText';
import Link from 'next/link';
import { useState, useEffect } from 'react';

function Avatar({ name, photoUrl, size = 56, locked = false }: { name: string; photoUrl?: string; size?: number; locked?: boolean }) {
  const colors = ['#534AB7','#0F6E56','#E8620A','#0369A1','#E11D48'];
  const color = colors[name.charCodeAt(0) % colors.length];

  if (photoUrl) {
    return (
      <div style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', flexShrink: 0, border: '2px solid #E8E6F5', position: 'relative' }}>
        <img src={photoUrl} alt="" width={size} height={size} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: locked ? 'blur(8px)' : 'none', transform: locked ? 'scale(1.1)' : 'none' }} />
        {locked && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,24,48,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ width: size, height: size, borderRadius: size / 2, flexShrink: 0, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      <span style={{ color: '#fff', fontSize: size * 0.38, fontWeight: 800 }}>{name.charAt(0).toUpperCase()}</span>
      {locked && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,24,48,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
        </div>
      )}
    </div>
  );
}

function Chip({ label, color = '#534AB7', bg = '#EEEDFE' }: { label: string; color?: string; bg?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, color, background: bg, border: `1px solid ${color}22`, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

type Props = {
  proposal: Proposal;
  onNotInterested?: (id: string) => void;
};

export default function ProposalCard({ proposal: p, onNotInterested }: Props) {
  const isFeatured = p.subscription_tier === 'featured' || p.is_boosted;
  const isBasic = p.subscription_tier === 'basic';
  const cardBorder = isFeatured ? '#E8620A44' : isBasic ? '#534AB744' : '#E8E6F5';
  const cardBg = isFeatured ? '#FFFBF5' : '#FFFFFF';
  const heightFt = p.height_inches ? heightDisplay(p.height_inches) : null;

  const [saved, setSaved] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [showPhone, setShowPhone] = useState(false);

  useEffect(() => {
    setSaved(getSavedIds().includes(p.id));
    const session = getSession();
    setIsActive(session ? isSubscriptionActive(session) : false);
    if (getNotInterestedIds().includes(p.id)) setDismissed(true);
  }, [p.id]);

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const ids = toggleSaved(p.id);
    setSaved(ids.includes(p.id));
  };

  const handleNotInterested = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    addNotInterested(p.id);
    setDismissed(true);
    onNotInterested?.(p.id);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const session = getSession();
    const showFullPhone = !!session && isSubscriptionActive(session);
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const text = buildProposalShareText(p, !isMobile ? false : true, showFullPhone);
    if (isMobile && navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    }
  };

  if (dismissed) return null;

  return (
    <Link href={`/profile/${p.proposal_number}`} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="card-hover" style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 20, padding: '14px', cursor: 'pointer', position: 'relative', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', flex: 1, height: '100%' }}>
        {isFeatured && (
          <div style={{ position: 'absolute', top: 12, right: 12, background: '#E8620A', color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 5px', borderRadius: 20, letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 2 }}>
            <svg width="8" height="8" viewBox="0 0 24 24" fill="white"><path d="M13 2L4.5 13.5H11L10 22L20 10H13.5L13 2Z"/></svg>
            FEATURED
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
          <Avatar name={p.name} photoUrl={p.profile_photo_url} size={52} locked={!isActive} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#1A1830' }}>
                {p.name}
              </span>
              <span style={{ fontSize: 11, color: '#B0ADCB' }}>
                {new Date(p.posted_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#6B6893', marginTop: 2 }}>{p.age} yrs • {p.country && p.country !== 'Pakistan' ? `${p.country} (from ${p.city})` : `${p.city}, Pakistan`}</div>
            <div style={{ fontSize: 12, color: '#6B6893', marginTop: 1 }}>{p.profession ? p.profession.length > 30 ? p.profession.slice(0, 30) + '…' : p.profession : null}</div>
          </div>
        </div>

        {/* Chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
          {heightFt && <Chip label={heightFt} color="#534AB7" bg="#EEEDFE" />}
          {p.caste && <Chip label={p.caste} color="#0F6E56" bg="#E1F5EE" />}
          {p.sect && <Chip label={p.sect} color="#0369A1" bg="#E0F2FE" />}
          {p.marital_status && <Chip label={p.marital_status} color="#6B6893" bg="#F5F5F5" />}

        </div>

        {/* About */}
        <p className="line-clamp-2" style={{ fontSize: 12.5, color: '#6B6893', margin: '6px 0 8px', lineHeight: 1.5, flex: 1, minHeight: 38 }}>
          {p.about || p.looking_for || ''}
        </p>

        <div style={{ height: 1, background: '#E8E6F5', margin: '8px 0' }} />

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {isActive ? (
            showPhone ? (
              <a
                href={`https://wa.me/92${p.contact_phone.replace(/^0/, '').replace(/\D/g, '')}`}
                target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#EEEDFE', borderRadius: 20, padding: '6px 12px', textDecoration: 'none' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#534AB7"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#534AB7' }}>{p.contact_phone}</span>
              </a>
            ) : (
              <div
                onClick={e => { e.preventDefault(); e.stopPropagation(); setShowPhone(true); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#EEEDFE', borderRadius: 20, padding: '6px 12px', cursor: 'pointer' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="#534AB7"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#534AB7' }}>View Contact</span>
              </div>
            )
          ) : (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#F5F5F8', border: '1px dashed #C4C2D8', borderRadius: 20, padding: '6px 12px' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B0ADCB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#B0ADCB' }}>Contact Locked</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={handleShare} style={{ background: '#F5F5F5', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Share">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6B6893" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'scaleX(-1)' }}>
                <path d="M9 14L4 9l5-5"/>
                <path d="M4 9h10.5a6.5 6.5 0 0 1 0 13H11"/>
              </svg>
            </button>
            <button onClick={handleSave} style={{ background: saved ? '#FEE2E2' : '#F5F5F5', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={saved ? 'Unsave' : 'Save'}>
              {saved ? '❤️' : '🤍'}
            </button>
            <button onClick={handleNotInterested} style={{ background: '#F5F5F5', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Not Interested">
              ✕
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}
