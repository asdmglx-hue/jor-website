'use client';
import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import PasswordInput from '@/components/PasswordInput';
import PhoneInput from '@/components/PhoneInput';

// ─────────────────────────────────────────────────────────────────────────────
// /register-otp — OTP phone signup clone
// Mirrors Flutter jor_auth_sheet.dart signup flow:
//   phone → OTP → set password → done → redirect to /register (profile form)
// The existing /register page is completely untouched.
// ─────────────────────────────────────────────────────────────────────────────

type Step = 'phone' | 'otp' | 'password' | 'done';

const PURPLE    = '#534AB7';
const PURPLE_LT = '#EEEDFE';
const INK       = '#1A1830';
const INK_LT    = '#6B6893';
const BORDER    = '#E8E6F5';
const BG        = '#FAF9FF';
const RED       = '#DC2626';
const RED_LT    = '#FEE2E2';
const WA_GREEN  = '#25D366';

const card: React.CSSProperties = {
  background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 20,
  padding: '32px 28px', boxShadow: '0 4px 20px rgba(83,74,183,0.08)',
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
  background: disabled ? '#9895C0' : PURPLE, color: '#fff',
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
    <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginBottom: 28 }}>
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

function WaIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
    </svg>
  );
}

// 6-box OTP input
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

