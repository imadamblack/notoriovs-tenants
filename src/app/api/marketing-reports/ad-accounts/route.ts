import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

// Endpoint server-to-server para el workflow CENTRAL de n8n que dispara la
// ingesta diaria de marketing (issue #19): en vez de un workflow por
// tenant, uno solo consulta aquí "qué cuentas publicitarias hay que traer
// hoy" y loopea. Mismo secreto que /ingest (MARKETING_REPORT_INGEST_KEY,
// header x-ingest-key): es el mismo actor, mismo pipeline.
//
// Por qué esta ruta y no `GET /api/tenants` con un API key de Payload: esa
// ruta está cerrada a propósito (ver Tenants/index.ts) porque el documento
// completo de un tenant trae secretos (`tracking.metaCapiToken`, entre
// otros). Esta ruta entrega SOLO subdomain + metaAdAccountId — lo mínimo
// que n8n necesita para llamar a Meta — de los tenants activos que tengan
// una cuenta configurada. Nada más de `tenants` sale por aquí.
export async function GET(req: NextRequest) {
  const expectedKey = process.env.MARKETING_REPORT_INGEST_KEY
  if (!expectedKey) {
    return NextResponse.json(
      { error: 'MARKETING_REPORT_INGEST_KEY no está configurado en el servidor' },
      { status: 503 },
    )
  }
  if (req.headers.get('x-ingest-key') !== expectedKey) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const payload = await getPayload({ config })

  // `select` pide SOLO subdomain y tracking.metaAdAccountId: el resto del
  // grupo `tracking` (metaCapiToken, metaPixelId) ni siquiera sale de la
  // base de datos, así que no hay forma de que un cambio futuro en este
  // archivo lo filtre por accidente.
  const { docs } = await payload.find({
    collection: 'tenants',
    where: { active: { equals: true } },
    select: { subdomain: true, tracking: { metaAdAccountId: true } },
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })

  // El filtro de "tiene cuenta configurada" va en JS, no en el `where`: son
  // pocos tenants (issue #19) y así no depende de que Postgres trate NULL
  // y string vacío igual en una comparación por punto sobre un grupo.
  const accounts = docs
    .filter((tenant) => Boolean(tenant.tracking?.metaAdAccountId))
    .map((tenant) => ({
      subdomain: tenant.subdomain,
      metaAdAccountId: tenant.tracking!.metaAdAccountId as string,
    }))

  return NextResponse.json({ accounts })
}
