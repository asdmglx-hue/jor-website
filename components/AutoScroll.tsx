'use client';
import { useEffect } from 'react';

// After 10 seconds of no user activity on the homepage,
// smoothly scrolls down to the Browse by Location section.
export default function AutoScroll() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const section = document.getElementById('browse-by-location');
        if (section) {
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 10000);
    };

    // Start timer immediately
    resetTimer();

    // Reset on any user interaction
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));

    // Stop after first scroll — only do it once
    const stopOnScroll = () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, resetTimer));
      window.removeEventListener('scroll', stopOnScroll);
    };
    window.addEventListener('scroll', stopOnScroll, { passive: true });

    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, resetTimer));
      window.removeEventListener('scroll', stopOnScroll);
    };
  }, []);

  return null;
}
