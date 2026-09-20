import { waitUntil } from '@vercel/functions'
import webpush, { WebPushError } from 'web-push'
import type { Payload, PayloadRequest } from 'payload'
import type { NotificationType } from './catalog'

// El envío del push interno (issue 36, ADR 0011). Vive separado de
// `src/events/tenantEvents.ts` a propósito: ese módulo es el sobre que sale
// hacia n8n (ADR 0008); este es la plataforma hablándole directo a su
// propio usuario, y la separación en el grafo de imports hace la distinción
// literal, no solo de prosa — ninguno de los dos importa al otro.

type PushMessage = { title: string; body: string; url: string }

let vapidConfigured = false

function ensureVapidConfigured(payload: Payload): boolean {
  if (vapidConfigured) return true

  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    payload.logger.info('No se manda push: faltan las llaves VAPID en el entorno.')
    return false
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  vapidConfigured = true
  return true
}

type SendTenantPushArgs = {
  tenantId: number | string
  type: NotificationType
  payload: Payload
  buildMessage: () => PushMessage
  req?: PayloadRequest
}

/**
 * Manda un Aviso push a cada dispositivo de este Tenant que tenga `type`
 * activo. **No se espera y nunca lanza** (mismo contrato que
 * `emitTenantEvent`): un fallo al mandar un push no revierte ni bloquea
 * nada de lo que lo disparó.
 */
export function sendTenantPush({ tenantId, type, payload, buildMessage, req }: SendTenantPushArgs): void {
  if (!ensureVapidConfigured(payload)) return

  const delivery = deliver({ tenantId, type, payload, buildMessage, req }).catch((err) => {
    payload.logger.warn(`Falló el envío de push para el tenant ${tenantId}: ${err}`)
  })

  // Igual que `emitTenantEvent`: mantiene viva la petición saliente después
  // de que la función serverless contestó. Fuera de Vercel no hace nada y la
  // promesa corre igual.
  waitUntil(delivery)
}

async function deliver({ tenantId, type, payload, buildMessage, req }: SendTenantPushArgs): Promise<void> {
  // Un Tenant inactivo no recibe Avisos por ningún canal (CONTEXT.md), y esa
  // regla se cumple aquí, en el emisor, igual que `deliveryDecision` la
  // cumple para el webhook.
  const tenant = await payload
    .findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 0,
      select: { active: true },
      overrideAccess: true,
      req,
    })
    .catch(() => null)

  if (!tenant) {
    payload.logger.info(`No se manda push: no existe el tenant ${tenantId}`)
    return
  }
  if (!tenant.active) {
    payload.logger.info(`No se manda push para ${tenantId}: el tenant está inactivo (no recibe Avisos)`)
    return
  }

  const subscriptions = await payload.find({
    collection: 'push-subscriptions',
    depth: 0,
    limit: 0,
    overrideAccess: true,
    req,
    where: {
      and: [{ tenant: { equals: tenantId } }, { notificationTypes: { contains: type } }],
    },
  })

  if (!subscriptions.docs.length) return

  const message = buildMessage()
  const body = JSON.stringify(message)

  for (const subscription of subscriptions.docs) {
    const attempt = webpush
      .sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
        },
        body,
      )
      .catch(async (err) => {
        // 404/410: el permiso se revocó o se borraron los datos del
        // navegador — la suscripción está muerta. Se borra, no se
        // reintenta (ADR 0011): un envío fallido es la única señal que
        // existe de que ya no hay a quién entregarle nada.
        if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) {
          await payload.delete({ collection: 'push-subscriptions', id: subscription.id, overrideAccess: true, req })
          return
        }
        payload.logger.warn(`Push rechazado para la suscripción ${subscription.id}: ${err}`)
      })

    waitUntil(attempt)
  }
}
