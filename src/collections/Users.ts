import type { CollectionConfig } from 'payload'
import { isInternalUser } from '@/access/isInternalUser'
import { internalRoleField, isSuperadmin } from '@/access/internalRoles'

// El equipo de Notoriovs. Es la colección del panel de Payload
// (`admin.user`), y la otra mitad de las dos poblaciones de auth del ADR 0001.
//
// El control de acceso dejó de ser el de Payload por omisión (que es
// "cualquiera con sesión"). Eso importa desde el issue 08: con los Tenant
// Users teniendo sesión de Payload propia, `POST /api/users` con la cookie de
// un cliente creaba un Internal User —o sea, se daba a sí mismo una cuenta del
// panel con acceso a los 50+ clientes. Aquí no se lee "cualquiera
// autenticado", se lee "de la colección interna".
//
// Encima de eso, `multiTenantPlugin` acota lo que ve un Internal User que no
// sea superadmin a los usuarios de sus Tenants asignados (más su propio
// documento, para que pueda cambiar su contraseña).
export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    singular: 'Usuario de Notoriovs',
    plural: 'Usuarios de Notoriovs',
  },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'role', 'updatedAt'],
    description: 'El equipo de Notoriovs. Quien entra a este panel.',
  },
  auth: {
    // `depth: 0` por la misma razón que en TenantUsers, y desde que este issue
    // empezó a llenar el campo `tenants`: con el depth por omisión (2), Payload
    // resuelve `user.tenants[].tenant` como el documento COMPLETO del Tenant en
    // cada petición autenticada —`dashboardPassword` y `tracking.metaCapiToken`
    // incluidos— y eso viaja en `GET /api/users/me` y en el HTML que el panel
    // serializa. Con 0 son ids, que es lo único que necesitan el plugin
    // multi-tenant y el control de acceso (ver `assignedTenantIds`).
    depth: 0,
  },
  access: {
    read: isInternalUser,
    update: isInternalUser,
    // Dar de alta y de baja a alguien del equipo es del superadmin. Si un
    // account manager pudiera crear usuarios, podría crearse un superadmin y
    // el alcance por cliente no valdría nada.
    create: isSuperadmin,
    delete: isSuperadmin,
  },
  hooks: {
    // El primer Internal User de una instalación es superadmin. Sin esto, una
    // base recién creada queda con un solo usuario `account-manager` sin
    // Tenants asignados: entra al panel y no ve ni un cliente, sin nadie
    // arriba que pueda arreglarlo. El alta del primer usuario (`/admin`, o un
    // seed) corre sin sesión y con `overrideAccess`, así que la regla no se
    // puede expresar en el control de acceso.
    //
    // Se pregunta por la colección vacía, no por "no hay sesión": un script
    // que dé de alta gente después, sin usuario en `req`, debe poder crear
    // account managers.
    beforeValidate: [
      async ({ data, operation, req }) => {
        if (operation !== 'create' || !data) return data

        const { totalDocs } = await req.payload.count({ collection: 'users', overrideAccess: true, req })
        return totalDocs === 0 ? { ...data, role: 'superadmin' } : data
      },
    ],
  },
  fields: [
    // El email lo agrega la configuración de `auth`.
    internalRoleField,
    // El campo `tenants` (a qué clientes está asignado) lo inyecta
    // `multiTenantPlugin`; su acceso de escritura se restringe a superadmin
    // desde payload.config.ts, por la misma razón que el rol.
  ],
}
