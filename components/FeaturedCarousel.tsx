'use client';
import { useState, useEffect, useRef } from 'react';
import { Proposal } from '@/lib/supabase';
import ProposalCard from './ProposalCard';

const VISIBLE = 3;
const SLIDE_INTERVAL_MS = 5000;

export default function FeaturedCarousel({ initial }: { initial: Proposal[] }) {
  const [proposals] = useState<Proposal[]>(initial);
  const [startIndex, setStartIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const needsSliding = proposals.length > VISIBLE;

  useEffect(() => {
    if (!needsSliding) return;
    timerRef.current = setInterval(() => {
      setStartIndex(prev => (prev + 1) % proposals.length);
    }, SLIDE_INTERVAL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [needsSliding, proposals.length]);

  if (proposals.length === 0) return null;

  // Wrap-around window of exactly VISIBLE people starting at startIndex —
  // e.g. with 5 people and startIndex=4, shows [person4, person0, person1].
  // This is what makes the cycle continuous instead of jumping/resetting.
  const visible = Array.from({ length: Math.min(VISIBLE, proposals.length) }, (_, i) =>
    proposals[(startIndex + i) % proposals.length]
  );

  return (
    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 20px 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#E8620A" stroke="#E8620A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1A1830', margin: 0 }}>Featured Profiles</h2>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(VISIBLE, proposals.length)}, 1fr)`,
          gap: 20,
        }}
      >
        {visible.map((p, i) => (
          // Keying by slot position (not proposal id) is deliberate — it's
          // what makes each slot fade/cross-fade into its next occupant in
          // place, rather than the whole row jarringly re-ordering itself
          // every slide.
          <div key={i} style={{ animation: 'jorFeaturedFade 0.5s ease' }}>
            <ProposalCard proposal={p} index={i} />
          </div>
        ))}
      </div>
      {needsSliding && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 16 }}>
          {proposals.map((_, i) => (
            <div
              key={i}
              style={{
                width: 6, height: 6, borderRadius: 3,
                background: i === startIndex ? '#E8620A' : '#E8E6F5',
                transition: 'background 0.3s',
              }}
            />
          ))}
        </div>
      )}
      <style>{`
        @keyframes jorFeaturedFade {
          from { opacity: 0.3; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}
