'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSession } from '@/lib/auth';

export default function AboutCta() {
  const [loggedIn, setLoggedIn] = useState(false);
  useEffect(() => { setLoggedIn(!!getSession()); }, []);

  return (
    <div style={{ textAlign: 'center', background: '#EEEDFE', borderRadius: 20, padding: '32px' }}>
      <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1A1830', marginBottom: 8 }}>Ready to find your match?</h2>
      <p style={{ fontSize: 14, color: '#6B6893', marginBottom: 20 }}>Join thousands of families who trust Jor for their matrimonial needs.</p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href="/proposals" style={{ padding: '12px 24px', borderRadius: 12, background: '#534AB7', color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>Browse Proposals</Link>
        {!loggedIn && (
          <Link href="/submit" style={{ padding: '12px 24px', borderRadius: 12, background: '#fff', border: '1.5px solid #534AB7', color: '#534AB7', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>Post a Rishta</Link>
        )}
      </div>
    </div>
  );
}
