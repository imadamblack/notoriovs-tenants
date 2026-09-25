import type { CollectionConfig } from 'payload'
import { isInternalUser } from '@/access/isInternalUser'
import { emitTenantEventById, leadEventData } from '@/events/tenantEvents'
import { sendTenantPush } from '@/notifications/pushSend'
import { scopeBulkToSelectedTenant } from './scopeBulkToSelectedTenant'
import { assertAssigneeInLeadTenant } from './leadAssignee'

// Fuentes que disparan el push interno (issue 36, ADR 0011): el quiz y las
// que entran por una fuente externa (Meta/WhatsApp, vía
// POST /api/leads/ingest). Un alta manual desde el Dashboard ('manual') o
// una importación ('import') las hizo el propio cliente o el equipo a
// propósito — avisarle de algo que él mismo acaba de hacer es ruido, no un
// Aviso. Es distinto del webhook a n8n (`emitTenantEventById` abajo), que
// sigue disparando para los 5 `source` sin este filtro: `lead.created` y su
// cuerpo no se tocan, solo el push interno gana esta condición extra.
const PUSH_ELIGIBLE_SOURCES = new Set(['quiz', 'meta', 'whatsapp'])

// Leads generados por el quiz de cada tenant. Antes solo se reenviaban a un
// webhook de n8n (ver /api/quiz-submit); ahora además se guardan aquí para
// poder mostrarlos en el dashboard de cliente (Kanban + edición + KPIs), y el
// aviso al cliente sale del hook `afterChange` de abajo.
//
// Dos campos separados para dos preguntas distintas:
//   - `stage`: EN QUÉ COLUMNA del Kanban está el lead ahora mismo. Guarda el
//     "id" interno (autogenerado por Payload) de una fila de
//     `Tenants.leadPipeline`, no su nombre, para que renombrar o reordenar
//     etapas nunca rompa esta relación. Texto libre (no `select`) a
//     propósito: las etapas son configurables por tenant, así que no hay un
//     set fijo de opciones que Payload pueda validar a nivel de campo. Esa
//     validación vive en las rutas del dashboard de cliente
//     (`/api/tenant-dashboard/*`), que ya tienen cargado el pipeline del
//     tenant en memoria.
//   - `status`: EL RESULTADO del lead (abierto/ganado/perdido/descalificado),
//     con un set fijo de 4 opciones igual para todos los tenants. Es
//     independiente de en qué etapa está: sirve para calcular tasa de
//     conversión sin importar cómo se llamen las etapas de cada tenant.
//     Se re-sincroniza automáticamente cuando `stage` cambia hacia una
//     etapa marcada como "Ganado"/"Perdido" en el pipeline del tenant (ver
//     PATCH /api/tenant-dashboard/leads), salvo que el request ya traiga un
//     `status` explícito (ej. marcar "Descalificado" a mano).
//
// El campo `tenant` NO está en `fields` a propósito: lo inyecta
// `multiTenantPlugin` (ver payload.config.ts) con el mismo nombre
// ('tenant') y el mismo `relationTo: 'tenants'` que tenía aquí a mano, para
// habilitar el selector de tenant del admin sin duplicar el campo.
export const Leads: CollectionConfig = {
  slug: 'leads',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'tenant', 'stage', 'status', 'phone', 'createdAt'],
    description: 'Leads capturados por el quiz de cada tenant.',
    components: {
      // Panel para subir un CSV y dar de alta varios leads a la vez, arriba
      // del listado. Ver /api/leads/bulk-import para el porqué de tantas
      // verificaciones ahí: este componente solo manda el tenant seleccionado
      // y el contenido del archivo; todo lo demás (parseo, `stage` inicial,
      // control de acceso) pasa del lado del servidor.
      beforeListTable: ['/components/admin/BulkLeadImport#BulkLeadImport'],
    },
  },
  hooks: {
    // "Select all" + Edit/Delete del panel: que no se salga del tenant elegido.
    beforeOperation: [scopeBulkToSelectedTenant],
    // El Responsable solo puede ser alguien del Tenant del Lead (issue 38).
    beforeChange: [assertAssigneeInLeadTenant],
    // EL punto de emisión de `lead.created` (ADR 0008, decisión 4). Está aquí,
    // en la colección, y no en cada ruta que crea Leads, porque un Lead entra
    // hoy por cuatro puertas —el quiz, el alta a mano del cliente, el ingest de
    // n8n y el panel de Payload— y solo esta las cubre todas: el panel no pasa
    // por ninguna ruta nuestra, y una ruta nueva queda cubierta sin acordarse
    // de nada.
    //
    // `operation === 'create'` es también lo que sostiene la idempotencia del
    // ingest: un reintento de n8n que cae en `update` por `externalId` no
    // vuelve a avisar.
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation !== 'create') return

        // Según la profundidad con que se guardó, `tenant` llega como id o ya
        // poblado.
        const tenantId =
          doc.tenant && typeof doc.tenant === 'object' ? doc.tenant.id : doc.tenant

        // No se espera la entrega, y un fallo no revierte nada: el Lead ya
        // está guardado (este hook corre dentro de su transacción). Lo único
        // que se espera es leer el Tenant, que es una lectura por id contra la
        // misma base.
        await emitTenantEventById({
          event: 'lead.created',
          tenantId,
          // El Lead completo salvo campos internos, en el mismo cuerpo que
          // usa `quiz.completed`: un solo juego de nodos en n8n lee los dos.
          data: leadEventData(doc),
          payload: req.payload,
          req,
        })

        // El push interno, aparte del webhook de arriba (ADR 0011). Un alta
        // desde el panel de Payload no la distingue ningún `source` por sí
        // solo —queda en su default 'quiz' si nadie lo cambia—, así que se
        // excluye aparte comprobando que quien creó el Lead no sea un
        // Internal User.
        if (req.user?.collection !== 'users' && PUSH_ELIGIBLE_SOURCES.has(doc.source)) {
          sendTenantPush({
            tenantId,
            type: 'lead-new',
            payload: req.payload,
            req,
            buildMessage: () => ({
              title: 'Nuevo lead',
              body: `Llegó un lead nuevo desde ${sourceLabel(doc.source)}.`,
              url: `/dashboard?lead=${doc.id}`,
            }),
          })
        }
      },
    ],
  },
  access: {
    // Solo usuarios internos (colección `users`) pueden leer, crear, editar o
    // borrar leads. Ojo con la diferencia entre `isInternalUser` y el
    // `Boolean(req.user)` que había aquí antes: desde que los Tenant Users
    // tienen sesión de Payload propia, `req.user` también puede ser un
    // cliente, y con la regla vieja un `GET /api/leads` con su cookie le
    // habría devuelto los leads de todos los tenants.
    //
    // El Dashboard de Cliente no depende de estas reglas: llega a los leads
    // por rutas server-side que usan la Local API con `overrideAccess: true`
    // y filtran a mano por el tenant del host.
    read: isInternalUser,
    create: isInternalUser,
    update: isInternalUser,
    delete: isInternalUser,
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'name', type: 'text', label: 'Nombre' },
        { name: 'phone', type: 'text', label: 'Teléfono' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'whatsapp', type: 'text', label: 'WhatsApp (con lada)' },
        { name: 'email', type: 'text', label: 'Email' },
      ],
    },
    {
      name: 'stage',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description:
          'Guarda el "id" interno de una etapa definida en Tenants → Dashboard Cliente → Pipeline (no su nombre). Se asigna automáticamente a la primera etapa cuando se crea el lead; no se edita a mano desde aquí.',
      },
    },
    {
      name: 'status',
      type: 'select',
      label: 'Estado',
      required: true,
      defaultValue: 'open',
      index: true,
      options: [
        { label: 'Abierto', value: 'open' },
        { label: 'Ganado', value: 'won' },
        { label: 'Perdido', value: 'lost' },
        { label: 'Descalificado', value: 'disqualified' },
      ],
      admin: {
        description:
          'Estado del lead (abierto, ganado, perdido o descalificado), independiente de la etapa en la que esté. Se actualiza solo al mover la etapa hacia una marcada como "Ganado"/"Perdido" en el pipeline del tenant; también se puede fijar a mano (ej. "Descalificado") desde el panel de detalle del lead.',
      },
    },
    {
      // Quién del equipo del cliente atiende este Lead (issue 38). Es una
      // etiqueta de trabajo, no un permiso: no cambia quién ve el Lead.
      // `filterOptions` solo ordena el selector del panel; la regla de que
      // sea del mismo Tenant la impone `assertAssigneeInLeadTenant`.
      name: 'assignee',
      type: 'relationship',
      relationTo: 'tenant-users',
      hasMany: false,
      index: true,
      label: 'Responsable',
      filterOptions: ({ data }) => {
        const tenantId = data?.tenant && typeof data.tenant === 'object' ? data.tenant.id : data?.tenant
        return tenantId ? { tenant: { equals: tenantId } } : false
      },
      admin: {
        description:
          'Usuario de Cliente que atiende este lead. Solo puede ser alguien del mismo tenant; vacío es "Sin asignar".',
      },
    },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'quiz',
      // `quiz` y `manual` son los dos caminos que ya existían: el formulario
      // público y el alta a mano desde el panel. Los otros tres entran por
      // POST /api/leads/ingest, el endpoint que usa nuestro n8n para los
      // leads que nunca pasan por el quiz. Se guardan por canal (y no como
      // un solo valor "n8n") para que el dashboard pueda separarlos sin
      // abrir lead por lead, y porque el canal es del negocio: seguiría
      // significando lo mismo si mañana cambiamos de herramienta.
      options: [
        { label: 'Quiz', value: 'quiz' },
        { label: 'Manual', value: 'manual' },
        { label: 'Meta Ads', value: 'meta' },
        { label: 'WhatsApp', value: 'whatsapp' },
        { label: 'Importado', value: 'import' },
      ],
    },
    {
      name: 'externalId',
      type: 'text',
      label: 'Id en el sistema de origen',
      index: true,
      admin: {
        readOnly: true,
        description:
          'Id que trae el lead en el sistema donde nació (el id del lead en Meta, por ejemplo). Es lo único que permite que n8n reintente el mismo envío sin duplicar el lead: al reingresar, un lead con el mismo id dentro del mismo tenant se actualiza en vez de crearse otra vez. Los leads del quiz no lo llevan.',
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      label: 'Notas internas',
      admin: {
        description: 'Notas visibles y editables desde el dashboard de cliente.',
      },
    },
    {
      name: 'answers',
      type: 'json',
      label: 'Respuestas del quiz',
      admin: {
        description:
          'Lo que contestó el lead (react-hook-form values), ya con las ediciones que haya hecho quien lo atiende: si el lead se equivocó al contestar, se corrige aquí y punto. Es lo que muestran el panel de detalle y la exportación, y lo que leerá cualquier número sobre respuestas — medir sobre un error del lead no le sirve a nadie. Se edita desde el dashboard de cliente, no desde aquí.',
        readOnly: true,
      },
    },
    {
      name: 'utm',
      type: 'json',
      label: 'UTM / tracking',
      admin: { readOnly: true },
    },
  ],
  // Índices compuestos: las dos formas en que el dashboard realmente
  // consulta esta tabla son "leads de este tenant, en esta etapa" (Kanban)
  // y "leads de este tenant, ordenados por fecha" (listado). El índice
  // simple en `tenant` (que agrega multiTenantPlugin) ya acota la búsqueda
  // a ese tenant; estos compuestos evitan que Postgres tenga que ordenar u
  // hojear aparte dentro de ese subconjunto. No cambian nada del código de
  // la app, solo aceleran las lecturas conforme crece el volumen por tenant.
  indexes: [
    { fields: ['tenant', 'stage'] }, // agrupar el Kanban por etapa
    { fields: ['tenant', 'status'] }, // contar abiertos/ganados/perdidos/descalificados para KPIs
    { fields: ['tenant', 'createdAt'] }, // listado / tendencia por fecha
    { fields: ['tenant', 'externalId'] }, // buscar el lead ya ingresado al reintentar (ver /api/leads/ingest)
    { fields: ['tenant', 'assignee'] }, // filtro por Responsable del dashboard (issue 38)
  ],
  timestamps: true,
}

/** Texto legible del `source` para el cuerpo del push — solo los 3 que activan uno. */
function sourceLabel(source: unknown): string {
  switch (source) {
    case 'quiz':
      return 'el quiz'
    case 'meta':
      return 'Meta Ads'
    case 'whatsapp':
      return 'WhatsApp'
    default:
      return 'una fuente externa'
  }
}
