'use client';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { saveSession } from '@/lib/auth';
import Link from 'next/link';
import PasswordInput from '@/components/PasswordInput';
import PhoneInput from '@/components/PhoneInput';
import { trackEvent } from '@/lib/analytics';

// ─────────────────────────────────────────────────────────────────────────────
// /login-otp — OTP phone login clone
// Mirrors Flutter jor_auth_sheet.dart login + forgot flow:
//   Login: phone + password → session → /my-profile
//   Forgot: phone → OTP → new password → back to login
// The existing /login page (CNIC) is completely untouched.
// ─────────────────────────────────────────────────────────────────────────────

type Mode  = 'login' | 'forgot';
type FStep = 'phone' | 'otp' | 'password' | 'done';

const PURPLE    = '#534AB7';
const PURPLE_LT = '#EEEDFE';
const INK       = '#1A1830';
const INK_LT    = '#6B6893';
const BORDER    = '#E8E6F5';
const BG        = '#FAF9FF';
const RED       = '#DC2626';
const RED_LT    = '#FEE2E2';
const GREEN     = '#16A34A';
const WA_GREEN  = '#25D366';

const card: React.CSSProperties = {
  background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 20,
  padding: '28px', boxShadow: '0 4px 20px rgba(83,74,183,0.08)',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 12,
  border: `1.5px solid ${BORDER}`, fontSize: 15, outline: 'none',
  color: INK, background: '#F8F7FF', boxSizing: 'border-box',
};

const primaryBtn = (disabled = false): React.CSSProperties => ({
  width: '100%', padding: '13px', borderRadius: 12, border: 'none',
  background: disabled ? '#9895C0' : PURPLE, color: '#fff',
  fontWeight: 800, fontSize: 15, cursor: disabled ? 'not-allowed' : 'pointer',
  boxShadow: disabled ? 'none' : '0 4px 14px rgba(83,74,183,0.3)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
});

const waBtn = (disabled = false): React.CSSProperties => ({
  width: '100%', padding: '13px', borderRadius: 12, border: 'none',
  background: disabled ? '#a3d4b8' : WA_GREEN, color: '#fff',
  fontWeight: 800, fontSize: 15, cursor: disabled ? 'not-allowed' : 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
});

const lbl: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 700, color: INK_LT, marginBottom: 6,
};

function Spinner() {
  return (
    <>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}>
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
    </>
  );
}

function ErrBox({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div style={{ background: RED_LT, border: `1px solid ${RED}44`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: RED, marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      {msg}
    </div>
  );
}

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{ width: i === current ? 18 : 6, height: 6, borderRadius: 3, background: i === current ? PURPLE : i < current ? '#A5B4FC' : BORDER, transition: 'all 0.2s' }} />
      ))}
    </div>
  );
}

function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, ' ').slice(0, 6).split('');
  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      const d = [...digits];
      if (d[i].trim()) { d[i] = ' '; onChange(d.join('').trimEnd()); }
      else if (i > 0) { d[i-1] = ' '; onChange(d.join('').trimEnd()); refs.current[i-1]?.focus(); }
    }
  };
  const handleChange = (i: number, v: string) => {
    const digit = v.replace(/\D/g, '').slice(-1);
    const d = [...digits.map(c => c.trim() ? c : '')];
    d[i] = digit;
    onChange(d.join(''));
    if (digit && i < 5) refs.current[i+1]?.focus();
  };
  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pasted);
    refs.current[Math.min(pasted.length, 5)]?.focus();
    e.preventDefault();
  };
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {[0,1,2,3,4,5].map(i => (
        <input key={i} ref={el => { refs.current[i] = el; }}
          value={digits[i].trim()} onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKey(i, e)} onPaste={handlePaste}
          maxLength={1} inputMode="numeric"
          style={{ width: 44, height: 52, textAlign: 'center', fontSize: 22, fontWeight: 700, borderRadius: 10,
            border: `2px solid ${digits[i].trim() ? PURPLE : BORDER}`, outline: 'none',
            color: INK, background: digits[i].trim() ? PURPLE_LT : '#F8F7FF', transition: 'all 0.15s' }}
        />
      ))}
    </div>
  );
}

