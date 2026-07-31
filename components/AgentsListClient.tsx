'use client';
import { useState, useMemo } from 'react';
import ReportAgentButton from '@/components/ReportAgentButton';

type Agent = {
  id: string;
  name: string;
  phone: string;
  support_center_address: string | null;
  support_center_city: string | null;
  timing: string | null;
};

export default function AgentsListClient({ initial }: { initial: Agent[] }) {
  const [selectedCity, setSelectedCity] = useState('');

  // Only cities that actually have a listed center — no point offering a
  // filter option that would just show "no results" every time.
  const availableCities = useMemo(() => {
    const cities = new Set<string>();
    initial.forEach(a => { if (a.support_center_city) cities.add(a.support_center_city); });
    return Array.from(cities).sort();
  }, [initial]);

  const agents = useMemo(() => {
    if (!selectedCity) return initial;
    return initial.filter(a => a.support_center_city === selectedCity);
  }, [initial, selectedCity]);

  return (
    <>
      {availableCities.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 28, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: '#6B6893' }}>Filter by city:</label>
          <select
            value={selectedCity}
            onChange={e => setSelectedCity(e.target.value)}
            style={{
              padding: '8px 14px', borderRadius: 10, border: '1.5px solid #E8E6F5',
              fontSize: 13.5, fontWeight: 600, color: '#1A1830', background: '#fff', cursor: 'pointer',
            }}
          >
            <option value="">All Cities</option>
            {availableCities.map(city => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </div>
      )}

      {agents.length === 0 && (
        <div style={{ textAlign: 'center', color: '#6B6893', fontSize: 14, padding: '40px 0' }}>
          {selectedCity ? `No verified agents listed in ${selectedCity} right now.` : 'No verified agents are listed right now — check back soon.'}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: agents.length === 1 ? 'minmax(320px, 420px)' : 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 16,
        justifyContent: agents.length === 1 ? 'center' : 'stretch',
      }}>
        {agents.map(agent => (
          <div key={agent.id} style={{ background: '#fff', border: '1px solid #E8E6F5', borderRadius: 16, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#1A1830' }}>{agent.name}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#E1F5EE', color: '#0F6E56', fontSize: 11, fontWeight: 800, padding: '3px 9px 3px 6px', borderRadius: 999 }}>
                  <svg width="16" height="16" viewBox="0 0 22 22" fill="none">
                    <path d="M 9.83 2.39 Q 11.00 1.00 12.17 2.39 Q 13.35 3.77 15.11 3.34 Q 16.88 2.91 17.01 4.72 Q 17.15 6.53 18.83 7.22 Q 20.51 7.91 19.56 9.45 Q 18.60 11.00 19.56 12.55 Q 20.51 14.09 18.83 14.78 Q 17.15 15.47 17.01 17.28 Q 16.88 19.09 15.11 18.66 Q 13.35 18.23 12.17 19.61 Q 11.00 21.00 9.83 19.61 Q 8.65 18.23 6.89 18.66 Q 5.12 19.09 4.99 17.28 Q 4.85 15.47 3.17 14.78 Q 1.49 14.09 2.44 12.55 Q 3.40 11.00 2.44 9.45 Q 1.49 7.91 3.17 7.22 Q 4.85 6.53 4.99 4.72 Q 5.12 2.91 6.89 3.34 Q 8.65 3.77 9.83 2.39 Z" fill="#0F6E56"/>
                    <path d="M7.3 11.2l2.4 2.4 4.8-5.4" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
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
              {agent.support_center_city && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>
                  <span style={{ fontWeight: 700 }}>{agent.support_center_city}</span>
                </div>
              )}
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
    </>
  );
}
