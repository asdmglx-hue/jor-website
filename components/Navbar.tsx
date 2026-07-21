'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getSession, clearSession, saveSession, syncSavedFromServer, syncNotInterestedFromServer } from '@/lib/auth';
import { updateProposal, supabase } from '@/lib/supabase';
import PasswordInput from '@/components/PasswordInput';
import { useRouter, usePathname } from 'next/navigation';

export default function Navbar() {
  const [user, setUser] = useState<{ name: string; profile_photo_url?: string; gender?: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | false>(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const s = getSession();
    setUser(s ? { name: s.name, profile_photo_url: s.profile_photo_url, gender: s.gender } : null);
    if (s?.id) syncSavedFromServer(s.id);
    if (s?.cnic) syncNotInterestedFromServer(s.cnic);
    setMounted(true);
  }, [pathname]);

  const openPasswordModal = () => {
    setMenuOpen(false);
    setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword('');
    setPasswordError(''); setPasswordSuccess('');
    setShowPasswordModal(true);
  };

  const handleChangePassword = async () => {
    const session = getSession();
    if (!session) return;
    setPasswordError(''); setPasswordSuccess('');
    if (!currentPassword.trim()) { setPasswordError('Enter your current password'); return; }
    if (currentPassword.trim() !== session.password) { setPasswordError('Current password is incorrect'); return; }
    if (!newPassword.trim() || newPassword.trim().length < 6) { setPasswordError('New password must be at least 6 characters'); return; }
    if (newPassword.trim() !== confirmNewPassword.trim()) { setPasswordError('New passwords do not match'); return; }
    setPasswordSaving(true);
    // Admin sessions (id like "admin:<uuid>") aren't real proposals — their
    // password lives in admin_accounts, not the proposals table, so they
    // need a different update target than a normal user's password change.
    // Admin accounts now go through a security-definer function that
    // itself re-verifies the current password server-side, rather than a
    // direct table write — the admin_accounts table no longer grants raw
    // write access to the anon key.
    const isAdmin = session.id?.startsWith('admin:');
    const ok = isAdmin
      ? !!(await supabase.rpc('admin_account_self_update_password', {
          p_cnic: session.cnic,
          p_current_password: currentPassword.trim(),
          p_new_password: newPassword.trim(),
        })).data
      : await updateProposal(session.id, { password: newPassword.trim() });
    setPasswordSaving(false);
    if (ok) {
      saveSession({ ...session, password: newPassword.trim() });
      setPasswordSuccess('Password updated successfully.');
      setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword('');
    } else {
      setPasswordError('Failed to update password. Please try again.');
    }
  };

  const handleLogout = () => {
    clearSession();
    setUser(null);
    setMenuOpen(false);
    window.location.href = '/';
  };

  const navContent = (
    <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
          <img src="/logo.png" alt="Jor" className="logo-full" style={{ height: 36, width: 'auto' }} />
          <img src="/logo-icon.png" alt="Jor" className="logo-mobile" style={{ height: 36, width: 'auto' }} />
        </Link>

        {/* Desktop nav */}
        <div className="nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Link href="/proposals" style={{ textDecoration: 'none', padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: pathname.startsWith('/proposals') ? '#EEEDFE' : 'transparent', color: '#534AB7' }}>Browse Proposals</Link>
          <Link href="/plans" style={{ textDecoration: 'none', padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: pathname.startsWith('/plans') ? '#EEEDFE' : 'transparent', color: '#534AB7' }}>Plans</Link>

          {mounted && (user ? (
            <div style={{ position: 'relative' }}>
              <button onClick={() => setMenuOpen(menuOpen === 'desktop' ? false : 'desktop')} style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '5px 12px 5px 5px', borderRadius: 10,
                border: '1.5px solid #E8E6F5', background: '#EEEDFE', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#534AB7',
              }}>
                <div style={{ width: 28, height: 28, borderRadius: 14, overflow: 'hidden', flexShrink: 0, background: user.gender === 'Male' ? '#534AB7' : '#E11D48', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', fontWeight: 800 }}>
                  {user.profile_photo_url
                    ? <img src={user.profile_photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : (user.name || '?').charAt(0).toUpperCase()}
                </div>
                {(user.name || 'Account').split(' ')[0]} ▾
              </button>
              {menuOpen === 'desktop' && (
                <div style={{ position: 'absolute', right: 0, top: '110%', background: '#fff', border: '1px solid #E8E6F5', borderRadius: 12, padding: '6px', minWidth: 160, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 200 }}>
                  <Link href="/my-profile" onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '9px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#1A1830', textDecoration: 'none' }}>My Profile</Link>
                  <button onClick={openPasswordModal} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#1A1830', background: 'none', border: 'none', cursor: 'pointer' }}>Change Password</button>
                  <button onClick={handleLogout} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer' }}>Logout</button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/login" style={{ textDecoration: 'none', padding: '8px 14px', borderRadius: 10, color: '#1A1830', fontSize: 13, fontWeight: 700, border: '1.5px solid #E8E6F5' }}>Login</Link>
          ))}

          {mounted && !user && (
            <Link href="/register" style={{ textDecoration: 'none', padding: '8px 18px', borderRadius: 10, background: '#534AB7', color: '#fff', fontSize: 13, fontWeight: 700, boxShadow: '0 2px 8px rgba(83,74,183,0.25)' }}>
              Register
            </Link>
          )}
        </div>

        {/* Mobile nav — avatar/login + hamburger */}
        <div className="nav-mobile" style={{ display: 'none', alignItems: 'center', gap: 8 }}>

          {mounted && (user ? (
            <div style={{ position: 'relative' }}>
              <button onClick={() => setMenuOpen(menuOpen === 'user' ? false : 'user')} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px 4px 4px', borderRadius: 10,
                border: '1.5px solid #E8E6F5', background: '#EEEDFE', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#534AB7',
              }}>
                <div style={{ width: 28, height: 28, borderRadius: 14, overflow: 'hidden', flexShrink: 0, background: user.gender === 'Male' ? '#534AB7' : '#E11D48', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', fontWeight: 800 }}>
                  {user.profile_photo_url
                    ? <img src={user.profile_photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : (user.name || '?').charAt(0).toUpperCase()}
                </div>
                ▾
              </button>
              {menuOpen === 'user' && (
                <div style={{ position: 'absolute', right: 0, top: '110%', background: '#fff', border: '1px solid #E8E6F5', borderRadius: 12, padding: '6px', minWidth: 160, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 200 }}>
                  <Link href="/my-profile" onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '9px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#1A1830', textDecoration: 'none' }}>My Profile</Link>
                  <button onClick={openPasswordModal} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#1A1830', background: 'none', border: 'none', cursor: 'pointer' }}>Change Password</button>
                  <button onClick={handleLogout} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer' }}>Logout</button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/login" style={{ textDecoration: 'none', padding: '7px 12px', borderRadius: 10, color: '#1A1830', fontSize: 13, fontWeight: 700, border: '1.5px solid #E8E6F5' }}>Login</Link>
              <Link href="/register" style={{ textDecoration: 'none', padding: '7px 14px', borderRadius: 10, background: '#534AB7', color: '#fff', fontSize: 13, fontWeight: 700 }}>Register</Link>
            </>
          ))}

          {/* Hamburger dropdown — Browse & Plans */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setMenuOpen(menuOpen === 'nav' ? false : 'nav')} style={{
              display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 5,
              width: 36, height: 36, borderRadius: 10, border: '1.5px solid #E8E6F5',
              background: menuOpen === 'nav' ? '#EEEDFE' : '#fff', cursor: 'pointer', padding: 0,
            }}>
              <span style={{ display: 'block', width: 16, height: 2, background: '#534AB7', borderRadius: 2 }} />
              <span style={{ display: 'block', width: 16, height: 2, background: '#534AB7', borderRadius: 2 }} />
              <span style={{ display: 'block', width: 16, height: 2, background: '#534AB7', borderRadius: 2 }} />
            </button>
            {menuOpen === 'nav' && (
              <div style={{ position: 'absolute', right: 0, top: '110%', background: '#fff', border: '1px solid #E8E6F5', borderRadius: 12, padding: '6px', minWidth: 160, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 200 }}>
                <Link href="/proposals" onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '9px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#534AB7', textDecoration: 'none', background: pathname.startsWith('/proposals') ? '#EEEDFE' : 'transparent' }}>Browse Proposals</Link>
                <Link href="/plans" onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '9px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#534AB7', textDecoration: 'none', background: pathname.startsWith('/plans') ? '#EEEDFE' : 'transparent' }}>Plans</Link>
              </div>
            )}
          </div>

        </div>
      </div>
      <div className="nav-gradient-bar" />
    </nav>
  );

  return (
    <>
      {navContent}
      {mounted && showPasswordModal && createPortal(
        <div onClick={() => setShowPasswordModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 380, padding: 24 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#1A1830', marginBottom: 16 }}>Change Password</div>
            <PasswordInput
              placeholder="Current password"
              value={currentPassword}
              onChange={e => { setCurrentPassword(e.target.value); setPasswordError(''); setPasswordSuccess(''); }}
              autoFocus
              style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #E8E6F5', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 10 }}
            />
            <PasswordInput
              placeholder="New password"
              value={newPassword}
              onChange={e => { setNewPassword(e.target.value); setPasswordError(''); setPasswordSuccess(''); }}
              style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #E8E6F5', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 10 }}
            />
            <PasswordInput
              placeholder="Confirm new password"
              value={confirmNewPassword}
              onChange={e => { setConfirmNewPassword(e.target.value); setPasswordError(''); setPasswordSuccess(''); }}
              style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #E8E6F5', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 6 }}
            />
            {passwordError && <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 10 }}>{passwordError}</div>}
            {passwordSuccess && <div style={{ fontSize: 12, color: '#16A34A', marginBottom: 10 }}>{passwordSuccess}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button onClick={() => setShowPasswordModal(false)} style={{ flex: 1, padding: '11px', borderRadius: 12, border: '1.5px solid #E8E6F5', background: '#fff', color: '#6B6893', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                {passwordSuccess ? 'Close' : 'Cancel'}
              </button>
              <button disabled={passwordSaving} onClick={handleChangePassword}
                style={{ flex: 2, padding: '11px', borderRadius: 12, border: 'none', background: passwordSaving ? '#F5F5F5' : '#534AB7', color: passwordSaving ? '#68629C' : '#fff', fontWeight: 800, fontSize: 14, cursor: passwordSaving ? 'not-allowed' : 'pointer' }}>
                {passwordSaving ? 'Saving…' : 'Update Password'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
