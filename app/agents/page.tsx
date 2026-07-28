import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import ReportAgentButton from '@/components/ReportAgentButton';

// Affiliates change rarely — same 5-minute cadence as the other
// mostly-static listing pages on the site.
export const revalidate = 300;

const SITE = 'https://joronline.com';

export const metadata: Metadata = {
  title: 'Jor Rishta Center | Jor',
  description: 'Get help creating your account and using the Jor App and Website — completely free.',
  alternates: { canonical: `${SITE}/agents` },
  robots: { index: true, follow: true },
};

type Agent = {
  id: string;
  name: string;
  phone: string;
  support_center_address: string | null;
  timing: string | null;
};

async function getAgents(): Promise<Agent[]> {
  const { data } = await supabase.rpc('list_verified_agents_secure');
  return (data as Agent[]) || [];
}

export default async function AgentsPage() {
  const agents = await getAgents();

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: '#1A1830', marginBottom: 10 }}>Jor Rishta Center</h1>
        <p style={{ fontSize: 15, color: '#6B6893', lineHeight: 1.7, maxWidth: 560, margin: '0 auto' }}>
          Get help creating your account and using the Jor App and Website — completely Free.
        </p>
      </div>

      {agents.length === 0 && (
        <div style={{ textAlign: 'center', color: '#6B6893', fontSize: 14, padding: '40px 0' }}>
          No verified agents are listed right now — check back soon.
        </div>
      )}

      <div style={{ display: 'grid', gap: 14 }}>
        {agents.map(agent => (
          <div key={agent.id} style={{ background: '#fff', border: '1px solid #E8E6F5', borderRadius: 16, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#1A1830' }}>{agent.name}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#E1F5EE', color: '#0F6E56', fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 999 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Verified
                </span>
              </div>
              <ReportAgentButton agentId={agent.id} agentName={agent.name} />
            </div>

            <div style={{ display: 'grid', gap: 6, fontSize: 13.5, color: '#1A1830' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 11.9a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.06 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16v.92z"/></svg>
                <a href={`tel:${agent.phone}`} style={{ color: '#534AB7', textDecoration: 'none', fontWeight: 700 }}>{agent.phone}</a>
              </div>
              {agent.support_center_address && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  <span>{agent.support_center_address}</span>
                </div>
              )}
              {agent.timing && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span>{agent.timing}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
