import { Metadata } from 'next';
import ProposalsClient from './ProposalsClient';

export const metadata: Metadata = {
  title: 'Browse Rishta Proposals | Jor',
  description: 'Browse thousands of verified rishta proposals from across Pakistan. Filter by city, caste, sect, profession and more.',
};

export default function ProposalsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  return <ProposalsClient searchParamsPromise={searchParams} />;
}
