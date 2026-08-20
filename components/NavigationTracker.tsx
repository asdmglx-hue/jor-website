'use client';
import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { trackPageView } from '@/lib/analytics';

// Fires a GA4 page_view on every client-side navigation.
// See lib/analytics.ts → trackPageView for the full explanation of why
// this is required and what breaks without it.
//
// Uses both pathname AND searchParams so filter changes on /proposals
// (e.g. ?city=Lahore) also register as meaningful navigation events,
// giving accurate data on which cities/filters users search most.
export default function NavigationTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip the very first render — GA4's own snippet already fires
    // page_view on the initial page load. Only track subsequent SPA
    // navigations so we don't double-count the landing page.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const url = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');
    trackPageView(window.location.origin + url);
  }, [pathname, searchParams]);

  return null;
}
