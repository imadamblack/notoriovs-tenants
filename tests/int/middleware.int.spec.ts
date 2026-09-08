// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'

import { middleware } from '@/middleware'

// El middleware lee ROOT_DOMAIN al importarse; 'notoriovs.com' es su default.
const request = (host: string, pathname: string) =>
  new NextRequest(`https://${host}${pathname}`, { headers: { host } })

/** A dónde termina yendo la petición: la ruta reescrita o la del redirect. */
const destination = (res: Response) =>
  res.headers.get('x-middleware-rewrite') || res.headers.get('location')

describe('middleware', () => {
  it('reescribe el host del tenant a su ruta interna', () => {
    const res = middleware(request('acme.notoriovs.com', '/survey'))

    expect(destination(res)).toBe('https://acme.notoriovs.com/tenant-site/acme/survey')
    expect(res.status).toBe(200)
  })

  // Esto es lo que le permite a la landing redirigir al quiz con la ruta
  // interna absoluta sin leer el `host` con `headers()` — que volvería la
  // página dinámica y tiraría toda la caché. Ver page.tsx.
  it('en el host del tenant, canonicaliza su propia ruta interna a la limpia', () => {
    const res = middleware(request('acme.notoriovs.com', '/tenant-site/acme/survey'))

    expect(res.status).toBe(308)
    expect(destination(res)).toBe('https://acme.notoriovs.com/survey')
  })

  it('la raíz interna canonicaliza a "/", no a la cadena vacía', () => {
    const res = middleware(request('acme.notoriovs.com', '/tenant-site/acme'))

    expect(destination(res)).toBe('https://acme.notoriovs.com/')
  })

  it('no confunde un subdominio con otro que lo tiene de prefijo', () => {
    // '/tenant-site/acme-mx' empieza con '/tenant-site/acme': comparar por
    // prefijo de cadena y no por segmento dejaría al host de acme sirviendo
    // el sitio de acme-mx en una URL ajena.
    const res = middleware(request('acme.notoriovs.com', '/tenant-site/acme-mx'))

    expect(res.status).toBe(200)
    expect(destination(res)).toBeNull()
  })

  it('el preview del admin sigue sirviendo la ruta interna tal cual', () => {
    // El iframe de Live Preview carga /tenant-site/{sub} desde el host del
    // admin, que es un subdominio reservado: ahí no hay nada que canonicalizar.
    const res = middleware(request('admin.notoriovs.com', '/tenant-site/acme/survey'))

    expect(res.status).toBe(200)
    expect(destination(res)).toBeNull()
  })

  it('el dominio raíz sirve el sitio default sin reescritura', () => {
    const res = middleware(request('notoriovs.com', '/'))

    expect(destination(res)).toBeNull()
  })

  it('admin y API de Payload pasan directo desde cualquier host', () => {
    expect(destination(middleware(request('acme.notoriovs.com', '/admin')))).toBeNull()
    expect(destination(middleware(request('acme.notoriovs.com', '/api/quiz-submit')))).toBeNull()
  })
})
