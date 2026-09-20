import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireDashboardAuth } from '@/utils/requireDashboardAuth'
import { findSubscriptionOfTenant } from '@/utils/pushSubscriptionDashboardFilters'
import { isNotificationType, type NotificationType } from '@/notifications/catalog'

// Alta, lectura, apagado por tipo y baja de las suscripciones de push de ESTE
// dispositivo (issue 36). Mismo patrón que el resto de /api/tenant-dashboard/*:
// Local API con `overrideAccess: true`, scoping a mano contra la sesión que
// resolvió `requireDashboardAuth` — nunca contra lo que mande el cliente.
//
// Un dispositivo es privado de quien lo dio de alta, no compartido por
// Tenant: cada ruta compara `tenant` Y `tenantUser` contra la sesión.

function toText(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() || undefined : undefined
}

// Las suscripciones de ESTE Tenant User, para que la interfaz de
// Notificaciones sepa si este dispositivo ya está dado de alta y con qué
// tipos activos al cargar.
export async function GET(req: NextRequest) {
  const auth = await requireDashboardAuth(req)
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'push-subscriptions',
    where: {
      and: [
        { tenant: { equals: auth.tenant.id } },
        { tenantUser: { equals: auth.session.userId } },
      ],
    },
    depth: 0,
    limit: 50,
    overrideAccess: true,
  })

  return NextResponse.json({
    subscriptions: result.docs.map((doc) => ({
      id: doc.id,
      endpoint: doc.endpoint,
      userAgent: doc.userAgent,
      notificationTypes: doc.notificationTypes,
    })),
  })
}

// Da de alta (o re-suscribe) el dispositivo desde el que se llama. Un
// `endpoint` que ya existía —el mismo dispositivo activando de nuevo el
// permiso, quizás desde otra sesión— se reasigna a este tenant/usuario en vez
// de rechazarse: el Push API puede reentregar el mismo endpoint tras borrar
// datos del navegador, y es el mismo dispositivo, no uno nuevo.
export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const auth = await requireDashboardAuth(req)
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const endpoint = toText(body?.endpoint)
  const p256dh = toText(body?.keys?.p256dh)
  const authKey = toText(body?.keys?.auth)
  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json({ error: 'Falta endpoint o llaves de la suscripción' }, { status: 400 })
  }

  const payload = await getPayload({ config })

  const existing = await payload.find({
    collection: 'push-subscriptions',
    where: { endpoint: { equals: endpoint } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })

  const data = {
    tenant: Number(auth.tenant.id),
    tenantUser: Number(auth.session.userId),
    endpoint,
    keys: { p256dh, auth: authKey },
    userAgent: toText(body?.userAgent),
    notificationTypes: ['lead-new'] as NotificationType[],
  }

  const subscription = existing.docs[0]
    ? await payload.update({
        collection: 'push-subscriptions',
        id: existing.docs[0].id,
        data,
        depth: 0,
        overrideAccess: true,
      })
    : await payload.create({
        collection: 'push-subscriptions',
        data,
        depth: 0,
        overrideAccess: true,
      })

  return NextResponse.json({ subscription }, { status: 201 })
}

// Apaga notificaciones en este dispositivo, o limpia una suscripción que el
// navegador ya dio de baja.
export async function DELETE(req: NextRequest) {
  const endpoint = req.nextUrl.searchParams.get('endpoint')

  const auth = await requireDashboardAuth(req)
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!endpoint) return NextResponse.json({ error: 'Falta endpoint' }, { status: 400 })

  const payload = await getPayload({ config })
  const existing = await payload.find({
    collection: 'push-subscriptions',
    where: {
      and: [
        { endpoint: { equals: endpoint } },
        { tenant: { equals: auth.tenant.id } },
        { tenantUser: { equals: auth.session.userId } },
      ],
    },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })

  const subscription = existing.docs[0]
  if (!subscription) return NextResponse.json({ error: 'Suscripción no encontrada' }, { status: 404 })

  await payload.delete({ collection: 'push-subscriptions', id: subscription.id, overrideAccess: true })

  return NextResponse.json({ ok: true })
}

// Apaga/prende tipos de Aviso en este dispositivo, sin revocar el permiso
// del navegador.
export async function PATCH(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { id, notificationTypes } = body || {}
  const auth = await requireDashboardAuth(req)
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  if (!Array.isArray(notificationTypes) || !notificationTypes.every(isNotificationType)) {
    return NextResponse.json({ error: 'Tipos de Aviso inválidos' }, { status: 400 })
  }

  const payload = await getPayload({ config })

  const subscription = await findSubscriptionOfTenant(payload, id, auth.tenant.id, auth.session.userId)
  if (!subscription) {
    return NextResponse.json({ error: 'Suscripción no encontrada' }, { status: 404 })
  }

  const updated = await payload.update({
    collection: 'push-subscriptions',
    id,
    data: { notificationTypes },
    depth: 0,
    overrideAccess: true,
  })

  return NextResponse.json({ subscription: updated })
}
