import type { CollectionConfig } from 'payload'
import { lexicalEditor, lexicalHTMLField } from '@payloadcms/richtext-lexical'
import { slugField } from '@/fields/slug'

// Los `value` deben coincidir 1:1 con el union type `SurveyStep['type']`
// definido en src/components/stepRenderer.tsx. Si agregas un tipo ahí,
// agrégalo también aquí.
const STEP_TYPES = [
  { label: 'Texto', value: 'text' },
  { label: 'Teléfono', value: 'tel' },
  { label: 'Número', value: 'number' },
  { label: 'Área de texto', value: 'textarea' },
  { label: 'Opción única (radio)', value: 'radio' },
  { label: 'Opción múltiple (checkbox)', value: 'checkbox' },
  { label: 'Selector (select)', value: 'select' },
  { label: 'Estado de la República (México)', value: 'state-mx' },
  { label: 'Opt-in (datos de contacto)', value: 'opt-in' },
  { label: 'Checkpoint (tracking, sin input)', value: 'checkpoint' },
] as const

const OPTION_STEP_TYPES = ['radio', 'checkbox', 'select']
const INPUT_STEP_TYPES = ['text', 'tel', 'number', 'textarea', 'radio', 'checkbox', 'select', 'state-mx']
const PLACEHOLDER_STEP_TYPES = ['text', 'tel', 'number', 'textarea', 'select', 'state-mx']

