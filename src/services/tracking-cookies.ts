import { getCookie } from 'cookies-next';

// NOTA: archivo generado (no incluido en los archivos compartidos). Lee los
// parámetros UTM de la URL, las cookies estándar de Meta Pixel (_fbc/_fbp) y
// la cookie "lead" que guarda src/components/opt-in-form.tsx al enviar el
// primer formulario, para acompañar los eventos de conversión, el webhook
// de opt-in y decidir si /survey debe redirigir (cuando no hay lead previo).
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

type SearchParamsLike = {
  get?: (key: string) => string | null;
} | null | undefined;

export type LeadCookie = {
  fullName?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  id?: string;
  [key: string]: unknown;
};

function readLeadCookie(): LeadCookie | undefined {
  const raw = getCookie('lead');
  if (!raw) return undefined;

  try {
    return JSON.parse(String(raw));
  } catch {
    return undefined;
  }
}

export default function getTrackingData(searchParams?: SearchParamsLike) {
  const utm: Record<string, string> = {};

  UTM_KEYS.forEach((key) => {
    const value = searchParams?.get?.(key);
    if (value) utm[key] = value;
  });

  const fbc = getCookie('_fbc') ?? '';
  const fbp = getCookie('_fbp') ?? '';
  const lead = readLeadCookie();

  return { utm, fbc, fbp, lead, shouldRedirect: !lead };
}
