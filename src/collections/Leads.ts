import type { CollectionConfig } from 'payload'
import { isInternalUser } from '@/access/isInternalUser'

// Leads generados por el quiz de cada tenant. Antes solo se reenviaban a un
// webhook de n8n (ver `Tenants.quizWebhook` y /api/quiz-submit); ahora
// además se guardan aquí para poder mostrarlos en el dashboard de cliente
// (Kanban + edición + KPIs). El envío a n8n se mantiene igual (dual-write)
// para no romper automatizaciones existentes.
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
          'Resultado del lead, independiente de la etapa en la que esté. Se actualiza solo al mover la etapa hacia una marcada como "Ganado"/"Perdido" en el pipeline del tenant; también se puede fijar a mano (ej. "Descalificado") desde el panel de detalle del lead.',
      },
    },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'quiz',
      options: [
        { label: 'Quiz', value: 'quiz' },
        { label: 'Manual', value: 'manual' },
      ],
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
        description: 'Copia cruda de todas las respuestas enviadas por el lead (react-hook-form values).',
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
  ],
  timestamps: true,
}
