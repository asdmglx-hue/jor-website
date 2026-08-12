'use client';
import { useState, useEffect } from 'react';
import { loginWithCnic, supabase } from '@/lib/supabase';
import { saveSession } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PasswordInput from '@/components/PasswordInput';
import { trackEvent } from '@/lib/analytics';

// Generates a persistent device ID for this browser.
// Stored in localStorage so the same browser always uses the same ID.
function getOrCreateWebDeviceId(): string {
  const key = 'jor_web_device_id';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const fresh = 'web-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  localStorage.setItem(key, fresh);
  return fresh;
}

const ADMIN_WHATSAPP = process.env.NEXT_PUBLIC_ADMIN_WHATSAPP || '923000000000';

export default function LoginClient() {
  const [cnic, setCnic] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotCnic, setForgotCnic] = useState('');
  const [forgotError, setForgotError] = useState('');
  const router = useRouter();

  useEffect(() => {
    // Show message if user was kicked due to new device login
    if (typeof window !== 'undefined' && window.location.search.includes('kicked=1')) {
      setError('You were logged out because your account was accessed from a new device. Only 1 device can be logged in at a time.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('app_settings').select('key, value');
        if (data) {
          const s: Record<string, string> = {};
          (data as { key: string; value: string }[]).forEach(r => { s[r.key] = r.value; });
          setSettings(s);
        }
      } catch (_) {}
    })();
  }, []);

  // Auto-format CNIC as 12345-1234567-1
  const formatCnic = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 13);
    if (digits.length <= 5) return digits;
    if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
  };

  const handleLogin = async () => {
    const cleanCnic = cnic.replace(/-/g, '');
    if (cleanCnic.length !== 13) { setError('Enter a valid 13-digit CNIC.'); return; }
    if (!password.trim()) { setError('Password is required.'); return; }
    setLoading(true); setError('');
    try {
      const proposal = await loginWithCnic(cleanCnic, password);
      if (!proposal) { setError('Incorrect CNIC or password. Please try again.'); return; }

      // Clear any old token first, then register new session
      localStorage.removeItem('jor_session_token');
      const deviceId = getOrCreateWebDeviceId();
      const { data: sessionToken } = await supabase.rpc('register_device_session', {
        p_cnic: cleanCnic,
        p_device_id: deviceId,
        p_device_type: 'web',
      });
      if (sessionToken) {
        localStorage.setItem('jor_session_token', sessionToken as string);
      }

      localStorage.setItem('jor_login_time', Date.now().toString());
      saveSession(proposal);
      trackEvent('login_success');
      // Use window.location instead of router.push to force full page reload.
      // This clears any stale session check intervals from previous visits.
      window.location.href = '/my-profile';
    } catch {
      setError('Something went wrong. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Simplified to match the app: no CNIC/photo upload here anymore —
  // just point the person to WhatsApp with a generic pre-filled message.
  // Messaging from their own registered number is itself the identity
  // signal (the admin sees the sender), rather than a typed CNIC number
  // that could be spoofed by anyone.
  const handleForgotWhatsApp = () => {
    const digits = forgotCnic.replace(/-/g, '');
    if (digits.length !== 13) { setForgotError('Enter a complete 13-digit CNIC number.'); return; }
    const adminWa = settings['whatsapp_number'] || ADMIN_WHATSAPP;
    const text = `Hi, I forgot my password for my JOR account.\n\nMy CNIC: ${forgotCnic}\n\nPlease help me reset it.`;
    window.open(`https://wa.me/${adminWa}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    setShowForgotModal(false);
    setForgotCnic('');
    setForgotError('');
  };

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', background: '#FAF9FF' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 20, background: '#EEEDFE', margin: '0 auto 12px' }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1A1830', marginBottom: 8 }}>Welcome Back</h1>
          <p style={{ color: '#6B6893', fontSize: 14 }}>Login with your CNIC and password</p>
        </div>

        <div style={{ background: '#fff', border: '1px solid #E8E6F5', borderRadius: 20, padding: '28px', boxShadow: '0 4px 20px rgba(83,74,183,0.08)' }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#6B6893', marginBottom: 6 }}>CNIC Number</label>
            <input
              type="text" placeholder="12345-1234567-1"
              value={cnic} onChange={e => setCnic(formatCnic(e.target.value))}
              maxLength={15}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E8E6F5', fontSize: 15, outline: 'none', color: '#1A1830', letterSpacing: 1 }}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#6B6893', marginBottom: 6 }}>Password</label>
            <PasswordInput
              placeholder="Your password"
              value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E8E6F5', fontSize: 15, outline: 'none', color: '#1A1830' }}
            />
            <div style={{ textAlign: 'right', marginTop: 8 }}>
              <button onClick={() => { setForgotCnic(''); setForgotError(''); setShowForgotModal(true); }} style={{ background: 'none', border: 'none', padding: 0, color: '#534AB7', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Forgot Password?
              </button>
            </div>
          </div>

          {error && (
            <div style={{ background: '#FEE2E2', border: '1px solid #DC262644', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#DC2626', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          <button onClick={handleLogin} disabled={loading} style={{
            width: '100%', padding: '13px', borderRadius: 12, border: 'none',
            background: '#534AB7', color: '#fff', fontWeight: 800, fontSize: 15,
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
            boxShadow: '0 4px 14px rgba(83,74,183,0.3)',
          }}>
            {loading ? 'Logging in...' : 'Login →'}
          </button>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#6B6893' }}>
            Don&apos;t have an account?{' '}
            <Link href="/register" style={{ color: '#534AB7', fontWeight: 700, textDecoration: 'none' }}>Register</Link>
          </p>
        </div>
      </div>

      {showForgotModal && (
        <div onClick={() => setShowForgotModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 380, padding: 24 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#534AB7', marginBottom: 4 }}>Forgot Password</div>
            <div style={{ fontSize: 13, color: '#6B6893', marginBottom: 16, lineHeight: 1.5 }}>
              Message us from your registered WhatsApp number and we&apos;ll help reset your password.
            </div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#6B6893', marginBottom: 6 }}>CNIC Number</label>
            <input
              type="text" placeholder="12345-1234567-1"
              value={forgotCnic} onChange={e => { setForgotCnic(formatCnic(e.target.value)); setForgotError(''); }}
              maxLength={15}
              autoFocus
              style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${forgotError ? '#DC2626' : '#E8E6F5'}`, fontSize: 15, outline: 'none', color: '#1A1830', letterSpacing: 1, boxSizing: 'border-box', marginBottom: 6 }}
            />
            {forgotError && <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 10 }}>{forgotError}</div>}
            <button onClick={handleForgotWhatsApp} style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '13px', borderRadius: 12, border: 'none', background: '#25D366',
              color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', marginTop: 8,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.48 1.32 4.99L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm0 18.06h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.03-.2-.31a8.14 8.14 0 0 1-1.25-4.3c0-4.5 3.66-8.16 8.17-8.16 2.18 0 4.23.85 5.77 2.4a8.1 8.1 0 0 1 2.39 5.77c0 4.5-3.66 8.14-8.11 8.14Zm4.47-6.11c-.24-.12-1.45-.72-1.68-.8-.22-.08-.39-.12-.55.12-.16.24-.63.8-.78.96-.14.16-.29.18-.53.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.02-.37.1-.49.11-.11.24-.29.36-.43.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.32-.75-1.81-.2-.48-.4-.41-.55-.42-.14-.01-.3-.01-.46-.01-.16 0-.42.06-.64.3-.22.24-.85.83-.85 2.02 0 1.19.87 2.34.99 2.5.12.16 1.71 2.61 4.14 3.66.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.45-.59 1.65-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28Z"/></svg>
              Message on WhatsApp
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
