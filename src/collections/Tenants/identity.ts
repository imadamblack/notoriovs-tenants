import type { Field, Tab } from 'payload'
import { slugField } from '@/fields/slug'

// Identidad del tenant: quién es y cómo se le llega. Son los campos que viven
// fuera de los tabs (el encabezado del documento) más el tab de Info General.

export const identityFields: Field[] = [
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
]

export const generalInfoTab: Tab = {
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
}
