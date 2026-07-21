'use client';
import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import FilterBar from './FilterBar';
import ProposalCard from './ProposalCard';
import { fetchProposals, FilterState, Proposal } from '@/lib/supabase';
import { getLockedGenderFilter } from '@/lib/auth';

const GENDER_TO_SLUG: Record<string, string> = { Female: 'bride', Male: 'groom' };

// Every field that can be "this page's own identity" — not just city.
// Previously only city/country were recognized here, which meant
// changing the caste/sect/profession/marital-status filter on a page
// built around one of those never actually navigated anywhere — it just
// silently filtered in place while the heading (rendered by the parent
// server page, from the URL) stayed on the old value.
type IdentityField = 'city' | 'caste' | 'sect' | 'maritalStatus' | 'profession' | 'country';

type Props = {
  initialProposals: Proposal[];
  initialFilters: FilterState;
  // Which field is this page's own identity — changing it means
  // navigating to a different page entirely, not just re-filtering this
  // one, so the heading and URL can never disagree with what's shown.
  locationField: IdentityField;
  // Every value in that field that actually has its own dedicated page —
  // anything not in this map falls back to the filtered browse view.
  qualifyingSlugs: Record<string, string>;
  // If this page also has a gender segment in its URL (the city
  // /bride //groom pages), changing gender navigates too.
  hasGenderSegment?: boolean;
};

export default function CategoryPageClient({ initialProposals, initialFilters, locationField, qualifyingSlugs, hasGenderSegment }: Props) {
  const router = useRouter();
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [proposals, setProposals] = useState<Proposal[]>(initialProposals);
  const [total, setTotal] = useState(initialProposals.length);
  const [loading, setLoading] = useState(false);
  const basePath = locationField === 'country' ? '/proposals/overseas' : '/proposals';
  const currentValue = initialFilters[locationField];

  // Navigates without reloading the whole page (header/footer stay put,
  // no visible flash) while still guaranteeing the destination's content
  // is genuinely fresh rather than a cached leftover from a previous
  // visit to a similar page — router.push() alone occasionally served a
  // stale version when moving between two structurally-similar pages
  // (e.g. one city page to another); the explicit refresh() right after
  // closes that gap without giving up the smooth, app-like navigation.
  const navigateFresh = useCallback((url: string) => {
    router.push(url);
    router.refresh();
  }, [router]);

  // A logged-in (non-admin) man only browses women's proposals and vice
  // versa — matches the mobile app's identical lockedGender feature.
  // initialFilters/initialProposals come from a server component (city/
  // caste pages, etc.), which can't know the visitor's session, so this
  // corrects it client-side right after mount. On a gender-segmented page
  // (e.g. /lahore/groom) a mismatch redirects to the correct sibling page
  // (/lahore/bride) the same way a manual change would — otherwise the
  // heading/URL would say "Groom" while quietly showing women's proposals.
  // Everywhere else it's just a plain re-filter of what's already shown.
  const [lockedGender] = useState<'Male' | 'Female' | null>(() =>
    typeof window === 'undefined' ? null : getLockedGenderFilter()
  );
  useEffect(() => {
    if (!lockedGender || initialFilters.gender === lockedGender) return;
    if (hasGenderSegment) {
      const slug = qualifyingSlugs[currentValue || ''];
      const genderSlug = GENDER_TO_SLUG[lockedGender];
      if (slug) { navigateFresh(`${basePath}/${slug}/${genderSlug}`); return; }
    }
    const next = { ...initialFilters, gender: lockedGender };
    setFilters(next);
    setLoading(true);
    fetchProposals(next, 0, 24).then(({ proposals: data, total: t }) => {
      setProposals(data);
      setTotal(t);
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedGender]);

  const handleChange = useCallback((next: FilterState) => {
    const nextValue = next[locationField];

    // The page's own identity value changed to something else — navigate
    // to the right dedicated page instead of quietly filtering in place.
    if (nextValue && nextValue !== currentValue) {
      const slug = qualifyingSlugs[nextValue];
      const genderSlug = locationField === 'city' && hasGenderSegment && next.gender ? GENDER_TO_SLUG[next.gender] : undefined;
      if (slug) {
        navigateFresh(genderSlug ? `${basePath}/${slug}/${genderSlug}` : `${basePath}/${slug}`);
      } else {
        // No dedicated page for this value yet — fall back to the
        // filterable browse view rather than a broken link.
        const params = new URLSearchParams();
        if (locationField === 'country') { params.set('country', nextValue); params.set('overseas', 'true'); }
        else params.set(locationField, nextValue);
        if (next.gender) params.set('gender', next.gender);
        navigateFresh(`/proposals?${params.toString()}`);
      }
      return;
    }

    // The page's own identity value was cleared entirely (not changed to
    // another value, just removed) — this page's URL and heading only
    // ever mean one specific value, so there's no "identity-less" version
    // of it to filter in place to. Go back to the general browse page,
    // carrying over anything else that was still set.
    if (!nextValue && currentValue) {
      const params = new URLSearchParams();
      Object.entries(next).forEach(([k, v]) => {
        if (v !== undefined && v !== '' && k !== locationField) params.set(k, String(v));
      });
      navigateFresh(params.toString() ? `/proposals?${params.toString()}` : '/proposals');
      return;
    }

    // Gender changed on a city+gender page — navigate to the sibling
    // gender page (or back to the plain city page if cleared).
    if (hasGenderSegment && next.gender !== initialFilters.gender) {
      const slug = qualifyingSlugs[currentValue || ''];
      const genderSlug = next.gender ? GENDER_TO_SLUG[next.gender] : undefined;
      if (slug) {
        navigateFresh(genderSlug ? `${basePath}/${slug}/${genderSlug}` : `${basePath}/${slug}`);
        return;
      }
    }

    // Everything else — just refine the results shown on this same page,
    // heading and URL untouched.
    setFilters(next);
    setLoading(true);
    fetchProposals(next, 0, 24).then(({ proposals: data, total: t }) => {
      setProposals(data);
      setTotal(t);
      setLoading(false);
    });
  }, [locationField, hasGenderSegment, initialFilters, currentValue, qualifyingSlugs, basePath, navigateFresh]);

  return (
    <>
      <FilterBar filters={filters} onChange={handleChange} total={total} lockedGender={lockedGender} />
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#68629C' }}>Loading…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginTop: 20, marginBottom: 24 }}>
          {proposals.map((p, i) => <ProposalCard key={p.id} proposal={p} index={i} />)}
        </div>
      )}
    </>
  );
}
