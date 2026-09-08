'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { saveSession } from '@/lib/auth';
import Link from 'next/link';
import PasswordInput from '@/components/PasswordInput';
import PhoneInput from '@/components/PhoneInput';
import { trackEvent } from '@/lib/analytics';

// ─────────────────────────────────────────────────────────────────────────────
// Mirrors jor_auth_sheet.dart exactly:
//   Mode: signup | login | forgot
//   Signup steps: phone → otp → password → done
//   Forgot steps: phone → otp → password
// ─────────────────────────────────────────────────────────────────────────────

type Mode   = 'signup' | 'login' | 'forgot';
type SStep  = 'phone' | 'otp' | 'password' | 'done';
type FStep  = 'phone' | 'otp' | 'password';

function getOrCreateWebDeviceId(): string {
  const key = 'jor_web_device_id';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const fresh = 'web-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  localStorage.setItem(key, fresh);
  return fresh;
}

function formatPhone(dialCode: string, number: string): string {
  const digits = number.replace(/\D/g, '');
  const local = dialCode === '+92' ? digits.replace(/^0+/, '') : digits;
  return `${dialCode}${local}`;
}

// ── Styles ───────────────────────────────────────────────────────────────────
const PURPLE     = '#534AB7';
const PURPLE_LT  = '#EEEDFE';
const INK        = '#1A1830';
const INK_LT     = '#6B6893';
const BORDER     = '#E8E6F5';
const BG         = '#FAF9FF';
const GREEN      = '#16A34A';
const GREEN_LT   = '#F0FDF4';
const GREEN_BDR  = '#BBF7D0';
const RED        = '#DC2626';
const RED_LT     = '#FEE2E2';
const RED_BDR    = '#DC262644';
const WA_GREEN   = '#25D366';

const card: React.CSSProperties = {
  background: '#fff',
  border: `1px solid ${BORDER}`,
  borderRadius: 20,
  padding: '28px',
  boxShadow: '0 4px 20px rgba(83,74,183,0.08)',
};

const input: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 12,
  border: `1.5px solid ${BORDER}`, fontSize: 15, outline: 'none',
  color: INK, background: '#F8F7FF', boxSizing: 'border-box',
};

const btn = (disabled = false): React.CSSProperties => ({
  width: '100%', padding: '13px', borderRadius: 12, border: 'none',
  background: disabled ? '#9895C0' : PURPLE, color: '#fff',
  fontWeight: 800, fontSize: 15,
  cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.8 : 1,
  boxShadow: disabled ? 'none' : '0 4px 14px rgba(83,74,183,0.3)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
});

const wabtn = (disabled = false): React.CSSProperties => ({
  width: '100%', padding: '13px', borderRadius: 12, border: 'none',
  background: disabled ? '#a3d4b8' : WA_GREEN, color: '#fff',
  fontWeight: 800, fontSize: 15,
  cursor: disabled ? 'not-allowed' : 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
});

const lbl: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 700, color: INK_LT, marginBottom: 6,
};

