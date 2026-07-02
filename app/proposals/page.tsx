import type { Metadata } from 'next';
import { Suspense } from 'react';
import ProposalsClient from './ProposalsClient';

export const metadata: Metadata = {
  title: 'Browse Rishta Proposals | Jor',
  description: 'Browse thousands of verified rishta proposals from across Pakistan. Filter by city, caste, sect, profession and more.',
};

export default function ProposalsPage() {
  return (
    <Suspense fallback={null}>
      <ProposalsClient />
    </Suspense>
  );
}
