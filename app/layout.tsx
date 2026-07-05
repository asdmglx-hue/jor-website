import type { Metadata, Viewport } from "next";

import Image from "next/image";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

const inter = { className: '' };

export const metadata: Metadata = {
  title: "Jor – Pakistan's Trusted Matrimonial Platform",
  description: "Browse thousands of verified rishta proposals across Pakistan. Find your perfect match by city, caste, profession and more. Free to join.",
  keywords: "rishta, matrimonial, Pakistan, shaadi, marriage, proposals, nikah, brides, grooms",
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
  openGraph: {
    title: "Jor – Pakistan's Trusted Matrimonial Platform",
    description: "Browse verified rishta proposals across Pakistan. Filter by city, caste, profession and more.",
    type: "website",
    locale: "en_PK",
    images: [{ url: 'https://joronline.com/hero-wedding.jpg', width: 1200, height: 630, alt: "Jor – Pakistan's Trusted Matrimonial Platform" }],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let waNumber = '923287654333';
  try {
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'whatsapp_number').single();
    if (data) waNumber = (data as { value: string }).value;
  } catch (_) {}
  return (
    <html lang="en">
      <body className={inter.className}>
        <Navbar />
        <main className="site-main" style={{ minHeight: 'calc(100vh - 60px)' }}>
          {children}
        </main>
        <footer className="site-footer" style={{ background: '#1A1830', color: '#B0ADCB', padding: '28px 48px 40px', marginTop: 48, position: 'relative', overflow: 'hidden' }}>
          {/* Background wedding image at very low opacity */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/footer-wedding.jpg" alt="" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', opacity: 0.07, pointerEvents: 'none' }} />

          <div className="footer-wrap" style={{ position: 'relative', maxWidth: 1200, margin: '0 auto' }}>

            {/* Top row: logo left, nav right — same level */}
            <div className="footer-top-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>

              {/* Left: logo */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-footer.png" alt="Jor" style={{ height: 90, width: 160, objectFit: 'contain', objectPosition: 'left center', marginLeft: -18, transform: 'scale(0.8)', transformOrigin: 'left center' }} />

              {/* Right: nav links stacked — desktop only */}
              <div className="footer-nav-right footer-nav-desktop" style={{ textAlign: 'right' }}>
                <div className="footer-nav-main" style={{ display: 'flex', gap: 32, fontSize: 15, fontWeight: 500, color: '#fff', marginBottom: 8, justifyContent: 'flex-end' }}>
                  <a href="/proposals" style={{ color: '#fff', textDecoration: 'none' }}>Browse Proposals</a>
                  <a href="/register" style={{ color: '#fff', textDecoration: 'none' }}>Register</a>
                  <a href="/plans" style={{ color: '#fff', textDecoration: 'none' }}>Plans</a>
                  <a href="/about" style={{ color: '#fff', textDecoration: 'none' }}>About</a>
                  <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" style={{ color: '#fff', textDecoration: 'none' }}>Contact</a>
                  <a href="/refer" style={{ color: '#fff', textDecoration: 'none' }}>Affiliate</a>
                </div>
                <div className="footer-nav-legal" style={{ display: 'flex', gap: 24, fontSize: 14, justifyContent: 'flex-end' }}>
                  <a href="/privacy-policy" style={{ color: '#6B6893', textDecoration: 'none' }}>Privacy Policy</a>
                  <a href="/terms" style={{ color: '#6B6893', textDecoration: 'none' }}>Terms of Service</a>
                </div>
              </div>
            </div>

            {/* Tagline below logo */}
            <p className="footer-tagline" style={{ fontSize: 20, fontWeight: 400, color: '#fff', margin: '8px 0 24px', lineHeight: 1.4 }}>
              Pakistan&apos;s Trusted<br />Matrimonial Platform
            </p>

            {/* Bottom row: app badges left, payment + copyright right */}
            <div className="footer-bottom-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>

              {/* App badges */}
              <div className="footer-app-badges" style={{ display: 'flex', gap: 12 }}>
                <a href="/get-android" style={{ display: 'inline-block' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/google_play.png" alt="Get it on Google Play" style={{ height: 32, width: 'auto' }} />
                </a>
                <a href="/get-ios" style={{ display: 'inline-block' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/app_store.png" alt="Download on App Store" style={{ height: 32, width: 'auto' }} />
                </a>
              </div>

              {/* Nav links — mobile only, shown after app badges */}
              <div className="footer-nav-mobile-copy">
                <div style={{ display: 'flex', gap: 14, fontSize: 14, fontWeight: 500, color: '#fff', marginBottom: 8 }}>
                  <a href="/proposals" style={{ color: '#fff', textDecoration: 'none' }}>Browse Proposals</a>
                  <a href="/register" style={{ color: '#fff', textDecoration: 'none' }}>Register</a>
                  <a href="/plans" style={{ color: '#fff', textDecoration: 'none' }}>Plans</a>
                </div>
                <div style={{ display: 'flex', gap: 14, fontSize: 14, fontWeight: 500, color: '#fff', marginBottom: 10 }}>
                  <a href="/about" style={{ color: '#fff', textDecoration: 'none' }}>About</a>
                  <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" style={{ color: '#fff', textDecoration: 'none' }}>Contact</a>
                  <a href="/refer" style={{ color: '#fff', textDecoration: 'none' }}>Affiliate</a>
                </div>
                <div style={{ display: 'flex', gap: 20, fontSize: 13, marginBottom: 24 }}>
                  <a href="/privacy-policy" style={{ color: '#6B6893', textDecoration: 'none' }}>Privacy Policy</a>
                  <a href="/terms" style={{ color: '#6B6893', textDecoration: 'none' }}>Terms of Service</a>
                </div>
              </div>

              {/* Payment logos + copyright */}
              <div className="footer-payment" style={{ textAlign: 'right' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/payment-methods.png" alt="JazzCash, EasyPaisa, Visa, Mastercard" style={{ height: 36, width: 'auto', display: 'block', marginLeft: 'auto', marginBottom: 4 }} />
                <p style={{ fontSize: 13, color: '#6B6893', margin: 0, textAlign: 'right' }}>© 2026 Jor. All rights reserved.</p>
              </div>

            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

// deploy test 1783233402
