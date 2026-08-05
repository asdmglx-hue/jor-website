import type { Metadata } from 'next';
import SubscriptionClient from './SubscriptionClient';
export const metadata: Metadata = { title: 'Choose a Plan - Jor', description: 'Subscribe to Jor to unlock verified rishta profiles or feature your profile to stand out and reach more families across Pakistan and abroad.', alternates: { canonical: 'https://joronline.com/plans' } };
export default function SubscriptionPage() { return <SubscriptionClient />; }
