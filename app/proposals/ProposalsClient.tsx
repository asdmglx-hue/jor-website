'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { fetchProposals, fetchFeaturedForCarousel, FilterState, Proposal, supabase, TIME_CHIPS, chipDateRange } from '@/lib/supabase';
import { getNotInterestedIds, addNotInterested, getLockedGenderFilter } from '@/lib/auth';
import ProposalCard from '@/components/ProposalCard';
import FeaturedCarousel from '@/components/FeaturedCarousel';
import FilterBar from '@/components/FilterBar';

// Matches the same mapping used on the dedicated category pages — 'bride'
// / 'groom' are the real search terms people use, not the underlying DB
// values.
const GENDER_TO_SLUG: Record<string, string> = { Female: 'bride', Male: 'groom' };

function Spinner({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" style={{ display: 'block', margin: '0 auto' }}>
      <circle cx="18" cy="18" r="15" stroke="#E8E6F5" strokeWidth="3"/>
      <path d="M18 3a15 15 0 0 1 15 15" stroke="#534AB7" strokeWidth="3" strokeLinecap="round">
        <animateTransform attributeName="transform" type="rotate" from="0 18 18" to="360 18 18" dur="0.8s" repeatCount="indefinite"/>
      </path>
    </svg>
  );
}

// Time filter dropdown — All / New / 1 Month / 2 Months / 3+ Months, same
// bucket definitions as the mobile app's feed chips (see chipDateRange in
// lib/supabase.ts). A dropdown fits the available header space better than
// mobile's horizontal chip row.
function TimeFilterDropdown({ value, onChange }: { value: number; onChange: (i: number) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 10,
        border: `1.5px solid ${value !== 0 ? '#534AB7' : '#E8E6F5'}`,
        background: value !== 0 ? '#EEEDFE' : '#fff', color: value !== 0 ? '#534AB7' : '#6B6893',
        fontWeight: 700, fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap',
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        {TIME_CHIPS[value]}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: '#fff', border: '1px solid #E8E6F5', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', zIndex: 50, minWidth: 130, overflow: 'hidden' }}>
          {TIME_CHIPS.map((label, i) => (
            <div key={label} onClick={() => { onChange(i); setOpen(false); }}
              style={{ padding: '9px 14px', fontSize: 12.5, cursor: 'pointer',
                color: value === i ? '#534AB7' : '#1A1830', fontWeight: value === i ? 700 : 400,
                background: value === i ? '#EEEDFE' : 'transparent' }}
              onMouseEnter={e => { if (value !== i) (e.currentTarget as HTMLElement).style.background = '#F8F7FF'; }}
              onMouseLeave={e => { if (value !== i) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
              {label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const PAGE_SIZE = 16;

type Props = {
  // { realValue: urlSlug } per category type — e.g. categorySlugs.city['Lahore'] === 'lahore'.
  // Only values with enough real profiles behind them appear here at all
  // (see MIN_CATEGORY_PROFILES) — anything absent just filters in place,
  // exactly as before this feature existed.
  categorySlugs: Record<string, Record<string, string>>;
  countrySlugs: Record<string, string>;
};

export default function ProposalsClient({ categorySlugs, countrySlugs }: Props) {
  const router = useRouter();
  // Navigates without a full page reload (header/footer stay put) while
  // still guaranteeing the destination shows genuinely fresh content —
  // see the identical helper and explanation in CategoryPageClient.tsx.
  const navigateFresh = useCallback((url: string) => {
    router.push(url);
    router.refresh();
  }, [router]);
  // useSearchParams reads the URL directly in the browser — works fine in
  // a static export, unlike the previous server-passed searchParams prop,
  // which required per-request server rendering (not possible/needed here
  // since a static file can't know the query string in advance anyway).
  const urlParams = useSearchParams();
  const searchParams = {
    gender: urlParams.get('gender') ?? undefined,
    city: urlParams.get('city') ?? undefined,
    country: urlParams.get('country') ?? undefined,
  };
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [notInterestedIds, setNotInterestedIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('er_not_interested') || '[]'); } catch { return []; }
  });
  const [newCount, setNewCount] = useState(0); // realtime new proposals banner
  // A logged-in (non-admin) man only browses women's proposals and vice
  // versa — matches the mobile app's identical lockedGender feature. Takes
  // priority over any ?gender= URL param, same as mobile ignoring a
  // mismatched manual filter for a locked user.
  const [lockedGender] = useState<'Male' | 'Female' | null>(() =>
    typeof window === 'undefined' ? null : getLockedGenderFilter()
  );
  const [filters, setFilters] = useState<FilterState>({
    gender: lockedGender || searchParams.gender,
    city: searchParams.city,
    ...(searchParams.country ? { overseas: true, country: searchParams.country } : {}),
  });
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Featured carousel — fetched independently of the main paginated
  // results below, but now re-fetched whenever filters change so it
  // reflects the same caste/sect/age/etc. filters as the rest of the
  // page (city/overseas are deliberately ignored by the fetch itself —
  // see fetchFeaturedForCarousel's own comment for why). Still only
  // shown on the fully unfiltered-by-location view (no city, no
  // overseas) — a location-filtered view has its own dedicated Featured
  // section instead (see components/CategoryPageClient.tsx).
  const [featuredCarousel, setFeaturedCarousel] = useState<Proposal[]>([]);
  useEffect(() => {
    fetchFeaturedForCarousel(filters).then(setFeaturedCarousel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);
  const isGeneralView = !filters.city && !filters.overseas;

  // ── Time filter (All / New / 1 Month / 2 Months / 3+ Months) ─────────────
  const [timeChip, setTimeChip] = useState(0);
  const handleTimeChip = (chip: number) => {
    setTimeChip(chip);
    const range = chipDateRange(chip);
    setFilters(prev => ({ ...prev, postedAfter: range.postedAfter, postedBefore: range.postedBefore }));
  };
  // FilterBar's "Clear filters" resets the whole FilterState object (not
  // just its own fields), which drops postedAfter/postedBefore too — keep
  // this dropdown's highlighted option in sync with that instead of it
  // silently staying on a chip that's no longer actually applied.
  useEffect(() => {
    if (filters.postedAfter === undefined && filters.postedBefore === undefined && timeChip !== 0) {
      setTimeChip(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.postedAfter, filters.postedBefore]);

  const loadingMoreRef = useRef(false);
  const pageRef = useRef(0);
  const totalRef = useRef(0);
  const proposalsLenRef = useRef(0);
  const proposalsRef = useRef<Proposal[]>([]);

  // Fetches `count` replacement proposals to keep the grid full whenever
  // cards get filtered out for being "not interested" — pulls from right
  // after everything already loaded, skipping dupes and dismissed ids.
  const backfill = useCallback(async (count: number) => {
    if (count <= 0) return;
    const dismissed = getNotInterestedIds();
    const existingIds = new Set(proposalsRef.current.map(p => p.id));
    const results: Proposal[] = [];
    let offset = proposalsLenRef.current;
    let guard = 0; // safety cap so a bad state can't loop forever
    while (results.length < count && offset < totalRef.current && guard < count + 20) {
      const { proposals: data } = await fetchProposals(filtersRef.current, offset, 1);
      offset += 1;
      guard += 1;
      const item = data[0];
      if (!item) break;
      if (dismissed.includes(item.id) || existingIds.has(item.id)) continue;
      results.push(item);
      existingIds.add(item.id);
    }
    if (results.length) setProposals(prev => [...prev, ...results]);
  }, []);

  useEffect(() => {
    setNotInterestedIds(getNotInterestedIds());
    const onSynced = () => {
      const freshIds = getNotInterestedIds();
      setNotInterestedIds(prevIds => {
        const newlyHidden = freshIds.filter(id => !prevIds.includes(id) && proposalsRef.current.some(p => p.id === id));
        if (newlyHidden.length) backfill(newlyHidden.length);
        return freshIds;
      });
    };
    window.addEventListener('jor:not-interested-synced', onSynced);
    return () => window.removeEventListener('jor:not-interested-synced', onSynced);
  }, [backfill]);

  const load = useCallback(async (f: FilterState, p: number, append = false) => {
    if (!append) setLoading(true);
    else { setLoadingMore(true); loadingMoreRef.current = true; }
    try {
      const { proposals: data, total: t } = await fetchProposals(f, p, PAGE_SIZE);
      const dismissed = getNotInterestedIds();
      const filtered = data.filter(row => !dismissed.includes(row.id));
      setProposals(prev => append ? [...prev, ...filtered] : filtered);
      setTotal(t);
      setNewCount(0);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }, []);

  useEffect(() => { setPage(0); load(filters, 0); }, [filters, load]);

  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { totalRef.current = total; }, [total]);
  useEffect(() => { proposalsLenRef.current = proposals.length; }, [proposals.length]);
  useEffect(() => { proposalsRef.current = proposals; }, [proposals]);

  const observerRef = useRef<IntersectionObserver | null>(null);

  // Callback ref: fires whenever the sentinel mounts or unmounts
  const sentinelRef = useCallback((el: HTMLDivElement | null) => {
    if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
    if (!el) return;
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loadingMoreRef.current && proposalsLenRef.current < totalRef.current) {
        const next = pageRef.current + 1;
        pageRef.current = next;
        setPage(next);
        load(filtersRef.current, next, true);
      }
    }, { rootMargin: '300px' });
    observerRef.current.observe(el);
  }, [load]);

  // Scroll-to-top button visibility
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Real-time: listen for new/updated proposals ──────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('proposals-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'proposals', filter: 'status=eq.active' },
        (payload) => {
          const newProposal = payload.new as Proposal;
          // If it matches current filters, show banner
          const f = filtersRef.current;
          const matches =
            (!f.gender || newProposal.gender === f.gender) &&
            (!f.city || newProposal.city === f.city);
          if (matches) setNewCount(c => c + 1);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'proposals' },
        (payload) => {
          const updated = payload.new as Proposal;
          const expired = !!(updated.subscription_expiry && new Date(updated.subscription_expiry) <= new Date());
          // If proposal was deactivated OR its subscription just expired
          // (status may still literally say 'active' until the admin app's
          // periodic check catches up and flips it), remove it from view.
          if (updated.status !== 'active' || expired) {
            setProposals(prev => prev.filter(p => p.id !== updated.id));
          } else {
            // Update in place
            setProposals(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const [showSaved, setShowSaved] = useState(false);
  const [savedProposals, setSavedProposals] = useState<Proposal[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  const handleShowSaved = async () => {
    if (showSaved) { setShowSaved(false); return; }
    setShowSaved(true);
    const ids: string[] = (() => { try { return JSON.parse(localStorage.getItem('er_saved') || '[]'); } catch { return []; } })();
    if (ids.length === 0) { setSavedProposals([]); return; }
    setLoadingSaved(true);
    const { fetchProposalById } = await import('@/lib/supabase');
    const results = await Promise.all(ids.map(id => fetchProposalById(id)));
    setSavedProposals(results.filter(Boolean) as Proposal[]);
    setLoadingSaved(false);
  };

  // When a filter change amounts to exactly one simple, well-known
  // category value — nothing else combined in — send the visitor to
  // that value's own dedicated, indexed page instead of just filtering
  // this one in place. Better for SEO (a real page Google already knows
  // about, rather than a query-string variant of this one) and faster
  // (that page is cached; this one always fetches fresh). Any combination
  // of filters, or a value that doesn't have its own page yet, still just
  // filters right here exactly as before — nothing about that changes.
  const handleFilterChange = (next: FilterState) => {
    const identityFields: (keyof FilterState)[] = ['city', 'caste', 'sect', 'maritalStatus', 'profession', 'country'];
    const setIdentityFields = identityFields.filter(f => next[f]);
    const otherFiltersSet = !!(
      next.minAge || next.maxAge || next.education || next.homeType ||
      next.minHeight || next.maxHeight || next.openToPolygamy || next.search ||
      next.postedAfter || next.postedBefore
    );

    if (setIdentityFields.length === 1 && !otherFiltersSet) {
      const field = setIdentityFields[0];
      const value = next[field] as string;

      if (field === 'city') {
        const slug = categorySlugs.city?.[value];
        if (slug) {
          // City is the only category type with a bride/groom sub-page —
          // safe to fold a gender selection into the URL here specifically.
          const genderSlug = next.gender ? GENDER_TO_SLUG[next.gender] : undefined;
          navigateFresh(genderSlug ? `/proposals/${slug}/${genderSlug}` : `/proposals/${slug}`);
          return;
        }
      } else if (!next.gender) {
        // Every other category type has no gender sub-page — only redirect
        // when gender isn't also part of the selection, so a gender
        // filter is never silently lost by redirecting somewhere that
        // can't represent it in the URL.
        if (field === 'country') {
          const slug = countrySlugs[value];
          if (slug) { navigateFresh(`/proposals/overseas/${slug}`); return; }
        } else {
          const slug = categorySlugs[field]?.[value];
          if (slug) { navigateFresh(`/proposals/${slug}`); return; }
        }
      }
    }

    // Combined filters, or a value without a dedicated page yet — same
    // behavior as before this feature existed.
    setFilters(next);
  };

  const handleNotInterested = (id: string) => {
    setNotInterestedIds(addNotInterested(id));
    backfill(1);
  };
  const visible = proposals.filter(p => !notInterestedIds.includes(p.id));

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1A1830' }}>Browse<br className="proposals-br" /> Rishta Proposals</h1>
        <button onClick={handleShowSaved} className="saved-btn saved-btn-header" style={{
          display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
          border: `1.5px solid ${showSaved ? '#E11D48' : '#E8E6F5'}`,
          background: showSaved ? '#FEE2E2' : '#fff',
          color: showSaved ? '#E11D48' : '#6B6893',
          fontWeight: 700, cursor: 'pointer',
        }}>
          {showSaved ? '❤️ Saved' : '🤍 Saved'}
        </button>
      </div>

      <FilterBar filters={filters} onChange={handleFilterChange} total={total} showSaved={showSaved} onSavedToggle={handleShowSaved} lockedGender={lockedGender} />

      {isGeneralView && !showSaved && <FeaturedCarousel initial={featuredCarousel} />}

      {/* Results count + time filter — hidden when saved panel is open */}
      {!loading && !showSaved && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingLeft: 16, paddingRight: 4, gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#534AB7' }}>{total.toLocaleString()} proposals found</div>
          <TimeFilterDropdown value={timeChip} onChange={handleTimeChip} />
        </div>
      )}

      {/* Saved proposals view */}
      {showSaved && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 280px)', marginBottom: 24 }}>
          {loadingSaved ? (
            <div style={{ color: '#68629C', textAlign: 'center' }}>Loading...</div>
          ) : savedProposals.length === 0 ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, lineHeight: 1, marginBottom: 10 }}>❤️</div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1A1830', margin: '0 0 8px' }}>Saved Proposals</h2>
              <div style={{ color: '#68629C', fontSize: 14 }}>No saved proposals yet.</div>
            </div>
          ) : (
            <div style={{ width: '100%' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, alignItems: 'stretch' }}>
                {savedProposals.map((p, i) => <div key={p.id} style={{ display: 'flex', flexDirection: 'column' }}><ProposalCard proposal={p} onNotInterested={handleNotInterested} index={i} /></div>)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Realtime new proposals banner */}
      {newCount > 0 && (
        <button
          onClick={() => { setPage(0); load(filters, 0); }}
          style={{
            width: '100%', padding: '12px', marginBottom: 16, borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg, #534AB7, #3D35A0)', color: '#fff',
            fontWeight: 800, fontSize: 14, cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(83,74,183,0.3)',
          }}
        >
          🔔 {newCount} new proposal{newCount > 1 ? 's' : ''} added — click to refresh
        </button>
      )}

      {!showSaved && (loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#68629C' }}>
          <Spinner />
          <div style={{ marginTop: 12 }}>Loading proposals...</div>
        </div>
      ) : visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#C4C2D8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 12px' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#6B6893', marginBottom: 8 }}>No proposals found</div>
          <div style={{ fontSize: 14, color: '#68629C' }}>Try adjusting your filters</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, alignItems: 'stretch' }}>
            {visible.map((p, i) => <div key={p.id} style={{ display: 'flex', flexDirection: 'column' }}><ProposalCard proposal={p} onNotInterested={handleNotInterested} index={i} /></div>)}
          </div>
          {/* Sentinel for infinite scroll — callback ref attaches observer when this mounts */}
          <div ref={sentinelRef} style={{ height: 1 }} />
          {loadingMore && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <Spinner size={28} />
            </div>
          )}
        </>
      ))}

      {/* Scroll to top button */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{
            position: 'fixed', bottom: 28, right: 24, zIndex: 50,
            width: 44, height: 44, borderRadius: 22,
            background: '#534AB7', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(83,74,183,0.35)',
          }}
          aria-label="Scroll to top"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5"/>
            <polyline points="6 11 12 5 18 11"/>
          </svg>
        </button>
      )}
    </div>
  );
}
