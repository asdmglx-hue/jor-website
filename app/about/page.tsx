import type { Metadata } from 'next';
import Link from 'next/link';
import AboutCta from '@/components/AboutCta';

export const metadata: Metadata = {
  title: 'About Jor | Pakistan\'s Trusted Matrimonial Platform',
  description: 'Learn about Jor — a trusted matrimonial platform connecting families across Pakistan with verified rishta proposals.',
  alternates: { canonical: 'https://joronline.com/about' },
};

const features = [
  {
    color: '#0F6E56', bg: '#E1F5EE', title: 'Verified Profiles', desc: 'We verify CNIC before posting',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  },
  {
    color: '#534AB7', bg: '#EEEDFE', title: 'See All Contacts', desc: 'Phone numbers unlocked instantly',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 11.9a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.06 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16v.92z"/></svg>,
  },
  {
    color: '#E8620A', bg: '#FEEDE3', title: 'Privacy Protected', desc: 'Photos & phones hidden from visitors',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E8620A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  },
  {
    color: '#E11D48', bg: '#FEE2E2', title: 'Easy Deletion', desc: 'Delete your profile anytime',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E11D48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
  },
];

const values = [
  {
    title: 'Trust First', desc: 'Every proposal goes through a review before it goes live. We don\'t just list people — we verify them.',
    icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  },
  {
    title: 'Built for Pakistan', desc: 'Designed for Pakistani families with local values, local cities, and fields like caste, sect, and practice level.',
    icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  },
  {
    title: 'Privacy by Default', desc: 'Contact numbers and photos are hidden from visitors. Only verified subscribers can see sensitive information.',
    icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  },
  {
    title: 'Simple & Honest Pricing', desc: 'One flat subscription. No hidden charges, no per-message fees, no premium gimmicks.',
    icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  },
];

export default function AboutPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 20px' }}>

      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-icon.png" alt="Jor" style={{ height: 72, width: 'auto', display: 'block', margin: '0 auto 16px' }} />
        <h1 style={{ fontSize: 36, fontWeight: 900, color: '#1A1830', marginBottom: 12 }}>About Jor</h1>
        <p style={{ fontSize: 16, color: '#6B6893', lineHeight: 1.7, maxWidth: 560, margin: '0 auto' }}>
          Jor is Pakistan&apos;s trusted matrimonial platform — connecting families with verified rishta proposals across every city and province.
        </p>
      </div>

      {/* Mission */}
      <div style={{ background: 'linear-gradient(135deg, #534AB7, #3D35A0)', borderRadius: 20, padding: '32px', marginBottom: 32, color: '#fff' }}>
        <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 12 }}>Our Mission</h2>
        <p style={{ fontSize: 15, lineHeight: 1.8, color: '#D4D1F7' }}>
          Finding a life partner is one of the most important decisions a family makes. We built Jor to make that process simple, safe, and dignified — free from middlemen, fake profiles, and hidden costs. Every proposal on Jor is reviewed by a real person before it goes live.
        </p>
      </div>

      {/* Why Jor */}
      <div style={{ background: '#fff', border: '1px solid #E8E6F5', borderRadius: 20, padding: '28px', marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1A1830', marginBottom: 20 }}>Why Jor?</h2>
        {features.map((f, i) => (
          <div key={f.title} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: i < features.length - 1 ? '1px solid #F5F5F5' : 'none' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{f.icon}</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#1A1830' }}>{f.title}</div>
              <div style={{ fontSize: 13, color: '#6B6893', marginTop: 2 }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Values */}
      <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1A1830', marginBottom: 16 }}>What We Stand For</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16, marginBottom: 32 }}>
        {values.map(v => (
          <div key={v.title} style={{ background: '#fff', border: '1px solid #E8E6F5', borderRadius: 16, padding: '20px' }}>
            <div style={{ marginBottom: 10 }}>{v.icon}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1A1830', marginBottom: 6 }}>{v.title}</div>
            <div style={{ fontSize: 13, color: '#6B6893', lineHeight: 1.6 }}>{v.desc}</div>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div style={{ background: '#FAF9FF', border: '1px solid #E8E6F5', borderRadius: 20, padding: '28px', marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1A1830', marginBottom: 20 }}>How It Works</h2>
        {[
          { step: '1', title: 'Post Your Rishta', desc: 'Fill out a detailed profile through the Jor app. Reviewed within 24 hours.' },
          { step: '2', title: 'Subscribe to Browse', desc: 'Get a subscription to unlock contact numbers, photos, and advanced filters.' },
          { step: '3', title: 'Connect Directly', desc: 'Contact the family directly — no middleman, no hidden fees.' },
        ].map(item => (
          <div key={item.step} style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#534AB7', color: '#fff', fontSize: 15, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{item.step}</div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#1A1830' }}>{item.title}</div>
              <div style={{ fontSize: 13, color: '#6B6893', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <AboutCta />
    </div>
  );
}
