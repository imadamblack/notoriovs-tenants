import type { CollectionConfig } from 'payload'
import { isInternalUser } from '@/access/isInternalUser'

// Cada vez que alguien de Notoriovs entra al Dashboard de un cliente desde el
// panel (issue 31). Un documento es tres cosas a la vez, en el orden en que
// suceden:
//
//   1. El ticket de traspaso: el panel lo emite (`ticketHash`, vida de un
//      minuto) y el navegador aterriza con él en el host del Tenant. Es de un
//      solo uso: canjearlo llena `enteredAt`.
//   2. La sesión que ese canje abre en el host del Tenant (`sessionHash`),
//      que se vuelve a validar en cada petición contra este documento y contra
//      el Internal User vivo. Salir llena `endedAt` y la sesión muere.
//   3. La bitácora: quién entró, a qué cliente y cuándo.
//
// De los tokens solo se guarda el hash: quien lea esta tabla (o un respaldo de
// la base) no se lleva una sesión abierta.
//
// Se escribe solo desde las rutas, con `overrideAccess: true`. Desde el panel
// nadie la crea, edita ni borra: una bitácora que el interesado puede
// reescribir no sirve de nada. El campo `tenant` lo inyecta
// `multiTenantPlugin` (ver payload.config.ts), que además acota a un account
// manager a las entradas de sus Tenants asignados.

// Los campos que solo leen las rutas del traspaso. Ocultos en el panel y
// cerrados a toda lectura por API; la Local API con `overrideAccess` los ve.
// No se usa `hidden: true` porque ese los esconde también de la Local API.
const SERVER_ONLY = {
  access: { read: () => false },
  admin: { hidden: true },
} as const

export const DashboardVisits: CollectionConfig = {
  slug: 'dashboard-visits',
  labels: { singular: 'Entrada al Dashboard', plural: 'Entradas al Dashboard' },
  admin: {
    useAsTitle: 'userEmail',
    defaultColumns: ['tenant', 'userEmail', 'enteredAt', 'endedAt'],
    description:
      'Cada vez que alguien de Notoriovs entró al Dashboard de un cliente desde el panel. Solo lectura.',
  },
  access: {
    read: isInternalUser,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      // No es `required`: borrar a alguien del equipo deja la relación vacía
      // (ON DELETE SET NULL) y su correo, abajo, sigue diciendo quién fue.
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      label: 'Quién entró',
      index: true,
      admin: { readOnly: true },
    },
    {
      // Igual que en `lead-exports`: si el usuario se borra, la relación queda
      // vacía y la bitácora dejaría de decir quién fue.
      name: 'userEmail',
      type: 'text',
      required: true,
      label: 'Correo de quien entró',
      admin: { readOnly: true },
    },
    {
      name: 'ticketHash',
      type: 'text',
      required: true,
      unique: true,
      ...SERVER_ONLY,
    },
    {
      name: 'ticketExpiresAt',
      type: 'date',
      required: true,
      ...SERVER_ONLY,
    },
    {
      name: 'enteredAt',
      type: 'date',
      label: 'Entró',
      admin: {
        readOnly: true,
        date: { pickerAppearance: 'dayAndTime' },
        description: 'Vacío si el enlace se emitió pero nunca se abrió.',
      },
    },
    {
      name: 'sessionHash',
      type: 'text',
      unique: true,
      ...SERVER_ONLY,
    },
    {
      name: 'sessionExpiresAt',
      type: 'date',
      ...SERVER_ONLY,
    },
    {
      name: 'endedAt',
      type: 'date',
      label: 'Salió',
      admin: {
        readOnly: true,
        date: { pickerAppearance: 'dayAndTime' },
        description: 'Vacío si la sesión venció sola en vez de cerrarse con "Salir".',
      },
    },
    {
      // A dónde vuelve "Salir": la ficha del Tenant en el panel desde el que se
      // entró. Se guarda al emitir el ticket, en el host del panel, porque el
      // host del Tenant no tiene forma de saber dónde vive el panel.
      name: 'returnUrl',
      type: 'text',
      required: true,
      ...SERVER_ONLY,
    },
  ],
}
