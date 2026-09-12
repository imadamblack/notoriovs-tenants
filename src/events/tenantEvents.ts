import { waitUntil } from '@vercel/functions'
import type { Payload, PayloadRequest } from 'payload'

// La salida de eventos de la plataforma, en el sobre del ADR 0008
// (docs/adr/0008-un-solo-tubo-de-eventos-con-sobre.md). Quien agrega un evento
// nuevo agrega un renglón en EVENT_CATALOG y una llamada a `emitTenantEvent`:
// no hay una segunda forma de mandar un webhook en este repo.
//
// Hay DOS tubos, y la diferencia no es técnica sino de a quién le pasó la cosa:
//
//  - Los eventos del Tenant —le pasó algo al negocio del cliente— van al
//    `eventsWebhook` de ESE cliente, que es suyo y puede apuntar a su propio
//    CRM.
//  - Los eventos de plataforma —le pasó algo a nuestra cartera de clientes— van
//    al tubo de abajo, uno solo para todos. Ningún cliente quiere que le avisen
//    que lo dimos de alta: ese hecho es nuestro, no suyo.
//
// El sobre, los headers y el catálogo son los mismos para los dos. Lo único que
// cambia es a qué URL sale cada evento, y eso lo dice su renglón del catálogo.

// Base de los webhooks de n8n.
export const EVENTS_WEBHOOK_BASE = 'https://n8n.notoriovs.com/webhook/'

// El tubo de los eventos de plataforma. Se llama por el tubo y no por un
// evento (`tenant-created`, que es lo que había) para que el siguiente evento
// de plataforma —`tenant.activated` y `tenant.deactivated` del issue 21, por
// ejemplo— entre por aquí y se enrute por `event` del otro lado, en vez de
// abrir una URL nueva. Una URL por evento es justo lo que el ADR 0008 no
// quiere, del lado del Tenant y de este.
export const PLATFORM_EVENTS_WEBHOOK = `${EVENTS_WEBHOOK_BASE}tenants-crm`

export type TenantEventName = 'lead.created' | 'quiz.completed' | 'tenant.created'

type EventSpec = {
  // Versión del esquema de `data` de ESTE evento, no del sobre. Subirla es la
  // única forma de romper `data` (ADR 0008, decisión 2).
  version: number
  // Un Tenant inactivo conserva su landing y su quiz capturando Leads, pero no
  // recibe Avisos (CONTEXT.md). La regla se cumple aquí, en el emisor, y no en
  // n8n: una regla del dominio viviendo en un workflow no la ve nadie que lea
  // este código.
  onlyWhenActive: boolean
  // A cuál de los dos tubos sale (ver el comentario de arriba).
  destination: 'tenant' | 'platform'
}

export const EVENT_CATALOG = {
  'lead.created': { version: 1, onlyWhenActive: true, destination: 'tenant' },
  // El quiz y el alta no son Avisos al cliente: el primero alimenta lo que n8n
  // hace con las respuestas, el segundo provisiona la infraestructura del
  // Tenant recién creado. Callarlos con el Tenant inactivo no protegería a
  // nadie y rompería el aprovisionamiento.
  'quiz.completed': { version: 1, onlyWhenActive: false, destination: 'tenant' },
  // Va al tubo de plataforma por una razón dura, no de gusto: este evento es el
  // que hace que exista la infraestructura de ese Tenant en n8n, incluida la
  // ruta de su propio `eventsWebhook`. Mandarlo ahí sería mandarlo a una URL
  // que todavía no escucha nadie — y lo que se pierde cuando este evento no
  // llega no es un aviso, son TODOS los de ese cliente, para siempre.
  'tenant.created': { version: 1, onlyWhenActive: false, destination: 'platform' },
} as const satisfies Record<TenantEventName, EventSpec>

/**
 * Lo que el emisor lee del Tenant: los cinco campos que van en el sobre, más
 * los dos con los que decide si manda (`active`) y a dónde (`eventsWebhook`,
 * solo para los eventos del Tenant).
 * Es un `select` enumerado a propósito, igual que las proyecciones de
 * `getTenant`: lo que sale del Tenant se enumera, no se filtra.
 */
export const EVENT_TENANT_SELECT = {
  id: true,
  name: true,
  subdomain: true,
  active: true,
  generalInfo: { whatsapp: true, email: true },
  eventsWebhook: true,
} as const

