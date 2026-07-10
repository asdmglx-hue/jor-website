'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Deliberately a tiny client component instead of a server-side fetch in
// the root layout. The old approach ran a Supabase query on the server for
// every single page load across the entire site (since layout wraps every
// route) — that's real Cloudflare Worker CPU time spent on every request,
// just to show a WhatsApp link in the footer. Fetching it client-side costs
// zero Worker CPU time (it runs in the visitor's own browser instead), and
// the number changes rarely enough that a brief fallback-then-swap is fine.
export default function FooterWhatsAppLink({ children }: { children: React.ReactNode }) {
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
    <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" style={{ color: '#fff', textDecoration: 'none' }}>
      {children}
    </a>
  );
}
