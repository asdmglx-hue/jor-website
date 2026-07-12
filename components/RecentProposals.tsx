'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Proposal, fetchRecentProposalAt } from '@/lib/supabase';
import { getNotInterestedIds, addNotInterested } from '@/lib/auth';
import ProposalCard from './ProposalCard';

export default function RecentProposals({ initial }: { initial: Proposal[] }) {
  const [proposals, setProposals] = useState<Proposal[]>(initial);
  // Starts empty to match what the server rendered (server has no access to
  // localStorage) — the real list is applied in the effect below, right
  // after mount, avoiding a hydration mismatch that was causing the flicker.
  const [notInterestedIds, setNotInterestedIds] = useState<string[]>([]);
  // Stays hidden until we've checked the real dismissed list, so the very
  // first thing the user sees is already correct — never a flash of a
  // profile they'd previously crossed out.
  const [ready, setReady] = useState(false);
  const proposalsRef = useRef<Proposal[]>(initial);
  const offsetRef = useRef(initial.length);

  useEffect(() => { proposalsRef.current = proposals; }, [proposals]);

  // Fetches `count` replacement proposals — pulls from right after
  // everything already shown in this section, in the same "most recently
  // posted" order, skipping dupes and dismissed ids.
  const backfill = useCallback(async (count: number) => {
    if (count <= 0) return;
    const dismissed = getNotInterestedIds();
    const existingIds = new Set(proposalsRef.current.map(p => p.id));
    const results: Proposal[] = [];
    let guard = 0; // safety cap so a bad state can't loop forever
    while (results.length < count && guard < count + 20) {
      const item = await fetchRecentProposalAt(offsetRef.current);
      offsetRef.current += 1;
      guard += 1;
      if (!item) break; // ran out of proposals entirely
      if (dismissed.includes(item.id) || existingIds.has(item.id)) continue;
      results.push(item);
      existingIds.add(item.id);
    }
    if (results.length) setProposals(prev => [...prev, ...results]);
  }, []);

  // Shared by both the very first check (on page load, from local storage)
  // and any later background syncs — whichever newly-dismissed ids are
  // sitting in what's currently on screen get backfilled, every time.
  const applyDismissed = useCallback((freshIds: string[]) => {
    setNotInterestedIds(prevIds => {
      const newlyHidden = freshIds.filter(id => !prevIds.includes(id) && proposalsRef.current.some(p => p.id === id));
      if (newlyHidden.length) backfill(newlyHidden.length);
      return freshIds;
    });
  }, [backfill]);

  useEffect(() => {
    applyDismissed(getNotInterestedIds());
    setReady(true);
  }, [applyDismissed]);

  useEffect(() => {
    const onSynced = () => applyDismissed(getNotInterestedIds());
    window.addEventListener('jor:not-interested-synced', onSynced);
    return () => window.removeEventListener('jor:not-interested-synced', onSynced);
  }, [applyDismissed]);

  const handleNotInterested = (id: string) => {
    setNotInterestedIds(addNotInterested(id));
    backfill(1);
  };

  const visible = proposals.filter(p => !notInterestedIds.includes(p.id));

  if (!ready) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {initial.map(p => (
          <div key={p.id} style={{ height: 220, borderRadius: 16, background: '#F5F4FB', animation: 'jor-pulse 1.4s ease-in-out infinite' }} />
        ))}
        <style>{`@keyframes jor-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
      {visible.map((p, i) => <ProposalCard key={p.id} proposal={p} onNotInterested={handleNotInterested} index={i} />)}
    </div>
  );
}
