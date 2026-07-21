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
