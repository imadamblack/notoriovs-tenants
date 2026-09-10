import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getTenantBySubdomain } from '@/utils/getTenant'
import { requireDashboardAuth } from '@/utils/requireDashboardAuth'
import { buildLeadsWhere, describeLeadFilters, readLeadFilters } from '@/utils/leadDashboardFilters'
import {
  buildLeadCsvColumns,
  csvHeaderRow,
  csvLeadRow,
  CSV_BOM,
  leadCsvFilename,
  type ExportableLead,
} from '@/utils/leadsCsv'

// Descarga en CSV de los Leads que el Tenant User está viendo (issue 14).
//
// Dos cosas la separan del resto de /api/tenant-dashboard/*:
//
//   1. Los filtros son los MISMOS que los del listado, no unos parecidos:
//      `buildLeadsWhere` es el único lugar donde se traducen a una consulta
//      (ver leadDashboardFilters.ts). Lo único que se ignora es la etapa: se
//      exporta lo que el tablero muestra en conjunto, no una sola columna.
//   2. Cada descarga queda registrada en `lead-exports` antes de mandar el
//      archivo. Se registra la petición, no la entrega: si la descarga se
//      corta a la mitad los datos ya salieron igual, y una bitácora que solo
//      anota las descargas completas es una bitácora con huecos.
//
// El aislamiento entre clientes es el mismo de siempre y no se relaja aquí:
// el tenant sale del host (ADR 0002/0007), la sesión tiene que ser de ESE
// tenant, y la consulta va scopeada a su id. No hay ningún parámetro con el
// que el cliente pueda nombrar otro tenant.

// Cuántos leads se traen por vuelta al armar el archivo. Se pagina y se va
// escribiendo al stream en vez de juntar todo en memoria: un tenant con
// decenas de miles de leads tiene que poder exportar sin tumbar la función.
const PAGE_SIZE = 500

export async function GET(req: NextRequest) {
  const auth = await requireDashboardAuth(req)
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { session, subdomain } = auth

  // El pipeline (para la columna "Etapa") y el quiz (para las columnas de
  // respuestas) del tenant que autorizó el host, nunca uno pedido por el
  // cliente.
  const tenant = await getTenantBySubdomain(subdomain, 'dashboardExport')
  if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const filters = readLeadFilters(req.nextUrl.searchParams)
  // La etapa se descarta: en el Kanban están abiertas todas las columnas a
  // la vez, así que "lo que estoy viendo" es el tablero completo.
  const where = buildLeadsWhere(tenant, { ...filters, stage: undefined })

  const payload = await getPayload({ config })

  // Se cuenta antes de escribir nada porque el registro de la exportación
  // necesita el número, y esperar a terminar el archivo para escribirlo
  // dejaría fuera de la bitácora justo las descargas que fallaron.
  const { totalDocs } = await payload.count({ collection: 'leads', where, overrideAccess: true })

  await payload.create({
    collection: 'lead-exports',
    data: {
      tenant: Number(tenant.id),
      exportedBy: session.userId as number,
      exportedByEmail: session.email,
      leadCount: totalDocs,
      filtersLabel: describeLeadFilters(filters),
      filters,
    },
    depth: 0,
    overrideAccess: true,
  })

  const columns = buildLeadCsvColumns(tenant.leadPipeline || [], tenant.quizSteps || [])
  const encoder = new TextEncoder()

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(CSV_BOM + csvHeaderRow(columns)))

      try {
        // Orden fijo por fecha de alta, el mismo default del listado. No se
        // respeta el `sort` del toolbar: en una hoja de cálculo reordenar
        // una columna es un clic, y un orden estable hace que dos
        // exportaciones seguidas se puedan comparar.
        for (let page = 1; ; page++) {
          const { docs, hasNextPage } = await payload.find({
            collection: 'leads',
            where,
            sort: '-createdAt',
            page,
            limit: PAGE_SIZE,
            depth: 0,
            overrideAccess: true,
          })

          for (const lead of docs) {
            controller.enqueue(encoder.encode(csvLeadRow(columns, lead as unknown as ExportableLead)))
          }

          if (!hasNextPage) break
        }
      } catch (err) {
        // El archivo ya empezó a viajar: no se puede cambiar el status a 500
        // ni mandar un JSON de error. Se corta el stream para que el
        // navegador muestre la descarga como fallida en vez de entregar un
        // CSV incompleto que parezca completo.
        console.error(`Falló la exportación de leads del tenant ${subdomain}`, err)
        controller.error(err)
        return
      }

      controller.close()
    },
  })

  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${leadCsvFilename(subdomain)}"`,
      // Datos personales de un cliente: ni el navegador ni un CDN intermedio
      // deben guardarse una copia.
      'Cache-Control': 'no-store',
    },
  })
}