function formatPhone(dialCode: string, number: string): string {
  const digits = number.replace(/\D/g, '');
  const local = dialCode === '+92' ? digits.replace(/^0+/, '') : digits;
  return `${dialCode}${local}`;
}

function getOrCreateWebDeviceId(): string {
  const key = 'jor_web_device_id';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const fresh = 'web-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  localStorage.setItem(key, fresh);
  return fresh;
}

export default function LoginOtpClient() {
  const [mode, setMode]         = useState<Mode>('login');

  // Login
  const [lPhone, setLPhone]     = useState('');
  const [lDial, setLDial]       = useState('+92');
  const [lPass, setLPass]       = useState('');
  const [lBusy, setLBusy]       = useState(false);
  const [lErr, setLErr]         = useState('');

  // Forgot
  const [fStep, setFStep]       = useState<FStep>('phone');
  const [fPhone, setFPhone]     = useState('');
  const [fDial, setFDial]       = useState('+92');
  const [fOtp, setFOtp]         = useState('');
  const [fPass, setFPass]       = useState('');
  const [fConf, setFConf]       = useState('');
  const [fBusy, setFBusy]       = useState(false);
  const [fErr, setFErr]         = useState('');
  const [fFullPhone, setFFullPhone] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.location.search.includes('kicked=1')) {
        setLErr('You were logged out because your account was accessed from a new device.');
      }
      // Pre-fill phone if coming from /register-otp
      const params = new URLSearchParams(window.location.search);
      const pre = params.get('phone');
      if (pre) { setLPhone(pre.replace(/^\+92/, '')); setLDial('+92'); }
    }
  }, []);

  // ── Login ─────────────────────────────────────────────────────────────────
  async function handleLogin() {
    if (!lPhone.trim()) { setLErr('Enter your phone number.'); return; }
    if (!lPass.trim())  { setLErr('Password is required.'); return; }
    setLBusy(true); setLErr('');
    try {
      const phone = formatPhone(lDial, lPhone);
      // login_by_phone returns a text identity (cnic or phone), not a proposal object
      const { data: identity, error } = await supabase.rpc('login_by_phone', {
        p_phone: phone,
        p_password: lPass.trim(),
      });
      if (error || !identity) {
        setLErr('Incorrect phone number or password. Please try again.');
        return;
      }

      // Fetch the full proposal using RPC (bypasses RLS so pending profiles work too)
      const identityStr = identity as string;
      const { data: statusData } = await supabase.rpc('fetch_user_status_by_cnic', {
        p_cnic: identityStr,
      });
      // fetch_user_status_by_cnic returns nested object — unwrap it
      const rawStatus = statusData as Record<string, unknown> | null;
      const proposal = (rawStatus?.fetch_user_status_by_cnic ?? rawStatus) as Record<string, unknown> | null;

      const deviceId = getOrCreateWebDeviceId();
      localStorage.removeItem('jor_session_token');
      const { data: sessionToken } = await supabase.rpc('register_device_session', {
        p_cnic: identityStr, p_device_id: deviceId, p_device_type: 'web',
      });
      if (sessionToken) localStorage.setItem('jor_session_token', sessionToken as string);
      localStorage.setItem('jor_login_time', Date.now().toString());

      if (proposal && proposal.id) {
        saveSession(proposal as import('@/lib/supabase').Proposal);
        trackEvent('login_success');
        const params = new URLSearchParams(window.location.search);
        window.location.href = params.get('next') || '/my-profile';
      } else {
        // No profile yet — redirect to register to complete it
        trackEvent('login_success');
        window.location.href = '/register';
      }
    } catch {
      setLErr('Something went wrong. Please check your connection and try again.');
    } finally {
      setLBusy(false);
    }
  }

  // ── Forgot: send OTP ──────────────────────────────────────────────────────
  async function handleForgotSendOtp() {
    if (!fPhone.trim()) { setFErr('Enter your phone number.'); return; }
    setFBusy(true); setFErr('');
    const fp = formatPhone(fDial, fPhone);
    try {
      const res = await supabase.functions.invoke('send-otp', { body: { phone: fp } });
      const data = res.data as Record<string, unknown>;
      if (data?.success) { setFFullPhone(fp); setFStep('otp'); }
      else setFErr((data?.message as string) || 'Failed to send OTP. Please try again.');
    } catch { setFErr('Network error. Please check your connection.'); }
    setFBusy(false);
  }

  // ── Forgot: verify OTP ────────────────────────────────────────────────────
  async function handleForgotVerifyOtp() {
    const code = fOtp.replace(/\D/g, '');
    if (code.length < 6) { setFErr('Enter the 6-digit code.'); return; }
    setFBusy(true); setFErr('');
    try {
      const res = await supabase.functions.invoke('verify-otp', { body: { phone: fFullPhone, code } });
      const data = res.data as Record<string, unknown>;
      if (data?.success) setFStep('password');
      else setFErr((data?.message as string) || 'Invalid code. Please try again.');
    } catch { setFErr('Network error. Please check your connection.'); }
    setFBusy(false);
  }

  // ── Forgot: save password ─────────────────────────────────────────────────
  async function handleForgotSavePassword() {
    if (fPass.length < 6) { setFErr('Password must be at least 6 characters.'); return; }
    if (fPass !== fConf)   { setFErr('Passwords do not match.'); return; }
    setFBusy(true); setFErr('');
    try {
      await supabase.rpc('set_phone_password', { p_phone: fFullPhone, p_password: fPass });
      setFStep('done');
    } catch { setFErr('Failed to update password. Please try again.'); }
    setFBusy(false);
  }

  function resetForgot() {
    setMode('login'); setFStep('phone'); setFPhone(''); setFOtp('');
    setFPass(''); setFConf(''); setFErr(''); setFFullPhone('');
  }

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', background: BG }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: PURPLE_LT, margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={PURPLE} strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: INK, marginBottom: 6 }}>
            {mode === 'forgot' ? 'Reset Password' : 'Welcome Back'}
          </h1>
          <p style={{ color: INK_LT, fontSize: 14 }}>
            {mode === 'forgot' ? 'Reset your password using WhatsApp OTP' : 'Login with your phone number and password'}
          </p>
        </div>

        <div style={card}>

          {/* ── Login ── */}
          {mode === 'login' && (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>WhatsApp Number</label>
                <PhoneInput value={lPhone} onChange={v => { setLPhone(v); setLErr(''); }}
                  dialCode={lDial} onDialChange={v => { setLDial(v); setLErr(''); }} autoFocus />
              </div>
              <div style={{ marginBottom: 4 }}>
                <label style={lbl}>Password</label>
                <PasswordInput placeholder="Your password" value={lPass}
                  onChange={e => { setLPass(e.target.value); setLErr(''); }}
                  onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleLogin()}
                  style={inputStyle} />
                <div style={{ textAlign: 'right', marginTop: 8 }}>
                  <button onClick={() => { setMode('forgot'); setFPhone(lPhone); setFDial(lDial); setFErr(''); }}
                    style={{ background: 'none', border: 'none', padding: 0, color: PURPLE, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    Forgot Password?
                  </button>
                </div>
              </div>
              <ErrBox msg={lErr} />
              <button onClick={handleLogin} disabled={lBusy} style={{ ...primaryBtn(lBusy), marginTop: 16 }}>
                {lBusy ? <><Spinner /> Logging in...</> : 'Login →'}
              </button>
              <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: INK_LT }}>
                Don&apos;t have an account?{' '}
                <Link href="/register-otp" style={{ color: PURPLE, fontWeight: 700, textDecoration: 'none' }}>Create Account</Link>
              </p>
            </>
          )}

          {/* ── Forgot ── */}
          {mode === 'forgot' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: INK }}>
                    {fStep === 'phone' ? 'Enter your phone' : fStep === 'otp' ? 'Enter the OTP' : fStep === 'password' ? 'Set new password' : 'Password updated!'}
                  </div>
                  {fStep !== 'done' && <StepDots current={fStep === 'phone' ? 0 : fStep === 'otp' ? 1 : 2} total={3} />}
                </div>
                <button onClick={resetForgot} style={{ background: 'none', border: 'none', cursor: 'pointer', color: INK_LT, padding: 4 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              {fStep === 'phone' && (
                <>
                  <p style={{ fontSize: 13, color: INK_LT, marginBottom: 16, lineHeight: 1.6 }}>
                    Enter the phone number you signed up with. We&apos;ll send a code via WhatsApp.
                  </p>
                  <label style={lbl}>Phone Number</label>
                  <PhoneInput value={fPhone} onChange={v => { setFPhone(v); setFErr(''); }}
                    dialCode={fDial} onDialChange={v => { setFDial(v); setFErr(''); }} autoFocus />
                  <ErrBox msg={fErr} />
                  <div style={{ marginTop: 20 }}>
                    <button onClick={handleForgotSendOtp} disabled={fBusy} style={waBtn(fBusy)}>
                      {fBusy ? <><Spinner /> Sending...</> : 'Send OTP via WhatsApp'}
                    </button>
                  </div>
                </>
              )}

              {fStep === 'otp' && (
                <>
                  <div style={{ background: '#f0fdf4', border: `1px solid ${WA_GREEN}33`, borderRadius: 14, padding: 14, marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: `${WA_GREEN}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={WA_GREEN} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a7a40' }}>Code sent!</div>
                        <div style={{ fontSize: 12.5, color: '#1a7a40' }}>{fFullPhone}</div>
                      </div>
                    </div>
                  </div>
                  <label style={{ ...lbl, textAlign: 'center', display: 'block', marginBottom: 16 }}>Enter 6-digit code</label>
                  <OtpInput value={fOtp} onChange={setFOtp} />
                  <ErrBox msg={fErr} />
                  <div style={{ marginTop: 20 }}>
                    <button onClick={handleForgotVerifyOtp} disabled={fBusy || fOtp.replace(/\D/g,'').length < 6} style={primaryBtn(fBusy || fOtp.replace(/\D/g,'').length < 6)}>
                      {fBusy ? <><Spinner /> Verifying...</> : 'Verify Code →'}
                    </button>
                  </div>
                  <button onClick={() => { setFStep('phone'); setFOtp(''); setFErr(''); }} style={{ background: 'none', border: 'none', padding: '12px 0 0', width: '100%', textAlign: 'center', color: INK_LT, fontSize: 13, cursor: 'pointer' }}>
                    ← Change number
                  </button>
                </>
              )}

              {fStep === 'password' && (
                <>
                  <div style={{ background: '#f0fdf4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '10px 13px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12"/></svg>
                    <span style={{ fontSize: 13, color: '#15803D', fontWeight: 600 }}>Phone verified — set your new password.</span>
                  </div>
                  <label style={lbl}>New Password</label>
                  <PasswordInput placeholder="At least 6 characters" value={fPass}
                    onChange={e => { setFPass(e.target.value); setFErr(''); }}
                    style={{ ...inputStyle, marginBottom: 14 }} autoFocus />
                  <label style={lbl}>Confirm Password</label>
                  <PasswordInput placeholder="Repeat your new password" value={fConf}
                    onChange={e => { setFConf(e.target.value); setFErr(''); }}
                    style={inputStyle} />
                  <ErrBox msg={fErr} />
                  <div style={{ marginTop: 20 }}>
                    <button onClick={handleForgotSavePassword} disabled={fBusy} style={primaryBtn(fBusy)}>
                      {fBusy ? <><Spinner /> Saving...</> : 'Save Password'}
                    </button>
                  </div>
                </>
              )}

              {fStep === 'done' && (
                <div style={{ textAlign: 'center', padding: '8px 0' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: INK, marginBottom: 8 }}>Password Updated!</div>
                  <p style={{ fontSize: 13, color: INK_LT, marginBottom: 22, lineHeight: 1.6 }}>
                    Your password has been changed. Login with your new password.
                  </p>
                  <button onClick={resetForgot} style={primaryBtn()}>Back to Login</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
