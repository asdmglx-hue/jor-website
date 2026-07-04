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
    <button onClick={handleClick} title={saved ? 'Unsave' : 'Save'} style={{
      position: 'absolute', top: 16, right: 16,
      background: saved ? '#FEE2E2' : '#F5F5F5', border: 'none', borderRadius: 8,
      width: 32, height: 32, cursor: 'pointer', fontSize: 14,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {saved ? '❤️' : '🤍'}
    </button>
  );
}
