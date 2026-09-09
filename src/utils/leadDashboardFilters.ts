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
