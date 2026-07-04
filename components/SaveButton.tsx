'use client';
import { useState, useEffect } from 'react';
import { getSavedIds, toggleSaved } from '@/lib/auth';

export default function SaveButton({ proposalId }: { proposalId: string }) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(getSavedIds().includes(proposalId));
    const onSynced = () => setSaved(getSavedIds().includes(proposalId));
    window.addEventListener('jor:saved-synced', onSynced);
    return () => window.removeEventListener('jor:saved-synced', onSynced);
  }, [proposalId]);

  const handleClick = () => {
    const ids = toggleSaved(proposalId);
    setSaved(ids.includes(proposalId));
  };

  return (
    <button onClick={handleClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
      background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0,
    }}>
      <span style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 36, height: 36, borderRadius: '50%', background: saved ? '#FEE2E2' : '#EEEDFE',
        border: `1.5px solid ${saved ? '#DC262622' : '#534AB722'}`,
      }}>
        {saved ? (
          <svg width="16" height="15" viewBox="0 0 24 24" fill="#DC2626"><path d="M12 21s-6.716-4.35-9.428-8.06C.24 9.79 1.02 5.9 4.2 4.44c2.1-.96 4.5-.3 5.8 1.5.5.7 1.4.7 1.9 0 1.3-1.8 3.7-2.46 5.8-1.5 3.18 1.46 3.96 5.35 1.63 8.5C18.716 16.65 12 21 12 21z"/></svg>
        ) : (
          <svg width="16" height="15" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2"><path d="M12 21s-6.716-4.35-9.428-8.06C.24 9.79 1.02 5.9 4.2 4.44c2.1-.96 4.5-.3 5.8 1.5.5.7 1.4.7 1.9 0 1.3-1.8 3.7-2.46 5.8-1.5 3.18 1.46 3.96 5.35 1.63 8.5C18.716 16.65 12 21 12 21z"/></svg>
        )}
      </span>
      <span style={{ fontSize: 11, fontWeight: 700, color: saved ? '#DC2626' : '#534AB7' }}>
        {saved ? 'Saved' : 'Save'}
      </span>
    </button>
  );
}
