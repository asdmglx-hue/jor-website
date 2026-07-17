'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

type Ad = {
  id: string;
  media_type: 'image' | 'video';
  media_url: string;
  cta_text: string;
  cta_url: string;
};

// Fetches independently, client-side, rather than as part of the profile
// page's own server-rendered data — the profile page itself is cached for
// 10 minutes at a time (see revalidate in page.tsx), but an ad slot should
// be free to rotate between advertisers on every single visit, not be
// locked to that same cache window.
export default function AdWidget({ placement = 'profile_sidebar' }: { placement?: string }) {
  // undefined = still loading (show a placeholder, avoids layout shift);
  // null = confirmed no active ad right now (render nothing at all, not
  // an empty box — a blank "ad" slot looks broken, not just unused).
  const [ad, setAd] = useState<Ad | null | undefined>(undefined);
  const trackedImpression = useRef(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('ads')
      .select('id, media_type, media_url, cta_text, cta_url, sort_order')
      .eq('placement', placement)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        if (!data || data.length === 0) { setAd(null); return; }
        // If several ads share the lowest (highest-priority) sort_order,
        // rotate randomly among just that group — gives every advertiser
        // at the same priority level a fair, even share of views instead
        // of always showing whichever happens to sort first.
        const minSort = Math.min(...data.map(a => a.sort_order));
        const topTier = data.filter(a => a.sort_order === minSort);
        setAd(topTier[Math.floor(Math.random() * topTier.length)]);
      }, () => { if (!cancelled) setAd(null); });
    return () => { cancelled = true; };
  }, [placement]);

  useEffect(() => {
    if (ad && !trackedImpression.current) {
      trackedImpression.current = true;
      supabase.rpc('increment_ad_stat', { p_ad_id: ad.id, p_stat: 'impression' }).then(() => {}, () => {});
    }
  }, [ad]);

  const handleClick = () => {
    if (!ad) return;
    supabase.rpc('increment_ad_stat', { p_ad_id: ad.id, p_stat: 'click' }).then(() => {}, () => {});
  };

  if (ad === undefined) {
    return <div style={{ marginTop: 16, borderRadius: 20, background: '#F5F4FA', aspectRatio: '1 / 1.15', width: '100%' }} />;
  }
  if (!ad) return null;

  return (
    <div style={{ marginTop: 16, background: '#fff', border: '1px solid #E8E6F5', borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 20px rgba(83,74,183,0.08)' }}>
      {/* Small, honest "Advertisement" label — standard practice on every
          major site, so a visitor never mistakes paid content for an
          organic part of the page. */}
      <div style={{ padding: '10px 16px 0', fontSize: 10, fontWeight: 700, color: '#B0ADCB', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Advertisement
      </div>
      {/* rel="sponsored" — the correct, standard signal to search engines
          that this is a paid link, not an editorial endorsement. */}
      <a href={ad.cta_url} target="_blank" rel="noopener noreferrer sponsored" onClick={handleClick} style={{ display: 'block', textDecoration: 'none' }}>
        <div style={{ width: '100%', aspectRatio: '1 / 1', background: '#F5F4FA', marginTop: 8 }}>
          {ad.media_type === 'video' ? (
            <video src={ad.media_url} autoPlay muted loop playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ad.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          )}
        </div>
        <div style={{ padding: 14 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '10px', borderRadius: 12, background: '#534AB7', color: '#fff',
            fontWeight: 700, fontSize: 13.5,
          }}>
            {ad.cta_text}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </div>
        </div>
      </a>
    </div>
  );
}
