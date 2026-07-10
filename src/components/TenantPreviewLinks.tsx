'use client'

import React from 'react'
import { useFormFields } from '@payloadcms/ui'

// Botones de preview en el sidebar de Tenants: el admin.livePreview nativo de
// Payload solo admite una `url` fija por colección, así que no hay forma de
// alternar entre landing/quiz/thankyou dentro de ese panel. Esto abre cada
// vista en una pestaña nueva, leyendo el subdominio actual del formulario
// (aunque el documento no se haya guardado todavía).

const VIEWS = [
  { label: 'Ver Landing', path: '' },
  { label: 'Ver Quiz', path: '/survey' },
  { label: 'Ver Gracias', path: '/thankyou' },
]

const btnStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'center',
  padding: '0.5rem 0.75rem',
  borderRadius: 6,
  border: '1px solid var(--theme-elevation-150)',
  background: 'var(--theme-elevation-50)',
  color: 'inherit',
  cursor: 'pointer',
  fontSize: '0.85rem',
  textDecoration: 'none',
  boxSizing: 'border-box',
}

export const TenantPreviewLinks: React.FC = () => {
  const subdomain = useFormFields(([fields]) => fields?.subdomain?.value) as string | undefined

  if (!subdomain || typeof subdomain !== 'string') {
    return (
      <div style={{ fontSize: '0.8rem', color: 'var(--theme-elevation-500)' }}>
        Define el subdominio para activar los links de vista previa.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {VIEWS.map((v) => (
        <a
          key={v.path}
          href={`/tenant-site/${subdomain}${v.path}`}
          target="_blank"
          rel="noreferrer"
          style={btnStyle}
        >
          {v.label} ↗
        </a>
      ))}
    </div>
  )
}

export default TenantPreviewLinks