const errBox = (msg: string) => msg ? (
  <div style={{ background: RED_LT, border: `1px solid ${RED_BDR}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: RED, marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    {msg}
  </div>
) : null;

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  );
}

// OTP digit input — 6 boxes like the Flutter version
function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, '').slice(0, 6).split('');

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      const newDigits = [...digits];
      if (newDigits[i] && newDigits[i] !== ' ') {
        newDigits[i] = ' ';
        onChange(newDigits.join('').trimEnd());
      } else if (i > 0) {
        newDigits[i - 1] = ' ';
        onChange(newDigits.join('').trimEnd());
        refs.current[i - 1]?.focus();
      }
    }
  };

  const handleChange = (i: number, v: string) => {
    const digit = v.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits.map(d => d === ' ' ? '' : d)];
    newDigits[i] = digit;
    const joined = newDigits.join('');
    onChange(joined);
    if (digit && i < 5) refs.current[i + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pasted);
    const focusIdx = Math.min(pasted.length, 5);
    refs.current[focusIdx]?.focus();
    e.preventDefault();
  };

  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {[0,1,2,3,4,5].map(i => (
        <input
          key={i}
          ref={el => { refs.current[i] = el; }}
          value={digits[i] === ' ' ? '' : (digits[i] || '')}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          maxLength={1}
          inputMode="numeric"
          style={{
            width: 44, height: 52, textAlign: 'center', fontSize: 22, fontWeight: 700,
            borderRadius: 10, border: `2px solid ${digits[i] && digits[i] !== ' ' ? PURPLE : BORDER}`,
            outline: 'none', color: INK, background: digits[i] && digits[i] !== ' ' ? PURPLE_LT : '#F8F7FF',
            transition: 'all 0.15s',
          }}
        />
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function LoginOtpClient() {
  const [mode, setMode]       = useState<Mode>('login');

  // ── Signup state ──
  const [sStep, setSStep]     = useState<SStep>('phone');
  const [sPhone, setSPhone]   = useState('');
  const [sDialCode, setSDialCode] = useState('+92');
  const [sOtp, setSotp]       = useState('');
  const [sPass, setSPass]     = useState('');
  const [sConf, setSConf]     = useState('');
  const [sBusy, setSBusy]     = useState(false);
  const [sErr, setSErr]       = useState('');

  // ── Login state ──
  const [lPhone, setLPhone]   = useState('');
  const [lDialCode, setLDialCode] = useState('+92');
  const [lPass, setLPass]     = useState('');
  const [lBusy, setLBusy]     = useState(false);
  const [lErr, setLErr]       = useState('');

  // ── Forgot state ──
  const [fStep, setFStep]     = useState<FStep>('phone');
  const [fPhone, setFPhone]   = useState('');
  const [fDialCode, setFDialCode] = useState('+92');
  const [fOtp, setFotp]       = useState('');
  const [fPass, setFPass]     = useState('');
  const [fConf, setFConf]     = useState('');
  const [fBusy, setFBusy]     = useState(false);
  const [fErr, setFErr]       = useState('');
  const [fProposalId, setFProposalId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('kicked=1')) {
      setMode('login');
      setLErr('You were logged out because your account was accessed from a new device.');
    }
  }, []);

  // ── Helper: send OTP ──────────────────────────────────────────────────────
  async function sendOtp(phone: string, isSignup: boolean): Promise<string | null> {
    try {
      const res = await supabase.functions.invoke('send-otp', { body: { phone } });
      const data = res.data as Record<string, unknown>;
      if (data?.success) return null;

      if (isSignup && data?.hasAccount) {
        // Phone already registered — switch to login
        setLPhone(sPhone);
        setLDialCode(sDialCode);
        setMode('login');
        setLErr('This number already has an account. Login below.');
        return 'already_registered';
      }
      return (data?.message as string) || 'Failed to send OTP.';
    } catch {
      return 'Network error. Please check your connection.';
    }
  }

  async function verifyOtp(phone: string, code: string): Promise<{ success: boolean; hasAccount?: boolean; message?: string; phone?: string }> {
    try {
      const res = await supabase.functions.invoke('verify-otp', { body: { phone, code } });
      const data = res.data as Record<string, unknown>;
      return {
        success: data?.success === true,
        hasAccount: data?.hasAccount as boolean | undefined,
        message: data?.message as string | undefined,
        phone: data?.phone as string | undefined,
      };
    } catch {
      return { success: false, message: 'Network error. Please check your connection.' };
    }
  }

  // ── Signup: send OTP ──────────────────────────────────────────────────────
  async function handleSignupSendOtp() {
    if (!sPhone.trim()) { setSErr('Enter your phone number.'); return; }
    setSBusy(true); setSErr('');
    const phone = formatPhone(sDialCode, sPhone);

    // Check if already registered before sending OTP
    try {
      const { data } = await supabase.rpc('check_phone_exists', { p_phone: phone });
      if (data === true) {
        setSBusy(false);
        setLPhone(sPhone);
        setLDialCode(sDialCode);
        setMode('login');
        setLErr('This number already has an account. Login below.');
        return;
      }
    } catch (_) { /* proceed */ }

    const err = await sendOtp(phone, true);
    setSBusy(false);
    if (err && err !== 'already_registered') { setSErr(err); return; }
    if (!err) setSStep('otp');
  }

  // ── Signup: verify OTP ────────────────────────────────────────────────────
  async function handleSignupVerifyOtp() {
    if (sOtp.replace(/\D/g, '').length < 6) { setSErr('Enter the 6-digit code.'); return; }
    setSBusy(true); setSErr('');
    const phone = formatPhone(sDialCode, sPhone);
    const result = await verifyOtp(phone, sOtp.replace(/\D/g, ''));
    setSBusy(false);

    if (!result.success) {
      if (result.hasAccount) {
        setLPhone(sPhone);
        setLDialCode(sDialCode);
        setMode('login');
        setLErr('This number already has an account. Login below.');
        return;
      }
      setSErr(result.message || 'Invalid code. Please try again.');
      return;
    }
    setSStep('password');
  }

  // ── Signup: set password ──────────────────────────────────────────────────
  async function handleSignupSetPassword() {
    if (sPass.length < 6) { setSErr('Password must be at least 6 characters.'); return; }
    if (sPass !== sConf) { setSErr('Passwords do not match.'); return; }
    setSBusy(true); setSErr('');
    try {
      await supabase.rpc('set_phone_password', {
        p_phone: formatPhone(sDialCode, sPhone),
        p_password: sPass,
      });
      setSStep('done');
    } catch {
      setSErr('Something went wrong. Please try again.');
    }
    setSBusy(false);
  }

  // ── Login ─────────────────────────────────────────────────────────────────
  async function handleLogin() {
    if (!lPhone.trim()) { setLErr('Enter your phone number.'); return; }
    if (!lPass.trim())  { setLErr('Password is required.'); return; }
    setLBusy(true); setLErr('');
    try {
      const phone = formatPhone(lDialCode, lPhone);
      const { data, error } = await supabase.rpc('login_by_phone', {
        p_phone: phone,
        p_password: lPass.trim(),
      });
      const proposal = data as Record<string, unknown> | null;
      if (error || !proposal || !proposal.id) {
        setLErr('Incorrect phone number or password. Please try again.');
        return;
      }

      // Register device session
      const deviceId = getOrCreateWebDeviceId();
      localStorage.removeItem('jor_session_token');
      const { data: sessionToken } = await supabase.rpc('register_device_session', {
        p_cnic: phone,   // phone acts as the identity key
        p_device_id: deviceId,
        p_device_type: 'web',
      });
      if (sessionToken) {
        localStorage.setItem('jor_session_token', sessionToken as string);
      }

      localStorage.setItem('jor_login_time', Date.now().toString());
      saveSession(proposal as import('@/lib/supabase').Proposal);
      trackEvent('login_success');
      window.location.href = '/my-profile';
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
    const phone = formatPhone(fDialCode, fPhone);
    const err = await sendOtp(phone, false);
    setFBusy(false);
    if (err) { setFErr(err); return; }
    setFStep('otp');
  }

  // ── Forgot: verify OTP ────────────────────────────────────────────────────
  async function handleForgotVerifyOtp() {
    if (fOtp.replace(/\D/g, '').length < 6) { setFErr('Enter the 6-digit code.'); return; }
    setFBusy(true); setFErr('');
    const phone = formatPhone(fDialCode, fPhone);
    const result = await verifyOtp(phone, fOtp.replace(/\D/g, ''));
    setFBusy(false);
    if (!result.success) { setFErr(result.message || 'Invalid code. Try again.'); return; }

    // Get proposal id for this phone
    const { data } = await supabase
      .from('proposals')
      .select('id')
      .eq('auth_phone', phone)
      .maybeSingle();
    if (!data?.id) {
      // Also check phone_accounts
      const { data: pa } = await supabase
        .from('phone_accounts')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();
      if (!pa) { setFErr('No account found for this number.'); return; }
    }
    setFProposalId(data?.id || null);
    setFStep('password');
  }

  // ── Forgot: set new password ──────────────────────────────────────────────
  async function handleForgotSavePassword() {
    if (fPass.length < 6) { setFErr('Password must be at least 6 characters.'); return; }
    if (fPass !== fConf) { setFErr('Passwords do not match.'); return; }
    setFBusy(true); setFErr('');
    try {
      const phone = formatPhone(fDialCode, fPhone);
      await supabase.rpc('set_phone_password', {
        p_phone: phone,
        p_password: fPass,
      });
      // Also update proposals table password for backward compat
      if (fProposalId) {
        await supabase.from('proposals').update({ password: fPass }).eq('id', fProposalId);
      }
      // Done — switch to login with success message
      setLPhone(fPhone);
      setLDialCode(fDialCode);
      setMode('login');
      setLErr('');
      // Show success by briefly showing green
    } catch {
      setFErr('Failed to update password. Please try again.');
    }
    setFBusy(false);
  }

  // ── Step progress indicator ───────────────────────────────────────────────
  function StepDots({ current, total }: { current: number; total: number }) {
    return (
      <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{
            width: i === current ? 18 : 6, height: 6, borderRadius: 3,
            background: i === current ? PURPLE : i < current ? '#A5B4FC' : BORDER,
            transition: 'all 0.2s',
          }} />
        ))}
      </div>
    );
  }

  // ── Mode switcher tabs ────────────────────────────────────────────────────
  function ModeTabs() {
    return (
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, background: PURPLE_LT, borderRadius: 12, padding: 4 }}>
        {(['login', 'signup'] as Mode[]).map(m => (
          <button key={m} onClick={() => { setMode(m); setSErr(''); setLErr(''); setFErr(''); }}
            style={{
              flex: 1, padding: '9px', borderRadius: 10, border: 'none',
              background: mode === m ? PURPLE : 'transparent',
              color: mode === m ? '#fff' : INK_LT,
              fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'all 0.2s',
            }}>
            {m === 'login' ? 'Login' : 'Create Account'}
          </button>
        ))}
      </div>
    );
  }

  // ── OTP sent badge (matches Flutter green box) ────────────────────────────
  function OtpSentBadge({ phone }: { phone: string }) {
    return (
      <div style={{ background: '#f0fdf4', border: `1px solid ${WA_GREEN}33`, borderRadius: 14, padding: 14, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: `${WA_GREEN}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={WA_GREEN} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a7a40' }}>Code sent!</div>
            <div style={{ fontSize: 12.5, color: '#1a7a40' }}>{phone}</div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', background: BG }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: PURPLE_LT, margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={PURPLE} strokeWidth="2" strokeLinecap="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.87 12 19.79 19.79 0 0 1 1.81 3.4a2 2 0 0 1 1.994-2.186h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 5.61 5.61l.98-.98a2 2 0 0 1 2.1-.45c.91.339 1.854.573 2.82.7A2 2 0 0 1 22 16.92z"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: INK, marginBottom: 6 }}>
            {mode === 'signup' ? 'Create Account' : mode === 'forgot' ? 'Reset Password' : 'Welcome Back'}
          </h1>
          <p style={{ color: INK_LT, fontSize: 14 }}>
            {mode === 'signup' ? 'Sign up with your phone number via WhatsApp OTP'
              : mode === 'forgot' ? 'Reset your password using WhatsApp OTP'
              : 'Login with your phone number and password'}
          </p>
        </div>

        <div style={card}>
          {/* ── Forgot password ── */}
          {mode === 'forgot' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: INK }}>
                    {fStep === 'phone' ? 'Enter your phone' : fStep === 'otp' ? 'Enter the OTP' : 'Set new password'}
                  </div>
                  <StepDots current={fStep === 'phone' ? 0 : fStep === 'otp' ? 1 : 2} total={3} />
                </div>
                <button onClick={() => { setMode('login'); setFStep('phone'); setFPhone(''); setFotp(''); setFPass(''); setFConf(''); setFErr(''); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: INK_LT, padding: 4 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              {fStep === 'phone' && (
                <>
                  <p style={{ fontSize: 13, color: INK_LT, marginBottom: 16, lineHeight: 1.6 }}>
                    Enter the phone number you signed up with. We&apos;ll send a code via WhatsApp.
                  </p>
                  <label style={lbl}>Phone Number</label>
                  <PhoneInput value={fPhone} onChange={setFPhone} dialCode={fDialCode} onDialChange={setFDialCode} autoFocus />
                  {errBox(fErr)}
                  <div style={{ marginTop: 20 }}>
                    <button onClick={handleForgotSendOtp} disabled={fBusy} style={wabtn(fBusy)}>
                      {fBusy ? <><Spinner /> Sending...</> : <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
                        Send OTP via WhatsApp
                      </>}
                    </button>
                  </div>
                  <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: INK_LT }}>
                    Remembered it?{' '}
                    <button onClick={() => { setMode('login'); setFStep('phone'); setFErr(''); }} style={{ background: 'none', border: 'none', padding: 0, color: PURPLE, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                      Login
                    </button>
                  </p>
                </>
              )}

              {fStep === 'otp' && (
                <>
                  <OtpSentBadge phone={`${fDialCode} ${fPhone}`} />
                  <label style={{ ...lbl, textAlign: 'center', display: 'block', marginBottom: 16 }}>Enter 6-digit code</label>
                  <OtpInput value={fOtp} onChange={setFotp} />
                  {errBox(fErr)}
                  <div style={{ marginTop: 20 }}>
                    <button onClick={handleForgotVerifyOtp} disabled={fBusy || fOtp.replace(/\D/g,'').length < 6} style={btn(fBusy || fOtp.replace(/\D/g,'').length < 6)}>
                      {fBusy ? <><Spinner /> Verifying...</> : 'Verify Code →'}
                    </button>
                  </div>
                  <button onClick={() => { setFStep('phone'); setFotp(''); setFErr(''); }} style={{ background: 'none', border: 'none', padding: '12px 0 0', width: '100%', textAlign: 'center', color: INK_LT, fontSize: 13, cursor: 'pointer' }}>
                    ← Change number
                  </button>
                </>
              )}

              {fStep === 'password' && (
                <>
                  <div style={{ background: GREEN_LT, border: `1px solid ${GREEN_BDR}`, borderRadius: 10, padding: '10px 13px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12"/></svg>
                    <span style={{ fontSize: 13, color: '#15803D', fontWeight: 600 }}>Phone verified — set your new password below.</span>
                  </div>
                  <label style={lbl}>New Password</label>
                  <PasswordInput placeholder="At least 6 characters" value={fPass} onChange={e => { setFPass(e.target.value); setFErr(''); }} style={{ ...input, marginBottom: 14 }} autoFocus />
                  <label style={lbl}>Confirm Password</label>
                  <PasswordInput placeholder="Repeat your password" value={fConf} onChange={e => { setFConf(e.target.value); setFErr(''); }} style={input} />
                  {errBox(fErr)}
                  <div style={{ marginTop: 20 }}>
                    <button onClick={handleForgotSavePassword} disabled={fBusy} style={btn(fBusy)}>
                      {fBusy ? <><Spinner /> Saving...</> : 'Save Password'}
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <ModeTabs />

              {/* ── Login ── */}
              {mode === 'login' && (
                <>
                  <label style={lbl}>Phone Number</label>
                  <PhoneInput value={lPhone} onChange={v => { setLPhone(v); setLErr(''); }} dialCode={lDialCode} onDialChange={v => { setLDialCode(v); setLErr(''); }} autoFocus />
                  <div style={{ marginTop: 14, marginBottom: 6 }}>
                    <label style={lbl}>Password</label>
                    <PasswordInput placeholder="Your password" value={lPass} onChange={e => { setLPass(e.target.value); setLErr(''); }}
                      onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleLogin()}
                      style={input} />
                    <div style={{ textAlign: 'right', marginTop: 8 }}>
                      <button onClick={() => { setMode('forgot'); setFPhone(lPhone); setFDialCode(lDialCode); setFErr(''); }} style={{ background: 'none', border: 'none', padding: 0, color: PURPLE, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                        Forgot Password?
                      </button>
                    </div>
                  </div>
                  {errBox(lErr)}
                  <button onClick={handleLogin} disabled={lBusy} style={{ ...btn(lBusy), marginTop: 16 }}>
                    {lBusy ? <><Spinner /> Logging in...</> : 'Login →'}
                  </button>
                  <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: INK_LT }}>
                    Don&apos;t have an account?{' '}
                    <button onClick={() => { setMode('signup'); setLErr(''); }} style={{ background: 'none', border: 'none', padding: 0, color: PURPLE, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                      Create Account
                    </button>
                  </p>
                  <p style={{ textAlign: 'center', marginTop: 8, fontSize: 13, color: INK_LT }}>
                    <Link href="/register" style={{ color: PURPLE, fontWeight: 700, textDecoration: 'none' }}>Submit your profile →</Link>
                  </p>
                </>
              )}

              {/* ── Signup ── */}
              {mode === 'signup' && (
                <>
                  {/* Step: phone */}
                  {sStep === 'phone' && (
                    <>
                      <label style={lbl}>Phone Number</label>
                      <PhoneInput value={sPhone} onChange={v => { setSPhone(v); setSErr(''); }} dialCode={sDialCode} onDialChange={v => { setSDialCode(v); setSErr(''); }} autoFocus />
                      <p style={{ fontSize: 12, color: INK_LT, marginTop: 8, lineHeight: 1.5 }}>
                        A 6-digit code will be sent to you via WhatsApp.
                      </p>
                      {errBox(sErr)}
                      <div style={{ marginTop: 20 }}>
                        <button onClick={handleSignupSendOtp} disabled={sBusy} style={wabtn(sBusy)}>
                          {sBusy ? <><Spinner /> Sending...</> : <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
                            Continue via WhatsApp
                          </>}
                        </button>
                      </div>
                      <p style={{ fontSize: 11.5, color: INK_LT, textAlign: 'left', marginTop: 16, lineHeight: 1.6 }}>
                        By continuing, you accept our{' '}
                        <a href="/privacy-policy" target="_blank" style={{ color: PURPLE, fontWeight: 700 }}>Privacy Policy</a>{' '}and{' '}
                        <a href="/terms" target="_blank" style={{ color: PURPLE, fontWeight: 700 }}>Terms of Service</a>.
                      </p>
                    </>
                  )}

                  {/* Step: otp */}
                  {sStep === 'otp' && (
                    <>
                      <OtpSentBadge phone={`${sDialCode} ${sPhone}`} />
                      <label style={{ ...lbl, textAlign: 'center', display: 'block', marginBottom: 16 }}>Enter 6-digit code</label>
                      <OtpInput value={sOtp} onChange={setSotp} />
                      {errBox(sErr)}
                      <div style={{ marginTop: 20 }}>
                        <button onClick={handleSignupVerifyOtp} disabled={sBusy || sOtp.replace(/\D/g,'').length < 6} style={btn(sBusy || sOtp.replace(/\D/g,'').length < 6)}>
                          {sBusy ? <><Spinner /> Verifying...</> : 'Verify Code →'}
                        </button>
                      </div>
                      <button onClick={() => { setSStep('phone'); setSotp(''); setSErr(''); }} style={{ background: 'none', border: 'none', padding: '12px 0 0', width: '100%', textAlign: 'center', color: INK_LT, fontSize: 13, cursor: 'pointer' }}>
                        ← Change number
                      </button>
                    </>
                  )}

                  {/* Step: password */}
                  {sStep === 'password' && (
                    <>
                      <label style={lbl}>Set Password</label>
                      <PasswordInput placeholder="At least 6 characters" value={sPass} onChange={e => { setSPass(e.target.value); setSErr(''); }} style={{ ...input, marginBottom: 14 }} autoFocus />
                      <label style={lbl}>Confirm Password</label>
                      <PasswordInput placeholder="Repeat your password" value={sConf} onChange={e => { setSConf(e.target.value); setSErr(''); }} style={input} />
                      {errBox(sErr)}
                      <div style={{ marginTop: 20 }}>
                        <button onClick={handleSignupSetPassword} disabled={sBusy} style={btn(sBusy)}>
                          {sBusy ? <><Spinner /> Creating account...</> : 'Create Account →'}
                        </button>
                      </div>
                    </>
                  )}

                  {/* Step: done — Account created */}
                  {sStep === 'done' && (
                    <div style={{ textAlign: 'center', padding: '8px 0' }}>
                      <div style={{ width: 72, height: 72, borderRadius: '50%', background: WA_GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: INK, marginBottom: 6 }}>Account created!</div>
                      <div style={{ fontSize: 14, color: INK_LT, marginBottom: 24 }}>
                        Login to fill in your rishta profile.
                      </div>
                      <button onClick={() => {
                        setMode('login');
                        setLPhone(sPhone);
                        setLDialCode(sDialCode);
                        setSStep('phone');
                        setSotp(''); setSPass(''); setSConf(''); setSErr('');
                      }} style={btn()}>
                        Continue
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
