'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSession } from '@/lib/auth';

export default function PostRishtaButton({ variant }: { variant: 'hero' | 'cta' }) {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(!!getSession());
  }, []);

  if (loggedIn) return null;

  if (variant === 'hero') return (
    <Link href="/submit" style={{
      padding: '14px 32px', borderRadius: 14, background: 'rgba(255,255,255,0.15)',
      color: '#fff', fontWeight: 700, fontSize: 16, textDecoration: 'none',
      border: '1.5px solid rgba(255,255,255,0.4)',
    }}>Post Your Rishta</Link>
  );

  return (
    <Link href="/submit" style={{
      display: 'inline-block', marginTop: 36, padding: '14px 36px', borderRadius: 14,
      background: '#534AB7', color: '#fff', fontWeight: 800, fontSize: 16, textDecoration: 'none',
      boxShadow: '0 4px 16px rgba(83,74,183,0.3)',
    }}>Post Your Rishta →</Link>
  );
}
