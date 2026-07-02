import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Jor – Pakistan's Trusted Matrimonial Platform",
  description: "Browse thousands of verified rishta proposals across Pakistan. Find your perfect match by city, caste, profession and more. Free to join.",
  keywords: "rishta, matrimonial, Pakistan, shaadi, marriage, proposals, nikah, brides, grooms",
  openGraph: {
    title: "Jor – Pakistan's Trusted Matrimonial Platform",
    description: "Browse verified rishta proposals across Pakistan. Filter by city, caste, profession and more.",
    type: "website",
    locale: "en_PK",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Navbar />
        <main style={{ minHeight: 'calc(100vh - 60px)' }}>
          {children}
        </main>
        <footer style={{ background: '#1A1830', color: '#B0ADCB', padding: '28px 48px 40px', marginTop: 48, position: 'relative', overflow: 'hidden' }}>
          {/* Background wedding image at very low opacity */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/footer-wedding.jpg" alt="" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', opacity: 0.07, pointerEvents: 'none' }} />

          <div style={{ position: 'relative', maxWidth: 1200, margin: '0 auto' }}>

            {/* Top row: logo left, nav right — same level */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>

              {/* Left: logo */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-footer.png" alt="Jor" style={{ height: 90, width: 160, objectFit: 'contain', objectPosition: 'left center', marginLeft: -18, transform: 'scale(0.8)', transformOrigin: 'left center' }} />

              {/* Right: nav links stacked */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'flex', gap: 24, fontSize: 15, fontWeight: 500, color: '#fff', marginBottom: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <a href="/proposals" style={{ color: '#fff', textDecoration: 'none' }}>Browse Proposals</a>
                  <a href="/register" style={{ color: '#fff', textDecoration: 'none' }}>Post Rishta</a>
                  <a href="/plans" style={{ color: '#fff', textDecoration: 'none' }}>Plans</a>
                  <a href="/about" style={{ color: '#fff', textDecoration: 'none' }}>About</a>
                  <a href="/refer" style={{ color: '#fff', textDecoration: 'none' }}>Refer & Earn</a>
                  <a href="https://wa.me/923287654333" target="_blank" rel="noopener noreferrer" style={{ color: '#fff', textDecoration: 'none' }}>Contact</a>
                </div>
                <div style={{ display: 'flex', gap: 24, fontSize: 14, justifyContent: 'flex-end' }}>
                  <a href="/privacy-policy" style={{ color: '#6B6893', textDecoration: 'none' }}>Privacy Policy</a>
                  <a href="/terms" style={{ color: '#6B6893', textDecoration: 'none' }}>Terms of Service</a>
                </div>
              </div>
            </div>

            {/* Tagline below logo */}
            <p style={{ fontSize: 20, fontWeight: 400, color: '#fff', margin: '8px 0 24px', lineHeight: 1.4 }}>
              Pakistan&apos;s Trusted<br />Matrimonial Platform
            </p>

            {/* Bottom row: app badges left, payment + copyright right */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>

              {/* App badges */}
              <div style={{ display: 'flex', gap: 12 }}>
                <a href="#" style={{ display: 'inline-block' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/google_play.png" alt="Get it on Google Play" style={{ height: 32, width: 'auto' }} />
                </a>
                <a href="#" style={{ display: 'inline-block' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/app_store.png" alt="Download on App Store" style={{ height: 32, width: 'auto' }} />
                </a>
              </div>

              {/* Payment logos + copyright */}
              <div style={{ textAlign: 'right' }}>
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
