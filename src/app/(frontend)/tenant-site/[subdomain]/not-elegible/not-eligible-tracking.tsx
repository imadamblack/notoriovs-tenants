'use client';

import { useEffect } from 'react';
import fbEvent from '@/services/fbEvents';

type NotEligibleTrackingProps = {
  subdomain: string;
};


export default function NotEligibleTracking({ subdomain }: NotEligibleTrackingProps) {
  useEffect(() => {
    fbEvent('NotEligible', subdomain);
    if (typeof window !== 'undefined') {
      window.gtag?.('event', 'not_eligible');
    }
  }, [subdomain]);

  return null;
}
