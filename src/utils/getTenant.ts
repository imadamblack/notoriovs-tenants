import { cache } from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { TenantQuizStep } from '@/utils/tenantQuiz'

// Tipos locales (ver nota en tenantQuiz.ts: no se pudo correr
// `payload generate:types` en este entorno). Deben mantenerse en sync con
// src/collections/Tenants.ts.
export type TenantTracking = {
  metaPixelId?: string | null
  metaCapiToken?: string | null
  googleTagId?: string | null
}

export type TenantDoc = {
  id: string | number
  name: string
  subdomain: string
  active?: boolean | null
  generalInfo?: {
    companyName?: string | null
    legalName?: string | null
    phone?: string | null
    whatsapp?: string | null
    email?: string | null
    address?: string | null
    logo?: unknown
    privacyNoticeUrl?: string | null
    termsUrl?: string | null
  } | null
  landingHero?: {
    title?: string | null
    subtitle?: string | null
    image?: unknown
    ctaLabel?: string | null
    ctaLink?: string | null
  } | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  landingBlocks?: any[] | null
  quizIntro?: {
    title?: string | null
    description?: string | null
    image?: unknown
    ctaLabel?: string | null
  } | null
  quizSteps?: TenantQuizStep[] | null
  optInWebhook?: string | null
  quizWebhook?: string | null
  tracking?: TenantTracking | null
  thankYouPage?: {
    title?: string | null
    subtitle?: string | null
    contentHTML?: string | null
  } | null
  notEligiblePage?: {
    title?: string | null
    subtitle?: string | null
    contentHTML?: string | null
  } | null
}

/**
 * Busca un tenant activo por subdominio. Se usa desde las páginas de
 * /tenant-site/[subdomain] y desde /api/quiz-submit.
 */
export const getTenantBySubdomain = cache(
  async (subdomain: string): Promise<TenantDoc | null> => {
    if (!subdomain) return null

    const payload = await getPayload({ config })

    const { docs } = await payload.find({
      collection: 'tenants',
      where: {
        subdomain: { equals: subdomain.toLowerCase() },
        active: { equals: true },
      },
      limit: 1,
      depth: 1,
    })

    return (docs[0] as unknown as TenantDoc) || null
  },
)
