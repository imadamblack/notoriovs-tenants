import { cache } from 'react'
import { getPayload, type SelectType } from 'payload'
import config from '@payload-config'
import type { TenantQuizStep } from '@/utils/tenantQuiz'

// Tipos locales (ver nota en tenantQuiz.ts: no se pudo correr
// `payload generate:types` en este entorno). Deben mantenerse en sync con
// src/collections/Tenants.ts.
export type TenantLeadStage = {
  // Id autogenerado por Payload para esta fila del array; es lo único que
  // referencia `Lead.stage` (ver comentario en Leads.ts). Puede venir null
  // en teoría (tipo de Payload), pero en la práctica siempre existe una vez
  // que el tenant se guardó al menos una vez.
  id?: string | null
  label: string
  isWon?: boolean | null
  isLost?: boolean | null
}

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
  dashboardPassword?: string | null
  leadPipeline?: TenantLeadStage[] | null
  leadStuckAfterDays?: number | null
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

type Present<T> = Exclude<T, null | undefined>

// Un campo se pide entero (`true`) o, si es un grupo, subcampo por subcampo.
// Lo segundo es lo que permite que una página pública se lleve el Meta Pixel
// sin llevarse el token de la Conversions API que vive en el mismo grupo.
type FieldSelect<V> = true | { [K in keyof Present<V>]?: true }

type TenantSelect = { [K in keyof Omit<TenantDoc, 'id'>]?: FieldSelect<TenantDoc[K]> }

/**
 * Qué campos del Tenant pide cada consumidor. Nadie resuelve un Tenant sin
 * nombrar una de estas proyecciones, así que el conjunto de campos que una
 * página carga en memoria se lee de un solo lugar — y se puede afirmar en un
 * test que ninguna página pública toca `tracking.metaCapiToken` ni
 * `dashboardPassword`.
 *
 * `id` siempre viene de vuelta (Payload lo incluye en todo `select`).
 */
export const TENANT_PROJECTIONS = {
  // Layout compartido por TODAS las páginas del tenant: título/OG de la
  // metadata y los scripts de analytics. Nada de landing, quiz ni pipeline.
  chrome: {
    name: true,
    generalInfo: true,
    landingHero: { subtitle: true },
    quizIntro: { description: true },
    tracking: { metaPixelId: true, googleTagId: true },
  },
  landing: {
    landingHero: true,
    landingBlocks: true,
  },
  quiz: {
    name: true,
    generalInfo: true,
    quizIntro: true,
    quizSteps: true,
  },
  thankYou: {
    name: true,
    generalInfo: true,
    thankYouPage: true,
  },
  notEligible: {
    name: true,
    generalInfo: true,
    notEligiblePage: true,
  },
  privacyNotice: {
    name: true,
    generalInfo: true,
  },
  // Dashboard de Cliente. `dashboardPassword` entra solo para saber si el
  // tenant tiene dashboard configurado; no viaja al cliente.
  dashboard: {
    name: true,
    generalInfo: true,
    dashboardPassword: true,
    leadPipeline: true,
    leadStuckAfterDays: true,
  },
  // Rutas /api/tenant-dashboard/* (leads, counts, kpis): autorizan con la
  // contraseña y filtran con el pipeline.
  dashboardApi: {
    dashboardPassword: true,
    leadPipeline: true,
    leadStuckAfterDays: true,
  },
  dashboardLogin: {
    dashboardPassword: true,
  },
  // Único consumidor del token de la Conversions API: la ruta server-side
  // que reenvía el evento a Meta.
  conversionsApi: {
    tracking: { metaPixelId: true, metaCapiToken: true },
  },
  quizSubmit: {
    name: true,
    leadPipeline: true,
    quizWebhook: true,
  },
  identity: {
    name: true,
    subdomain: true,
  },
} as const satisfies Record<string, TenantSelect>

export type TenantProjectionName = keyof typeof TENANT_PROJECTIONS

/**
 * Proyecciones que puede pedir una página servida a cualquier visitante. El
 * test de tenantProjections verifica contra esta lista que ninguna arrastre
 * un secreto del tenant.
 */
export const PUBLIC_TENANT_PROJECTIONS = [
  'chrome',
  'landing',
  'quiz',
  'thankYou',
  'notEligible',
  'privacyNotice',
] as const satisfies readonly TenantProjectionName[]

type ProjectField<V, S> = S extends true
  ? V
  : Pick<Present<V>, Extract<keyof S, keyof Present<V>>> | Extract<V, null | undefined>

type Projected<S> = Pick<TenantDoc, 'id'> & {
  [K in keyof TenantDoc as K extends keyof S ? K : never]: ProjectField<TenantDoc[K], S[K & keyof S]>
}

/** El Tenant tal como lo ve el consumidor que pidió la proyección `K`. */
export type TenantView<K extends TenantProjectionName> = Projected<(typeof TENANT_PROJECTIONS)[K]>

/**
 * La consulta que resuelve un tenant activo por subdominio con una
 * proyección dada. Separada de la ejecución para poder afirmarla en un test
 * sin base de datos.
 */
export function buildTenantQuery(subdomain: string, projection: TenantProjectionName) {
  return {
    collection: 'tenants' as const,
    where: {
      subdomain: { equals: subdomain.toLowerCase() },
      active: { equals: true },
    },
    limit: 1,
    depth: 1,
    select: TENANT_PROJECTIONS[projection] as SelectType,
  }
}

// Memoizado por (subdominio, proyección): dos consumidores que piden la
// misma proyección en el mismo render comparten una sola query, y uno que
// pide otra proyección paga la suya (que es justo el punto).
const findTenant = cache(
  async (subdomain: string, projection: TenantProjectionName): Promise<unknown> => {
    const payload = await getPayload({ config })
    const { docs } = await payload.find(buildTenantQuery(subdomain, projection))
    return docs[0] ?? null
  },
)

/**
 * Busca un tenant activo por subdominio y devuelve solo los campos de la
 * proyección pedida. Se usa desde las páginas de /tenant-site/[subdomain] y
 * desde las rutas de /api.
 */
export async function getTenantBySubdomain<K extends TenantProjectionName>(
  subdomain: string,
  projection: K,
): Promise<TenantView<K> | null> {
  if (!subdomain) return null

  return (await findTenant(subdomain, projection)) as TenantView<K> | null
}
