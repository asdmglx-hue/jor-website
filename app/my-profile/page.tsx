import type { Metadata } from 'next';
import MyProposalClient from './MyProposalClient';
export const metadata: Metadata = { title: 'My Profile | Jor', description: 'View and manage your Jor rishta proposal.', robots: { index: false, follow: false } };
export default function MyProfilePage() { return <MyProposalClient />; }
