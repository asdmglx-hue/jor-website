import type { Metadata, Viewport } from "next";

import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
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
      { url: '/favicon.svg', type: 'image/svg+xml' },
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
          <Image src="/footer-wedding.jpg" alt="" aria-hidden="true" fill sizes="100vw" style={{ objectFit: 'cover', objectPosition: 'center', opacity: 0.07, pointerEvents: 'none' }} />

          <div className="footer-wrap" style={{ position: 'relative', maxWidth: 1200, margin: '0 auto' }}>

            {/* Top row: logo left, nav right — same level */}
            <div className="footer-top-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>

              {/* Left: logo */}
              <Image src="/logo-footer.png" alt="Jor" width={601} height={415} style={{ height: 90, width: 160, objectFit: 'contain', objectPosition: 'left center', marginLeft: -18, transform: 'scale(0.8)', transformOrigin: 'left center' }} />

              {/* Right: nav links stacked — desktop only */}
              <div className="footer-nav-right footer-nav-desktop" style={{ textAlign: 'right' }}>
                <div className="footer-nav-main" style={{ display: 'flex', gap: 32, fontSize: 15, fontWeight: 500, color: '#fff', marginBottom: 8, justifyContent: 'flex-end' }}>
                  <Link href="/proposals" style={{ color: '#fff', textDecoration: 'none' }}>Proposals</Link>
                  <Link href="/register" style={{ color: '#fff', textDecoration: 'none' }}>Register</Link>
                  <Link href="/plans" style={{ color: '#fff', textDecoration: 'none' }}>Plans</Link>
                  <Link href="/stories" style={{ color: '#fff', textDecoration: 'none' }}>Stories</Link>
                  <Link href="/blog" style={{ color: '#fff', textDecoration: 'none' }}>Blog</Link>
                  <Link href="/refer" style={{ color: '#fff', textDecoration: 'none' }}>Affiliate</Link>
                </div>
                <div className="footer-nav-legal" style={{ display: 'flex', gap: 24, fontSize: 15, fontWeight: 500, justifyContent: 'flex-end' }}>
                  <Link href="/about" style={{ color: '#fff', textDecoration: 'none' }}>About</Link>
                  <FooterWhatsAppLink>Contact</FooterWhatsAppLink>
                  <Link href="/privacy-policy" style={{ color: '#fff', textDecoration: 'none' }}>Privacy Policy</Link>
                  <Link href="/terms" style={{ color: '#fff', textDecoration: 'none' }}>Terms of Service</Link>
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
                <Link href="/get-android" style={{ display: 'inline-block' }}>
                  <Image src="/google_play.png" alt="Get it on Google Play" width={715} height={218} style={{ height: 32, width: 'auto' }} />
                </Link>
                <Link href="/get-ios" style={{ display: 'inline-block' }}>
                  <Image src="/app_store.png" alt="Download on App Store" width={715} height={218} style={{ height: 32, width: 'auto' }} />
                </Link>
              </div>

              {/* Nav links — mobile only, shown after app badges */}
              <div className="footer-nav-mobile-copy">
                <div style={{ display: 'flex', gap: 14, fontSize: 14, fontWeight: 500, color: '#fff', marginBottom: 8 }}>
                  <Link href="/proposals" style={{ color: '#fff', textDecoration: 'none' }}>Proposals</Link>
                  <Link href="/register" style={{ color: '#fff', textDecoration: 'none' }}>Register</Link>
                  <Link href="/plans" style={{ color: '#fff', textDecoration: 'none' }}>Plans</Link>
                  <Link href="/stories" style={{ color: '#fff', textDecoration: 'none' }}>Stories</Link>
                  <Link href="/blog" style={{ color: '#fff', textDecoration: 'none' }}>Blog</Link>
                </div>
                <div style={{ display: 'flex', gap: 14, fontSize: 14, fontWeight: 500, color: '#fff', marginBottom: 10 }}>
                  <Link href="/about" style={{ color: '#fff', textDecoration: 'none' }}>About</Link>
                  <FooterWhatsAppLink>Contact</FooterWhatsAppLink>
                  <Link href="/refer" style={{ color: '#fff', textDecoration: 'none' }}>Affiliate</Link>
                </div>
                <div style={{ display: 'flex', gap: 20, fontSize: 13, marginBottom: 24 }}>
                  <Link href="/privacy-policy" style={{ color: '#6B6893', textDecoration: 'none' }}>Privacy Policy</Link>
                  <Link href="/terms" style={{ color: '#6B6893', textDecoration: 'none' }}>Terms of Service</Link>
                </div>
              </div>

              {/* Payment logos + copyright */}
              <div className="footer-payment" style={{ textAlign: 'right' }}>
                <Image src="/payment-methods.png" alt="JazzCash, EasyPaisa, Visa, Mastercard" width={3573} height={393} style={{ height: 36, width: 'auto', display: 'block', marginLeft: 'auto', marginBottom: 4 }} />
                <p style={{ fontSize: 13, color: '#6B6893', margin: 0, textAlign: 'right' }}>© 2026 Jor. All rights reserved.</p>
              </div>

            </div>
          </div>
        </footer>

        {/* Google Analytics 4 — only loads if NEXT_PUBLIC_GA_MEASUREMENT_ID
            is set (in Cloudflare's environment variables), so this is safe
            to deploy before that's configured. strategy="afterInteractive"
            loads it after the page is already interactive, so it doesn't
            slow down the initial page render/Core Web Vitals. */}
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}');
              `}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}

// deploy test 1783233402
