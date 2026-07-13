import type { Metadata } from 'next';
import { Suspense } from 'react';
import ProposalsClient from './ProposalsClient';
import { getDefaultProposalsFeed } from '@/lib/supabase';

export const metadata: Metadata = {
  title: 'Browse Rishta Proposals | Jor',
  description: 'Browse thousands of verified rishta proposals from across Pakistan. Filter by city, caste, sect, profession and more.',
};

type Props = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

// Only the plain, filterless landing view (no ?gender=/?city=/?country= in
// the URL) gets server-rendered + cached — that's the one case we can be
// sure is the same for every visitor. Any URL-filtered view, and anything
// tied to a logged-in session's own locked-gender restriction (which lives
// in localStorage — the server has no way to know it), still goes through
// ProposalsClient's existing live client-side fetch, completely unchanged.
export default async function ProposalsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const hasUrlFilters = !!(sp.gender || sp.city || sp.country);
  const initialData = hasUrlFilters ? null : await getDefaultProposalsFeed();

  return (
    <Suspense fallback={null}>
      <ProposalsClient initialData={initialData} />
    </Suspense>
  );
}
