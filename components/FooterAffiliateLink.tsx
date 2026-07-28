'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

// Same reasoning as FooterWhatsAppLink: a tiny client component instead of
// a server-side fetch in the root layout, so this doesn't add a Supabase
// query (and Worker CPU time) to every single page load across the site.
// Starts hidden (rather than defaulting to shown) so there's no visible
// flash of the link before a "disabled" state is confirmed — it only
// appears once we positively know the affiliate program is enabled.
export default function FooterAffiliateLink({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('app_settings').select('value').eq('key', 'referral_enabled').maybeSingle();
        setEnabled(data?.value !== 'false');
      } catch (_) {
        // If the check fails for any reason, default to showing the link —
        // fail open, since this is just a footer nav item, not something
        // that could leak sensitive data.
        setEnabled(true);
      }
    })();
  }, []);

  if (!enabled) return null;

  return (
    <Link href="/refer" style={{ color: '#fff', textDecoration: 'none' }}>
      {children}
    </Link>
  );
}
