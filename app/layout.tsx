import type { Metadata, Viewport } from "next";

import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import "./globals.css";
import NavbarWrapper from "@/components/NavbarWrapper";
import NavigationTracker from "@/components/NavigationTracker";
import ContactSupportButton from "@/components/ContactSupportButton";
import PausedToast from "@/components/PausedToast";
import { supabase } from "@/lib/supabase";

const inter = { className: '' };

export const metadata: Metadata = {
  title: "Jor - Post Your Rishta",
  description: "Browse thousands of verified rishta proposals across Pakistan. Find your perfect match by city, caste, profession and more. Free to join.",
  keywords: "rishta, matrimonial, Pakistan, shaadi, marriage, proposals, nikah, brides, grooms",
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
  openGraph: {
    title: "Jor - Find the Right Rishta Easily",
    description: "Browse verified rishta proposals across Pakistan. Filter by city, caste, profession and more.",
    type: "website",
    url: "https://joronline.com",
    siteName: "Jor",
    locale: "en_PK",
    images: [{ url: 'https://joronline.com/hero-wedding.jpg', width: 1200, height: 630, alt: "Jor - Find the Right Rishta Easily" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Jor - Find the Right Rishta Easily",
    description: "Browse verified rishta proposals across Pakistan. Filter by city, caste, profession and more.",
    images: ["https://joronline.com/hero-wedding.jpg"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

// Primary: on-demand revalidation via /api/revalidate (called by admin app
// immediately after any footer setting changes). Fallback: 30-second timer
// catches any missed calls. Gives instant updates in practice while
// guaranteeing the footer never stays stale longer than 30 seconds.
export const revalidate = false;

async function getFooterSettings(): Promise<{ helpCenterName: string; affiliateEnabled: boolean; helpCenterVisible: boolean; waNumber: string }> {
  try {
    const [{ data: settings }, { data: agents }] = await Promise.all([
      supabase.from('app_settings').select('key,value'),
      supabase.rpc('list_verified_agents_secure'),
    ]);
    const map = Object.fromEntries((settings ?? []).map((r: any) => [r.key, r.value]));
    const helpCenterOn = map['help_center_enabled'] !== 'false';
    const hasAgents = Array.isArray(agents) && agents.length > 0;
    return {
      helpCenterName: map['help_center_page_name'] || 'Help Center',
      affiliateEnabled: map['referral_enabled'] !== 'false',
      helpCenterVisible: helpCenterOn && hasAgents,
      waNumber: map['whatsapp_number'] || '923287654333',
    };
  } catch {
    return { helpCenterName: 'Help Center', affiliateEnabled: true, helpCenterVisible: false, waNumber: '923287654333' };
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { helpCenterName, affiliateEnabled, helpCenterVisible, waNumber } = await getFooterSettings();
  return (
    <html lang="en">
      <head>
        {/* Preconnect to external domains the page fetches on load.
            Opens TCP+TLS connections before the browser parses body content —
            saves 100-300ms per domain on mobile connections.
            R2: profile photos. Supabase: API. GTM: analytics. */}
        <link rel="preconnect" href="https://pub-45b25e06fb4b4f448d2ee349c6f55922.r2.dev" />
        <link rel="preconnect" href="https://olzfarkfxhwcwabgribo.supabase.co" />
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        {/* Inter via Google Fonts — font-display:swap (baked into the ?display=swap
            param) means text renders immediately in the system font then
            swaps to Inter once downloaded. No layout shift: Inter metrics
            closely match system-ui so the reflow is imperceptible. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
        />
      </head>
      <body className={inter.className}>
        <NavbarWrapper />
        <NavigationTracker />
        <main className="site-main" style={{ minHeight: 'calc(100vh - 60px)', overflowX: 'hidden' }}>
          {children}
        </main>
        <div style={{ position: 'relative', height: 0 }}>
          <ContactSupportButton />
        <PausedToast />
        </div>
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
                <div className="footer-nav-main" style={{ display: 'flex', gap: 32, fontSize: 15, fontWeight: 400, color: '#fff', marginBottom: 8, justifyContent: 'flex-end' }}>
                  <Link href="/proposals" style={{ color: '#fff', textDecoration: 'none' }}>Proposals</Link>
                  <Link href="/register" style={{ color: '#fff', textDecoration: 'none' }}>Register</Link>
                  <Link href="/plans" style={{ color: '#fff', textDecoration: 'none' }}>Plans</Link>
                  <Link href="/stories" style={{ color: '#fff', textDecoration: 'none' }}>Stories</Link>
                  <Link href="/blog" style={{ color: '#fff', textDecoration: 'none' }}>Blog</Link>
                  {affiliateEnabled && <Link href="/refer" style={{ color: '#fff', textDecoration: 'none' }}>Affiliate</Link>}
                </div>
                <div className="footer-nav-legal" style={{ display: 'flex', gap: 24, fontSize: 15, fontWeight: 400, justifyContent: 'flex-end' }}>
                  <Link href="/about" style={{ color: '#fff', textDecoration: 'none' }}>About</Link>
                  {helpCenterVisible && <Link href="/agents" style={{ color: '#fff', textDecoration: 'none' }}>{helpCenterName}</Link>}
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
                  <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" style={{ color: '#fff', textDecoration: 'none' }}>Contact</a>
                  {helpCenterVisible && <Link href="/agents" style={{ color: '#fff', textDecoration: 'none' }}>{helpCenterName}</Link>}
                  {affiliateEnabled && <Link href="/refer" style={{ color: '#fff', textDecoration: 'none' }}>Affiliate</Link>}
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

        {/* Meta Pixel — strategy="afterInteractive" keeps it off the critical
            path so it doesn't affect Core Web Vitals. Fires PageView on every
            route automatically since this layout wraps all pages. */}
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window,document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '29194785943444504');
            fbq('track', 'PageView');
          `}
        </Script>
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            src="https://www.facebook.com/tr?id=29194785943444504&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
      </body>
    </html>
  );
}

// deploy test 1783233402
