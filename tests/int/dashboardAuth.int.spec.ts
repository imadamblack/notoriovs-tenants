// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Access } from 'payload'

import { TenantUsers } from '@/collections/TenantUsers'
import { Leads } from '@/collections/Leads'
import { MarketingReports } from '@/collections/MarketingReports'
import { Tenants } from '@/collections/Tenants'
import { createDashboardToken } from '@/utils/dashboardAuth'

// Este archivo prueba la capa de autorización del Dashboard de Cliente sin
// base de datos: qué sesión abre qué tenant. Lo que se resuelve contra
// Postgres (buscar el tenant, verificar el JWT contra el usuario vivo) se
// sustituye por dobles, porque lo que puede romperse aquí no es la consulta
// sino la regla — y la regla es la única barrera entre los leads de un
// cliente y los de otro.
const getTenantBySubdomain = vi.fn()
const tenantHasSharedPassword = vi.fn()
const getTenantUserSession = vi.fn()

vi.mock('@/utils/getTenant', () => ({
  getTenantBySubdomain: (...args: unknown[]) => getTenantBySubdomain(...args),
  tenantHasSharedPassword: (...args: unknown[]) => tenantHasSharedPassword(...args),
}))

vi.mock('@/utils/tenantUserAuth', () => ({
  getTenantUserSession: (...args: unknown[]) => getTenantUserSession(...args),
}))

const { resolveDashboardAuth } = await import('@/utils/requireDashboardAuth')

const ACME = { id: 1, leadPipeline: [], leadStuckAfterDays: 21 }

/** Un Tenant User de `tenantId`, tal como lo devuelve `getTenantUserSession`. */
const tenantUser = (tenantId: string | number) => ({
  id: 7,
  email: 'cliente@acme.com',
  tenantId,
})

beforeEach(() => {
  vi.resetAllMocks()
  getTenantBySubdomain.mockResolvedValue(ACME)
  tenantHasSharedPassword.mockResolvedValue(true)
  getTenantUserSession.mockResolvedValue(null)
})

const noHeaders = new Headers()

describe('autorización del dashboard', () => {
  it('un Tenant User de este tenant entra, y la sesión lo nombra', async () => {
    getTenantUserSession.mockResolvedValue(tenantUser(1))

    const auth = await resolveDashboardAuth(noHeaders, undefined, 'acme')

    expect(auth?.tenant).toBe(ACME)
    expect(auth?.session).toEqual({ kind: 'tenant-user', userId: 7, email: 'cliente@acme.com' })
  })

  // El caso que justifica toda esta capa: la sesión es legítima, pero es de
  // otro cliente. El tenant sale del host de la petición, nunca del usuario.
  it('un Tenant User de otro tenant no entra aunque cambie el subdominio', async () => {
    getTenantUserSession.mockResolvedValue(tenantUser(2))

    expect(await resolveDashboardAuth(noHeaders, undefined, 'acme')).toBeNull()
  })

  it('un Tenant User sin tenant asignado no entra a ninguno', async () => {
    getTenantUserSession.mockResolvedValue(tenantUser(null as unknown as number))

    expect(await resolveDashboardAuth(noHeaders, undefined, 'acme')).toBeNull()
  })

  it('la contraseña compartida sigue abriendo el dashboard', async () => {
    const token = createDashboardToken('acme')

    const auth = await resolveDashboardAuth(noHeaders, token, 'acme')

    expect(auth?.tenant).toBe(ACME)
    expect(auth?.session).toEqual({ kind: 'shared-password' })
  })

  it('una cookie compartida firmada para otro subdominio no sirve aquí', async () => {
    const token = createDashboardToken('otro')

    expect(await resolveDashboardAuth(noHeaders, token, 'acme')).toBeNull()
  })

  it('vaciar la contraseña en el admin cierra esa puerta sin tocar a los Tenant Users', async () => {
    tenantHasSharedPassword.mockResolvedValue(false)
    const token = createDashboardToken('acme')

    expect(await resolveDashboardAuth(noHeaders, token, 'acme')).toBeNull()

    getTenantUserSession.mockResolvedValue(tenantUser(1))
    expect(await resolveDashboardAuth(noHeaders, token, 'acme')).not.toBeNull()
  })

  // Una cookie inventada no debe costar una consulta: es el caso que un
  // atacante puede repetir gratis.
  it('una cookie compartida con firma inválida se descarta sin consultar la base', async () => {
    expect(await resolveDashboardAuth(noHeaders, 'basura.basura', 'acme')).toBeNull()
    expect(tenantHasSharedPassword).not.toHaveBeenCalled()
  })

  it('sin subdominio no hay tenant que resolver', async () => {
    expect(await resolveDashboardAuth(noHeaders, undefined, null)).toBeNull()
    expect(getTenantBySubdomain).not.toHaveBeenCalled()
  })

  it('un tenant inexistente o inactivo no autoriza ni con sesión válida', async () => {
    getTenantBySubdomain.mockResolvedValue(null)
    getTenantUserSession.mockResolvedValue(tenantUser(1))

    expect(await resolveDashboardAuth(noHeaders, createDashboardToken('acme'), 'acme')).toBeNull()
  })
})

