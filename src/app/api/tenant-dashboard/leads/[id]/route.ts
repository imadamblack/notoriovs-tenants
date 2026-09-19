import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireDashboardTenant } from '@/utils/requireDashboardAuth'
import { findLeadOfTenant } from '@/utils/leadDashboardFilters'

type RouteParams = { params: Promise<{ id: string }> }

// Issue 35 (abrir un Lead por URL): a diferencia del listado paginado del
// Kanban/la Lista, un link a `?lead=123` puede apuntar a un lead que no está
// en la página o el filtro que se carga por defecto. Esta ruta es la única
// forma de traer UN lead suelto por id, y reusa `findLeadOfTenant` para que
// el mismo id de otro tenant responda exactamente igual (404) que en el
// PATCH/DELETE de `../route.ts`.
export async function GET(req: NextRequest, { params }: RouteParams) {
  const tenant = await requireDashboardTenant(req)
  if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const payload = await getPayload({ config })

  const lead = await findLeadOfTenant(payload, id, tenant.id)
  if (!lead) {
    return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })
  }

  return NextResponse.json({ lead })
}
