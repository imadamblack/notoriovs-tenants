// @vitest-environment node
import { describe, it, expect } from 'vitest'

import {
  buildEnvelope,
  deliveryDecision,
  EVENT_TENANT_SELECT,
  PLATFORM_EVENTS_WEBHOOK,
  leadEventData,
} from '@/events/tenantEvents'

// El sobre es la otra puerta por la que salen datos del Tenant (la primera son
// las páginas públicas, ver tenantProjections). Va hacia n8n en TODOS los
// eventos, así que un descuido aquí no se escapa por un evento sino por los
// tres. Ver ADR 0008.

// Un Tenant como viene de la base, con todo lo que NUNCA debe salir.
const tenantConSecretos = {
  id: 12,
  name: 'Acme Dental',
  subdomain: 'acme',
  active: true,
  generalInfo: { whatsapp: '521234567890', email: 'mail@mail.com', legalName: 'Acme SA de CV' },
  eventsWebhook: 'https://n8n.notoriovs.com/webhook/acme',
  tracking: { metaPixelId: '123', metaCapiToken: 'SECRETO' },
}

describe('sobre de eventos del tenant', () => {
  it('el bloque tenant son cinco campos y nada más', () => {
    const envelope = buildEnvelope('lead.created', tenantConSecretos, { id: 7 })

    expect(envelope.tenant).toEqual({
      id: 12,
      subdomain: 'acme',
      name: 'Acme Dental',
      whatsapp: '521234567890',
      email: 'mail@mail.com',
    })

    // Ni el token de CAPI ni la URL del propio tubo viajan adentro, aunque se
    // le pase el doc completo: el sobre se enumera, no se esparce.
    const serialized = JSON.stringify(envelope)
    expect(serialized).not.toContain('SECRETO')
    expect(serialized).not.toContain('metaCapiToken')
    expect(serialized).not.toContain('eventsWebhook')
    expect(serialized).not.toContain('n8n.notoriovs.com')
  })

  it('lo que el emisor lee del Tenant tampoco incluye secretos', () => {
    expect(EVENT_TENANT_SELECT).not.toHaveProperty('tracking')
    expect(EVENT_TENANT_SELECT.generalInfo).toEqual({ whatsapp: true, email: true })
  })

  it('un tenant inactivo no emite el aviso de Lead, pero sí los otros eventos', () => {
    const inactivo = { ...tenantConSecretos, active: false }

    expect(deliveryDecision('lead.created', inactivo).send).toBe(false)
    expect(deliveryDecision('tenant.created', inactivo).send).toBe(true)
    expect(deliveryDecision('lead.created', tenantConSecretos).send).toBe(true)
  })

  it('los eventos del negocio del cliente salen a SU tubo', () => {
    expect(deliveryDecision('lead.created', tenantConSecretos)).toEqual({
      send: true,
      url: 'https://n8n.notoriovs.com/webhook/acme',
    })
    expect(deliveryDecision('quiz.completed', tenantConSecretos)).toEqual({
      send: true,
      url: 'https://n8n.notoriovs.com/webhook/acme',
    })
  })

  // El alta es el evento que CREA la ruta del tubo del cliente en n8n, así que
  // no puede salir por ella. Sale por el tubo de plataforma, y tiene que salir
  // aunque el tubo del cliente esté vacío: en ese momento todavía no escucha
  // nadie del otro lado.
  it('el alta de un cliente sale al tubo de plataforma, aunque no tenga el suyo', () => {
    expect(deliveryDecision('tenant.created', { ...tenantConSecretos, eventsWebhook: '' })).toEqual({
      send: true,
      url: PLATFORM_EVENTS_WEBHOOK,
    })
    expect(PLATFORM_EVENTS_WEBHOOK).toBe('https://n8n.notoriovs.com/webhook/tenants-crm')
  })

  it('sin eventsWebhook no salen los eventos del cliente', () => {
    expect(deliveryDecision('lead.created', { ...tenantConSecretos, eventsWebhook: '' }).send).toBe(
      false,
    )
  })
})

// `lead.created` y `quiz.completed` mandan el MISMO cuerpo a la misma URL, y de
// eso depende que un workflow de n8n tenga un solo mapeo en vez de dos.
describe('cuerpo compartido de los eventos de Lead', () => {
  const lead = {
    id: 356, name: 'Ana Ruiz', phone: '3312345678', email: 'ana@example.com',
    source: 'quiz', stage: 'etapa-1', status: 'open',
    answers: { nombre: 'Ana Ruiz' }, utm: { utm_source: 'meta' },
    createdAt: '2026-09-12T18:04:22.099Z',
  }

  it('los dos eventos traen exactamente los mismos campos', () => {
    const creado = buildEnvelope('lead.created', tenantConSecretos, leadEventData(lead))
    const quiz = buildEnvelope('quiz.completed', tenantConSecretos, leadEventData(lead))

    expect(Object.keys(quiz.data)).toEqual(Object.keys(creado.data))
    expect(quiz.data).toEqual(creado.data)
  })

  // Sin Lead guardado la forma NO cambia: lo que no existe va en nulo, y el
  // contacto sigue viajando porque sale de las respuestas. Es el caso en que
  // alguien tiene que atender a mano, así que es el peor momento para mandar
  // un cuerpo distinto.
  it('sin Lead guardado cambia el contenido, no la forma', () => {
    const sinLead = leadEventData({
      name: 'Ana Ruiz', phone: '3312345678', source: 'quiz', answers: lead.answers,
    })

    expect(Object.keys(sinLead)).toEqual(Object.keys(leadEventData(lead)))
    expect(sinLead.id).toBeNull()
    expect(sinLead.name).toBe('Ana Ruiz')
    expect(sinLead.answers).toEqual(lead.answers)
  })

  it('no se cuela nada que no esté enumerado', () => {
    const conBasura = leadEventData({ ...lead, tenant: 12, updatedAt: 'x' } as never)
    expect(conBasura).not.toHaveProperty('tenant')
    expect(conBasura).not.toHaveProperty('updatedAt')
  })
})
