'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

// Same client-side pattern as FooterAffiliateLink (avoids adding a
// Supabase query to every server-rendered page load). Two conditions must
// both hold before this link appears: the admin's "Affiliate Program"
// toggle is on, AND there's at least one affiliate actually registered —
// no point linking to an empty /agents page.
export default function RishtaCenterLink({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: setting }, { data: agents }] = await Promise.all([
          supabase.from('app_settings').select('value').eq('key', 'referral_enabled').maybeSingle(),
          supabase.rpc('list_verified_agents_secure'),
        ]);
        const enabled = setting?.value !== 'false';
        const hasAgents = Array.isArray(agents) && agents.length > 0;
        setVisible(enabled && hasAgents);
      } catch (_) {
        // Fail closed here (unlike FooterAffiliateLink's fail-open) — this
        // link points somewhere content-dependent, so showing it without
        // knowing there's actually something to show is worse than
        // occasionally hiding it on a transient error.
        setVisible(false);
      }
    })();
  }, []);

  if (!visible) return null;

  return (
    <Link href="/agents" style={{ color: '#fff', textDecoration: 'none' }}>
      {children}
    </Link>
  );
}
