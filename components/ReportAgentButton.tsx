'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const REASONS = [
  'Center is closed / no longer operating',
  'Wrong address or contact info',
  'Requested money outside official pricing',
  'Rude or unprofessional behavior',
  'Other',
];

export default function ReportAgentButton({ agentId, agentName }: { agentId: string; agentName: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('923000000000');

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'whatsapp_number').maybeSingle()
      .then(({ data }) => { if (data?.value) setWhatsappNumber(data.value as string); });
  }, []);

  const reset = () => { setOpen(false); setReason(''); setDetails(''); setContact(''); setDone(false); setError(''); };

  const submit = async () => {
    if (!reason) { setError('Please select a reason.'); return; }
    setSubmitting(true);
    setError('');
    const { error: rpcError } = await supabase.rpc('report_affiliate_secure', {
      p_affiliate_id: agentId,
      p_reason: reason,
      p_details: details.trim() || null,
      p_reporter_contact: contact.trim() || null,
    });
    setSubmitting(false);
    if (rpcError) { setError('Something went wrong. Please try again.'); return; }

    // Forward the same filled form to WhatsApp so the team sees it
    // immediately, in addition to it being saved for the record via the
    // RPC above.
    const text = `Help Center Report\n\nAgent: ${agentName}\nReason: ${reason}${details.trim() ? `\nDetails: ${details.trim()}` : ''}${contact.trim() ? `\nReporter phone: ${contact.trim()}` : ''}`;
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');

    setDone(true);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{ flexShrink: 0, background: 'none', border: '1px solid #E8E6F5', borderRadius: 10, padding: '6px 12px', fontSize: 12, fontWeight: 700, color: '#6B6893', cursor: 'pointer' }}
      >
        Report
      </button>

      {open && (
        <div onClick={reset} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 400, padding: 24 }}>
            {done ? (
              <>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#534AB7', marginBottom: 8 }}>Report submitted</div>
                <div style={{ fontSize: 13.5, color: '#6B6893', lineHeight: 1.6, marginBottom: 20 }}>
                  Thanks — we&apos;ve saved this and opened WhatsApp so our team sees it right away.
                </div>
                <button onClick={reset} style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: '#534AB7', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
                  Close
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#1A1830', marginBottom: 4 }}>Report {agentName}</div>
                <div style={{ fontSize: 13, color: '#6B6893', marginBottom: 16, lineHeight: 1.5 }}>
                  Let us know what happened — reports are reviewed by our team, not shown publicly.
                </div>

                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#6B6893', marginBottom: 6 }}>Reason</label>
                <select
                  value={reason} onChange={e => setReason(e.target.value)}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E8E6F5', fontSize: 14, outline: 'none', color: '#1A1830', background: '#fff', boxSizing: 'border-box', marginBottom: 14 }}
                >
                  <option value="">Select a reason</option>
                  {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>

                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#6B6893', marginBottom: 6 }}>Details (optional)</label>
                <textarea
                  value={details} onChange={e => setDetails(e.target.value)}
                  rows={3} placeholder="Anything else we should know"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E8E6F5', fontSize: 14, outline: 'none', color: '#1A1830', boxSizing: 'border-box', marginBottom: 14, resize: 'vertical', fontFamily: 'inherit' }}
                />

                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#6B6893', marginBottom: 6 }}>Your phone number (optional)</label>
                <input
                  type="text" value={contact} onChange={e => setContact(e.target.value)}
                  placeholder="In case we need to follow up"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E8E6F5', fontSize: 14, outline: 'none', color: '#1A1830', boxSizing: 'border-box', marginBottom: 6 }}
                />

                {error && <div style={{ fontSize: 12, color: '#DC2626', marginTop: 8, marginBottom: 6 }}>{error}</div>}

                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  <button onClick={reset} style={{ flex: 1, padding: '11px', borderRadius: 12, border: '1.5px solid #E8E6F5', background: '#fff', color: '#6B6893', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={submit} disabled={submitting} style={{ flex: 2, padding: '11px', borderRadius: 12, border: 'none', background: submitting ? '#68629C' : '#534AB7', color: '#fff', fontWeight: 800, fontSize: 14, cursor: submitting ? 'default' : 'pointer' }}>
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
