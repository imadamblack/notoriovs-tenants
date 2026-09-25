// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Access } from 'payload'

import { TenantUsers } from '@/collections/TenantUsers'
import { Leads } from '@/collections/Leads'
import { MarketingReports } from '@/collections/MarketingReports'
import { Tenants } from '@/collections/Tenants'
import {
  canChangeAssignee,
  normalizeTenantUserRole,
  roleCan,
  TENANT_USER_MANAGEMENT_ENABLED,
} from '@/access/tenantUserPermissions'
import { assertAssigneeInLeadTenant } from '@/collections/leadAssignee'

// Este archivo prueba la capa de autorización del Dashboard de Cliente sin
// base de datos: qué sesión abre qué tenant. Lo que se resuelve contra
// Postgres (buscar el tenant, verificar el JWT contra el usuario vivo) se
// sustituye por dobles, porque lo que puede romperse aquí no es la consulta
// sino la regla — y la regla es la única barrera entre los leads de un
// cliente y los de otro.
const getTenantBySubdomain = vi.fn()
const getTenantUserSession = vi.fn()

vi.mock('@/utils/getTenant', () => ({
  getTenantBySubdomain: (...args: unknown[]) => getTenantBySubdomain(...args),
}))

vi.mock('@/utils/tenantUserAuth', () => ({
  getTenantUserSession: (...args: unknown[]) => getTenantUserSession(...args),
}))

const { resolveDashboardAuth, sessionCan } = await import('@/utils/requireDashboardAuth')
const { findLeadOfTenant, buildBulkLeadsWhere, buildLeadsWhere, readBulkLeadIds, readLeadFilters, MAX_BULK_LEADS } =
  await import('@/utils/leadDashboardFilters')
const { resolveStageAndStatus } = await import('@/utils/leadStageStatus')
const { findSubscriptionOfTenant } = await import('@/utils/pushSubscriptionDashboardFilters')
const { PushSubscriptions } = await import('@/collections/PushSubscriptions')

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
  getTenantUserSession.mockResolvedValue(null)
})

// El subdominio ya no es un argumento: `resolveDashboardAuth` lo saca del
// `Host` de la petición, así que una petición aquí es su cabecera `Host`.
const onHost = (host: string) => new Headers({ host })

/** Una petición al dashboard de acme, tal como la manda el navegador. */
const onAcme = onHost('acme.localhost:3000')

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

    const auth = await resolveDashboardAuth(onAcme)

    expect(getTenantBySubdomain).toHaveBeenCalledWith('acme', 'dashboardApi')
    expect(auth?.tenant).toBe(ACME)
    expect(auth?.subdomain).toBe('acme')
    expect(auth?.session).toEqual({ userId: 7, email: 'cliente@acme.com', role: 'owner' })
  })

  // El caso que justifica toda esta capa: la sesión es legítima, pero es de
  // otro cliente. El tenant sale del host de la petición, nunca del usuario.
  it('un Tenant User de otro tenant no entra aunque cambie el subdominio', async () => {
    getTenantUserSession.mockResolvedValue(tenantUser(2))

    expect(await resolveDashboardAuth(onAcme)).toBeNull()
  })

  it('un Tenant User sin tenant asignado no entra a ninguno', async () => {
    getTenantUserSession.mockResolvedValue(tenantUser(null as unknown as number))

    expect(await resolveDashboardAuth(onAcme)).toBeNull()
  })

  // La regla del ADR 0002 vista desde el otro lado: en un host que no es el de
  // ningún tenant no hay a quién autorizar, y ya no queda ningún parámetro con
  // el que el cliente pueda nombrar uno.
  it('en un host sin subdominio de tenant no hay tenant que resolver', async () => {
    getTenantUserSession.mockResolvedValue(tenantUser(1))

    expect(await resolveDashboardAuth(onHost('localhost:3000'))).toBeNull()
    expect(await resolveDashboardAuth(new Headers())).toBeNull()
    expect(getTenantBySubdomain).not.toHaveBeenCalled()
  })

  // Sin sesión de Tenant User no queda ninguna otra puerta: la contraseña
  // compartida por Tenant se retiró con su campo.
  it('sin sesión de Tenant User no entra nadie', async () => {
    expect(await resolveDashboardAuth(onAcme)).toBeNull()
  })

  it('un tenant inexistente o inactivo no autoriza ni con sesión válida', async () => {
    getTenantBySubdomain.mockResolvedValue(null)
    getTenantUserSession.mockResolvedValue(tenantUser(1))

    expect(await resolveDashboardAuth(onAcme)).toBeNull()
  })
})

