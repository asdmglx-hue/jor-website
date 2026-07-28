'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Mode = 'home' | 'join' | 'login' | 'forgot' | 'dashboard';

type Stats = {
  name: string;
  code: string;
  total_commission: number;
  paid_commission: number;
  referrals: number;
  pending_amount: number;
  rate: number;
};

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// Converts an <input type="time"> value ("14:30") to the "H:MM AM/PM"
// format stored everywhere else (admin app, user app) for consistency —
// e.g. "9:00 AM - 6:00 PM" as shown on the /agents page.
function formatTime24to12(time24: string): string {
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${mStr} ${period}`;
}

const inp: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E8E6F5',
  fontSize: 14, outline: 'none', color: '#1A1830', background: '#fff', boxSizing: 'border-box',
};

export default function ReferClient() {
  const [mode, setMode] = useState<Mode>('home');
  const [commissionRate, setCommissionRate] = useState(500);

  // Join / registration form
  const [joinName, setJoinName] = useState('');
  const [joinPhone, setJoinPhone] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [joinConfirmPassword, setJoinConfirmPassword] = useState('');
  const [joinAddress, setJoinAddress] = useState('');
  const [joinOpenTime, setJoinOpenTime] = useState(''); // "HH:MM" from <input type="time">
  const [joinCloseTime, setJoinCloseTime] = useState('');
  const [joinCnicFront, setJoinCnicFront] = useState<File | null>(null);
  const [joinCnicBack, setJoinCnicBack] = useState<File | null>(null);
  const [joinCode, setJoinCode] = useState(() => generateCode());
  const [joining, setJoining] = useState(false);
  const [joinMsg, setJoinMsg] = useState('');
  const [showJoinPassword, setShowJoinPassword] = useState(false);
  const [showJoinConfirmPassword, setShowJoinConfirmPassword] = useState(false);

  // Login form
  const [loginCode, setLoginCode] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [newSignupEnabled, setNewSignupEnabled] = useState(true);
  const [signupSettingLoaded, setSignupSettingLoaded] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('923000000000');

  // Forgot password form
  const [forgotCode, setForgotCode] = useState('');
  const [forgotCnicFront, setForgotCnicFront] = useState<File | null>(null);
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotError, setForgotError] = useState('');

  useEffect(() => {
    supabase.from('app_settings').select('key, value')
      .in('key', ['referral_commission', 'referral_enabled', 'referral_signup_enabled', 'whatsapp_number'])
      .then(({ data }) => {
        if (!data) { setSignupSettingLoaded(true); return; }
        const s: Record<string, string> = {};
        (data as { key: string; value: string }[]).forEach(r => { s[r.key] = r.value; });
        if (s.referral_commission) setCommissionRate(Number(s.referral_commission));
        if (s.referral_signup_enabled === 'false') setNewSignupEnabled(false);
        if (s.whatsapp_number) setWhatsappNumber(s.whatsapp_number);
        setSignupSettingLoaded(true);
      });
  }, []);

  const handleJoin = async () => {
    setJoinMsg('');
    if (!joinName.trim()) { setJoinMsg('Name is required.'); return; }
    const digits = joinPhone.replace(/\D/g, '');
    const requiredLen = digits.startsWith('0') ? 11 : 10;
    if (!digits || digits.length !== requiredLen) { setJoinMsg(`Enter a valid Pakistani number (${requiredLen} digits).`); return; }
    if (joinPassword.length < 6) { setJoinMsg('Password must be at least 6 characters.'); return; }
    if (joinPassword !== joinConfirmPassword) { setJoinMsg('Passwords do not match.'); return; }
    if (!joinOpenTime || !joinCloseTime) { setJoinMsg('Please select opening and closing time.'); return; }
    if (!joinCnicFront || !joinCnicBack) { setJoinMsg('Please upload both CNIC front and back photos.'); return; }

    setJoining(true);
    try {
      const uploadForm = new FormData();
      uploadForm.append('front', joinCnicFront);
      uploadForm.append('back', joinCnicBack);
      const uploadRes = await fetch('/api/upload-affiliate-cnic', { method: 'POST', body: uploadForm });
      const uploaded = await uploadRes.json();
      if (!uploadRes.ok || uploaded.error) {
        setJoinMsg(uploaded.error || 'Failed to upload CNIC photos. Please try again.');
        setJoining(false);
        return;
      }

      const { error } = await supabase.rpc('affiliate_self_register_secure', {
        p_name: joinName.trim(),
        p_phone: joinPhone.trim(),
        p_password: joinPassword,
        p_code: joinCode,
        p_support_center_address: joinAddress.trim() || null,
        p_timing: `${formatTime24to12(joinOpenTime)} - ${formatTime24to12(joinCloseTime)}`,
        p_cnic_front_url: uploaded.front,
        p_cnic_back_url: uploaded.back,
      });
      setJoining(false);
      if (error) {
        setJoinMsg(error.message.includes('duplicate') ? 'This code is already taken. Please regenerate.' : 'Something went wrong. Please try again.');
      } else {
        setJoinMsg('success');
      }
    } catch {
      setJoining(false);
      setJoinMsg('Something went wrong. Please try again.');
    }
  };

  const [loginPassword, setLoginPassword] = useState('');

  const handleLogin = async () => {
    const code = loginCode.trim().toUpperCase();
    if (code.length < 4) { setLoginError('Enter your affiliate code.'); return; }
    setLoginLoading(true); setLoginError('');
    const { data, error } = await supabase.rpc('affiliate_login_secure', {
      p_code: code,
      p_password: loginPassword.trim() || null,
    });
    const { data: rateRow } = await supabase.from('app_settings').select('value').eq('key', 'referral_commission').maybeSingle();
    setLoginLoading(false);
    if (error || !data || data.error) { setLoginError(data?.error || 'No affiliate found with this code.'); return; }
    setStats({
      name: data.name, code: data.code,
      total_commission: data.total_commission ?? 0,
      paid_commission: data.paid_commission ?? 0,
      referrals: data.referrals ?? 0, pending_amount: data.pending_amount ?? 0,
      rate: Number(rateRow?.value ?? 500),
    });
    setMode('dashboard');
  };

  const handleForgotSubmit = async () => {
    const code = forgotCode.trim().toUpperCase();
    if (!code) { setForgotError('Enter your referral code.'); return; }
    if (!forgotCnicFront) { setForgotError('Please upload a color photo of your CNIC front side.'); return; }
    setForgotSubmitting(true);
    setForgotError('');
    try {
      const uploadForm = new FormData();
      uploadForm.append('code', code);
      uploadForm.append('front', forgotCnicFront);
      const res = await fetch('/api/upload-affiliate-forgot-password-cnic', { method: 'POST', body: uploadForm });
      const uploaded = await res.json();
      if (!res.ok || uploaded.error) {
        setForgotSubmitting(false);
        setForgotError(uploaded.error || 'Failed to upload CNIC photo. Please try again.');
        return;
      }
      const text = `Hi, I forgot my affiliate password.\n\nMy Referral Code: ${code}\n\nCNIC front photo (for verification): ${uploaded.url}\n\nPlease help me reset my password.`;
      setForgotSubmitting(false);
      setMode('home');
      setForgotCode(''); setForgotCnicFront(null);
      window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    } catch {
      setForgotSubmitting(false);
      setForgotError('Failed to upload CNIC photo. Please check your connection and try again.');
    }
  };

  const card: React.CSSProperties = { background: '#fff', border: '1px solid #E8E6F5', borderRadius: 20, padding: 24 };

  if (mode === 'dashboard' && stats) return (
    <div className="refer-page-wrap" style={{ maxWidth: 600, margin: '0 auto', padding: '48px 20px' }}>
      <button onClick={() => { setMode('home'); setStats(null); setLoginCode(''); }} style={{ background: 'none', border: 'none', color: '#534AB7', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Back
      </button>

      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: '#EEEDFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#1A1830' }}>Welcome, {stats.name.split(' ')[0]}!</div>
            <div style={{ fontSize: 13, color: '#6B6893' }}>Affiliate Dashboard</div>
          </div>
        </div>

        {/* Code display */}
        <div style={{ background: '#EEEDFE', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6B6893', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>Your Referral Code</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#534AB7', letterSpacing: 4 }}>{stats.code}</div>
          </div>
          <button onClick={() => navigator.clipboard.writeText(stats.code)} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: '#534AB7', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Copy</button>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'Commission Rate', value: `Rs ${stats.rate}`, color: '#534AB7' },
            { label: 'Total Referrals', value: String(stats.referrals), color: '#B45309' },
            { label: 'Amount Paid', value: `Rs ${stats.paid_commission}`, color: '#16A34A' },
            { label: 'Pending', value: `Rs ${stats.pending_amount}`, color: '#DC2626' },
          ].map(s => (
            <div key={s.label} style={{ background: '#F8F7FF', borderRadius: 12, border: '1px solid #E8E6F5', padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#6B6893', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: '#EEEDFE', borderRadius: 14, padding: '16px 18px', fontSize: 13, color: '#534AB7', lineHeight: 1.6 }}>
        <strong>How it works:</strong> Share your code with others. When someone subscribes using your code, you earn Rs {stats.rate} per referral. Contact support to withdraw your earnings.
      </div>
    </div>
  );

  if (mode === 'join') return (
    <div className="refer-page-wrap" style={{ maxWidth: 520, margin: '0 auto', padding: '48px 20px' }}>
      <button onClick={() => { setMode('home'); setJoinMsg(''); }} style={{ background: 'none', border: 'none', color: '#534AB7', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Back
      </button>

      {joinMsg === 'success' ? (
        <div style={{ ...card, textAlign: 'center', padding: 40 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#1A1830', marginBottom: 8 }}>Request Submitted!</div>
          <div style={{ fontSize: 14, color: '#6B6893', lineHeight: 1.6, marginBottom: 6 }}>Your affiliate code is <strong style={{ color: '#534AB7', letterSpacing: 2 }}>{joinCode}</strong></div>
          <div style={{ fontSize: 13, color: '#6B6893', lineHeight: 1.5 }}>We will contact you soon. Use your code to start referring people to Jor and earn Rs {commissionRate} per referral.</div>
        </div>
      ) : (
        <div style={card}>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1A1830', marginBottom: 4 }}>Join as Affiliate</h2>
          <p style={{ fontSize: 13, color: '#6B6893', marginBottom: 24 }}>Fill in your details and share your code with others to earn rewards.</p>

          {joinMsg && <div style={{ background: '#FEE2E2', border: '1px solid #DC262644', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#DC2626', marginBottom: 16 }}>{joinMsg}</div>}

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#6B6893', marginBottom: 5 }}>Full Name</label>
            <input value={joinName} onChange={e => setJoinName(e.target.value)} placeholder="Your name" style={inp} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#6B6893', marginBottom: 5 }}>Phone Number</label>
            <input value={joinPhone} onChange={e => setJoinPhone(e.target.value.replace(/[^\d]/g, '').slice(0, 11))} placeholder="03XXXXXXXXX" type="tel" style={inp} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#6B6893', marginBottom: 5 }}>Support Center Address (optional)</label>
            <input value={joinAddress} onChange={e => setJoinAddress(e.target.value)} placeholder="Address" style={inp} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#6B6893', marginBottom: 5 }}>Timing</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <input type="time" value={joinOpenTime} onChange={e => setJoinOpenTime(e.target.value)} style={inp} />
              <input type="time" value={joinCloseTime} onChange={e => setJoinCloseTime(e.target.value)} style={inp} />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#6B6893', marginBottom: 5 }}>Your Code</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ ...inp, flex: 1, fontWeight: 900, letterSpacing: 4, color: '#534AB7', fontSize: 16, background: '#EEEDFE', border: '1.5px solid #534AB733' }}>{joinCode}</div>
              <button onClick={() => setJoinCode(generateCode())} style={{ padding: '0 16px', borderRadius: 12, border: '1.5px solid #E8E6F5', background: '#fff', cursor: 'pointer', color: '#534AB7', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#6B6893', marginBottom: 5 }}>CNIC Front Photo</label>
            <input type="file" accept="image/*" onChange={e => setJoinCnicFront(e.target.files?.[0] || null)} style={inp} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#6B6893', marginBottom: 5 }}>CNIC Back Photo</label>
            <input type="file" accept="image/*" onChange={e => setJoinCnicBack(e.target.files?.[0] || null)} style={inp} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#6B6893', marginBottom: 5 }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input type={showJoinPassword ? 'text' : 'password'} value={joinPassword} onChange={e => setJoinPassword(e.target.value)} placeholder="At least 6 characters" style={{ ...inp, paddingRight: 44 }} />
              <button onClick={() => setShowJoinPassword(v => !v)} type="button" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6B6893', fontSize: 12, fontWeight: 700 }}>
                {showJoinPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#6B6893', marginBottom: 5 }}>Confirm Password</label>
            <div style={{ position: 'relative' }}>
              <input type={showJoinConfirmPassword ? 'text' : 'password'} value={joinConfirmPassword} onChange={e => setJoinConfirmPassword(e.target.value)} placeholder="Re-enter password" style={{ ...inp, paddingRight: 44 }} />
              <button onClick={() => setShowJoinConfirmPassword(v => !v)} type="button" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6B6893', fontSize: 12, fontWeight: 700 }}>
                {showJoinConfirmPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button onClick={handleJoin} disabled={joining} style={{ width: '100%', padding: 13, borderRadius: 12, border: 'none', background: '#534AB7', color: '#fff', fontWeight: 800, fontSize: 15, cursor: joining ? 'not-allowed' : 'pointer', opacity: joining ? 0.7 : 1 }}>
            {joining ? 'Submitting…' : 'Submit →'}
          </button>
        </div>
      )}
    </div>
  );

  if (mode === 'login') return (
    <div className="refer-page-wrap" style={{ maxWidth: 520, margin: '0 auto', padding: '48px 20px' }}>
      <button onClick={() => { setMode('home'); setLoginError(''); setLoginCode(''); }} style={{ background: 'none', border: 'none', color: '#534AB7', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Back
      </button>
      <div style={card}>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1A1830', marginBottom: 4 }}>Affiliate Login</h2>
        <p style={{ fontSize: 13, color: '#6B6893', marginBottom: 24 }}>Enter your 6-digit affiliate code to view your referrals and earnings.</p>

        {loginError && <div style={{ background: '#FEE2E2', border: '1px solid #DC262644', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#DC2626', marginBottom: 16 }}>{loginError}</div>}

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#6B6893', marginBottom: 5 }}>Affiliate Code</label>
          <input value={loginCode} onChange={e => setLoginCode(e.target.value.toUpperCase())} placeholder="e.g. JOR4X2" maxLength={8} onKeyDown={e => e.key === 'Enter' && handleLogin()} style={{ ...inp, letterSpacing: 3, fontWeight: 700, fontSize: 16 }} />
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#6B6893', marginBottom: 5 }}>Password</label>
          <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="Leave blank if you don't have one" onKeyDown={e => e.key === 'Enter' && handleLogin()} style={inp} />
        </div>

        <div style={{ textAlign: 'right', marginBottom: 20 }}>
          <button onClick={() => { setMode('forgot'); setLoginError(''); }} style={{ background: 'none', border: 'none', color: '#534AB7', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', padding: 0 }}>
            Forgot Password?
          </button>
        </div>

        <button onClick={handleLogin} disabled={loginLoading} style={{ width: '100%', padding: 13, borderRadius: 12, border: 'none', background: '#534AB7', color: '#fff', fontWeight: 800, fontSize: 15, cursor: loginLoading ? 'not-allowed' : 'pointer', opacity: loginLoading ? 0.7 : 1 }}>
          {loginLoading ? 'Checking…' : 'View Dashboard →'}
        </button>
      </div>
    </div>
  );

  if (mode === 'forgot') return (
    <div className="refer-page-wrap" style={{ maxWidth: 520, margin: '0 auto', padding: '48px 20px' }}>
      <button onClick={() => { setMode('login'); setForgotError(''); }} style={{ background: 'none', border: 'none', color: '#534AB7', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Back
      </button>
      <div style={card}>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1A1830', marginBottom: 4 }}>Forgot Password</h2>
        <p style={{ fontSize: 13, color: '#6B6893', marginBottom: 24 }}>We&apos;ll verify you on WhatsApp and reset your password.</p>

        {forgotError && <div style={{ background: '#FEE2E2', border: '1px solid #DC262644', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#DC2626', marginBottom: 16 }}>{forgotError}</div>}

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#6B6893', marginBottom: 5 }}>Referral Code</label>
          <input value={forgotCode} onChange={e => setForgotCode(e.target.value.toUpperCase())} placeholder="e.g. JOR4X2" style={{ ...inp, letterSpacing: 2, fontWeight: 700 }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#6B6893', marginBottom: 5 }}>CNIC Front Photo (color)</label>
          <input type="file" accept="image/*" onChange={e => setForgotCnicFront(e.target.files?.[0] || null)} style={inp} />
        </div>

        <button onClick={handleForgotSubmit} disabled={forgotSubmitting} style={{ width: '100%', padding: 13, borderRadius: 12, border: 'none', background: '#534AB7', color: '#fff', fontWeight: 800, fontSize: 15, cursor: forgotSubmitting ? 'not-allowed' : 'pointer', opacity: forgotSubmitting ? 0.7 : 1 }}>
          {forgotSubmitting ? 'Uploading…' : 'Send via WhatsApp'}
        </button>
      </div>
    </div>
  );

  // Home
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 20px' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ width: 72, height: 72, borderRadius: 22, background: '#EEEDFE', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: '#1A1830', marginBottom: 10 }}>Refer & Earn</h1>
        <p style={{ fontSize: 15, color: '#6B6893', lineHeight: 1.7, maxWidth: 480, margin: '0 auto' }}>
          Help others find their life partner with Jor. Earn <strong style={{ color: '#534AB7' }}>Rs {commissionRate}</strong> for every person who subscribes using your referral code.
        </p>
      </div>

      {/* How it works */}
      <div className="refer-steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 32 }}>
        {[
          { step: '1', title: 'Join as Affiliate', desc: 'Register with your name and phone. Get a unique 6-digit code.', color: '#534AB7', bg: '#EEEDFE' },
          { step: '2', title: 'Share Your Code', desc: 'Share your code with friends, family, or on social media.', color: '#E8620A', bg: '#FEEDE3' },
          { step: '3', title: 'Earn Rewards', desc: `Get Rs ${commissionRate} every time someone subscribes using your code.`, color: '#16A34A', bg: '#DCFCE7' },
        ].map(s => (
          <div key={s.step} style={{ background: '#fff', border: '1px solid #E8E6F5', borderRadius: 16, padding: 20 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: s.bg, color: s.color, fontSize: 16, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>{s.step}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#1A1830', marginBottom: 6 }}>{s.title}</div>
            <div style={{ fontSize: 13, color: '#6B6893', lineHeight: 1.5 }}>{s.desc}</div>
          </div>
        ))}
      </div>


      {/* CTA buttons */}
      <div className="refer-cta-btns" style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 24 }}>
        {signupSettingLoaded && newSignupEnabled && (
          <button onClick={() => setMode('join')} style={{ padding: '14px 32px', borderRadius: 14, border: 'none', background: '#534AB7', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: '0 4px 14px rgba(83,74,183,0.3)' }}>
            Join as Affiliate →
          </button>
        )}
        <button onClick={() => setMode('login')} style={{ padding: '14px 32px', borderRadius: 14, border: '2px solid #534AB7', background: '#fff', color: '#534AB7', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
          Affiliate Login
        </button>
      </div>
    </div>
  );
}
