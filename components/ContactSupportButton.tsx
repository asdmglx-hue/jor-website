'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Same reasoning as FooterWhatsAppLink — client-side fetch so this doesn't
// add a Supabase query to every server-rendered page load. Fixed-position
// pill, visible on every page (mounted once from the root layout), so
// visitors always have a one-tap way to reach support now that the
// footer's plain "Contact" link was removed from the desktop footer.
export default function ContactSupportButton() {
  const [waNumber, setWaNumber] = useState('923287654333');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('app_settings').select('value').eq('key', 'whatsapp_number').maybeSingle();
        if (data?.value) setWaNumber(data.value as string);
      } catch (_) {}
    })();
  }, []);

  return (
    <a
      href={`https://wa.me/${waNumber}`}
      target="_blank"
      rel="noopener noreferrer"
      className="contact-support-btn"
      style={{
        position: 'fixed', top: 16, right: 16, zIndex: 900,
        display: 'flex', alignItems: 'center', gap: 8,
        background: '#25D366', color: '#fff', textDecoration: 'none',
        padding: '10px 18px', borderRadius: 999, fontWeight: 700, fontSize: 14,
        boxShadow: '0 4px 14px rgba(37,211,102,0.4)',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.51 2 12.04 2zm5.83 14.1c-.24.68-1.4 1.31-1.94 1.35-.5.04-1.02.24-3.4-.71-2.87-1.14-4.71-4.07-4.86-4.26-.14-.19-1.16-1.55-1.16-2.96 0-1.41.74-2.1 1-2.39.26-.29.57-.36.76-.36.19 0 .38 0 .55.01.18.01.42-.07.65.5.24.58.82 2 .89 2.14.07.14.12.31.02.5-.1.19-.14.31-.29.48-.14.17-.3.38-.43.51-.14.14-.29.29-.13.57.17.29.74 1.22 1.59 1.98 1.09.97 2.02 1.28 2.31 1.42.29.14.46.12.63-.07.17-.19.72-.84.91-1.13.19-.29.38-.24.64-.14.26.1 1.65.78 1.93.92.29.14.48.21.55.33.07.12.07.7-.17 1.38z"/></svg>
      <span className="contact-support-text">Contact Support</span>
    </a>
  );
}
