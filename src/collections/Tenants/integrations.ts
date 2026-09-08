import type { Tab } from 'payload'

// Integraciones salientes del tenant: webhooks de n8n y píxeles de tracking.

// Base de los webhooks de n8n. El webhook del quiz de cada tenant vive en
// `${N8N_WEBHOOK_BASE}${subdomain}`; el evento de alta de tenant se dispara
// a `${N8N_WEBHOOK_BASE}tenant-created`.
export const N8N_WEBHOOK_BASE = 'https://n8n.notoriovs.com/webhook/'

export const integrationsTab: Tab = {
  label: 'Webhooks',
  fields: [
    {
      name: 'optInWebhook',
      type: 'text',
      admin: {
        description: 'URL a la que se envía el lead cuando completa el opt-in inicial (antes de empezar el quiz).',
      },
    },
    {
      // Se autogenera en el hook beforeValidate de la colección
      // (ver index.ts) a partir de `subdomain`, en cada guardado.
      name: 'quizWebhook',
      type: 'text',
      admin: {
        readOnly: true,
        description:
          'Se genera automáticamente como https://n8n.notoriovs.com/webhook/ + subdominio. No editable.',
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
