import type { Metadata } from 'next';
import SubmitClient from './SubmitClient';

export const metadata: Metadata = {
  title: 'Post a Rishta Proposal | Jor',
  description: 'Submit your rishta profile on Jor and connect with Muslim families across Pakistan and overseas. Simple, secure, and trusted for finding the right rishta.',
  alternates: { canonical: 'https://joronline.com/register' },
};

export default function SubmitPage() { return <SubmitClient />; }
