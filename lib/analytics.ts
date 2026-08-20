declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Fires a GA4 event, safely. Never throws — if gtag isn't loaded (blocked,
 * not yet initialized, or GA simply isn't configured), this just does
 * nothing rather than breaking whatever flow called it.
 */
export function trackEvent(eventName: string, params?: Record<string, string | number | boolean>) {
  try {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', eventName, params);
    }
  } catch {
    // Analytics should never be able to break a real user flow.
  }
}

/**
 * Fires a GA4 page_view event for the current URL.
 *
 * WHY THIS IS NEEDED:
 * Next.js is a Single Page Application (SPA) — after the first load,
 * navigation between pages happens in JavaScript without a full browser
 * reload. GA4's gtag snippet only fires automatically on the FIRST page load.
 * For every subsequent client-side navigation (clicking Browse Proposals,
 * opening a profile, going to Plans, etc.), GA4 never sees a page_view
 * unless we tell it manually.
 *
 * Without this, GA4 records every user as a "single page" session, which:
 *   - Makes bounce rate look artificially high (everyone "bounces")
 *   - Makes average session duration look too low
 *   - Hides which pages users actually visit after the first one
 *   - Breaks the "Pages and screens" report accuracy
 *
 * This function is called from the NavigationTracker component (in layout.tsx)
 * on every pathname change — matching exactly what a page reload would do.
 */
export function trackPageView(url: string) {
  try {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', {
        page_location: url,
        page_title: document.title,
      });
    }
  } catch {
    // Never break navigation over analytics.
  }
}
