import type { CollectionConfig } from 'payload'
import { revalidateTenantSite } from '@/utils/tenantSiteCache'
import { identityFields, generalInfoTab } from './identity'
import { landingTab } from './landing'
import { quizTab, thankYouTab, notEligibleTab } from './quiz'
import { integrationsTab, N8N_WEBHOOK_BASE } from './integrations'
import { pipelineTab } from './pipeline'

// La configuración del tenant vive repartida por área en los módulos vecinos.
// Este archivo solo ensambla: los hooks de colección y el orden de los tabs.

export const Tenants: CollectionConfig = {
  slug: 'tenants',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'subdomain', 'active'],
    description:
      'Crea y edita la landing, quiz y webhooks de un cliente',
    livePreview: {
      url: ({ data }) => `/tenant-site/${data.subdomain}`,
    },
  },
  access: {
    read: () => true,
    // create/update/delete: restringir a admins internos cuando se defina el rol client-editor.
  },
  hooks: {
    // Autogenera `quizWebhook` a partir de `subdomain`. Va aquí (a nivel de
    // colección) y no como hook de campo porque `subdomain` es un campo raíz
    // y `quizWebhook` vive anidado dentro de `tabs`: los hooks beforeValidate
    // de campo corren todos en paralelo (Promise.all) y el recorrido síncrono
    // llega al campo anidado antes de que se resuelva el microtask que
    // escribe el valor de `subdomain`, dejando `quizWebhook` vacío. El hook
    // de colección beforeValidate, en cambio, corre solo después de que
    // TODO el árbol de hooks de campo terminó, así que aquí `data.subdomain`
    // ya es el valor final.
    beforeValidate: [
      ({ data }) => {
        if (typeof data?.subdomain === 'string' && data.subdomain.trim()) {
          return { ...data, quizWebhook: `${N8N_WEBHOOK_BASE}${data.subdomain}` }
        }
        return data
      },
    ],
    // Refresca las páginas públicas del tenant (landing, quiz, gracias, no
    // elegible, aviso de privacidad), que se sirven prerrenderizadas desde el
    // CDN. Sin esto, guardar en el admin no cambiaría nada visible hasta que
    // venciera el TTL. Ver src/utils/tenantSiteCache.ts.
    //
    // Corre en TODA operación, no solo en update:
    //  - create: publica el sitio del tenant nuevo sin necesidad de desplegar
    //    (y tira el 404 que pudo haberse cacheado si alguien entró antes).
    //  - update: incluye desactivar el tenant, porque `active: false` hace que
    //    la página deje de resolverlo y pase a 404.
    // Si cambió el subdominio hay que invalidar los dos: el viejo se queda
    // sirviendo el sitio hasta que se le diga lo contrario.
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        await revalidateTenantSite([doc.subdomain, previousDoc?.subdomain], req.payload)
      },

      // Notifica a n8n cuando se da de alta un tenant nuevo (no en updates).
      // Fire-and-forget: no bloquea ni revierte la creación si el webhook falla.
      async ({ doc, operation, req }) => {
        if (operation !== 'create') return

        try {
          await fetch(`${N8N_WEBHOOK_BASE}tenant-created`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: doc.name,
              subdomain: doc.subdomain,
              whatsapp: doc.generalInfo?.whatsapp,
              email: doc.generalInfo?.email,
              quizWebhook: doc.quizWebhook,
              quizQuestions: Array.isArray(doc.quizSteps)
                ? doc.quizSteps.map((step: { name?: string }) => step?.name)
                : [],
              createdAt: new Date().toISOString(),
            }),
          })
        } catch (err) {
          req.payload.logger.warn(`No se pudo notificar tenant-created a n8n para tenant ${doc.name}: ${err}`)
        }
      },
    ],

    // Borrar el tenant también tiene que bajar su sitio: la página cacheada
    // sobreviviría al documento.
    afterDelete: [
      async ({ doc, req }) => {
        await revalidateTenantSite([doc.subdomain], req.payload)
      },
    ],
  },
  fields: [
    ...identityFields,
    {
      type: 'tabs',
      tabs: [
        generalInfoTab,
        landingTab,
        quizTab,
        thankYouTab,
        notEligibleTab,
        integrationsTab,
        pipelineTab,
      ],
    },
  ],
}
