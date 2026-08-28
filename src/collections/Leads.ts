import type { CollectionConfig } from 'payload'

// Leads generados por el quiz de cada tenant. Antes solo se reenviaban a un
// webhook de n8n (ver `Tenants.quizWebhook` y /api/quiz-submit); ahora
// además se guardan aquí para poder mostrarlos en el dashboard de cliente
// (Kanban + edición + KPIs). El envío a n8n se mantiene igual (dual-write)
// para no romper automatizaciones existentes.
//
// `status` es texto libre (no `select`) a propósito: las etapas del Kanban
// son configurables por tenant (ver `Tenants.leadPipeline`), así que no hay
// un set fijo de opciones que Payload pueda validar a nivel de campo. La
// validación real de que `status` sea una etapa vigente del tenant vive en
// las rutas del dashboard de cliente (`/api/tenant-dashboard/*`), que ya
// tienen cargado el pipeline del tenant en memoria.
//
// El campo `tenant` NO está en `fields` a propósito: lo inyecta
// `multiTenantPlugin` (ver payload.config.ts) con el mismo nombre
// ('tenant') y el mismo `relationTo: 'tenants'` que tenía aquí a mano, para
// habilitar el selector de tenant del admin sin duplicar el campo.
export const Leads: CollectionConfig = {
  slug: 'leads',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'tenant', 'status', 'phone', 'createdAt'],
    description: 'Leads capturados por el quiz de cada tenant.',
  },
  access: {
    // Solo usuarios internos autenticados en Payload (admin panel / API
    // directa) pueden leer, crear, editar o borrar leads. El dashboard de
    // cliente (auth por contraseña simple, sin usuario Payload) llega a
    // estos datos a través de rutas server-side que usan la Local API con
    // `overrideAccess: true` y filtran manualmente por tenant, así que no
    // depende de estas reglas.
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
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
      name: 'status',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description:
          'Debe coincidir con el "key" de una etapa definida en Tenants → Dashboard Cliente → Pipeline. Se asigna automáticamente a la primera etapa cuando se crea el lead.',
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
    { fields: ['tenant', 'status'] },
    { fields: ['tenant', 'createdAt'] },
  ],
  timestamps: true,
}
