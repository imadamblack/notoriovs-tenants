// @vitest-environment node
import fs from 'node:fs'
import path from 'node:path'
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

  it('test queda reservado para preview de servidor, no es subdominio de tenant', () => {
    const res = middleware(request('test.notoriovs.com', '/survey'))

    expect(res.status).toBe(200)
    expect(destination(res)).toBeNull()
  })

  it('los archivos estáticos de /public no se reescriben por tenant', () => {
    // El apple-touch-icon del dashboard vive en /public. Reescrito a
    // /tenant-site/{sub}/apple-touch-icon-dashboard.png da 404, y entonces
    // iOS guarda una captura de la página como icono de home screen.
    const res = middleware(request('acme.notoriovs.com', '/apple-touch-icon-dashboard.png'))

    expect(destination(res)).toBeNull()
    expect(res.status).toBe(200)
  })

  it('una ruta de tenant con punto en el slug sí se reescribe', () => {
    const res = middleware(request('acme.notoriovs.com', '/oferta-2.0'))

    expect(destination(res)).toBe('https://acme.notoriovs.com/tenant-site/acme/oferta-2.0')
  })

  it('el dominio raíz sirve el sitio default sin reescritura', () => {
    const res = middleware(request('notoriovs.com', '/'))

    expect(destination(res)).toBeNull()
  })

  describe('qué rutas viven en qué host (issue 28)', () => {
    it('en el host de un tenant, el panel y la API de Payload no existen', () => {
      for (const path of [
        '/admin',
        '/admin/login',
        '/admin/forgot',
        '/api/users/login',
        '/api/users/forgot-password',
        '/api/tenants',
        '/api/tenant-users/login',
        '/api/leads',
        '/api/marketing-reports',
        '/api/graphql',
        '/api/graphql-playground',
        // El ticket del traspaso al dashboard (issue 31) se emite en el panel.
        '/api/internal-dashboard/enter',
      ]) {
        expect(middleware(request('acme.notoriovs.com', path)).status, path).toBe(404)
      }
    })

    it('en el host del panel, el panel y la API de Payload pasan directo', () => {
      for (const host of ['admin.notoriovs.com', 'notoriovs.com', 'localhost:3000']) {
        for (const path of [
          '/admin',
          '/admin/collections/tenants',
          '/api/tenants',
          '/api/graphql',
          '/api/internal-dashboard/enter',
        ]) {
          const res = middleware(request(host, path))
          expect(res.status, `${host}${path}`).toBe(200)
          expect(destination(res), `${host}${path}`).toBeNull()
        }
      }
    })

    it('en local, acme.localhost es host de tenant y localhost el del panel', () => {
      expect(middleware(request('acme.localhost:3000', '/admin')).status).toBe(404)
      expect(middleware(request('localhost:3000', '/admin')).status).toBe(200)
    })

    // La lista de rutas propias vive en el middleware; si alguien agrega una en
    // src/app/api y no la declara, su host de tenant le contestaría 404. Las de
    // /api/internal-dashboard son del panel a propósito.
    it('toda ruta propia de src/app/api sigue respondiendo en el host del tenant', () => {
      const apiDir = path.resolve(__dirname, '../../src/app/api')
      const routes = fs
        .readdirSync(apiDir, { recursive: true, encoding: 'utf8' })
        .filter((file) => file.endsWith('route.ts'))
        .map((file) => `/api/${path.dirname(file).split(path.sep).join('/')}`)
        .map((route) => route.replace(/\[[^\]]+\]/g, '123'))
        .filter((route) => !route.startsWith('/api/internal-dashboard/'))

      expect(routes).toContain('/api/tenant-dashboard/leads/123')
      expect(routes).toContain('/api/tenant-dashboard/internal-session')
      for (const route of routes) {
        const res = middleware(request('acme.notoriovs.com', route))
        expect(res.status, route).toBe(200)
        expect(destination(res), route).toBeNull()
      }
    })

    it('los archivos de Media sin blob se sirven en el host del tenant', () => {
      const res = middleware(request('acme.notoriovs.com', '/api/media/file/logo.png'))

      expect(res.status).toBe(200)
      expect(destination(res)).toBeNull()
    })

    it('una página del tenant que empieza con "admin" no es el panel', () => {
      const res = middleware(request('acme.notoriovs.com', '/administracion'))

      expect(destination(res)).toBe('https://acme.notoriovs.com/tenant-site/acme/administracion')
    })
  })
})
