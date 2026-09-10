import { cache } from 'react'
import { getPayload, type SelectType } from 'payload'
import config from '@payload-config'
import type { TenantQuizStep } from '@/utils/tenantQuiz'

// Tipos locales (ver nota en tenantQuiz.ts: no se pudo correr
// `payload generate:types` en este entorno). Deben mantenerse en sync con
// src/collections/Tenants/.
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
// sin llevarse el token de la Conversions API, que vive en el mismo grupo.
type FieldSelect<V> = true | { [K in keyof Present<V>]?: true }

type TenantSelect = { id?: true } & { [K in keyof Omit<TenantDoc, 'id'>]?: FieldSelect<TenantDoc[K]> }

type TenantProjection = {
  // `depth: 1` solo donde la página realmente pinta una Media (logo, imagen
  // del quiz): con `depth: 0` esos campos llegan como id y la imagen queda
  // en blanco. Ver la regla de `depth` en .claude/skills/payload/reference/
  // local-api.md — cada nivel es un join más.
  depth: 0 | 1
  select: TenantSelect
}

// Bloques que se repiten entre proyecciones. Nombrarlos evita que la tabla
// se lea como una lista de campos sueltos.
const IDENTITY = { name: true, generalInfo: true } as const
const PIPELINE = { leadPipeline: true, leadStuckAfterDays: true } as const

/**
 * Qué campos del Tenant pide cada consumidor. Nadie resuelve un Tenant sin
 * nombrar una de estas proyecciones, así que el conjunto de campos que una
 * página carga en memoria se lee de un solo lugar — y se puede afirmar en un
 * test que ninguna página pública toca `tracking.metaCapiToken`.
 *
 * `id` siempre viene de vuelta (Payload lo incluye en todo `select`).
 */
export const TENANT_PROJECTIONS = {
  // Layout compartido por TODAS las páginas del tenant: título/OG de la
  // metadata y los scripts de analytics. Nada de landing, quiz ni pipeline.
  chrome: {
    depth: 1, // generalInfo.logo va en la imagen de OpenGraph
    select: {
      ...IDENTITY,
      landingHero: { subtitle: true },
      quizIntro: { description: true },
      tracking: { metaPixelId: true, googleTagId: true },
    },
  },
  landing: {
    // El renderer de bloques todavía no pinta `landingHero.image` ni las
    // imágenes de los bloques, pero son campos de imagen: poblarlos es lo
    // que hace que agregarlos al render sea solo tocar el JSX.
    depth: 1,
    select: { landingHero: true, landingBlocks: true },
  },
  quiz: {
    depth: 1, // logo + quizIntro.image se pintan en el formulario
    select: { ...IDENTITY, quizIntro: true, quizSteps: true },
  },
  thankYou: {
    depth: 1, // logo
    select: { ...IDENTITY, thankYouPage: true },
  },
  notEligible: {
    depth: 1, // logo
    select: { ...IDENTITY, notEligiblePage: true },
  },
  privacyNotice: {
    depth: 0, // solo texto: razón social, domicilio, teléfono, email
    select: IDENTITY,
  },
  // Dashboard de Cliente. Si el tenant tiene o no dashboard disponible lo
  // responde `tenantHasDashboard`, que cuenta usuarios en vez de leer nada
  // del Tenant.
  dashboard: {
    depth: 0,
    select: { ...IDENTITY, ...PIPELINE },
  },
  // Rutas /api/tenant-dashboard/* (leads, counts, kpis) y la autorización de
  // la página del dashboard: el `id` para scopear la query a `leads` y el
  // pipeline para filtrarla. Quién autoriza es `resolveDashboardAuth`, contra
  // la colección `tenant-users`; del Tenant no sale ninguna credencial.
  dashboardApi: {
    depth: 0,
    select: { ...PIPELINE },
  },
  // Único consumidor del token de la Conversions API: la ruta server-side
  // que reenvía el evento a Meta.
  conversionsApi: {
    depth: 0,
    select: { tracking: { metaPixelId: true, metaCapiToken: true } },
  },
  quizSubmit: {
    depth: 0,
    select: { name: true, leadPipeline: true, quizWebhook: true },
  },
  // Quién firma un correo transaccional: el id para acotar la búsqueda del
  // usuario al Tenant, y el nombre de la empresa para el remitente visible y
  // el cuerpo del correo. Lo piden rutas sin sesión (recuperar contraseña),
  // así que no puede traer nada más.
  tenantMail: {
    depth: 0,
    select: { name: true, generalInfo: { companyName: true } },
  },
  // Resolver el subdominio a un id de tenant, nada más: es todo lo que
  // necesita el ingest de marketing reports para scopear lo que escribe.
  identity: {
    depth: 0,
    select: { id: true },
  },
  // Ingest de leads (POST /api/leads/ingest, el n8n de Notoriovs). Necesita
  // más que `identity` porque un lead nace en una etapa concreta: el
  // pipeline es para saber cuál es la primera. El nombre, para los logs.
  leadIngest: {
    depth: 0,
    select: { name: true, leadPipeline: true },
  },
} as const satisfies Record<string, TenantProjection>

