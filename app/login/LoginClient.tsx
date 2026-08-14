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

// Normalise a phone number for comparison: strip spaces, dashes, and a
// leading country code (92) so that 0300-1234567, 03001234567, and
// 923001234567 all match the same record.
function normalisePhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('92') && digits.length > 10) digits = '0' + digits.slice(2);
  return digits;
}

export default function LoginClient() {
  const [cnic, setCnic] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState<Record<string, string>>({});

  // Forgot-password modal state
  // step 1 = verify CNIC + phone, step 2 = set new password
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotCnic, setForgotCnic] = useState('');
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotVerifying, setForgotVerifying] = useState(false);
  const [verifiedProposalId, setVerifiedProposalId] = useState<string | null>(null);

  // Step-2 fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);

  const router = useRouter();

  useEffect(() => {
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
      window.location.href = '/my-profile';
    } catch {
      setError('Something went wrong. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot password: step 1 ─────────────────────────────────────────────
  // Look up a proposal whose CNIC and contact_phone both match what the user
  // typed. We do the comparison server-side via Supabase RPC so the raw
  // password column never reaches the browser.
  const handleVerifyIdentity = async () => {
    const cnicDigits = forgotCnic.replace(/-/g, '');
    const phoneDigits = normalisePhone(forgotPhone);

    if (cnicDigits.length !== 13) { setForgotError('Enter a complete 13-digit CNIC number.'); return; }
    if (phoneDigits.length < 10) { setForgotError('Enter a valid phone number.'); return; }

    setForgotVerifying(true);
    setForgotError('');

    try {
      // Fetch proposal matching CNIC; then check phone client-side.
      // (All sensitive columns are already protected by RLS — this select
      //  returns only id + contact_phone for the matching CNIC row.)
      const { data, error: dbErr } = await supabase
        .from('proposals')
        .select('id, contact_phone')
        .or(`cnic.eq.${cnicDigits}`)
        .maybeSingle();

      if (dbErr || !data) {
        setForgotError('No account found with that CNIC. Please check and try again.');
        return;
      }

      const storedPhone = normalisePhone(data.contact_phone ?? '');
      if (storedPhone !== phoneDigits) {
        setForgotError('Phone number does not match our records for this CNIC.');
        return;
      }

      // Identity verified — move to step 2
      setVerifiedProposalId(data.id as string);
      setForgotStep(2);
      setForgotError('');
    } catch {
      setForgotError('Something went wrong. Please check your connection and try again.');
    } finally {
      setForgotVerifying(false);
    }
  };

  // ── Forgot password: step 2 ─────────────────────────────────────────────
  const handleSaveNewPassword = async () => {
    if (newPassword.length < 6) { setForgotError('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { setForgotError('Passwords do not match.'); return; }
    if (!verifiedProposalId) return;

    setSavingPassword(true);
    setForgotError('');

    try {
      const { error: updateErr } = await supabase
        .from('proposals')
        .update({ password: newPassword })
        .eq('id', verifiedProposalId);

      if (updateErr) throw updateErr;

      setPasswordSaved(true);
    } catch {
      setForgotError('Failed to update password. Please try again.');
    } finally {
      setSavingPassword(false);
    }
  };

  const closeForgotModal = () => {
    if (forgotVerifying || savingPassword) return;
    setShowForgotModal(false);
    setForgotStep(1);
    setForgotCnic('');
    setForgotPhone('');
    setForgotError('');
    setVerifiedProposalId(null);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordSaved(false);
  };

  const inputStyle = (hasError = false): React.CSSProperties => ({
    width: '100%', padding: '12px 14px', borderRadius: 12, fontSize: 14, outline: 'none',
    color: '#1A1830', boxSizing: 'border-box', background: '#F8F7FF',
    border: `1.5px solid ${hasError ? '#DC2626' : '#E8E6F5'}`,
  });

  const busy = forgotVerifying || savingPassword;

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
              <button onClick={() => { setShowForgotModal(true); }} style={{ background: 'none', border: 'none', padding: 0, color: '#534AB7', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
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

      {/* ── Forgot Password Modal ─────────────────────────────────────────── */}
      {showForgotModal && (
        <div
          onClick={closeForgotModal}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 400, padding: 24, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: '#EEEDFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#1A1830' }}>Reset Password</div>
                {/* Step indicator dots */}
                <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
                  {([1, 2] as const).map(s => (
                    <div key={s} style={{ width: s === forgotStep ? 18 : 6, height: 6, borderRadius: 3, background: s === forgotStep ? '#534AB7' : s < forgotStep ? '#A5B4FC' : '#E8E6F5', transition: 'all 0.2s' }} />
                  ))}
                </div>
              </div>
              {!busy && !passwordSaved && (
                <button onClick={closeForgotModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9895C0', padding: 4, display: 'flex', alignItems: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>

            {/* ── Step 1: Verify identity ─────────────────────────────── */}
            {forgotStep === 1 && !passwordSaved && (
              <>
                <p style={{ fontSize: 13, color: '#6B6893', margin: '14px 0 18px', lineHeight: 1.6 }}>
                  Enter your CNIC and the phone number you registered with. If they match, you can set a new password instantly.
                </p>

                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#6B6893', marginBottom: 6 }}>CNIC Number</label>
                <input
                  type="text" placeholder="12345-1234567-1"
                  value={forgotCnic}
                  onChange={e => { setForgotCnic(formatCnic(e.target.value)); setForgotError(''); }}
                  maxLength={15} autoFocus
                  style={{ ...inputStyle(), letterSpacing: 1, marginBottom: 14 }}
                />

                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#6B6893', marginBottom: 6 }}>Registered Phone Number</label>
                <input
                  type="tel" placeholder="e.g. 0300-1234567"
                  value={forgotPhone}
                  onChange={e => { setForgotPhone(e.target.value); setForgotError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleVerifyIdentity()}
                  style={{ ...inputStyle(), marginBottom: 0 }}
                />
                <p style={{ fontSize: 11.5, color: '#9895C0', marginTop: 5, marginBottom: 0 }}>
                  This is Phone Number 1 you entered when registering.
                </p>

                {forgotError && (
                  <div style={{ fontSize: 12, color: '#DC2626', fontWeight: 500, marginTop: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    {forgotError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                  <button onClick={closeForgotModal} disabled={busy} style={{ flex: 1, padding: '13px', borderRadius: 12, border: '1.5px solid #E8E6F5', background: '#fff', color: '#6B6893', fontWeight: 700, fontSize: 14, cursor: busy ? 'not-allowed' : 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={handleVerifyIdentity} disabled={busy} style={{ flex: 2, padding: '13px', borderRadius: 12, border: 'none', background: busy ? '#9895C0' : '#534AB7', color: '#fff', fontWeight: 800, fontSize: 14, cursor: busy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {forgotVerifying ? (
                      <>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                        Verifying...
                      </>
                    ) : 'Verify →'}
                  </button>
                </div>
              </>
            )}

            {/* ── Step 2: Set new password ────────────────────────────── */}
            {forgotStep === 2 && !passwordSaved && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '14px 0 18px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '10px 13px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12"/></svg>
                  <span style={{ fontSize: 13, color: '#15803D', fontWeight: 600 }}>Identity verified — set your new password below.</span>
                </div>

                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#6B6893', marginBottom: 6 }}>New Password</label>
                <PasswordInput
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={e => { setNewPassword(e.target.value); setForgotError(''); }}
                  autoFocus
                  style={{ ...inputStyle(), marginBottom: 14 }}
                />

                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#6B6893', marginBottom: 6 }}>Confirm New Password</label>
                <PasswordInput
                  placeholder="Repeat your new password"
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setForgotError(''); }}
                  style={{ ...inputStyle() }}
                />

                {forgotError && (
                  <div style={{ fontSize: 12, color: '#DC2626', fontWeight: 500, marginTop: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    {forgotError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                  <button onClick={() => { setForgotStep(1); setForgotError(''); setNewPassword(''); setConfirmPassword(''); }} disabled={busy} style={{ flex: 1, padding: '13px', borderRadius: 12, border: '1.5px solid #E8E6F5', background: '#fff', color: '#6B6893', fontWeight: 700, fontSize: 14, cursor: busy ? 'not-allowed' : 'pointer' }}>
                    ← Back
                  </button>
                  <button onClick={handleSaveNewPassword} disabled={busy} style={{ flex: 2, padding: '13px', borderRadius: 12, border: 'none', background: busy ? '#9895C0' : '#534AB7', color: '#fff', fontWeight: 800, fontSize: 14, cursor: busy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {savingPassword ? (
                      <>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                        Saving...
                      </>
                    ) : 'Save Password'}
                  </button>
                </div>
              </>
            )}

            {/* ── Success state ───────────────────────────────────────── */}
            {passwordSaved && (
              <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#1A1830', marginBottom: 8 }}>Password Updated!</div>
                <p style={{ fontSize: 13, color: '#6B6893', marginBottom: 22, lineHeight: 1.6 }}>
                  Your password has been changed. You can now log in with your new password.
                </p>
                <button onClick={closeForgotModal} style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: '#534AB7', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
                  Back to Login
                </button>
              </div>
            )}

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        </div>
      )}
    </div>
  );
}
