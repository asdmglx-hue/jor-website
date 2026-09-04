'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

const TYPE_ICON: Record<string, string> = {
  proposal_submitted:          '📋',
  profile_approved:            '🎉',
  profile_rejected:            '❌',
  profile_paused:              '⏸️',
  profile_resumed:             '👀',
  expiry_warning_7d:           '⚠️',
  expiry_warning_1d:           '⚠️',
  subscription_expired:        '🔴',
  subscription_renewed:        '✨',
  profile_verified:            '✅',
  profile_featured:            '⚡',
  profile_featured_ended:      '📅',
  edit_changes_rejected:       '📝',
  doc_rejected:                '📄',
  verification_submitted:      '🔍',
  payment_proof_submitted:     '💳',
  payment_proof_rejected:      '❌',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
}

export default function NotificationBell() {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [proposalId, setProposalId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const unread = notifs.filter(n => !n.read_at).length;

  // Load proposal id from session
  useEffect(() => {
    setMounted(true);
    const s = getSession();
    if (s?.id && !s.id.startsWith('admin:')) setProposalId(s.id);
  }, []);

  // Fetch notifications
  useEffect(() => {
    if (!proposalId) return;
    const fetchNotifs = async () => {
      const { data } = await supabase
        .from('notification_log')
        .select('id, type, title, body, created_at, read_at')
        .eq('proposal_id', proposalId)
        .in('status', ['sent', 'skipped_no_token', 'local'])
        .order('created_at', { ascending: false })
        .limit(30);
      if (data) setNotifs(data as Notif[]);
    };
    fetchNotifs();
    // Poll every 60s for new notifications
    const interval = setInterval(fetchNotifs, 60000);
    // Also refresh immediately when a local action fires the event
    const onRefresh = () => setTimeout(fetchNotifs, 1500);
    window.addEventListener('jor:notify', onRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('jor:notify', onRefresh);
    };
  }, [proposalId]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markAllRead = async () => {
    if (!proposalId) return;
    const now = new Date().toISOString();
    const unreadIds = notifs.filter(n => !n.read_at).map(n => n.id);
    if (unreadIds.length === 0) return;
    await supabase
      .from('notification_log')
      .update({ read_at: now })
      .in('id', unreadIds);
    setNotifs(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? now })));
  };

  const markOneRead = async (id: string) => {
    const now = new Date().toISOString();
    await supabase.from('notification_log').update({ read_at: now }).eq('id', id);
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read_at: now } : n));
  };

  if (!mounted || !proposalId) return null;

  const bell = (
    <button
      ref={btnRef}
      onClick={() => { setOpen(o => !o); if (!open && unread > 0) markAllRead(); }}
      style={{
        position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 36, height: 36, borderRadius: 10, border: '1.5px solid #E8E6F5',
        background: open ? '#EEEDFE' : '#fff', cursor: 'pointer', flexShrink: 0,
      }}
      aria-label="Notifications"
    >
      {/* Bell icon */}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      {/* Unread badge */}
      {unread > 0 && (
        <span style={{
          position: 'absolute', top: -4, right: -4,
          background: '#E11D48', color: '#fff',
          fontSize: 9, fontWeight: 800, lineHeight: 1,
          padding: '2px 4px', borderRadius: 8,
          minWidth: 16, textAlign: 'center',
          border: '1.5px solid #fff',
        }}>
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  );

  const panel = open ? (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        // Position below the navbar
        top: 64, right: 16,
        width: 340, maxWidth: 'calc(100vw - 32px)',
        maxHeight: 480,
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 8px 40px rgba(0,0,0,0.14)',
        border: '1px solid #E8E6F5',
        zIndex: 1200,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #F0EFF8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: '#1A1830' }}>Notifications</span>
        {unread > 0 && (
          <button onClick={markAllRead} style={{ fontSize: 11, fontWeight: 700, color: '#534AB7', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {notifs.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🔔</div>
            No notifications yet
          </div>
        ) : notifs.map(n => (
          <div
            key={n.id}
            onClick={() => markOneRead(n.id)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '12px 16px',
              background: n.read_at ? '#fff' : '#F8F7FF',
              borderBottom: '1px solid #F5F5F5',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {/* Icon */}
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: '#EEEDFE', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 16,
            }}>
              {TYPE_ICON[n.type] ?? '🔔'}
            </div>
            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: n.read_at ? 600 : 800, color: '#1A1830', marginBottom: 2 }}>
                {n.title}
              </div>
              <div style={{ fontSize: 12, color: '#6B6893', lineHeight: 1.4, marginBottom: 4 }}>
                {n.body}
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>
                {timeAgo(n.created_at)}
              </div>
            </div>
            {/* Unread dot */}
            {!n.read_at && (
              <div style={{ width: 8, height: 8, borderRadius: 4, background: '#534AB7', flexShrink: 0, marginTop: 4 }} />
            )}
          </div>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <>
      {bell}
      {mounted && panel && createPortal(panel, document.body)}
    </>
  );
}
