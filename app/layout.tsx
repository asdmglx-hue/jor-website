import type { Metadata, Viewport } from "next";

import Image from "next/image";
import "./globals.css";
import Navbar from "@/components/Navbar";
import FooterWhatsAppLink from "@/components/FooterWhatsAppLink";

const inter = { className: '' };

export const metadata: Metadata = {
  title: "Jor – Pakistan's Trusted Matrimonial Platform",
  description: "Browse thousands of verified rishta proposals across Pakistan. Find your perfect match by city, caste, profession and more. Free to join.",
  keywords: "rishta, matrimonial, Pakistan, shaadi, marriage, proposals, nikah, brides, grooms",
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      // Google Search's own favicon guidance recommends a favicon larger
      // than 48x48px for best display quality across surfaces — without
      // this, the largest icon Google could find on the page was 32x32.
      { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
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

              {/* Right: nav links grouped into columns — desktop only.
                  Was one long row of 8 links, which got cramped once
                  Stories and Blog were added. Grouped by what each link
                  actually is (content to browse / account actions /
                  company info) instead of one flat list. Mobile keeps
                  its own separate, unchanged block further down. */}
              <div className="footer-nav-right footer-nav-desktop" style={{ textAlign: 'right' }}>
                <div className="footer-nav-groups" style={{ display: 'flex', gap: 40, justifyContent: 'flex-end', marginBottom: 4 }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#6B6893', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Explore</div>
                    <a href="/proposals" style={{ display: 'block', color: '#fff', textDecoration: 'none', fontSize: 14.5, fontWeight: 500, marginBottom: 10 }}>Proposals</a>
                    <a href="/stories" style={{ display: 'block', color: '#fff', textDecoration: 'none', fontSize: 14.5, fontWeight: 500, marginBottom: 10 }}>Stories</a>
                    <a href="/blog" style={{ display: 'block', color: '#fff', textDecoration: 'none', fontSize: 14.5, fontWeight: 500 }}>Blog</a>
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#6B6893', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Account</div>
                    <a href="/register" style={{ display: 'block', color: '#fff', textDecoration: 'none', fontSize: 14.5, fontWeight: 500, marginBottom: 10 }}>Register</a>
                    <a href="/plans" style={{ display: 'block', color: '#fff', textDecoration: 'none', fontSize: 14.5, fontWeight: 500, marginBottom: 10 }}>Plans</a>
                    <a href="/refer" style={{ display: 'block', color: '#fff', textDecoration: 'none', fontSize: 14.5, fontWeight: 500 }}>Affiliate</a>
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#6B6893', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Company</div>
                    <a href="/about" style={{ display: 'block', color: '#fff', textDecoration: 'none', fontSize: 14.5, fontWeight: 500, marginBottom: 10 }}>About</a>
                    <FooterWhatsAppLink>Contact</FooterWhatsAppLink>
                  </div>
                </div>
                <div className="footer-nav-legal" style={{ display: 'flex', gap: 24, fontSize: 14, justifyContent: 'flex-end', marginTop: 20 }}>
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
                  <a href="/proposals" style={{ color: '#fff', textDecoration: 'none' }}>Proposals</a>
                  <a href="/register" style={{ color: '#fff', textDecoration: 'none' }}>Register</a>
                  <a href="/plans" style={{ color: '#fff', textDecoration: 'none' }}>Plans</a>
                  <a href="/stories" style={{ color: '#fff', textDecoration: 'none' }}>Stories</a>
                  <a href="/blog" style={{ color: '#fff', textDecoration: 'none' }}>Blog</a>
                </div>
                <div style={{ display: 'flex', gap: 14, fontSize: 14, fontWeight: 500, color: '#fff', marginBottom: 10 }}>
                  <a href="/about" style={{ color: '#fff', textDecoration: 'none' }}>About</a>
                  <FooterWhatsAppLink>Contact</FooterWhatsAppLink>
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
