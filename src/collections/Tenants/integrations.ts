import type { Tab } from 'payload'

// Integraciones salientes del tenant: el tubo de eventos y los píxeles de
// tracking.

export const integrationsTab: Tab = {
  label: 'Webhooks',
  fields: [
    {
      // El destino saliente de este cliente: los eventos de SU negocio van
      // aquí —hoy `lead.created` y `quiz.completed`— y se distinguen por el
      // campo `event` del cuerpo, no por la URL (ADR 0008). El alta del cliente
      // no sale por aquí: es un hecho de nuestra cartera, no de su negocio, y
      // va al tubo de plataforma (ver src/events/tenantEvents.ts).
      //
      // Se autogenera al CREAR el tenant (ver el hook beforeValidate en
      // index.ts) y a partir de ahí es del que edita: a diferencia del viejo
      // `quizWebhook`, no se reescribe en cada guardado. El precio de eso es
      // que renombrar el subdominio NO repunta el webhook —queda apuntando al
      // workflow viejo y hay que corregirlo a mano—, y es preferible a que se
      // repunte solo a una URL que en n8n no existe y los avisos se pierdan en
      // silencio.
      name: 'eventsWebhook',
      type: 'text',
      label: 'Webhook de eventos',
      admin: {
        description:
          'A dónde se mandan los eventos de este cliente (lead nuevo, quiz completado). Se genera solo al crear el cliente como https://n8n.notoriovs.com/webhook/ + subdominio; cámbialo solo si el cliente quiere sus eventos en su propio sistema. Si se deja vacío, el cliente deja de recibir avisos.',
      },
    },
    {
      name: 'tracking',
      type: 'group',
      label: 'Tracking',
      fields: [
        { name: 'metaPixelId', type: 'text', label: 'Meta Pixel' },
        { name: 'metaCapiToken', type: 'text', label: 'Meta Conversions API Token' },
        { name: 'googleTagId', type: 'text', label: 'Google Tag' },
      ],
    },
  ],
}
