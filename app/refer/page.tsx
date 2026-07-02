import type { Metadata } from 'next';
import ReferClient from './ReferClient';
export const metadata: Metadata = {
  title: 'Refer & Earn | Jor',
  description: 'Join the Jor affiliate program and earn commission for every person who subscribes using your referral code.',
};
export default function ReferPage() { return <ReferClient />; }
