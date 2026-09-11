import type { Where } from 'payload'
import type { TenantDoc } from '@/utils/getTenant'
import { DEFAULT_LEAD_STUCK_AFTER_DAYS } from '@/components/dashboard/leadPresentation'
import { sinceCutoffISO } from '@/utils/dashboardPeriod'

// Filtros compartidos entre GET /api/tenant-dashboard/leads (trae los
// documentos, paginado) y GET /api/tenant-dashboard/leads/counts (solo
// cuenta, para los badges del Kanban). Viven en un solo lugar para que
// "Estancado" y el filtro de tiempo se calculen exactamente igual en las
// dos rutas: si un lead cuenta como estancado en el badge de la columna,
// tiene que ser el mismo lead que aparece al cargar esa columna.

// Campos donde busca el cuadro de "Buscar leads" del dashboard (Kanban y
// Lista). `contains` en Postgres se traduce a ILIKE '%valor%' (case
// insensitive), ver @payloadcms/drizzle/dist/queries/sanitizeQueryValue.js.
export const SEARCH_FIELDS = ['name', 'phone', 'whatsapp', 'email'] as const

export const ALLOWED_STATUSES_FILTER = new Set(['open', 'won', 'lost', 'disqualified'])

// El filtro de tiempo ("Hoy/7 días/30 días/3 meses/Máximo") vive en
// utils/dashboardPeriod.ts: lo comparten estas rutas, la de KPIs y el
// selector del toolbar. Aquí solo se aplica sobre `createdAt` (cuándo
// llegó el lead, no cuándo se tocó por última vez: es la misma fecha que
// ya usa el Sort).

export function stuckCutoffISO(tenant: Pick<TenantDoc, 'leadStuckAfterDays'>): string {
  const days =
    tenant.leadStuckAfterDays && tenant.leadStuckAfterDays > 0
      ? tenant.leadStuckAfterDays
      : DEFAULT_LEAD_STUCK_AFTER_DAYS
  return new Date(Date.now() - days * 86400000).toISOString()
}

// Agrega a `and` las cláusulas de status/tiempo. `status=stuck` es un
// valor sintético igual que `stage=__other__` en leads/route.ts: no existe
// como tal en la DB, se resuelve a "status=open y updatedAt viejo" (el
// mismo corte que ya usa leadPresentation.ts para pintar la tarjeta de
// "vieja" en el Kanban).
export function applyStatusAndSinceFilters(
  and: Where[],
  tenant: Pick<TenantDoc, 'leadStuckAfterDays'>,
  status: string | undefined,
  since: string | undefined,
) {
  if (status === 'stuck') {
    and.push({ status: { equals: 'open' } }, { updatedAt: { less_than: stuckCutoffISO(tenant) } })
  } else if (status && ALLOWED_STATUSES_FILTER.has(status)) {
    and.push({ status: { equals: status } })
  }

  const sinceCutoff = sinceCutoffISO(since)
  if (sinceCutoff) and.push({ createdAt: { greater_than_equal: sinceCutoff } })
}

/** Lo que el toolbar del dashboard tiene prendido en este momento. */
export type LeadFilters = {
  /** Id de una etapa del pipeline, o `__other__`. Solo lo usa el Kanban. */
  stage?: string
  status?: string
  since?: string
  search?: string
}

export function readLeadFilters(params: URLSearchParams): LeadFilters {
  return {
    stage: params.get('stage')?.trim() || undefined,
    status: params.get('status')?.trim() || undefined,
    since: params.get('since')?.trim() || undefined,
    search: params.get('search')?.trim() || undefined,
  }
}

/**
 * El `where` de una consulta de leads del dashboard, con el tenant siempre
 * al frente. Lo comparten el listado, los conteos del Kanban y la
 * exportación a CSV, y eso es justo lo que hace que el archivo que se
 * descarga traiga los mismos leads que están en pantalla: no hay dos
 * lecturas de los filtros que puedan separarse con el tiempo.
 */
export function buildLeadsWhere(
  tenant: Pick<TenantDoc, 'id' | 'leadPipeline' | 'leadStuckAfterDays'>,
  filters: LeadFilters,
): Where {
  const and: Where[] = [{ tenant: { equals: tenant.id } }]

  if (filters.stage) {
    if (filters.stage === '__other__') {
      const pipelineIds = (tenant.leadPipeline || []).map((s) => s.id)
      // Si el tenant no tiene pipeline configurado, "otro" es simplemente
      // "todos los leads": no hay ninguna etapa contra la cual comparar.
      if (pipelineIds.length) and.push({ stage: { not_in: pipelineIds } })
    } else {
      and.push({ stage: { equals: filters.stage } })
    }
  }

  applyStatusAndSinceFilters(and, tenant, filters.status, filters.since)

  if (filters.search) {
    and.push({ or: SEARCH_FIELDS.map((field) => ({ [field]: { contains: filters.search } })) })
  }

  return { and }
}

/**
 * Los filtros activos en palabras, para el registro de exportaciones: lo que
 * hay que poder leer meses después para saber qué se llevó alguien.
 */
export function describeLeadFilters(filters: LeadFilters): string {
  const parts: string[] = []
  if (filters.status) parts.push(`status: ${filters.status}`)
  if (filters.since) parts.push(`periodo: ${filters.since}`)
  if (filters.search) parts.push(`búsqueda: "${filters.search}"`)
  if (filters.stage) parts.push(`etapa: ${filters.stage}`)
  return parts.length ? parts.join(', ') : 'sin filtros (todos los leads)'
}
