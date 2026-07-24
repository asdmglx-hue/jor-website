'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Proposal } from '@/lib/supabase';
import ProposalCard from './ProposalCard';

const NATURAL_WIDTH = 360; // ProposalCard's normal, unscaled width
const CARD_WIDTH = 315; // actual on-screen width in this carousel — 0.5/4 (87.5%) of natural size
const SCALE = CARD_WIDTH / NATURAL_WIDTH;
const GAP = 20;

export default function FeaturedCarousel({ initial }: { initial: Proposal[] }) {
  const [proposals, setProposals] = useState<Proposal[]>(initial);
  // Syncs whenever the parent's data changes — not just on first mount.
  // Needed because this prop arrives two different ways depending on the
  // page: the homepage fetches it server-side, so `initial` is already
  // correct the very first time this component renders. The Proposals
  // page fetches it client-side in a useEffect, so it starts as an empty
  // array and only becomes real data a moment after mount — without this
  // sync, useState(initial) would have locked in that empty array forever
  // and the carousel would silently never appear there.
  useEffect(() => { setProposals(initial); }, [initial]);

  const trackRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(0);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartPosRef = useRef(0);
  const hasDraggedRef = useRef(false);

  // Only scroll continuously when there's enough to actually loop — with
  // 3 or fewer, it just sits still as a plain static row (matches the
  // count that would make City/Country sliders pointless to auto-scroll
  // too). More than 3 (i.e. 4+) is what triggers the carousel.
  const needsScrolling = proposals.length > 3;

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    if (!needsScrolling) {
      // Explicitly clear any leftover shift from a previous scrolling
      // session (e.g. the unfiltered page had 4+ people and was actively
      // auto-scrolling, then a filter dropped the count to 3 or fewer) —
      // without this, the single static card renders visually shifted
      // left by the stale transform and gets clipped by this
      // container's overflow: hidden.
      if (trackRef.current) trackRef.current.style.transform = '';
      posRef.current = 0;
      return;
    }
    const track = trackRef.current;
    if (!track) return;
    let raf: number;
    const speed = 0.6;

    const animate = () => {
      if (!pausedRef.current) {
        posRef.current += speed;
        const half = track.scrollWidth / 2;
        if (posRef.current >= half) posRef.current = 0;
        track.style.transform = `translateX(-${posRef.current}px)`;
      }
      raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [needsScrolling, proposals.length]);

  const handleWindowPointerMove = (e: PointerEvent) => {
    if (!trackRef.current) return;
    const deltaX = dragStartXRef.current - e.clientX;
    const half = trackRef.current.scrollWidth / 2;
    let next = (dragStartPosRef.current + deltaX) % half;
    if (next < 0) next += half;
    posRef.current = next;
    trackRef.current.style.transform = `translateX(-${next}px)`;
  };

  const stopDragging = () => {
    window.removeEventListener('pointermove', handleWindowPointerMove);
    window.removeEventListener('pointerup', stopDragging);
    isDraggingRef.current = false;
    setIsDragging(false);
    setPaused(false); // resume auto-scroll from the current position
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!needsScrolling) return;
    hasDraggedRef.current = false;
    dragStartXRef.current = e.clientX;
    dragStartPosRef.current = posRef.current;
    const startX = e.clientX;

    // Waits for real movement before committing to a drag — a plain
    // click never exceeds this, so it's left completely alone and
    // reaches the Link normally.
    const checkForDragStart = (moveEvent: PointerEvent) => {
      if (Math.abs(moveEvent.clientX - startX) < 8) return;
      window.removeEventListener('pointermove', checkForDragStart);
      isDraggingRef.current = true;
      hasDraggedRef.current = true;
      setIsDragging(true);
      setPaused(true);
      window.addEventListener('pointermove', handleWindowPointerMove);
      window.addEventListener('pointerup', stopDragging);
    };
    const cancelIfReleasedEarly = () => {
      window.removeEventListener('pointermove', checkForDragStart);
      window.removeEventListener('pointerup', cancelIfReleasedEarly);
    };
    window.addEventListener('pointermove', checkForDragStart);
    window.addEventListener('pointerup', cancelIfReleasedEarly);
  };

  // Prevents an accidental navigation on the Link the pointer happens to
  // release over, but only for a genuine drag — an ordinary click always
  // passes through untouched.
  const handleClickCapture = (e: React.MouseEvent) => {
    if (hasDraggedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      hasDraggedRef.current = false;
    }
  };

  if (proposals.length === 0) return null;

  // Doubled for a seamless loop — identical technique to City/Country
  // sliders. Not doubled when there's nothing to scroll (3 or fewer),
  // since duplicating them would just show the same people twice for no
  // reason.
  const track = needsScrolling ? [...proposals, ...proposals] : proposals;

  return (
    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 20px 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#E8620A" stroke="#E8620A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1A1830', margin: 0 }}>Featured Profiles</h2>
      </div>
      <div
        style={{
          overflow: 'hidden', position: 'relative', paddingTop: 4,
          cursor: needsScrolling ? (isDragging ? 'grabbing' : 'grab') : 'default',
          touchAction: 'pan-y',
        }}
        onMouseEnter={() => needsScrolling && setPaused(true)}
        onMouseLeave={() => { if (!isDraggingRef.current) setPaused(false); }}
        onPointerDown={handlePointerDown}
        onClickCapture={handleClickCapture}
      >
        <div
          ref={trackRef}
          style={needsScrolling ? {
            display: 'flex', gap: GAP, width: 'max-content',
            willChange: 'transform',
          } : {
            // Static (3-or-fewer) mode: same grid parameters as the
            // regular proposal grid (components/CategoryPageClient.tsx,
            // app/proposals/ProposalsClient.tsx) — a flex row with
            // flex:1 here previously stretched a lone card to fill the
            // entire section width instead of a normal card size.
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16,
          }}
        >
          {track.map((p, i) => (
            needsScrolling ? (
              <div key={i} style={{ width: CARD_WIDTH, userSelect: 'none', transform: 'translateZ(0)' }}>
                <div style={{ width: NATURAL_WIDTH, zoom: SCALE } as CSSProperties}>
                  <ProposalCard proposal={p} index={i % proposals.length} />
                </div>
              </div>
            ) : (
              <ProposalCard key={i} proposal={p} index={i} />
            )
          ))}
        </div>
      </div>
    </section>
  );
}
