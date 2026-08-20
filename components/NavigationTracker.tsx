'use client';
import { Suspense, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { trackPageView } from '@/lib/analytics';

// useSearchParams() requires a Suspense boundary during SSR/static generation.
// We split into two components: the outer one exported from this file wraps
// the inner one in <Suspense> so the build never errors on /_not-found or
// any other statically pre-rendered page.

function Tracker() {
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

export default function NavigationTracker() {
  // null fallback: this component renders nothing visible — the Suspense
  // boundary is purely here to satisfy Next.js's static generation requirement.
  return (
    <Suspense fallback={null}>
      <Tracker />
    </Suspense>
  );
}
