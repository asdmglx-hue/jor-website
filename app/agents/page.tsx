import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import AgentsListClient from '@/components/AgentsListClient';

// Affiliates change rarely — same 5-minute cadence as the other
// mostly-static listing pages on the site.
// Cached indefinitely — on-demand revalidation via database triggers
// pings the webhook the moment content changes, so no fixed timer needed.
// The 5-minute fallback (revalidate = 300) was the old approach; this is
// strictly better: zero unnecessary regenerations, instant real updates.
export const revalidate = false;

const SITE = 'https://joronline.com';

export const metadata: Metadata = {
  title: 'Jor Help Center | Jor',
  description: 'Get help creating your account and using the Jor App and Website — completely free.',
  alternates: { canonical: `${SITE}/agents` },
  robots: { index: true, follow: true },
};

type Agent = {
  id: string;
  name: string;
  phone: string;
  support_center_address: string | null;
  support_center_city: string | null;
  timing: string | null;
};

async function getAgents(): Promise<Agent[]> {
  const { data } = await supabase.rpc('list_verified_agents_secure');
  return (data as Agent[]) || [];
}

export default async function AgentsPage() {
  const agents = await getAgents();

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '48px 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: '#1A1830', marginBottom: 10 }}>Jor Help Center</h1>
        <p style={{ fontSize: 15, color: '#6B6893', lineHeight: 1.7, maxWidth: 680, margin: '0 auto' }}>
          Get help with registration and using the Jor App and Website — completely Free.
        </p>
      </div>

      <AgentsListClient initial={agents} />
    </div>
  );
}
