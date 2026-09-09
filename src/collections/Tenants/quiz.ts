import type { Tab } from 'payload'
import { lexicalEditor, lexicalHTMLField } from '@payloadcms/richtext-lexical'

// El quiz del tenant y sus dos páginas de salida (gracias / no elegible).
// Debe empatar con SurveyStep en stepRenderer.tsx y con el consumo en
// /src/app/(frontend)/survey.

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

export const quizTab: Tab = {
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
            {
              name: 'disqualifies',
              type: 'checkbox',
              label: 'Descalifica al lead',
              defaultValue: false,
              admin: {
                description:
                  'Redirige a la página "No Elegible".',
                width: '25%',
              },
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
}

export const thankYouTab: Tab = {
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
}

export const notEligibleTab: Tab = {
  label: 'Página No Elegible',
  fields: [
    {
      name: 'notEligiblePage',
      type: 'group',
      admin: {
        description:
          'Página a la que se redirige al lead cuando elige una opción marcada como "Descalifica al lead" en una pregunta de radio. Si se deja vacío, cae al copy genérico.',
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
}
