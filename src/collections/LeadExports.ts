import type { CollectionConfig } from 'payload'
import { isInternalUser } from '@/access/isInternalUser'

// Bitácora de exportaciones de Leads a CSV (issue 14).
//
// Descargar el CSV es la principal vía por la que los datos personales de
// los Leads de un cliente salen de la plataforma en bloque: deja de haber
// control de acceso en cuanto el archivo está en una laptop. Lo único que
// queda entonces es poder responder quién se llevó qué y cuándo — para el
// cliente cuando pregunta, y para nosotros cuando un Tenant User deja la
// empresa.
//
// Se escribe desde la ruta de exportación con `overrideAccess: true` (ahí no
// hay usuario de Payload, solo la sesión del Tenant User) y desde el panel
// no se puede crear, editar ni borrar: una bitácora que el interesado puede
// reescribir no sirve de nada.
//
// Igual que Leads y MarketingReports, el campo `tenant` lo inyecta
// `multiTenantPlugin` (ver payload.config.ts), no está a mano en `fields`.
export const LeadExports: CollectionConfig = {
  slug: 'lead-exports',
  labels: { singular: 'Exportación de Leads', plural: 'Exportaciones de Leads' },
  admin: {
    useAsTitle: 'exportedByEmail',
    defaultColumns: ['tenant', 'exportedByEmail', 'leadCount', 'filtersLabel', 'createdAt'],
    description:
      'Registro de cada descarga de Leads en CSV desde el Dashboard de Cliente. Solo lectura.',
  },
  access: {
    read: isInternalUser,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: 'exportedBy',
      type: 'relationship',
      relationTo: 'tenant-users',
      label: 'Quién exportó',
      index: true,
      admin: {
        readOnly: true,
        description: 'El Tenant User con cuya sesión se hizo la descarga.',
      },
    },
    {
      // El correo se guarda aparte de la relación a propósito: si el Tenant
      // User se borra, la relación queda vacía y el registro dejaría de
      // decir quién fue, que es justo lo único que tiene que decir.
      name: 'exportedByEmail',
      type: 'text',
      required: true,
      label: 'Correo de quien exportó',
      admin: { readOnly: true },
    },
    {
      name: 'leadCount',
      type: 'number',
      required: true,
      label: 'Leads exportados',
      admin: { readOnly: true },
    },
    {
      name: 'filtersLabel',
      type: 'text',
      required: true,
      label: 'Filtros activos',
      admin: {
        readOnly: true,
        description: 'Los filtros del dashboard en el momento de la descarga, en palabras.',
      },
    },
    {
      name: 'filters',
      type: 'json',
      label: 'Filtros (crudo)',
      admin: {
        readOnly: true,
        description: 'Los mismos filtros tal como llegaron, para poder repetir la consulta.',
      },
    },
  ],
  indexes: [
    { fields: ['tenant', 'createdAt'] }, // "qué se llevó este cliente y cuándo"
  ],
  timestamps: true,
}
