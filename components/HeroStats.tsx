'use client';
import { useEffect, useState } from 'react';
import AnimatedCounter from './AnimatedCounter';
import { fetchLiveHomeStats } from '@/lib/supabase';

type Stats = { total: number; male: number; female: number };

export default function HeroStats({ initial }: { initial: Stats }) {
  const [stats, setStats] = useState<Stats>(initial);

  // Checks for genuinely current numbers the moment the page loads,
  // instead of only ever showing whatever the server had cached at
  // build time. Silently keeps showing the initial numbers if this
  // fails for any reason.
  useEffect(() => {
    fetchLiveHomeStats().then(live => { if (live) setStats(live); });
  }, []);

  return (
    <div className="hero-stats">
      {[
        { label: 'Total Proposals', value: stats.total },
        { label: 'Groom Profiles', value: stats.male },
        { label: 'Bride Profiles', value: stats.female },
      ].map(s => (
        <div key={s.label} className="hero-stat-card">
          <div style={{ fontSize: 28, fontWeight: 900 }}><AnimatedCounter target={s.value} /></div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}
