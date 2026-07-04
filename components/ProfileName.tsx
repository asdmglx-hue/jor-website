'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import ExpandableName from './ExpandableName';

// The real name is deliberately NOT baked into the static HTML that Google
// indexes — only fetched here, client-side, after the page has loaded. This
// keeps individual profiles searchable-by-content (age, city, profession,
// bio) for SEO, without a person's actual name becoming Google-searchable.
// Real visitors still see the name almost instantly; it's just not part of
// what gets crawled and stored in Google's index.
export default function ProfileName({ proposalId, fallback, style, className }: {
  proposalId: string;
  fallback: string;
  style?: React.CSSProperties;
  className?: string;
}) {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.from('proposals').select('name').eq('id', proposalId).maybeSingle().then(({ data }) => {
      if (!cancelled && data?.name) setName(data.name);
    });
    return () => { cancelled = true; };
  }, [proposalId]);

  if (!name) {
    return <h1 className={className} style={style}>{fallback}</h1>;
  }
  return <ExpandableName name={name} className={className} style={style} />;
}
