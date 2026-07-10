import { getSubdomainFromHost } from '@/utils/subdomain';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
  }
}

// Mismo dominio raíz que usa src/middleware.ts (server), expuesto al
// browser porque fbEvent corre client-side. Configúralo con
// NEXT_PUBLIC_ROOT_DOMAIN si difiere del default.
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'tudominio.com';

type FbUserData = {
  phone?: string;
  email?: string;
  externalID?: string;
};

export default function fbEvent(
  eventName: string,
  userData: FbUserData = {
    phone: '',
    email: '',
    externalID: '',
  },
  eventID: number | string = Date.now(),
  clientData: Record<string, unknown> = {},
) {
  const standardEvents = ['PageView', 'Purchase', 'Lead', 'CompleteRegistration', 'Contact', 'InitiateCheckout'];
  const isStandard = standardEvents.includes(eventName);

  try {
    if (typeof window !== 'undefined' && typeof window.fbq !== 'undefined') {
      if (isStandard) {
        window.fbq('track', eventName, clientData);
      } else {
        window.fbq('trackCustom', eventName, clientData);
      }
    }
  } catch (err) {
    console.error('fbq error:', err);
  }

  const subdomain =
    typeof window !== 'undefined' ? getSubdomainFromHost(window.location.hostname, ROOT_DOMAIN) : '';

  const payload = JSON.stringify({
    eventName,
    eventID,
    subdomain,
    user: {
      ph: userData.phone,
      em: userData.email,
      externalID: userData.externalID,
    },
    clientData,
  });

  return fetch(`/api/fb-event`, {
    method: 'POST',
    body: payload,
    headers: {
      'Content-Type': 'application/json',
    },
  }).then((res) => res.json()).catch((err) => console.log(err));
}

// ─── Google Ads Conversion ────────────────────────────────────────────────────
export function gtagSendEvent(conversionId: string, data: { fullName?: string; phone?: string } = {}) {
  if (typeof window === 'undefined' || typeof window.gtag === 'undefined') return false;

  const fullName = data.fullName ?? '';
  const phone = data.phone ?? '';
  const [firstName = '', lastName = ''] = fullName.split(' ');

  window.gtag('set', 'user_data', {
    phone_number: phone.trim(),
    address: {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
    },
  });

  window.gtag('event', 'conversion', {
    send_to: `${process.env.NEXT_PUBLIC_GOOGLE_ADS_ID}/${conversionId}`,
    event_callback: () => {},
  });

  return false;
}