export type EventTenant = {
  id: number | string
  name?: string | null
  subdomain?: string | null
  active?: boolean | null
  generalInfo?: { whatsapp?: string | null; email?: string | null } | null
  eventsWebhook?: string | null
}

export type EventEnvelope = {
  id: string
  event: TenantEventName
  version: number
  occurredAt: string
  tenant: {
    id: number | string
    subdomain?: string | null
    name?: string | null
    whatsapp?: string | null
    email?: string | null
  }
  data: Record<string, unknown>
}

/**
 * Arma el sobre. Función pura y separada de la entrega para poder afirmarla en
 * un test: el bloque `tenant` se construye con sus cinco campos enumerados, no
 * esparciendo el doc, así que ningún token, contraseña ni URL de webhook puede
 * colarse por aquí hacia n8n.
 */
export function buildEnvelope(
  event: TenantEventName,
  tenant: EventTenant,
  data: Record<string, unknown>,
  overrides: { id?: string; occurredAt?: string } = {},
): EventEnvelope {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    event,
    version: EVENT_CATALOG[event].version,
    occurredAt: overrides.occurredAt ?? new Date().toISOString(),
    tenant: {
      id: tenant.id,
      subdomain: tenant.subdomain ?? null,
      name: tenant.name ?? null,
      whatsapp: tenant.generalInfo?.whatsapp ?? null,
      email: tenant.generalInfo?.email ?? null,
    },
    data,
  }
}

/**
 * ¿Sale este evento para este Tenant, y a qué tubo? Si no sale, por qué no
 * (para el log).
 */
export function deliveryDecision(
  event: TenantEventName,
  tenant: EventTenant,
): { send: true; url: string } | { send: false; reason: string } {
  const spec = EVENT_CATALOG[event]

  if (spec.onlyWhenActive && !tenant.active) {
    return { send: false, reason: 'el tenant está inactivo (no recibe Avisos)' }
  }

  // Los eventos de plataforma no dependen del tubo del cliente: salen aunque
  // ese campo esté vacío, y de hecho `tenant.created` sale ANTES de que la
  // ruta de ese tubo exista del otro lado.
  if (spec.destination === 'platform') {
    return { send: true, url: PLATFORM_EVENTS_WEBHOOK }
  }

  if (!tenant.eventsWebhook) {
    // No es un error: es un Tenant sin consumidor configurado. No debería
    // pasar, porque el campo se llena solo al crear.
    return { send: false, reason: 'no tiene "eventsWebhook" configurado' }
  }

  return { send: true, url: tenant.eventsWebhook }
}

/**
 * Un Lead como viaja en `data`. Lo que llega puede ser el doc recién guardado o
 * —cuando el guardado falló y solo tenemos lo que contestó la gente— un puñado
 * de campos sueltos.
 */
export type LeadLike = {
  id?: number | string | null
  name?: string | null
  phone?: string | null
  whatsapp?: string | null
  email?: string | null
  source?: string | null
  externalId?: string | null
  stage?: string | null
  status?: string | null
  notes?: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  utm?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  answers?: any
  createdAt?: string | null
}

/**
 * El `data` de los dos eventos que hablan de un Lead: `lead.created` y
 * `quiz.completed`. **Es el mismo cuerpo a propósito**, y esa es la decisión
 * que sostiene esta función.
 *
 * Del otro lado, en n8n, un solo juego de nodos lee los dos eventos: se enruta
 * por `event` para decidir qué hacer, no para saber dónde está el teléfono. Si
 * cada evento nombrara sus campos a su manera —`id` aquí, `leadId` allá— cada
 * workflow tendría dos mapeos para los mismos dos datos, y el día que se agregue
 * un tercer evento sobre Leads serían tres.
 *
 * Un `quiz.completed` cuyo Lead no se pudo guardar trae los mismos campos con
 * `id` en nulo: la forma no cambia porque el guardado haya fallado. Es
 * justamente el caso que hace que estos dos eventos sigan siendo dos y no uno
 * (ADR 0008, decisión 3).
 *
 * Enumerado y no esparcido: lo que se agregue mañana a la colección `leads` no
 * se va solo a n8n.
 */