describe('la colección de Tenant Users', () => {
  const asUser = (collection: string | null) =>
    ({ req: { user: collection ? { id: 1, collection } : null } }) as unknown as Parameters<Access>[0]

  // La propiedad estructural del ADR 0001: el panel de Payload está cerrado
  // para esta colección por construcción, no por un condicional de rol que
  // alguien pueda invertir sin darse cuenta.
  it('nunca da acceso al panel de Payload', () => {
    expect(TenantUsers.access?.admin?.(asUser('tenant-users'))).toBe(false)
    expect(TenantUsers.access?.admin?.(asUser('users'))).toBe(false)
    expect(TenantUsers.access?.admin?.(asUser(null))).toBe(false)
  })

  it('solo el equipo interno administra Tenant Users', () => {
    for (const operation of ['read', 'create', 'update', 'delete'] as const) {
      const access = TenantUsers.access?.[operation] as Access
      expect(access(asUser('users')), `${operation} para un Internal User`).toBe(true)
      expect(access(asUser('tenant-users')), `${operation} para un Tenant User`).toBe(false)
      expect(access(asUser(null)), `${operation} sin sesión`).toBe(false)
    }
  })

  // Con el `auth.depth` por omisión (2), Payload devuelve `user.tenant` como
  // el Tenant COMPLETO en cada petición autenticada, y el panel serializa el
  // usuario dentro de la página: `dashboardPassword` y `tracking.metaCapiToken`
  // terminaban en el HTML que recibe el navegador de un Tenant User que abre
  // /admin en el host de su tenant. Verificado contra un build de producción
  // antes y después del arreglo.
  it('resuelve la sesión sin poblar el Tenant, para no arrastrar sus secretos', () => {
    expect(typeof TenantUsers.auth).toBe('object')
    expect((TenantUsers.auth as { depth?: number }).depth).toBe(0)
  })

  it('cada Tenant User pertenece a un solo tenant, y es obligatorio', () => {
    const tenant = TenantUsers.fields.find((field) => 'name' in field && field.name === 'tenant')

    expect(tenant).toMatchObject({
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      hasMany: false,
    })
  })
})

// Desde que un Tenant User tiene sesión de Payload, `req.user` en el control
// de acceso de una colección ya no significa "alguien de Notoriovs". Estas
// colecciones se consultan por REST con la cookie del navegador, sin pasar por
// /api/tenant-dashboard/*, así que aquí no hay filtro por tenant que valga:
// dejar pasar a un Tenant User es entregarle los datos de todos los clientes.
describe('la API de Payload no le abre nada a un Tenant User', () => {
  const asUser = (collection: string | null) =>
    ({ req: { user: collection ? { id: 1, collection } : null } }) as unknown as Parameters<Access>[0]

  const collections = [
    ['leads', Leads],
    ['marketing-reports', MarketingReports],
    // El documento del Tenant trae `dashboardPassword` y el token de la CAPI:
    // su lectura por REST era pública, y ahora es interna.
    ['tenants', Tenants],
  ] as const

  it.each(collections)('%s solo se lee desde una sesión interna', (_slug, collection) => {
    const read = collection.access?.read as Access

    expect(read(asUser('users'))).toBe(true)
    expect(read(asUser('tenant-users'))).toBe(false)
    expect(read(asUser(null))).toBe(false)
  })

  it.each([
    ['leads', Leads],
    ['marketing-reports', MarketingReports],
  ] as const)('%s tampoco se escribe desde una sesión de cliente', (_slug, collection) => {
    for (const operation of ['create', 'update', 'delete'] as const) {
      const access = collection.access?.[operation] as Access
      expect(access(asUser('tenant-users')), operation).toBe(false)
    }
  })
})
