import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'
import { requireDashboardTenant } from '@/utils/requireDashboardAuth'
import { applyStatusAndSinceFilters, SEARCH_FIELDS } from '@/utils/leadDashboardFilters'

// Conteo de leads por etapa del pipeline, para los badges de cantidad del
// Kanban. Vive separado de GET /api/tenant-dashboard/leads a propósito: las
// columnas del Kanban cargan sus leads paginados (unos cuantos a la vez),
// pero necesitan saber el TOTAL de cada etapa aunque no lo hayan cargado
// todavía. `payload.count()` hace un COUNT(*) en vez de traer documentos,
// así que es barato incluso con miles de leads por tenant (los índices
// `tenant+stage` / `tenant+status` de Leads.ts ya cubren esta consulta).
export async function GET(req: NextRequest) {
  const subdomain = req.nextUrl.searchParams.get('subdomain')
  const tenant = await requireDashboardTenant(req, subdomain)
  if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const params = req.nextUrl.searchParams
  const search = params.get('search')?.trim() || undefined
  // Mismos filtros de status ("Estancados/Abiertos/Ganados/Perdidos/
  // Descalificados") y tiempo que .../leads, para que el número en el
  // badge de cada columna sea el mismo conjunto de leads que esa columna
  // termina mostrando.
  const status = params.get('status')?.trim() || undefined
  const since = params.get('since')?.trim() || undefined
  const payload = await getPayload({ config })

  const baseAnd: Where[] = [{ tenant: { equals: tenant.id } }]
  if (search) {
    baseAnd.push({ or: SEARCH_FIELDS.map((field) => ({ [field]: { contains: search } })) })
  }
  applyStatusAndSinceFilters(baseAnd, tenant, status, since)

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
