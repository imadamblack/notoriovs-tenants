import type { CollectionConfig } from 'payload'
import { internalScopedToAssignedTenants } from '@/access/internalRoles'
import { NOTIFICATION_TYPE_OPTIONS } from '@/notifications/catalog'

// Suscripciones de push del Dashboard de Cliente (issue 36, ADR 0011). Cada
// fila es UN dispositivo de UN Tenant User: la llave (`endpoint`) y el par
// de claves (`keys.p256dh`/`keys.auth`) que el navegador entregó al llamar
// `pushManager.subscribe()`, más qué tipos de Aviso quiere ese dispositivo.
//
// Calcada de `src/collections/TenantUsers.ts`: no pasa por
// `multiTenantPlugin` (el campo `tenant` se declara a mano, igual que ahí,
// porque esta colección está scopeada por `tenantUser`, no solo por
// `tenant`), y el acceso es el mismo `internalScopedToAssignedTenants()` que
// usa esa colección — el equipo interno puede ver/depurar suscripciones
// desde /admin, acotado a sus Tenants asignados.
//
// A diferencia de `TenantUsers`, esta colección NO tiene `auth`, así que no
// lleva `access.admin`: esa llave solo gobierna el login al panel de una
// población `auth`, y ni `Leads` ni `MarketingReports` (también internas,
// no-auth) la usan.
//
// Un Tenant User nunca lee ni escribe aquí directo: las rutas de
// /api/tenant-dashboard/push/* usan la Local API con `overrideAccess: true`
// y filtran a mano por `tenant` + `tenantUser` de su propia sesión — el
// mismo patrón que ya usa el resto de /api/tenant-dashboard/*.
export const PushSubscriptions: CollectionConfig = {
  slug: 'push-subscriptions',
  labels: {
    singular: 'Suscripción de Push',
    plural: 'Suscripciones de Push',
  },
  admin: {
    useAsTitle: 'endpoint',
    defaultColumns: ['tenant', 'tenantUser', 'userAgent', 'updatedAt'],
    description:
      'Dispositivos que un Tenant User dio de alta para recibir Avisos push. Se administran desde el Dashboard de Cliente, no desde aquí.',
  },
  access: {
    read: internalScopedToAssignedTenants(),
    create: internalScopedToAssignedTenants(),
    update: internalScopedToAssignedTenants(),
    delete: internalScopedToAssignedTenants(),
  },
  fields: [
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
      hasMany: false,
      label: 'Tenant',
    },
    {
      name: 'tenantUser',
      type: 'relationship',
      relationTo: 'tenant-users',
      required: true,
      index: true,
      hasMany: false,
      label: 'Usuario de Cliente',
      admin: {
        description: 'Dueño de este dispositivo. Un dispositivo es privado de quien lo dio de alta, no compartido por Tenant.',
      },
    },
    {
      name: 'endpoint',
      type: 'text',
      required: true,
      unique: true,
      label: 'Endpoint',
      admin: {
        description:
          'La URL del push service del navegador (Web Push API). Es la identidad natural del dispositivo: si vuelve a suscribirse con el mismo endpoint, esta fila se actualiza en vez de duplicarse.',
      },
    },
    {
      type: 'group',
      name: 'keys',
      label: 'Llaves',
      fields: [
        { name: 'p256dh', type: 'text', required: true },
        { name: 'auth', type: 'text', required: true },
      ],
    },
    {
      name: 'userAgent',
      type: 'text',
      label: 'Navegador',
      admin: {
        description: 'Para distinguir dispositivos de un mismo usuario en una lista futura. Hoy solo se guarda.',
      },
    },
    {
      name: 'notificationTypes',
      type: 'select',
      hasMany: true,
      defaultValue: ['lead-new'],
      options: NOTIFICATION_TYPE_OPTIONS,
      label: 'Tipos de Aviso activos',
      admin: {
        description:
          'Apagar un tipo aquí NO revoca el permiso del navegador: la suscripción sigue viva para los tipos que queden prendidos.',
      },
    },
  ],
  indexes: [{ fields: ['tenant', 'tenantUser'] }],
  timestamps: true,
}
