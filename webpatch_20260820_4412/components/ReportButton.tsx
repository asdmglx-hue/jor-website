'use client';
import { useState, useEffect } from 'react';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

const REASONS = [
  'Fake Profile',
  'Inappropriate Content',
  'Falsified Information',
  'Spam or Scam',
  'Other',
];

export default function ReportButton({ proposalId }: { proposalId: string }) {
  const [isActive, setIsActive]       = useState(false);
  const [open, setOpen]               = useState(false);
  const [selected, setSelected]       = useState<string | null>(null);
  const [submitting, setSubmitting]   = useState(false);
  const [done, setDone]               = useState(false);

  useEffect(() => {
    const session = getSession();
    if (!session) return;
    if (session.id?.startsWith('admin:')) return;
    if (session.id === proposalId) return;
    setIsActive(true);
  }, [proposalId]);

  if (!isActive) return null;

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    const session = getSession();
    try {
      await supabase.rpc('submit_profile_report', {
        p_cnic: (session as any)?.cnic ?? '',
        p_reported_proposal_id: proposalId,
        p_reason: selected,
      });
      setDone(true);
      setTimeout(() => setOpen(false), 2000);
    } catch {
      // silently fail — user sees no error flash on network issues
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Report icon button */}
      <button
        onClick={() => { setOpen(true); setSelected(null); setDone(false); }}
        title="Report this profile"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '2px 4px', display: 'inline-flex', alignItems: 'center',
          marginBottom: 6, opacity: 0.5,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#68629C" strokeWidth="2.5">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
          <line x1="4" y1="22" x2="4" y2="15"/>
        </svg>
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          onClick={() => !submitting && setOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 20, padding: '28px 24px',
              width: '100%', maxWidth: 400, boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
            }}
          >
            {done ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1830', marginBottom: 6 }}>
                  Report Submitted
                </div>
                <div style={{ fontSize: 13, color: '#68629C', lineHeight: 1.6 }}>
                  Thank you. Our team will review this profile.
                </div>
              </div>
            ) : (
              <>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5">
                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                      <line x1="4" y1="22" x2="4" y2="15"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#1A1830' }}>Report Profile</div>
                    <div style={{ fontSize: 12, color: '#68629C' }}>Our team will review and take action</div>
                  </div>
                </div>

                {/* Reasons */}
                <div style={{ marginBottom: 20 }}>
                  {REASONS.map(r => (
                    <div
                      key={r}
                      onClick={() => setSelected(r)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 0', cursor: 'pointer',
                        borderBottom: '1px solid #F5F3FF',
                      }}
                    >
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                        border: `2px solid ${selected === r ? '#DC2626' : '#C4BDE8'}`,
                        background: selected === r ? '#DC2626' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {selected === r && (
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
                        )}
                      </div>
                      <span style={{
                        fontSize: 13.5, color: '#1A1830',
                        fontWeight: selected === r ? 700 : 500,
                      }}>{r}</span>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setOpen(false)}
                    disabled={submitting}
                    style={{
                      background: 'none', border: '1.5px solid #E8E6F5',
                      borderRadius: 10, padding: '9px 18px',
                      fontSize: 13, fontWeight: 600, color: '#68629C', cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!selected || submitting}
                    style={{
                      background: selected ? '#DC2626' : '#E8E6F5',
                      border: 'none', borderRadius: 10, padding: '9px 18px',
                      fontSize: 13, fontWeight: 700,
                      color: selected ? '#fff' : '#9C8FC0',
                      cursor: selected ? 'pointer' : 'not-allowed',
                      transition: 'all 0.15s',
                    }}
                  >
                    {submitting ? 'Submitting…' : 'Submit Report'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
