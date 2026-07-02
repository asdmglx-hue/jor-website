'use client';
import { useState } from 'react';
import { loginWithCnic } from '@/lib/supabase';
import { saveSession } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginClient() {
  const [cnic, setCnic] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

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
    const proposal = await loginWithCnic(cleanCnic, password);
    setLoading(false);
    if (!proposal) { setError('Incorrect CNIC or password. Please try again.'); return; }
    saveSession(proposal);
    router.push('/my-proposal');
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
            <input
              type="password" placeholder="Your password"
              value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E8E6F5', fontSize: 15, outline: 'none', color: '#1A1830' }}
            />
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
            <Link href="/submit" style={{ color: '#534AB7', fontWeight: 700, textDecoration: 'none' }}>Post a Rishta</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
