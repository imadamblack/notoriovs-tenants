// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type { Access } from 'payload'

// El alcance de un Internal User sobre los clientes: quién ve todos y quién
// solo los suyos. Se prueba contra la config YA CONSTRUIDA (`payload.config`
// completa, plugins incluidos) y no contra el archivo de cada colección,
// porque el recorte por Tenants no está escrito ahí: lo agrega
// `multiTenantPlugin` encima de esas reglas. Leer los archivos sueltos se
// saltaría justo la parte que hace el trabajo, y daría verde con el
// aislamiento roto.
//
// Vive en su propio archivo por la misma razón: construir la config MUTA los
// objetos de colección que otros tests importan (el plugin les envuelve
// `access` en su lugar), y vitest aísla el grafo de módulos por archivo.
const builtConfig = await (await import('@/payload.config')).default

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

describe('alcance de un Internal User sobre los clientes', () => {
  const access = (slug: string, operation: 'read' | 'create' | 'update' | 'delete') => {
    const collection = builtConfig.collections.find((c) => c.slug === slug)
    if (!collection) throw new Error(`No existe la colección ${slug}`)
    return collection.access[operation] as Access
  }

  it('un superadmin sigue viendo todos los clientes y sus datos', async () => {
    for (const slug of ['tenants', 'leads', 'lead-exports', 'marketing-reports'] as const) {
      expect(await access(slug, 'read')(asSuperadmin()), slug).toBe(true)
    }
  })

  it('un account manager solo ve los clientes que tiene asignados', async () => {
    expect(await access('tenants', 'read')(asAccountManager([7, 9]))).toEqual({ id: { in: [7, 9] } })
  })

  it('y solo los Leads, Exportaciones y Marketing Reports de esos clientes', async () => {
    for (const slug of ['leads', 'lead-exports', 'marketing-reports'] as const) {
      expect(await access(slug, 'read')(asAccountManager([7])), slug).toEqual({ tenant: { in: [7] } })
    }
  })

  it('un account manager sin clientes asignados no ve datos de nadie', async () => {
    for (const slug of ['leads', 'lead-exports', 'marketing-reports'] as const) {
      expect(await access(slug, 'read')(asAccountManager([])), slug).toBe(false)
    }
  })

  it('un account manager no puede borrar Tenants, ni siquiera los suyos', async () => {
    expect(await access('tenants', 'delete')(asAccountManager([7]))).toBe(false)
    expect(await access('tenants', 'create')(asAccountManager([7]))).toBe(false)
    expect(await access('tenants', 'delete')(asSuperadmin())).toBe(true)
  })

  // La bitácora de exportaciones existe para poder decir quién se llevó los
  // datos de un cliente. Si desde el panel se pudiera crear, editar o borrar
  // una fila, dejaría de ser una respuesta y pasaría a ser una opinión.
  it('la bitácora de exportaciones no se escribe desde el panel', async () => {
    for (const operation of ['create', 'update', 'delete'] as const) {
      expect(await access('lead-exports', operation)(asSuperadmin()), operation).toBe(false)
    }
  })

  // Un account manager que puede crear usuarios internos se hace superadmin en
  // dos pasos, y el alcance por cliente deja de significar nada.
  it('un account manager no da de alta ni de baja gente del equipo', async () => {
    expect(await access('users', 'create')(asAccountManager([7]))).toBe(false)
    expect(await access('users', 'delete')(asAccountManager([7]))).toBe(false)
  })

  // Lo mismo por el otro lado: editar su propio documento sí puede (es donde
  // cambia su contraseña), pero el rol y la lista de clientes no se tocan.
  it('el rol y los clientes asignados solo los mueve un superadmin', () => {
    const users = builtConfig.collections.find((c) => c.slug === 'users')!
    const field = (name: string) => users.fields.find((f) => 'name' in f && f.name === name)!

    for (const name of ['role', 'tenants']) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fieldAccess = (field(name) as any).access
      expect(fieldAccess?.update?.(asSuperadmin()), name).toBe(true)
      expect(fieldAccess?.update?.(asAccountManager([7])), name).toBe(false)
    }
  })
})

// Desde el issue 08 un Tenant User tiene sesión de Payload, así que "cualquiera
// autenticado" —el control de acceso por omisión— lo incluye. Estas tres
// colecciones no tenían reglas propias para escribir.
describe('la API de Payload tampoco le deja escribir a un Tenant User', () => {
  const asTenantUser = () =>
    ({ req: { user: { id: 3, collection: 'tenant-users' } } }) as unknown as Parameters<Access>[0]

  it.each([
    ['tenants', 'create'],
    ['tenants', 'update'],
    ['tenants', 'delete'],
    ['users', 'create'],
    ['users', 'update'],
    ['users', 'delete'],
    ['media', 'create'],
    ['media', 'update'],
    ['media', 'delete'],
  ] as const)('%s: %s está cerrado para un cliente', async (slug, operation) => {
    const collection = builtConfig.collections.find((c) => c.slug === slug)!
    expect(await (collection.access[operation] as Access)(asTenantUser())).toBe(false)
  })
})

// El "Select all (N)" del panel manda su PATCH/DELETE sin el filtro del
// selector de tenant (Payload solo lo aplica al pintar la tabla), y a un
// superadmin el control de acceso no lo recorta. Así se editaron los 1065
// leads de todos los clientes creyendo tocar los 512 de uno. El candado es un
// `beforeOperation` que le agrega el tenant de la cookie al `where`.
describe('editar o borrar en bulto desde el panel no se sale del tenant elegido', () => {
  const bulk = async (
    slug: string,
    operation: 'update' | 'delete',
    { cookie, overrideAccess = false, id }: { cookie?: string; overrideAccess?: boolean; id?: number } = {},
  ) => {
    const collection = builtConfig.collections.find((c) => c.slug === slug)!
    const where = { id: { not_equals: '' } }
    let args = { where, ...(id === undefined ? {} : { id }) } as Record<string, unknown>
    for (const hook of collection.hooks?.beforeOperation ?? []) {
      args =
        ((await hook({
          args,
          collection,
          context: {},
          operation,
          overrideAccess,
          req: {
            headers: new Headers(cookie ? { cookie } : {}),
            payload: { db: { defaultIDType: 'number' } },
            user: { id: 1, collection: 'users', role: 'superadmin' },
          },
        } as never)) as Record<string, unknown>) ?? args
    }
    return args
  }

  it.each([
    ['leads', 'update'],
    ['leads', 'delete'],
    ['marketing-reports', 'update'],
    ['marketing-reports', 'delete'],
  ] as const)('%s: %s en bulto queda acotado al tenant de la cookie', async (slug, operation) => {
    const args = await bulk(slug, operation, { cookie: 'payload-tenant=7' })
    expect(args.where).toEqual({ and: [{ id: { not_equals: '' } }, { tenant: { equals: 7 } }] })
  })

  it('sin tenant elegido ("todos") el bulto toca lo mismo que muestra la tabla: todo', async () => {
    expect((await bulk('leads', 'update')).where).toEqual({ id: { not_equals: '' } })
  })

  it('no toca las rutas propias (overrideAccess) ni la edición de un solo lead', async () => {
    const cookie = 'payload-tenant=7'
    expect((await bulk('leads', 'delete', { cookie, overrideAccess: true })).where).toEqual({
      id: { not_equals: '' },
    })
    expect((await bulk('leads', 'update', { cookie, id: 5 })).where).toEqual({ id: { not_equals: '' } })
  })
})
