'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type Boost = { id: string; city: string; scheduled_date: string; is_used: boolean; created_at?: string };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function fmtRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${h}h ${m}m ${s}s remaining`;
}

// Live countdown bar for a running boost — same 24h window, green
// gradient bar, and per-second "Xh XXm XXs remaining" label as the admin
// app's boost list and the mobile app's Manage sheet. windowStart is
// resolved by the caller: created_at for same-day bookings (so a boost
// booked and started today doesn't show hours already "elapsed" purely
// because the stored date sits at midnight UTC — 5am Pakistan time),
// otherwise the scheduled_date itself for advance-scheduled boosts.
function RunningBoostBar({ windowStart }: { windowStart: Date }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const end = new Date(windowStart.getTime() + 24 * 60 * 60 * 1000);
  const remainingMs = end.getTime() - now.getTime();
  const totalMs = 24 * 60 * 60 * 1000;
  const elapsedMs = Math.min(totalMs, Math.max(0, totalMs - remainingMs));
  const progress = elapsedMs / totalMs;

  return (
    <div style={{ marginTop: 8, marginLeft: 44 }}>
      <div style={{ position: 'relative', height: 4, borderRadius: 4, background: 'rgba(22,163,74,0.15)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, width: `${progress * 100}%`, background: 'linear-gradient(90deg, rgba(22,163,74,0.7), #16A34A)', borderRadius: 4 }} />
      </div>
      <div style={{ marginTop: 5, fontSize: 11, fontWeight: 600, color: 'rgba(22,163,74,0.8)' }}>
        {fmtRemaining(Math.max(0, remainingMs))}
      </div>
    </div>
  );
}

export default function FeaturedManageModal({
  open, onClose, cnic, boosts, onChanged,
}: {
  open: boolean;
  onClose: () => void;
  cnic: string;
  boosts: Boost[];
  onChanged: () => void;
}) {
  const [cancelling, setCancelling] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ boost: Boost; isRunning: boolean } | null>(null);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }, [toast]);

  if (!open) return null;

  const now = new Date();
  const running = boosts.filter(b => !b.is_used && new Date(b.scheduled_date) <= now);
  const scheduled = boosts.filter(b => !b.is_used && new Date(b.scheduled_date) > now);

  const doCancel = async () => {
    if (!confirmTarget) return;
    const { boost, isRunning } = confirmTarget;
    setConfirmTarget(null);
    setCancelling(true);
    try {
      const { data } = await supabase.rpc('cancel_featured_boost', { p_cnic: cnic, p_boost_id: boost.id });
      if (data?.success) {
        setToast({ text: data.refunded ? 'Cancelled — 1 credit returned to your balance.' : 'Cancelled — no credit returned for a running post.', ok: true });
      } else {
        setToast({ text: data?.error ?? 'Could not cancel. Please try again.', ok: false });
      }
    } catch (_) {
      setToast({ text: 'Could not cancel right now. Please try again.', ok: false });
    }
    setCancelling(false);
    onChanged();
  };

  const row = (b: Boost, isRunning: boolean) => {
    const d = new Date(b.scheduled_date);
    const createdAt = b.created_at ? new Date(b.created_at) : null;
    const windowStart = (createdAt && isSameDay(createdAt, d)) ? createdAt : d;
    return (
      <div key={b.id} style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: '#E8620A1F', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: '#E8620A', fontSize: 16 }}>{isRunning ? '⚡' : '🕐'}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1A1830', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.city}</div>
            <div style={{ fontSize: 11.5, color: '#6B6893' }}>{isRunning ? `Running • ${fmtDate(b.scheduled_date)}` : fmtDate(b.scheduled_date)}</div>
          </div>
          <button
            onClick={() => setConfirmTarget({ boost: b, isRunning })}
            disabled={cancelling}
            style={{ padding: '8px 14px', borderRadius: 9, border: '1px solid #DC262680', background: '#fff', color: '#DC2626', fontWeight: 800, fontSize: 11.5, cursor: cancelling ? 'default' : 'pointer', flexShrink: 0 }}
          >
            Cancel
          </button>
        </div>
        {isRunning && <RunningBoostBar windowStart={windowStart} />}
      </div>
    );
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#fff', borderRadius: 20, maxWidth: 440, width: '100%', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 24, overflowY: 'auto' }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: '#1A1830', marginBottom: 6 }}>Manage Featured Posts</div>
          <div style={{ fontSize: 12.5, color: '#6B6893', lineHeight: 1.4, marginBottom: 18 }}>Make your profile stand out and get noticed</div>

          {running.length === 0 && scheduled.length === 0 && (
            <div style={{ textAlign: 'center', padding: '18px 0', fontSize: 13, color: '#9990B8' }}>No running or scheduled featured posts.</div>
          )}

          {running.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: '#9990B8', letterSpacing: 0.5, marginBottom: 10 }}>RUNNING NOW</div>
              {running.map((b, i) => (
                <div key={b.id}>
                  {i > 0 && <div style={{ height: 1, background: '#E8E6F599', margin: '10px 0' }} />}
                  {row(b, true)}
                </div>
              ))}
            </div>
          )}

          {scheduled.length > 0 && (
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: '#9990B8', letterSpacing: 0.5, marginBottom: 10 }}>SCHEDULED</div>
              {scheduled.map((b, i) => (
                <div key={b.id}>
                  {i > 0 && <div style={{ height: 1, background: '#E8E6F599', margin: '10px 0' }} />}
                  {row(b, false)}
                </div>
              ))}
            </div>
          )}

          <button onClick={onClose} style={{ width: '100%', marginTop: 20, padding: '13px', borderRadius: 12, border: '1px solid #E8E6F5', background: '#fff', color: '#6B6893', fontWeight: 700, cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>

      {confirmTarget && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmTarget(null); }}
        >
          <div style={{ background: '#fff', borderRadius: 20, maxWidth: 380, width: '100%', padding: 24 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#1A1830', marginBottom: 10 }}>
              {confirmTarget.isRunning ? 'Cancel Running Post?' : 'Cancel Scheduled Post?'}
            </div>
            <div style={{ fontSize: 13, color: '#6B6893', lineHeight: 1.5, marginBottom: 18 }}>
              {confirmTarget.isRunning
                ? `Your featured post in ${confirmTarget.boost.city} is currently running. Cancelling stops it now and the used credit will NOT be returned.`
                : `Your featured post in ${confirmTarget.boost.city} hasn't started yet. Cancelling it will return the full credit to your balance.`}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16 }}>
              <button onClick={() => setConfirmTarget(null)} style={{ background: 'none', border: 'none', color: '#6B6893', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>Keep it</button>
              <button onClick={doCancel} style={{ background: 'none', border: 'none', color: '#DC2626', fontWeight: 800, fontSize: 13.5, cursor: 'pointer' }}>Cancel Post</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 1300,
          background: toast.ok ? '#16A34A' : '#DC2626', color: '#fff', padding: '12px 20px', borderRadius: 12,
          fontSize: 13, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', maxWidth: '90vw',
        }}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
