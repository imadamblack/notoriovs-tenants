// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Access } from 'payload'

import { TenantUsers } from '@/collections/TenantUsers'
import { Leads } from '@/collections/Leads'
import { MarketingReports } from '@/collections/MarketingReports'
import { Tenants } from '@/collections/Tenants'
import { createDashboardToken } from '@/utils/dashboardAuth'
import { normalizeTenantUserRole, roleCan } from '@/access/tenantUserPermissions'

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

const { resolveDashboardAuth, sessionCan, sessionRole } = await import('@/utils/requireDashboardAuth')

const ACME = { id: 1, leadPipeline: [], leadStuckAfterDays: 21 }

/** Un Tenant User de `tenantId`, tal como lo devuelve `getTenantUserSession`. */
const tenantUser = (tenantId: string | number, role: 'owner' | 'member' = 'owner') => ({
  id: 7,
  email: 'cliente@acme.com',
  tenantId,
  role,
})

beforeEach(() => {
  vi.resetAllMocks()
  getTenantBySubdomain.mockResolvedValue(ACME)
  tenantHasSharedPassword.mockResolvedValue(true)
  getTenantUserSession.mockResolvedValue(null)
})

const noHeaders = new Headers()

/** Un Internal User que ve a todos los clientes. */
const asSuperadmin = () =>
  ({ req: { user: { id: 1, collection: 'users', role: 'superadmin' } } }) as unknown as Parameters<Access>[0]

/** Un Internal User acotado a los Tenants que tiene asignados. */
const asAccountManager = (tenantIds: number[]) =>
  ({
    req: {
      user: {
        id: 2,
        collection: 'users',
        role: 'account-manager',
        tenants: tenantIds.map((tenant) => ({ tenant })),
      },
    },
  }) as unknown as Parameters<Access>[0]