export type TenantProjectionName = keyof typeof TENANT_PROJECTIONS

/**
 * Proyecciones que puede pedir una página servida a cualquier visitante —
 * el dashboard incluido: su pantalla de login se renderiza sin sesión. El
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
  'dashboard',
  'dashboardApi',
  'tenantMail',
] as const satisfies readonly TenantProjectionName[]

type ProjectField<V, S> = S extends true
  ? V
  : Pick<Present<V>, Extract<keyof S, keyof Present<V>>> | Extract<V, null | undefined>

type Projected<S> = Pick<TenantDoc, 'id'> & {
  [K in keyof TenantDoc as K extends keyof S ? K : never]: ProjectField<TenantDoc[K], S[K & keyof S]>
}

/** El Tenant tal como lo ve el consumidor que pidió la proyección `K`. */
export type TenantView<K extends TenantProjectionName> = Projected<
  (typeof TENANT_PROJECTIONS)[K]['select']
>

/**
 * La consulta que resuelve un tenant activo por subdominio con una
 * proyección dada. Separada de la ejecución para poder afirmarla en un test
 * sin base de datos.
 */
export function buildTenantQuery(subdomain: string, projection: TenantProjectionName) {
  const { depth, select } = TENANT_PROJECTIONS[projection]

  return {
    collection: 'tenants' as const,
    where: {
      subdomain: { equals: subdomain.toLowerCase() },
      active: { equals: true },
    },
    limit: 1,
    depth,
    select: select as SelectType,
  }
}

// Memoizado por (subdominio, proyección): dos consumidores que piden la
// misma proyección en el mismo render comparten una sola query, y uno que
// pide otra proyección paga la suya (que es justo el punto).
const findTenant = cache(
  async (
    subdomain: string,
    projection: TenantProjectionName,
  ): Promise<Partial<TenantDoc> | null> => {
    const payload = await getPayload({ config })
    const { docs } = await payload.find(buildTenantQuery(subdomain, projection))
    return (docs[0] as Partial<TenantDoc>) ?? null
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

/** ¿Este tenant tiene al menos un Tenant User que pueda entrar con su email? */
export const tenantHasUsers = cache(async (tenantId: string | number): Promise<boolean> => {
  const payload = await getPayload({ config })
  const { totalDocs } = await payload.count({
    collection: 'tenant-users',
    where: { tenant: { equals: tenantId } },
    overrideAccess: true,
  })

  return totalDocs > 0
})

/**
 * ¿Hay alguna forma de entrar al dashboard de este tenant? Solo hay una:
 * tener al menos un Tenant User. Un tenant sin usuarios ve el aviso de "no
 * disponible" en vez de un login que nadie podría pasar.
 */
export async function tenantHasDashboard(tenantId: string | number): Promise<boolean> {
  return tenantHasUsers(tenantId)
}
