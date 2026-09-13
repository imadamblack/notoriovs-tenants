import type { CollectionConfig } from 'payload'
import { isInternalUser } from '@/access/isInternalUser'
import { isSuperadmin } from '@/access/internalRoles'
import { revalidateTenantSite } from '@/utils/tenantSiteCache'
import { identityFields, generalInfoTab } from './identity'
import { landingTab } from './landing'
import { quizTab, thankYouTab, notEligibleTab } from './quiz'
import { integrationsTab } from './integrations'
import { pipelineTab } from './pipeline'
import { emitTenantEvent, EVENTS_WEBHOOK_BASE } from '@/events/tenantEvents'

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
    // La lectura por API deja de ser pública. Todas las páginas del sitio de
    // un tenant resuelven su documento con la Local API (`getTenantBySubdomain`),
    // que corre con `overrideAccess: true`, así que la landing y el quiz siguen
    // sirviéndose igual a cualquier visitante.
    //
    // Lo que cierra es `GET /api/tenants`: ese endpoint devolvía el documento
    // COMPLETO de todos los clientes —incluido `tracking.metaCapiToken`, y en
    // su momento la contraseña compartida del dashboard, ya retirada—. Con los
    // Tenant Users teniendo ya sesión de Payload, eso les habría entregado los
    // secretos de cualquier otro tenant con una sola petición.
    read: isInternalUser,
    // Crear y borrar clientes es del superadmin (issue 09). Editar no: eso es
    // el trabajo diario de un account manager sobre los clientes que tiene
    // asignados, y a esos lo acota `multiTenantPlugin` (ver payload.config.ts),
    // que le agrega `id in [sus tenants]` a todas estas reglas.
    //
    // `create` también, aunque el issue solo pida cerrar el borrado: un
    // account manager que da de alta un cliente se queda sin poder verlo en
    // cuanto lo guarda (no está en su lista de asignados), así que el alta
    // pasa por quien además reparte las asignaciones.
    //
    // Que estén escritas aquí y no heredadas también cierra un agujero que no
    // era de roles: sin `access` explícito, Payload permite la operación a
    // cualquiera con sesión, y desde el issue 08 eso incluye a los Tenant
    // Users. Un cliente podía borrar el Tenant de otro con una llamada a
    // `DELETE /api/tenants/:id`.
    create: isSuperadmin,
    update: isInternalUser,
    delete: isSuperadmin,
  },
  hooks: {
    // Autogenera `eventsWebhook` a partir de `subdomain`, **solo al crear**:
    // después es un campo editable y reescribirlo en cada guardado borraría la
    // edición del que lo apuntó a su propio sistema (ADR 0008, decisión 1).
    //
    // Va aquí (a nivel de colección) y no como hook de campo porque `subdomain`
    // es un campo raíz y `eventsWebhook` vive anidado dentro de `tabs`: los
    // hooks beforeValidate de campo corren todos en paralelo (Promise.all) y el
    // recorrido síncrono llega al campo anidado antes de que se resuelva el
    // microtask que escribe el valor de `subdomain`, dejándolo vacío. El hook
    // de colección beforeValidate, en cambio, corre solo después de que TODO el
    // árbol de hooks de campo terminó, así que aquí `data.subdomain` ya es el
    // valor final.
    beforeValidate: [
      ({ data, operation }) => {
        if (operation !== 'create') return data
        if (typeof data?.eventsWebhook === 'string' && data.eventsWebhook.trim()) return data
        if (typeof data?.subdomain === 'string' && data.subdomain.trim()) {
          return { ...data, eventsWebhook: `${EVENTS_WEBHOOK_BASE}${data.subdomain}` }
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
    //  - update: incluye activar y desactivar el tenant. Ya no cambia si el
    //    sitio se sirve o no —un tenant inactivo conserva landing y quiz (issue
    //    23)—, pero sí cambia lo que se pinta en ellas, así que se invalida
    //    igual que cualquier otra edición.
    // Si cambió el subdominio hay que invalidar los dos: el viejo se queda
    // sirviendo el sitio hasta que se le diga lo contrario.
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        await revalidateTenantSite([doc.subdomain, previousDoc?.subdomain], req.payload)
      },

      // Avisa que se dio de alta un cliente nuevo (no en updates). Va al tubo
      // de PLATAFORMA, no al del cliente: del otro lado, este evento es el que
      // crea la infraestructura de este Tenant en n8n —incluida la ruta de su
      // propio `eventsWebhook`—, así que mandarlo al tubo del cliente sería
      // mandarlo a una URL que todavía no escucha nadie. Si no llega, el
      // cliente queda sin infraestructura y no se pierde un aviso: se pierden
      // todos. Por eso el ADR 0008 pide confirmarlo a mano al dar de alta.
      //
      // `emitTenantEvent` no se espera: este hook corre dentro de la
      // transacción de Postgres del guardado, y un n8n lento la mantendría
      // abierta (issue 33).
      ({ doc, operation, req }) => {
        if (operation !== 'create') return

        emitTenantEvent({
          event: 'tenant.created',
          // El doc recién guardado ya es el Tenant: no hace falta releerlo, y
          // el sobre se arma enumerando sus cinco campos, no esparciéndolo.
          tenant: doc,
          // Quién es el cliente y cómo contactarlo ya viaja en el sobre de
          // todos los eventos; `data` es lo que el sobre no dice.
          data: {
            quizQuestions: Array.isArray(doc.quizSteps)
              ? doc.quizSteps.map((step: { name?: string }) => step?.name)
              : [],
            createdAt: doc.createdAt ?? new Date().toISOString(),
          },
          payload: req.payload,
        })
      },
    ],

    // Los Tenant Users de este cliente se van con él. Va en `beforeDelete` y
    // no en `afterDelete` por una razón dura, no de estilo: la llave foránea
    // de `tenant_users.tenant_id` es `ON DELETE SET NULL` sobre una columna
    // `NOT NULL`, así que si el Tenant se borra primero, Postgres rechaza el
    // borrado entero y el admin muestra un error sin explicación. Limpiando
    // antes, el borrado pasa.
    //
    // Un Tenant User no significa nada sin su Tenant: no puede entrar a ningún
    // otro (ver TenantUsers) y no hay a quién reasignarlo. Los Leads, en
    // cambio, NO se tocan: su `tenant_id` sí admite nulo y son el registro
    // histórico del negocio.
    //
    // `req` va incluido para que esto viaje en la misma transacción que el
    // borrado del Tenant: si el borrado falla después, los usuarios vuelven.
    beforeDelete: [
      async ({ id, req }) => {
        await req.payload.delete({
          collection: 'tenant-users',
          where: { tenant: { equals: id } },
          req,
          overrideAccess: true,
        })
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
