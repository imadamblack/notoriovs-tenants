import type { Tab } from 'payload'

// Landing pública del tenant: el hero y los bloques que se apilan debajo.
// Cada bloque se consume en el frontend por slug, así que los `slug` de aquí
// son contrato con /src/app/(frontend)/tenant-site.

export const landingTab: Tab = {
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
}
