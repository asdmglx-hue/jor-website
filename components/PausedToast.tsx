'use client';
import { useState, useEffect } from 'react';

export default function PausedToast() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handler = () => {
      setVisible(true);
      clearTimeout(timer);
      timer = setTimeout(() => setVisible(false), 4000);
    };
    window.addEventListener('jor:paused-toast', handler);
    return () => { window.removeEventListener('jor:paused-toast', handler); clearTimeout(timer); };
  }, []);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', top: 72, left: '50%', transform: 'translateX(-50%)',
      zIndex: 3000, maxWidth: 480, width: 'calc(100% - 32px)',
      background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 12,
      padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span style={{ fontSize: 14, fontWeight: 600, color: '#92400E' }}>
        Please resume your profile to view contacts.
      </span>
      <button onClick={() => setVisible(false)}
        style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#92400E', flexShrink: 0 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  );
}
