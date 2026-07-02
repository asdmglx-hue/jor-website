import type { Metadata } from 'next';
import MyProposalClient from './MyProposalClient';
export const metadata: Metadata = { title: 'My Proposal | Jor', description: 'View and manage your Jor rishta proposal.', robots: { index: false, follow: false } };
export default function MyProposalPage() { return <MyProposalClient />; }