export function leadEventData(lead: LeadLike): Record<string, unknown> {
  return {
    id: lead.id ?? null,
    name: lead.name ?? null,
    phone: lead.phone ?? null,
    whatsapp: lead.whatsapp ?? null,
    email: lead.email ?? null,
    source: lead.source ?? null,
    externalId: lead.externalId ?? null,
    stage: lead.stage ?? null,
    status: lead.status ?? null,
    notes: lead.notes ?? null,
    utm: lead.utm ?? null,
    answers: lead.answers ?? null,
    createdAt: lead.createdAt ?? null,
  }
}

type EmitArgs = {
  event: TenantEventName
  tenant: EventTenant
  data: Record<string, unknown>
  payload: Payload
}

/**
 * Emite un evento al tubo del Tenant. **No se espera y nunca lanza**: un fallo
 * al emitir no impide que el hecho se haya guardado ni revierte nada (ADR 0008,
 * decisión 5). Lo único que deja un fallo es una línea en el log.
 *
 * El Tenant llega ya leído, no se lee aquí, y la razón no es de estilo: lo
 * único que se difiere es la petición a n8n. Si la lectura viajara adentro del
 * `waitUntil`, correría en una conexión nueva mientras la transacción del
 * guardado todavía no hizo commit, y no encontraría ni al Tenant recién creado.
 * Ver `loadEventTenant`.
 */
export function emitTenantEvent({ event, tenant, data, payload }: EmitArgs): void {
  const decision = deliveryDecision(event, tenant)
  if (!decision.send) {
    payload.logger.info(`No se emite ${event} para ${tenant.name ?? tenant.id}: ${decision.reason}`)
    return
  }

  const envelope = buildEnvelope(event, tenant, data)

  const delivery = deliver(envelope, decision.url, payload).catch((err) => {
    payload.logger.warn(`Falló la emisión de ${event} para el tenant ${tenant.id}: ${err}`)
  })

  // `waitUntil` mantiene viva la petición saliente después de que la función
  // serverless contestó. Sin él, un `fetch` sin `await` puede morir cuando
  // Vercel congela la función. Fuera de Vercel (dev, scripts, tests) no hay
  // contexto y no hace nada: la promesa corre igual.
  waitUntil(delivery)
}

/**
 * Lee del Tenant lo que el emisor necesita. Quien llama la espera —es una
 * lectura por id contra la misma base, no una llamada a n8n— y si está dentro
 * de un hook le pasa su `req`, para que la lectura vea la transacción en curso.
 */
export async function loadEventTenant(
  payload: Payload,
  tenantId: number | string,
  req?: PayloadRequest,
): Promise<EventTenant | null> {
  try {
    return (await payload.findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 0,
      select: EVENT_TENANT_SELECT,
      overrideAccess: true,
      req,
    })) as EventTenant
  } catch (err) {
    payload.logger.warn(`No se pudo leer el tenant ${tenantId} para emitir un evento: ${err}`)
    return null
  }
}

/**
 * `emitTenantEvent` para quien solo tiene el id del Tenant a la mano. Lo que se
 * espera es la lectura; la entrega sigue sin esperarse.
 */
export async function emitTenantEventById({
  event,
  tenantId,
  data,
  payload,
  req,
}: Omit<EmitArgs, 'tenant'> & {
  tenantId: number | string | null | undefined
  req?: PayloadRequest
}): Promise<void> {
  if (tenantId === null || tenantId === undefined) {
    payload.logger.warn(`No se emite ${event}: el documento no trae tenant`)
    return
  }

  const tenant = await loadEventTenant(payload, tenantId, req)
  if (!tenant) {
    payload.logger.warn(`No se emite ${event}: no existe el tenant ${tenantId}`)
    return
  }

  emitTenantEvent({ event, tenant, data, payload })
}

async function deliver(
  envelope: EventEnvelope,
  eventsWebhook: string,
  payload: Payload,
): Promise<void> {
  const res = await fetch(eventsWebhook, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Ninguno de los dos es seguridad (ADR 0008, decisión 6): `Event` sirve
      // para enrutar del otro lado y `Delivery` para descartar duplicados.
      'X-Notoriovs-Event': envelope.event,
      'X-Notoriovs-Delivery': envelope.id,
    },
    body: JSON.stringify(envelope),
  })

  if (!res.ok) {
    // No hay reintento ni cola: si n8n contesta mal, este aviso no se manda
    // nunca. El hecho quedó guardado; lo que se pierde es la inmediatez.
    payload.logger.warn(
      `${envelope.event} rechazado por el webhook del tenant ${envelope.tenant.id}: HTTP ${res.status}`,
    )
  }
}
