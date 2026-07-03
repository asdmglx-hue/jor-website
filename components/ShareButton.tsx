'use client';
import { Proposal, isSubscriptionActive } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { buildProposalShareText } from '@/lib/shareText';

export default function ShareButton({ p, compact = false }: { p: Proposal; compact?: boolean }) {
  const handleShare = async () => {
    const session = getSession();
    const showFullPhone = !!session && isSubscriptionActive(session);
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile && navigator.share) {
      const text = buildProposalShareText(p, true, showFullPhone);
      try { await navigator.share({ text }); return; } catch { /* cancelled */ }
    }
    const text = buildProposalShareText(p, false, showFullPhone);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  if (compact) {
    return (
      <button onClick={handleShare} title="Share" style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0,
      }}>
        <span style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: '50%', background: '#EEEDFE',
          border: '1.5px solid #534AB722',
        }}>
          <svg width="16" height="14" viewBox="0 0 512 512" fill="#534AB7"><path d="M503.7 226.2l-176 151.1c-15.38 13.3-39.69 2.545-39.69-18.16V272.1C132.9 274.3 66.06 312.8 111.4 457.8c5.031 16-14.09 28.62-27.7 18.9C39.59 445.5 0 383.5 0 322.3c0-152.2 127.4-183.5 288-185.7V52.72c0-20.7 24.3-31.46 39.69-18.16l176 151.1c11.1 9.6 11.1 30.4.01 40.4z"/></svg>
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#534AB7' }}>Share</span>
      </button>
    );
  }

  return (
    <button onClick={handleShare} style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      padding: '10px', borderRadius: 12, background: '#EEEDFE',
      border: '1.5px solid #534AB722', color: '#534AB7',
      fontWeight: 700, fontSize: 12, cursor: 'pointer',
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#534AB7"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      Share
    </button>
  );
}
