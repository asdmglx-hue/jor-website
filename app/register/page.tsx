import type { Metadata } from 'next';
import SubmitClient from './SubmitClient';

export const metadata: Metadata = {
  title: 'Jor - Post Your Rishta',
  description: 'Submit your rishta profile on Jor and connect with Muslim families across Pakistan and overseas. Simple, secure, and trusted for finding the right rishta.',
  alternates: { canonical: 'https://joronline.com/register' },
  openGraph: {
    title: 'Jor - Post Your Rishta',
    description: 'Submit your rishta profile on Jor and connect with Muslim families across Pakistan and overseas. Simple, secure, and trusted for finding the right rishta.',
    url: 'https://joronline.com/register',
    siteName: 'Jor',
    type: 'website',
    images: [{ url: 'https://joronline.com/hero-wedding.jpg', width: 1200, height: 630, alt: 'Jor - Post Your Rishta' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Jor - Post Your Rishta',
    description: 'Submit your rishta profile on Jor and connect with Muslim families across Pakistan and overseas.',
    images: ['https://joronline.com/hero-wedding.jpg'],
  },
};

export default function SubmitPage() { return <SubmitClient />; }