describe('autorización del dashboard', () => {
  it('un Tenant User de este tenant entra, y la sesión lo nombra', async () => {
    getTenantUserSession.mockResolvedValue(tenantUser(1))

    const auth = await resolveDashboardAuth(noHeaders, undefined, 'acme')

    expect(auth?.tenant).toBe(ACME)
    expect(auth?.session).toEqual({
      kind: 'tenant-user',
      userId: 7,
      email: 'cliente@acme.com',
      role: 'owner',
    })
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
      expect(access(asSuperadmin()), `${operation} para un superadmin`).toBe(true)
      expect(access(asUser('tenant-users')), `${operation} para un Tenant User`).toBe(false)
      expect(access(asUser(null)), `${operation} sin sesión`).toBe(false)
    }
  })

  // Un usuario de cliente es una llave para entrar a ese cliente: quien no
  // administra el Tenant tampoco reparte sus llaves.
  it('un account manager solo alcanza a los usuarios de sus clientes', () => {
    for (const operation of ['read', 'update', 'delete'] as const) {
      const access = TenantUsers.access?.[operation] as Access
      expect(access(asAccountManager([7])), operation).toEqual({ tenant: { in: [7] } })
      expect(access(asAccountManager([])), `${operation} sin clientes asignados`).toBe(false)
    }
  })

  // El `where` del control de acceso no filtra nada en un alta: no hay
  // documento contra el cual comparar, y Payload solo mira si la regla dio
  // algo verdadero. Por eso el alta la revisa además un hook.
  it('un account manager no puede crear un usuario en un cliente que no le toca', () => {
    const hook = TenantUsers.hooks?.beforeValidate?.[0]
    const run = (user: unknown, tenant: unknown) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      hook!({ data: { tenant }, operation: 'create', req: { user } } as any)

    expect(() => run(asAccountManager([7]).req.user, 9)).toThrow()
    expect(() => run(asAccountManager([7]).req.user, undefined)).toThrow()
    expect(run(asAccountManager([7]).req.user, 7)).toEqual({ tenant: 7 })
    expect(run(asSuperadmin().req.user, 9)).toEqual({ tenant: 9 })
  })

  it('cada Tenant User tiene un rol, y el que se asume es el de menos alcance', () => {
    const role = TenantUsers.fields.find((field) => 'name' in field && field.name === 'role')

    expect(role).toMatchObject({ type: 'select', required: true, defaultValue: 'member' })
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

// Borrar un Tenant se lleva a sus usuarios. Además de ser lo que uno espera,
// sin esto el borrado ni siquiera pasa: la llave foránea de
// `tenant_users.tenant_id` es ON DELETE SET NULL sobre una columna NOT NULL.
describe('borrar un Tenant', () => {
  it('borra antes a sus Tenant Users, en la misma transacción', async () => {
    const hook = Tenants.hooks?.beforeDelete?.[0]
    expect(hook, 'Tenants no tiene beforeDelete').toBeDefined()

    const del = vi.fn().mockResolvedValue({ docs: [] })
    const req = { payload: { delete: del } }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await hook!({ id: 7, req } as any)

    expect(del).toHaveBeenCalledTimes(1)
    const args = del.mock.calls[0][0]
    expect(args.collection).toBe('tenant-users')
    expect(args.where).toEqual({ tenant: { equals: 7 } })
    expect(args.overrideAccess).toBe(true)
    // Sin `req` el borrado de los usuarios va por su cuenta y sobrevive a un
    // fallo posterior del borrado del Tenant.
    expect(args.req).toBe(req)
  })

  it('no toca los Leads: son el registro histórico del negocio', async () => {
    const del = vi.fn().mockResolvedValue({ docs: [] })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await Tenants.hooks!.beforeDelete![0]!({ id: 7, req: { payload: { delete: del } } } as any)

    expect(del.mock.calls.map((c) => c[0].collection)).not.toContain('leads')
  })
})


// Los roles del lado del cliente. Un `member` trabaja los leads todos los días;
// lo que no hace es lo que no se puede deshacer ni lo administrativo.
describe('qué puede hacer cada rol dentro del dashboard', () => {
  it('un member marca leads como descalificados, pero no los borra', () => {
    expect(roleCan('member', 'leads:update')).toBe(true)
    expect(roleCan('member', 'leads:delete')).toBe(false)
    expect(roleCan('owner', 'leads:delete')).toBe(true)
  })

  it('un member ve los KPIs completos, con el gasto en anuncios', () => {
    expect(roleCan('member', 'kpis:read')).toBe(true)
  })

  it('un member no gestiona usuarios ni la suscripción', () => {
    expect(roleCan('member', 'users:manage')).toBe(false)
    expect(roleCan('member', 'billing:manage')).toBe(false)
    expect(roleCan('owner', 'users:manage')).toBe(true)
  })

  // Un documento sin rol (una fila vieja, un seed a mano) cae del lado que no
  // borra nada.
  it('un rol que no se reconoce vale como member', () => {
    expect(normalizeTenantUserRole(undefined)).toBe('member')
    expect(normalizeTenantUserRole('propietario')).toBe('member')
  })

  it('la sesión del dashboard lleva el rol del usuario', async () => {
    getTenantUserSession.mockResolvedValue(tenantUser(1, 'member'))

    const auth = await resolveDashboardAuth(noHeaders, undefined, 'acme')

    expect(auth && sessionRole(auth.session)).toBe('member')
    expect(auth && sessionCan(auth.session, 'leads:delete')).toBe(false)
  })

  // La contraseña compartida es una sola credencial que hoy abre todo. Se
  // retira vaciándola, no recortándole capacidades a quien no ha migrado.
  it('la contraseña compartida sigue valiendo como owner', async () => {
    const auth = await resolveDashboardAuth(noHeaders, createDashboardToken('acme'), 'acme')

    expect(auth && sessionRole(auth.session)).toBe('owner')
    expect(auth && sessionCan(auth.session, 'leads:delete')).toBe(true)
  })
})
