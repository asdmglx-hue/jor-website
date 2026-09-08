import ProposalFormClient from './ProposalFormClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Post Your Rishta — Jor',
  description: 'Submit your rishta profile on Jor.',
  robots: { index: false, follow: false },
};

export default function ProposalFormPage() {
  return <ProposalFormClient />;
}