// Campo oculto que Payload calcula automáticamente a partir de
// `checkpointContent` (richText) y expone como HTML listo para renderizar.
const checkpointHTMLField = lexicalHTMLField({
  lexicalFieldName: 'checkpointContent',
  htmlFieldName: 'checkpointContentHTML',
})
checkpointHTMLField.admin = {
  ...checkpointHTMLField.admin,
  condition: (_, siblingData) => siblingData?.type === 'checkpoint',
}

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
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField({
      name: 'subdomain',
      source: 'name',
      position: undefined,
      description:
        'Se genera automáticamente desde "name".',
    }),
    { name: 'active', type: 'checkbox', defaultValue: true },

    // Botones de vista previa (landing/quiz/thankyou) en el sidebar. Ver
    // src/components/TenantPreviewLinks.tsx. El livePreview nativo de Payload
    // solo admite una `url` fija, así que esto cubre el resto de vistas.
    {
      name: 'previewLinks',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: '/components/TenantPreviewLinks#TenantPreviewLinks',
        },
      },
    },

    {
      type: 'tabs',
      tabs: [
        // ─────────────────────────────────────────
        // Info General
        // ─────────────────────────────────────────
        {
          label: 'Info General',
          fields: [
            {
              name: 'generalInfo',
              type: 'group',
              fields: [
                { name: 'companyName', type: 'text', required: true },
                { name: 'legalName', type: 'text' },
                { name: 'phone', type: 'text' },
                { name: 'whatsapp', type: 'text' },
                { name: 'email', type: 'text' },
                { name: 'address', type: 'textarea' },
                { name: 'logo', type: 'upload', relationTo: 'media', admin: { description: 'En formato horizontal'} },
                { name: 'privacyNoticeUrl', type: 'text', defaultValue: '/privacy-notice' },
                { name: 'termsUrl', type: 'text', defaultValue: '/terms-and-conditions' },
              ],
            },
          ],
        },

        // ─────────────────────────────────────────
        // Landing Page
        // ─────────────────────────────────────────
        {
          label: 'Landing Page',
          fields: [
            {
              name: 'landingHero',
              type: 'group',
              admin: {
                description:
                  'Si dejas el título vacío y no agregas bloques abajo, este tenant no tiene landing: la raíz del subdominio redirige directo al quiz.',
              },
              fields: [
                { name: 'title', type: 'text' },
                { name: 'subtitle', type: 'text' },
                { name: 'image', type: 'upload', relationTo: 'media' },
                { name: 'ctaLabel', type: 'text' },
                { name: 'ctaLink', type: 'text' },
              ],
            },
            {
              name: 'landingBlocks',
              type: 'blocks',
              blocks: [
                {
                  slug: 'richText',
                  labels: { singular: 'Bloque de texto', plural: 'Bloques de texto' },
                  fields: [
                    { name: 'heading', type: 'text' },
                    { name: 'body', type: 'textarea', required: true },
                    { name: 'ctaLabel', type: 'text' },
                    { name: 'ctaLink', type: 'text' },
                  ],
                },
                {
                  slug: 'stats',
                  labels: { singular: 'Estadísticas', plural: 'Bloques de estadísticas' },
                  fields: [
                    {
                      name: 'items',
                      type: 'array',
                      fields: [
                        { name: 'number', type: 'text', required: true },
                        { name: 'description', type: 'text', required: true },
                      ],
                    },
                  ],
                },
                {
                  slug: 'criteria',
                  labels: { singular: 'Criterios', plural: 'Bloques de criterios' },
                  fields: [
                    { name: 'heading', type: 'text' },
                    { name: 'intro', type: 'textarea' },
                    {
                      name: 'items',
                      type: 'array',
                      fields: [
                        { name: 'title', type: 'text', required: true },
                        { name: 'body', type: 'textarea', required: true },
                      ],
                    },
                  ],
                },
                {
                  slug: 'projects',
                  labels: { singular: 'Proyectos', plural: 'Bloques de proyectos' },
                  fields: [
                    { name: 'heading', type: 'text' },
                    { name: 'intro', type: 'textarea' },
                    {
                      name: 'items',
                      type: 'array',
                      fields: [
                        { name: 'zone', type: 'text' },
                        { name: 'name', type: 'text', required: true },
                        { name: 'price', type: 'text' },
                        { name: 'timeframe', type: 'text' },
                        { name: 'description', type: 'textarea' },
                        { name: 'badge', type: 'text' },
                        { name: 'image', type: 'upload', relationTo: 'media' },
                      ],
                    },
                  ],
                },
                {
                  slug: 'testimonials',
                  labels: { singular: 'Testimonios', plural: 'Bloques de testimonios' },
                  fields: [
                    { name: 'heading', type: 'text' },
                    {
                      name: 'items',
                      type: 'array',
                      fields: [
                        { name: 'message', type: 'textarea', required: true },
                        { name: 'name', type: 'text', required: true },
                      ],
                    },
                  ],
                },
                {
                  slug: 'faq',
                  labels: { singular: 'FAQ', plural: 'Bloques de FAQ' },
                  fields: [
                    { name: 'heading', type: 'text' },
                    {
                      name: 'items',
                      type: 'array',
                      fields: [
                        { name: 'question', type: 'text', required: true },
                        { name: 'answer', type: 'textarea', required: true },
                      ],
                    },
                  ],
                },
                {
                  slug: 'ctaFinal',
                  labels: { singular: 'CTA final', plural: 'Bloques de CTA final' },
                  fields: [
                    { name: 'heading', type: 'text', required: true },
                    { name: 'body', type: 'textarea' },
                    { name: 'ctaLabel', type: 'text' },
                    {
                      name: 'ctaTarget',
                      type: 'select',
                      defaultValue: 'quiz',
                      options: [
                        { label: 'Ir al quiz del tenant', value: 'quiz' },
                        { label: 'Ancla / URL personalizada', value: 'custom' },
                      ],
                    },
                    { name: 'ctaLink', type: 'text', admin: { condition: (_, sib) => sib?.ctaTarget === 'custom' } },
                  ],
                },
              ],
            },
          ],
        },

        // ─────────────────────────────────────────
        // Quiz — debe empatar con SurveyStep en stepRenderer.tsx
        // y con el consumo en /src/app/(frontend)/survey
        // ─────────────────────────────────────────
        {
          label: 'Quiz',
          fields: [
            {
              name: 'quizIntro',
              type: 'group',
              admin: { description: 'Configuración general de la barra de progreso / experiencia del quiz.' },
              fields: [
                { name: 'title', type: 'text' },
                { name: 'description', type: 'textarea' },
                { name: 'image', type: 'upload', relationTo: 'media' },
                { name: 'ctaLabel', type: 'text' },
              ],
            },
            {
              name: 'quizSteps',
              type: 'array',
              labels: { singular: 'Pregunta', plural: 'Preguntas' },
              admin: {
                description:
                  'Cada paso se traduce 1:1 a un SurveyStep consumido por StepRenderer/formAtoms en el frontend del quiz.',
              },
              // El paso "opt-in" siempre debe quedar al final del quiz, sin
              // importar en qué posición lo haya arrastrado el editor. Este
              // hook reordena el arreglo en cada guardado.
              hooks: {
                beforeChange: [
                  ({ value }) => {
                    if (!Array.isArray(value)) return value
                    const rest = value.filter((step) => step?.type !== 'opt-in')
                    const optIns = value.filter((step) => step?.type === 'opt-in')
                    return [...rest, ...optIns]
                  },
                ],
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'type', type: 'select', required: true, options: [...STEP_TYPES], defaultValue: 'radio' },
                    {
                      name: 'name',
                      type: 'text',
                      required: true,
                      admin: {
                        description:
                          'Nombre del campo en el formulario (react-hook-form). Debe ser único por paso.',
                      },
                    },
                  ],
                },
                { name: 'title', type: 'text', admin: { description: 'Soporta HTML simple (se renderiza con dangerouslySetInnerHTML).' } },
                { name: 'description', type: 'textarea' },
                {
                  name: 'placeholder',
                  type: 'text',
                  admin: {
                    condition: (_, siblingData) => PLACEHOLDER_STEP_TYPES.includes(siblingData?.type),
                  },
                },
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'requiredMessage',
                      type: 'text',
                      admin: {
                        description: 'Si se define, el campo es obligatorio y este es el mensaje de error (inputOptions.required).',
                        condition: (_, siblingData) => INPUT_STEP_TYPES.includes(siblingData?.type),
                      },
                    },
                    {
                      name: 'cols',
                      type: 'number',
                      admin: {
                        description: 'Columnas del grid de opciones (Radio/Checkbox) o rows del textarea.',
                        condition: (_, siblingData) =>
                          ['radio', 'checkbox', 'textarea'].includes(siblingData?.type),
                      },
                    },
                  ]
                },
                {
                  name: 'options',
                  type: 'array',
                  admin: {
                    condition: (_, siblingData) => OPTION_STEP_TYPES.includes(siblingData?.type),
                  },
                  fields: [
                    {
                      type: 'row',
                      fields: [
                        { name: 'label', type: 'text', required: true },
                        { name: 'value', type: 'text', required: true },
                      ],
                    },
                  ],
                },
                {
                  name: 'optInActive',
                  type: 'checkbox',
                  label: 'Paso de opt-in activo',
                  defaultValue: true,
                  admin: {
                    description:
                      'Solo para pasos tipo "opt-in". Si se desactiva, este paso no se muestra en el quiz (sin necesidad de borrarlo).',
                    condition: (_, siblingData) => siblingData?.type === 'opt-in',
                  },
                },
                {
                  name: 'optInFields',
                  type: 'group',
                  label: 'Campos de contacto',
                  admin: {
                    description:
                      'Solo para pasos tipo "opt-in". Campos fijos: nombre y teléfono (siempre obligatorios, sin excepción) y email (opcional).',
                    condition: (_, siblingData) => siblingData?.type === 'opt-in',
                  },
                  fields: [
                    {
                      type: 'row',
                      fields: [
                        {
                          name: 'nombreTitle',
                          type: 'text',
                          label: 'Placeholder — Nombre',
                          defaultValue: 'Nombre',
                        },
                        {
                          name: 'nombreRequiredMessage',
                          type: 'text',
                          label: 'Mensaje de error — Nombre',
                          defaultValue: 'Ingresa tu nombre',
                          required: true,
                          admin: {
                            description: 'El campo nombre siempre es obligatorio; este texto solo define el mensaje de error.',
                          },
                        },
                      ],
                    },
                    {
                      type: 'row',
                      fields: [
                        {
                          name: 'telefonoTitle',
                          type: 'text',
                          label: 'Placeholder — Teléfono',
                          defaultValue: 'Teléfono',
                        },
                        {
                          name: 'telefonoRequiredMessage',
                          type: 'text',
                          label: 'Mensaje de error — Teléfono',
                          defaultValue: 'Ingresa tu teléfono',
                          required: true,
                          admin: {
                            description: 'El campo teléfono siempre es obligatorio; este texto solo define el mensaje de error.',
                          },
                        },
                      ],
                    },
                    {
                      name: 'emailTitle',
                      type: 'text',
                      label: 'Placeholder — Email (opcional)',
                      defaultValue: 'Email',
                      admin: { description: 'El email nunca es obligatorio para el usuario.' },
                    },
                  ],
                },
                {
                  name: 'autoAdvance',
                  type: 'checkbox',
                  defaultValue: false,
                  admin: { description: 'Avanza automáticamente al siguiente paso después de 5s (usado en checkpoints).' },
                },
                {
                  name: 'checkpointContent',
                  type: 'richText',
                  editor: lexicalEditor(),
                  admin: {
                    description: 'Contenido a mostrar en un paso tipo "checkpoint".',
                    condition: (_, siblingData) => siblingData?.type === 'checkpoint',
                  },
                },
                checkpointHTMLField,
              ],
            },
          ],
        },

        // ─────────────────────────────────────────
        // Thank You Page
        // ─────────────────────────────────────────
        {
          label: 'Thank You Page',
          fields: [
            {
              name: 'thankYouPage',
              type: 'group',
              admin: {
                description:
                  'Personaliza la página de gracias post-envío del quiz. Si se deja vacío, cae al copy genérico basado en generalInfo.',
              },
              fields: [
                { name: 'title', type: 'text' },
                { name: 'subtitle', type: 'text' },
                { name: 'content', type: 'richText', editor: lexicalEditor() },
                lexicalHTMLField({
                  lexicalFieldName: 'content',
                  htmlFieldName: 'contentHTML',
                }),
              ],
            },
          ],
        },

        // ─────────────────────────────────────────
        // Webhooks & Tracking
        // ─────────────────────────────────────────
        {
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
              name: 'quizWebhook',
              type: 'text',
              required: true,
              admin: {
                description: 'URL a la que se envían las respuestas completas del quiz (CRM, n8n, Zapier, etc).',
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
        },
      ],
    },
  ],
}
