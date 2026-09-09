import type { CollectionConfig } from 'payload'
import { Forbidden } from 'payload'
import { assignedTenantIds, internalScopedToAssignedTenants, isSuperadminUser } from '@/access/internalRoles'
import { tenantUserRoleField } from '@/access/tenantUserPermissions'

// Población de auth del lado del cliente: quien entra al Dashboard de Cliente
// de SU tenant. Es una colección aparte de `users` (el equipo de Notoriovs),
// no un `users` con un campo `role` — ver docs/adr/0001-dos-colecciones-de-auth.md.
//
// Lo que cierra el panel de Payload para esta población es `access.admin`:
// `canAccessAdmin` (payload/utilities/canAccessAdmin) llama esa función en
// cuanto el token viene de esta colección y, al devolver falso, tira 401 sin
// consultar rol alguno. No es un condicional que se pueda olvidar en una
// pantalla: es la única puerta del panel, y para esta colección está clavada
// en falso.
//
// La colección SÍ es visible en el nav del admin (el ADR hablaba de
// `admin.hidden`): un Internal User tiene que poder dar de alta a los usuarios
// de un cliente desde el panel, y esconder la colección solo la movería a una
// URL que hay que saberse de memoria. Esconderla nunca fue lo que cerraba el
// panel; `access.admin` sí.

// Solo el equipo interno administra Tenant Users desde el panel. Un Tenant
// User autenticado nunca pasa este control de acceso, ni siquiera contra los
// usuarios de su propio tenant: que un `owner` gestione a los suyos es cosa
// del Dashboard de Cliente (permiso `users:manage`), no de esta colección.
//
// Y dentro del equipo interno, un account manager solo alcanza a los usuarios
// de los Tenants que tiene asignados. Esta colección no pasa por
// `multiTenantPlugin` —el plugin inyectaría su propio campo `tenant` encima
// del que ya está declarado aquí—, así que el filtro se escribe a mano con el
// mismo criterio.

export const TenantUsers: CollectionConfig = {
  slug: 'tenant-users',
  labels: {
    singular: 'Usuario de Cliente',
    plural: 'Usuarios de Cliente',
  },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'tenant', 'updatedAt'],
    description:
      'Personas del lado del cliente que entran al Dashboard de Cliente de su tenant. No tienen acceso a este panel.',
  },
  auth: {
    // 30 días, lo mismo que duraba la cookie de la contraseña compartida a
    // la que reemplazó: pasar a usuario propio no debía hacer que a un
    // cliente se le cerrara la sesión más seguido.
    tokenExpiration: 60 * 60 * 24 * 30,
    // `depth: 0` NO es una micro-optimización: es lo que impide que el
    // documento del Tenant viaje dentro del usuario autenticado.
    //
    // Payload resuelve el usuario de cada petición con `auth.depth`, que por
    // omisión es 2. Con eso, `user.tenant` deja de ser un id y pasa a ser el
    // Tenant COMPLETO —`tracking.metaCapiToken` incluido— en cada request
    // autenticada. Y como el panel de Payload serializa el usuario dentro de
    // la página, ese secreto terminaba en
    // el HTML que recibe el navegador de un Tenant User que abra /admin en
    // el host de su tenant (el panel se sirve en todos los hosts; ver el
    // middleware). Con 0, `user.tenant` es el id y nada más, que es lo único
    // que la autorización del dashboard necesita.
    depth: 0,
    // Un dashboard de leads expuesto en un subdominio público es un blanco
    // barato para fuerza bruta; el panel interno no lo es tanto.
    maxLoginAttempts: 10,
    lockTime: 10 * 60 * 1000,
  },
  access: {
    // Puerta del panel de Payload: cerrada por construcción para toda esta
    // colección. No la vuelvas condicional.
    admin: () => false,
    read: internalScopedToAssignedTenants(),
    create: internalScopedToAssignedTenants(),
    update: internalScopedToAssignedTenants(),
    delete: internalScopedToAssignedTenants(),
  },
  hooks: {
    // El filtro por Tenant del control de acceso solo muerde en las
    // operaciones que consultan documentos existentes. En un `create` no hay
    // nada contra qué filtrar: Payload solo mira si la regla dio algo
    // verdadero, y un `where` lo es. Sin esta comprobación, un account manager
    // podía crearse un usuario en el tenant de un cliente que no le toca y
    // entrar a su dashboard con él.
    beforeValidate: [
      ({ data, operation, req }) => {
        if (operation !== 'create' || !req.user || isSuperadminUser(req.user)) return data

        const target = data?.tenant
        const allowed = assignedTenantIds(req.user).map(String)
        if (target === undefined || target === null || !allowed.includes(String(target))) {
          throw new Forbidden(req.t)
        }

        return data
      },
    ],
  },
  fields: [
    tenantUserRoleField,
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
      hasMany: false,
      label: 'Tenant',
      admin: {
        description:
          'El único tenant al que este usuario puede entrar. La autorización del dashboard compara esto contra el tenant del host de la petición, así que cambiar el subdominio en la URL no le da acceso a otro cliente.',
      },
    },
  ],
}