export default function RegisterOtpClient() {
  const [step, setStep]         = useState<Step>('phone');
  const [phone, setPhone]       = useState('');
  const [dialCode, setDialCode] = useState('+92');
  const [otp, setOtp]           = useState('');
  const [pass, setPass]         = useState('');
  const [conf, setConf]         = useState('');
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState('');
  const [fullPhone, setFullPhone] = useState('');

  // ── Step 1: Send OTP ──────────────────────────────────────────────────────
  async function handleSendOtp() {
    if (!phone.trim()) { setErr('Enter your phone number.'); return; }
    setBusy(true); setErr('');
    const fp = formatPhone(dialCode, phone);

    // Check if already registered
    try {
      const { data } = await supabase.rpc('check_phone_exists', { p_phone: fp });
      if (data === true) {
        setBusy(false);
        setErr('This number already has an account. Please login instead.');
        return;
      }
    } catch (_) { /* proceed */ }

    try {
      const res = await supabase.functions.invoke('send-otp', { body: { phone: fp } });
      const data = res.data as Record<string, unknown>;
      if (data?.success) {
        setFullPhone(fp);
        setStep('otp');
      } else {
        setErr((data?.message as string) || 'Failed to send OTP. Please try again.');
      }
    } catch {
      setErr('Network error. Please check your connection.');
    }
    setBusy(false);
  }

  // ── Step 2: Verify OTP ────────────────────────────────────────────────────
  async function handleVerifyOtp() {
    const code = otp.replace(/\D/g, '');
    if (code.length < 6) { setErr('Enter the 6-digit code.'); return; }
    setBusy(true); setErr('');
    try {
      const res = await supabase.functions.invoke('verify-otp', { body: { phone: fullPhone, code } });
      const data = res.data as Record<string, unknown>;
      if (data?.success) {
        setStep('password');
      } else if (data?.hasAccount) {
        setErr('This number already has an account. Please login instead.');
      } else {
        setErr((data?.message as string) || 'Invalid code. Please try again.');
      }
    } catch {
      setErr('Network error. Please check your connection.');
    }
    setBusy(false);
  }

  // ── Step 3: Set Password ──────────────────────────────────────────────────
  async function handleSetPassword() {
    if (pass.length < 6) { setErr('Password must be at least 6 characters.'); return; }
    if (pass !== conf)   { setErr('Passwords do not match.'); return; }
    setBusy(true); setErr('');
    try {
      await supabase.rpc('set_phone_password', { p_phone: fullPhone, p_password: pass });
      setStep('done');
    } catch {
      setErr('Something went wrong. Please try again.');
    }
    setBusy(false);
  }

  const stepIndex = step === 'phone' ? 0 : step === 'otp' ? 1 : step === 'password' ? 2 : 3;

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', background: BG }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: PURPLE_LT, margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={PURPLE} strokeWidth="2" strokeLinecap="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: INK, marginBottom: 6 }}>Create Account</h1>
          <p style={{ color: INK_LT, fontSize: 14 }}>Sign up with your phone number via WhatsApp OTP</p>
        </div>

        <div style={card}>
          {step !== 'done' && <StepDots current={stepIndex} total={3} />}

          {/* ── Step: phone ── */}
          {step === 'phone' && (
            <>
              <label style={lbl}>WhatsApp Number</label>
              <PhoneInput value={phone} onChange={v => { setPhone(v); setErr(''); }}
                dialCode={dialCode} onDialChange={v => { setDialCode(v); setErr(''); }} autoFocus />
              <p style={{ fontSize: 12, color: INK_LT, marginTop: 10, lineHeight: 1.5 }}>
                A 6-digit verification code will be sent to you via WhatsApp.
              </p>
              <ErrBox msg={err} />
              <div style={{ marginTop: 24 }}>
                <button onClick={handleSendOtp} disabled={busy} style={waBtn(busy)}>
                  {busy ? <><Spinner /> Sending...</> : <><WaIcon /> Continue via WhatsApp</>}
                </button>
              </div>
              <p style={{ fontSize: 11.5, color: INK_LT, textAlign: 'left', marginTop: 20, lineHeight: 1.6 }}>
                By continuing, you accept our{' '}
                <a href="/privacy-policy" target="_blank" style={{ color: PURPLE, fontWeight: 700 }}>Privacy Policy</a>{' '}and{' '}
                <a href="/terms" target="_blank" style={{ color: PURPLE, fontWeight: 700 }}>Terms</a>.
              </p>
              <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: INK_LT }}>
                Already have an account?{' '}
                <Link href="/login-otp" style={{ color: PURPLE, fontWeight: 700, textDecoration: 'none' }}>Login</Link>
              </p>
            </>
          )}

          {/* ── Step: otp ── */}
          {step === 'otp' && (
            <>
              {/* OTP sent badge */}
              <div style={{ background: '#f0fdf4', border: `1px solid ${WA_GREEN}33`, borderRadius: 14, padding: 14, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: `${WA_GREEN}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={WA_GREEN} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1a7a40' }}>Code sent!</div>
                    <div style={{ fontSize: 12.5, color: '#1a7a40' }}>{fullPhone}</div>
                  </div>
                </div>
              </div>
              <label style={{ ...lbl, textAlign: 'center', display: 'block', marginBottom: 16 }}>Enter 6-digit code</label>
              <OtpInput value={otp} onChange={setOtp} />
              <ErrBox msg={err} />
              <div style={{ marginTop: 20 }}>
                <button onClick={handleVerifyOtp} disabled={busy || otp.replace(/\D/g,'').length < 6} style={primaryBtn(busy || otp.replace(/\D/g,'').length < 6)}>
                  {busy ? <><Spinner /> Verifying...</> : 'Verify Code →'}
                </button>
              </div>
              <button onClick={() => { setStep('phone'); setOtp(''); setErr(''); }}
                style={{ background: 'none', border: 'none', padding: '12px 0 0', width: '100%', textAlign: 'center', color: INK_LT, fontSize: 13, cursor: 'pointer' }}>
                ← Change number
              </button>
            </>
          )}

          {/* ── Step: password ── */}
          {step === 'password' && (
            <>
              <div style={{ background: '#f0fdf4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '10px 13px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12"/></svg>
                <span style={{ fontSize: 13, color: '#15803D', fontWeight: 600 }}>Phone verified! Set a password for your account.</span>
              </div>
              <label style={lbl}>Password</label>
              <PasswordInput placeholder="At least 6 characters" value={pass}
                onChange={e => { setPass(e.target.value); setErr(''); }}
                style={{ ...inputStyle, marginBottom: 14 }} autoFocus />
              <label style={lbl}>Confirm Password</label>
              <PasswordInput placeholder="Repeat your password" value={conf}
                onChange={e => { setConf(e.target.value); setErr(''); }}
                style={inputStyle} />
              <ErrBox msg={err} />
              <div style={{ marginTop: 20 }}>
                <button onClick={handleSetPassword} disabled={busy} style={primaryBtn(busy)}>
                  {busy ? <><Spinner /> Creating account...</> : 'Create Account →'}
                </button>
              </div>
            </>
          )}

          {/* ── Step: done ── */}
          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: WA_GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: INK, marginBottom: 6 }}>Account Created!</div>
              <div style={{ fontSize: 14, color: INK_LT, marginBottom: 8, lineHeight: 1.6 }}>
                Your account is ready. Now fill in your rishta profile to get started.
              </div>
              <div style={{ fontSize: 13, color: INK_LT, marginBottom: 24 }}>{fullPhone}</div>
              <Link href={`/login-otp?phone=${encodeURIComponent(fullPhone)}&next=/register`}
                style={{ display: 'block', width: '100%', padding: '13px', borderRadius: 12, background: PURPLE, color: '#fff', fontWeight: 800, fontSize: 15, textDecoration: 'none', textAlign: 'center', boxShadow: '0 4px 14px rgba(83,74,183,0.3)' }}>
                Continue to Profile →
              </Link>
              <p style={{ marginTop: 16, fontSize: 13, color: INK_LT }}>
                Already have a profile?{' '}
                <Link href="/login-otp" style={{ color: PURPLE, fontWeight: 700, textDecoration: 'none' }}>Login</Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
