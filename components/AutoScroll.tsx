'use client';
import { useEffect } from 'react';

// After 10 seconds of no user activity on the homepage,
// smoothly scrolls down to the Browse by Location section.
// Only runs for first-time visitors — returning visitors are not interrupted.
export default function AutoScroll() {
  useEffect(() => {
    // Skip for returning visitors
    if (localStorage.getItem('jor_visited')) return;

    let timer: ReturnType<typeof setTimeout>;
    let scrolled = false;

    const doScroll = () => {
      if (scrolled) return;
      scrolled = true;
      const section = document.getElementById('browse-by-location');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      // Mark as visited so it never runs again
      localStorage.setItem('jor_visited', '1');
      cleanup();
    };

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(doScroll, 10000);
    };

    const cleanup = () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, onActivity));
      window.removeEventListener('scroll', onScroll);
    };

    const onActivity = () => {
      // Any activity resets timer
      resetTimer();
    };

    const onScroll = () => {
      // If user scrolls manually — cancel auto-scroll and mark visited
      if (!scrolled) {
        localStorage.setItem('jor_visited', '1');
        cleanup();
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'click'];
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    window.addEventListener('scroll', onScroll, { passive: true });

    // Start timer
    resetTimer();

    return cleanup;
  }, []);

  return null;
}
