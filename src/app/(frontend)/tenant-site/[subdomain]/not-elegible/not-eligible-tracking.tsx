'use client';

import { useEffect } from 'react';
import fbEvent from '@/services/fbEvents';

// Dispara el evento de Meta Pixel / Conversions API (vía fbEvent, que ya
// reenvía a /api/fb-event con el Pixel/token del tenant) cada vez que un
// lead aterriza en /not-elegible, ya sea por redirección desde el quiz
// (survey-form.tsx) o por visita directa. Como "NotEligible" no está en la
// lista de standardEvents de fbEvents.ts, se envía como evento custom
// (fbq('trackCustom', ...)).
export default function NotEligibleTracking() {
  useEffect(() => {
    fbEvent('NotEligible');
    if (typeof window !== 'undefined') {
      window.gtag?.('event', 'not_eligible');
    }
  }, []);

  return null;
}
