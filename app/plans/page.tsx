import type { Metadata } from 'next';
import SubscriptionClient from './SubscriptionClient';
export const metadata: Metadata = { title: 'Choose a Plan | Jor', description: 'Subscribe to Jor to unlock contact numbers, photos, and unlimited proposal browsing across Pakistan.' };
export default function SubscriptionPage() { return <SubscriptionClient />; }
