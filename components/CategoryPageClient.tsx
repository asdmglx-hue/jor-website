'use client';
import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import FilterBar from './FilterBar';
import ProposalCard from './ProposalCard';
import { fetchProposals, FilterState, Proposal } from '@/lib/supabase';
import { getLockedGenderFilter } from '@/lib/auth';

const GENDER_TO_SLUG: Record<string, string> = { Female: 'bride', Male: 'groom' };

type Props = {
  initialProposals: Proposal[];
  initialFilters: FilterState;
  // Which field is this page's own identity — changing it means
  // navigating to a different page entirely, not just re-filtering this
  // one, so the heading and URL can never disagree with what's shown.
  locationField: 'city' | 'country';
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
  const currentValue = locationField === 'country' ? initialFilters.country : initialFilters.city;

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
      if (slug) { router.replace(`${basePath}/${slug}/${genderSlug}`); return; }
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
    const nextValue = locationField === 'country' ? next.country : next.city;

    // The page's own location field changed — navigate to the right
    // dedicated page instead of quietly filtering in place.
    if (nextValue && nextValue !== currentValue) {
      const slug = qualifyingSlugs[nextValue];
      const genderSlug = hasGenderSegment && next.gender ? GENDER_TO_SLUG[next.gender] : undefined;
      if (slug) {
        router.push(genderSlug ? `${basePath}/${slug}/${genderSlug}` : `${basePath}/${slug}`);
      } else {
        // No dedicated page for this value yet — fall back to the
        // filterable browse view rather than a broken link.
        const params = new URLSearchParams();
        if (locationField === 'country') { params.set('country', nextValue); params.set('overseas', 'true'); }
        else params.set('city', nextValue);
        if (next.gender) params.set('gender', next.gender);
        router.push(`/proposals?${params.toString()}`);
      }
      return;
    }

    // Gender changed on a city+gender page — navigate to the sibling
    // gender page (or back to the plain city page if cleared).
    if (hasGenderSegment && next.gender !== initialFilters.gender) {
      const slug = qualifyingSlugs[currentValue || ''];
      const genderSlug = next.gender ? GENDER_TO_SLUG[next.gender] : undefined;
      if (slug) {
        router.push(genderSlug ? `${basePath}/${slug}/${genderSlug}` : `${basePath}/${slug}`);
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
  }, [locationField, hasGenderSegment, initialFilters, currentValue, qualifyingSlugs, basePath, router]);

  return (
    <>
      <FilterBar filters={filters} onChange={handleChange} total={total} lockedGender={lockedGender} />
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#B0ADCB' }}>Loading…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginTop: 20, marginBottom: 24 }}>
          {proposals.map((p, i) => <ProposalCard key={p.id} proposal={p} index={i} />)}
        </div>
      )}
    </>
  );
}