// `findLeadOfTenant` es la comprobación que comparten el PATCH/DELETE de
// /api/tenant-dashboard/leads y el GET de leads/[id] (issue 35, abrir un Lead
// por URL): un id de Lead es un número adivinable, así que "es de este
// tenant" no puede depender de qué ruta se llame.
describe('un Lead solo se abre por id si es de este tenant', () => {
  const payloadWith = (lead: unknown) => ({ findByID: vi.fn().mockResolvedValue(lead) })

  it('un Lead del tenant se devuelve', async () => {
    const payload = payloadWith({ id: 42, tenant: 1 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lead = await findLeadOfTenant(payload as any, 42, 1)

    expect(lead).toEqual({ id: 42, tenant: 1 })
  })

  it('el mismo id, pero de OTRO tenant, no se devuelve', async () => {
    const payload = payloadWith({ id: 42, tenant: 2 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await findLeadOfTenant(payload as any, 42, 1)).toBeNull()
  })

  it('también compara el tenant cuando `tenant` llega poblado (depth > 0)', async () => {
    const payload = payloadWith({ id: 42, tenant: { id: 2 } })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await findLeadOfTenant(payload as any, 42, 1)).toBeNull()
  })

  it('un Lead inexistente no se devuelve', async () => {
    const payload = payloadWith(null)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await findLeadOfTenant(payload as any, 999, 1)).toBeNull()
  })
})

// La edición en bulto de la Lista (leads/bulk) es `findLeadOfTenant` para
// varios ids a la vez: los ids vienen del navegador, el tenant de la sesión.
describe('editar leads en bulto solo toca los de este tenant', () => {
  it('el tenant de la sesión va siempre dentro del where, junto a los ids', () => {
    expect(buildBulkLeadsWhere(1, [42, 43])).toEqual({
      and: [{ tenant: { equals: 1 } }, { id: { in: [42, 43] } }],
    })
  })

  it('sin ids, o con demasiados, no hay edición', () => {
    expect(readBulkLeadIds([])).toBeNull()
    expect(readBulkLeadIds('42')).toBeNull()
    expect(readBulkLeadIds({ id: { not_equals: '' } })).toBeNull()
    expect(readBulkLeadIds(Array.from({ length: MAX_BULK_LEADS + 1 }, (_, i) => i + 1))).toBeNull()
    expect(readBulkLeadIds([42, '42', 42, null, { id: 1 }])).toEqual([42, '42'])
  })

  // Lo que dejó el incidente de "Select all" en Payload: leads de un cliente
  // apuntando a una etapa del pipeline de OTRO.
  it('una etapa del pipeline de otro tenant se rechaza', () => {
    const acme = { leadPipeline: [{ id: 'acme-nuevo', label: 'Nuevo' }] }
    expect(resolveStageAndStatus(acme, { stage: 'otro-tenant-cotizado' })).toEqual({
      ok: false,
      error: 'Etapa inválida para este tenant',
    })
  })
})

// `findSubscriptionOfTenant` es la misma comprobación que `findLeadOfTenant`,
// con una de más: un dispositivo de push es de una PERSONA, no de todo el
// tenant (issue 36). Un `owner` no administra las suscripciones de un
// `member` con solo saber su id.
describe('una suscripción de push solo se toca si es de este tenant y este usuario', () => {
  const payloadWith = (subscription: unknown) => ({ findByID: vi.fn().mockResolvedValue(subscription) })

  it('una suscripción de este tenant y este usuario se devuelve', async () => {
    const payload = payloadWith({ id: 5, tenant: 1, tenantUser: 7 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await findSubscriptionOfTenant(payload as any, 5, 1, 7)).toEqual({ id: 5, tenant: 1, tenantUser: 7 })
  })

  it('el mismo tenant, pero de OTRO Tenant User, no se devuelve', async () => {
    const payload = payloadWith({ id: 5, tenant: 1, tenantUser: 9 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await findSubscriptionOfTenant(payload as any, 5, 1, 7)).toBeNull()
  })

  it('el mismo id, pero de OTRO tenant, no se devuelve', async () => {
    const payload = payloadWith({ id: 5, tenant: 2, tenantUser: 7 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await findSubscriptionOfTenant(payload as any, 5, 1, 7)).toBeNull()
  })

  it('también compara cuando `tenant`/`tenantUser` llegan poblados (depth > 0)', async () => {
    const payload = payloadWith({ id: 5, tenant: { id: 2 }, tenantUser: { id: 7 } })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await findSubscriptionOfTenant(payload as any, 5, 1, 7)).toBeNull()
  })

  it('una suscripción inexistente no se devuelve', async () => {
    const payload = payloadWith(null)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await findSubscriptionOfTenant(payload as any, 999, 1, 7)).toBeNull()
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
  // usuario dentro de la página: `tracking.metaCapiToken` terminaba en el
  // HTML que recibe el navegador de un Tenant User que abre
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

// Igual que Tenant Users: solo el equipo interno ve suscripciones de push
// desde /admin (para depurar), acotado a sus Tenants asignados. Un Tenant
// User nunca llega aquí — las rutas de /api/tenant-dashboard/push/* usan la
// Local API con `overrideAccess: true`.
describe('la colección de Suscripciones de Push', () => {
  it('solo el equipo interno las administra', () => {
    for (const operation of ['read', 'create', 'update', 'delete'] as const) {
      const access = PushSubscriptions.access?.[operation] as Access
      expect(access(asSuperadmin()), `${operation} para un superadmin`).toBe(true)
      expect(access(asAccountManager([])), `${operation} sin clientes asignados`).toBe(false)
    }
  })

  it('un account manager solo alcanza las suscripciones de sus clientes', () => {
    for (const operation of ['read', 'update', 'delete'] as const) {
      const access = PushSubscriptions.access?.[operation] as Access
      expect(access(asAccountManager([7])), operation).toEqual({ tenant: { in: [7] } })
    }
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
    // El documento del Tenant trae el token de la CAPI: su lectura por REST
    // era pública, y ahora es interna.
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
  })

  // La administración de usuarios está construida pero apagada a pedido (ver
  // `TENANT_USER_MANAGEMENT_ENABLED`). Lo que se afirma es que el interruptor
  // MANDA: mientras esté en falso ni el `owner` la alcanza —o sea que las
  // rutas de /api/tenant-dashboard/users responden 403 aunque alguien las
  // llame a mano—, y al encenderlo la gana él y solo él. Así este test no hay
  // que reescribirlo el día que se entregue.
  it('solo el owner gestiona usuarios, y solo si la función está encendida', () => {
    expect(roleCan('owner', 'users:manage')).toBe(TENANT_USER_MANAGEMENT_ENABLED)
    expect(roleCan('member', 'users:manage')).toBe(false)
  })

  // Un documento sin rol (una fila vieja, un seed a mano) cae del lado que no
  // borra nada.
  it('un rol que no se reconoce vale como member', () => {
    expect(normalizeTenantUserRole(undefined)).toBe('member')
    expect(normalizeTenantUserRole('propietario')).toBe('member')
  })

  it('la sesión del dashboard lleva el rol del usuario', async () => {
    getTenantUserSession.mockResolvedValue(tenantUser(1, 'member'))

    const auth = await resolveDashboardAuth(onAcme)

    expect(auth?.session.role).toBe('member')
    expect(auth && sessionCan(auth.session, 'leads:delete')).toBe(false)
  })
})

// El Responsable de un Lead (issue 38). Dos reglas distintas: a quién se le
// puede asignar (solo a alguien del mismo Tenant: aislamiento) y quién puede
// cambiarlo (un `member` solo toma o suelta los propios: autorización).
describe('el Responsable de un Lead', () => {
  const ACME_ID = 1
  const OTHER_ID = 2

  /** Un `req` de Payload cuyo único Tenant User es `memberId`, del Tenant `memberTenant`. */
  const reqWithMember = (memberId: number, memberTenant: number) => ({
    context: {},
    payload: {
      findByID: vi.fn(async ({ id }: { id: number }) =>
        String(id) === String(memberId) ? { id: memberId, tenant: memberTenant } : null,
      ),
    },
  })

  const runHook = (args: { data: Record<string, unknown>; originalDoc?: Record<string, unknown>; req: unknown }) =>
    assertAssigneeInLeadTenant(args as unknown as Parameters<typeof assertAssigneeInLeadTenant>[0])

  it('se puede asignar a alguien del mismo Tenant, o a nadie', async () => {
    const req = reqWithMember(5, ACME_ID)

    await expect(runHook({ data: { assignee: 5 }, originalDoc: { tenant: ACME_ID }, req })).resolves.toBeTruthy()
    await expect(runHook({ data: { assignee: null }, originalDoc: { tenant: ACME_ID }, req })).resolves.toBeTruthy()
  })

  // Este hook vive en la colección, así que corre también para la Local API y
  // el panel de Payload: no hay una ruta que se lo pueda saltar.
  it('asignarle un Lead a alguien de OTRO Tenant se rechaza, venga de donde venga', async () => {
    const req = reqWithMember(5, OTHER_ID)

    await expect(runHook({ data: { assignee: 5 }, originalDoc: { tenant: ACME_ID }, req })).rejects.toThrow()
    expect(Leads.hooks?.beforeChange).toContain(assertAssigneeInLeadTenant)
  })

  it('un id que no es de ningún Tenant User tampoco pasa', async () => {
    const req = reqWithMember(5, ACME_ID)

    await expect(runHook({ data: { assignee: 999 }, originalDoc: { tenant: ACME_ID }, req })).rejects.toThrow()
  })

  it('mover un Lead a otro Tenant sin quitarle el Responsable se rechaza', async () => {
    const req = reqWithMember(5, ACME_ID)

    await expect(
      runHook({ data: { tenant: OTHER_ID }, originalDoc: { tenant: ACME_ID, assignee: 5 }, req }),
    ).rejects.toThrow()
  })

  it('un owner reparte leads a cualquiera', () => {
    expect(canChangeAssignee('owner', 7, null, 8)).toBe(true)
    expect(canChangeAssignee('owner', 7, 8, 9)).toBe(true)
    expect(canChangeAssignee('owner', 7, 8, null)).toBe(true)
  })

  it('un member toma un lead sin asignar para sí, y suelta los suyos', () => {
    expect(canChangeAssignee('member', 7, null, 7)).toBe(true)
    expect(canChangeAssignee('member', 7, 7, null)).toBe(true)
  })

  it('un member no le asigna leads a otro ni toca los de otro', () => {
    expect(canChangeAssignee('member', 7, null, 8)).toBe(false)
    expect(canChangeAssignee('member', 7, 8, 7)).toBe(false)
    expect(canChangeAssignee('member', 7, 8, null)).toBe(false)
    expect(canChangeAssignee('member', 7, 7, 8)).toBe(false)
  })

  it('dejar el Responsable como estaba no es cambiarlo', () => {
    expect(canChangeAssignee('member', 7, 8, 8)).toBe(true)
  })

  // "Yo" sale de la sesión, no de la URL; y cualquier filtro por persona va
  // detrás del tenant del host, así que un id de otro cliente no abre nada.
  it('el filtro por Responsable queda detrás del tenant, y "yo" es la sesión', () => {
    const filters = readLeadFilters(new URLSearchParams('assignee=me'), 7)
    const where = buildLeadsWhere(ACME, filters)

    expect(where.and?.[0]).toEqual({ tenant: { equals: ACME.id } })
    expect(where.and).toContainEqual({ assignee: { equals: 7 } })
    expect(readLeadFilters(new URLSearchParams('assignee=1 or 1=1')).assignee).toBeUndefined()
  })
})
