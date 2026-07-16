import type { Metadata } from 'next';
import SubmitClient from './SubmitClient';

export const metadata: Metadata = {
  title: 'Post a Rishta Proposal | Jor',
  description: 'Submit your rishta proposal on Jor. Reach thousands of families across Pakistan.',
  alternates: { canonical: 'https://joronline.com/register' },
};

export default function SubmitPage() { return <SubmitClient />; }
