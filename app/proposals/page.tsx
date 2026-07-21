import type { Metadata } from 'next';
import { Suspense } from 'react';
import ProposalsClient from './ProposalsClient';
import { getQualifyingCategoryEntries, getQualifyingCountries } from '@/lib/supabase';

export const metadata: Metadata = {
  title: 'Browse Rishta Proposals | Jor',
  description: 'Browse thousands of verified rishta proposals from across Pakistan. Filter by city, caste, sect, profession and more.',
  alternates: { canonical: 'https://joronline.com/proposals' },
};

// Refreshed periodically rather than on every visit — matches the same
// staleness tolerance already used for the category pages themselves. A
// city crossing the "has its own page now" threshold a few minutes late
// just means one extra visit gets filtered in place instead of redirected
// — never broken, just briefly not yet upgraded.
export const revalidate = 0;

export default async function ProposalsPage() {
  const [entries, countries] = await Promise.all([
    getQualifyingCategoryEntries(),
    getQualifyingCountries(),
  ]);

  // One small lookup table per category type — { realValue: urlSlug } —
  // so the client component can answer "does this value have its own
  // page?" without needing its own database access.
  const categorySlugs: Record<string, Record<string, string>> = {
    city: {}, caste: {}, sect: {}, maritalStatus: {}, profession: {},
  };
  for (const e of entries) categorySlugs[e.type][e.value] = e.slug;
  const countrySlugs = Object.fromEntries(countries.map(c => [c.value, c.slug]));

  return (
    <Suspense fallback={null}>
      <ProposalsClient categorySlugs={categorySlugs} countrySlugs={countrySlugs} />
    </Suspense>
  );
}
