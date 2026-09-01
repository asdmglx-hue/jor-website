import type { Metadata } from 'next';
import SubmitClient from './SubmitClient';

export const metadata: Metadata = {
  title: 'Post a Rishta Proposal | Jor',
  description: 'Post your rishta profile free on Jor — Pakistan\'s trusted matrimonial platform. Connect directly with families across Pakistan, UK, UAE and more. Verified profiles only.',
  alternates: { canonical: 'https://joronline.com/register' },
};

export default function SubmitPage() { return <SubmitClient />; }
