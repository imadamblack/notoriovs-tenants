import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'
import { requireDashboardTenant } from '@/utils/requireDashboardAuth'
import { buildLeadsWhere, readLeadFilters } from '@/utils/leadDashboardFilters'

// Conteo de leads por etapa del pipeline, para los badges de cantidad del
// Kanban. Vive separado de GET /api/tenant-dashboard/leads a propósito: las
// columnas del Kanban cargan sus leads paginados (unos cuantos a la vez),
// pero necesitan saber el TOTAL de cada etapa aunque no lo hayan cargado
// todavía. `payload.count()` hace un COUNT(*) en vez de traer documentos,
// así que es barato incluso con miles de leads por tenant (los índices
// `tenant+stage` / `tenant+status` de Leads.ts ya cubren esta consulta).
export async function GET(req: NextRequest) {
  const tenant = await requireDashboardTenant(req)
  if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const payload = await getPayload({ config })

  // Mismos filtros de status ("Estancados/Abiertos/Ganados/Perdidos/
  // Descalificados"), tiempo y búsqueda que .../leads, para que el número
  // en el badge de cada columna sea el mismo conjunto de leads que esa
  // columna termina mostrando. La etapa no: aquí se cuenta una por una.
  const filters = readLeadFilters(req.nextUrl.searchParams)
  const baseAnd = (buildLeadsWhere(tenant, { ...filters, stage: undefined }).and ?? []) as Where[]

  const pipeline = tenant.leadPipeline || []
  const pipelineIds = pipeline.map((s) => s.id)

  const [stageCountEntries, otherResult, totalResult] = await Promise.all([
    Promise.all(
      pipeline.map(async (stage) => {
        const { totalDocs } = await payload.count({
          collection: 'leads',
          where: { and: [...baseAnd, { stage: { equals: stage.id } }] },
          overrideAccess: true,
        })
        return [stage.id, totalDocs] as const
      }),
    ),
    payload.count({
      collection: 'leads',
      where: pipelineIds.length ? { and: [...baseAnd, { stage: { not_in: pipelineIds } }] } : { and: baseAnd },
      overrideAccess: true,
    }),
    payload.count({
      collection: 'leads',
      where: { and: baseAnd },
      overrideAccess: true,
    }),
  ])

  return NextResponse.json({
    counts: Object.fromEntries(stageCountEntries),
    other: otherResult.totalDocs,
    total: totalResult.totalDocs,
  })
}
