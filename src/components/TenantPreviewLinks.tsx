'use client'

import React from 'react'
import { useDocumentInfo, useFormFields } from '@payloadcms/ui'

// Botones de preview en el sidebar de Tenants: el admin.livePreview nativo de
// Payload solo admite una `url` fija por colección, así que no hay forma de
// alternar entre landing/quiz/thankyou dentro de ese panel. Esto abre cada
// vista en una pestaña nueva, leyendo el subdominio actual del formulario
// (aunque el documento no se haya guardado todavía).

const VIEWS = [
  { label: 'Ver Landing', path: '' },
  { label: 'Ver Quiz', path: '/survey' },
  { label: 'Ver Gracias', path: '/thankyou' },
  { label: 'Ver No Elegible', path: '/not-elegible' },
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

/**
 * POST de primer nivel a la ruta que emite el ticket de traspaso, que responde
 * redirigiendo al host del Tenant (ver /api/internal-dashboard/enter). Se arma
 * el formulario al vuelo porque este componente ya vive dentro del formulario
 * del documento, y un `<form>` anidado el navegador lo ignora: el botón
 * terminaría guardando el Tenant.
 */
function enterDashboard(tenantId: string | number) {
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = '/api/internal-dashboard/enter'
  form.target = '_blank'

  const input = document.createElement('input')
  input.type = 'hidden'
  input.name = 'tenant'
  input.value = String(tenantId)
  form.appendChild(input)

  document.body.appendChild(form)
  form.submit()
  form.remove()
}

export const TenantPreviewLinks: React.FC = () => {
  const subdomain = useFormFields(([fields]) => fields?.subdomain?.value) as string | undefined
  const { id } = useDocumentInfo()

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
      {/* El Dashboard no se previsualiza desde aquí: vive en el host del
          cliente y pide sesión. Este botón entra como equipo de Notoriovs
          (issue 31). Solo con el documento guardado: el ticket va atado a su id. */}
      {id && (
        <button type="button" onClick={() => enterDashboard(id)} style={{ ...btnStyle }}>
          Entrar al Dashboard ↗
        </button>
      )}
    </div>
  )
}

export default TenantPreviewLinks
