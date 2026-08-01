'use client';
import { useEffect } from 'react';
import { trackEvent } from '@/lib/analytics';

export default function ProfileViewTracker({ proposalNumber, gender, city }: { proposalNumber: number; gender: string; city: string }) {
  useEffect(() => {
    trackEvent('profile_view', { proposal_number: proposalNumber, gender, city });
  }, [proposalNumber, gender, city]);
  return null;
}
