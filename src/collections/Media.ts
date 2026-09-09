import type { CollectionConfig } from 'payload'
import { del } from '@vercel/blob'
import { isInternalUser } from '@/access/isInternalUser'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    // La lectura es pública a propósito: son las imágenes de las landings y
    // los quizzes, que se sirven a cualquier visitante.
    read: () => true,
    // Subir y borrar, no. Sin estas tres líneas Payload deja escribir a
    // cualquiera con sesión, y desde el issue 08 eso incluye a los Tenant
    // Users: la cookie del dashboard de un cliente servía para subir archivos
    // al blob de Notoriovs o borrar las imágenes de otro cliente.
    create: isInternalUser,
    update: isInternalUser,
    delete: isInternalUser,
  },
  folders: true,
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
  upload: {
    focalPoint: true,
  },
  hooks: {
    // Con `addRandomSuffix: true` cada re-subida (crop/focal point) crea un blob
    // nuevo en Vercel; aquí borramos el blob anterior para no dejar archivos huérfanos.
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        if (operation !== 'update') return
        if (!previousDoc?.url || previousDoc.url === doc.url) return

        try {
          await del(previousDoc.url, { token: process.env.BLOB_READ_WRITE_TOKEN })
        } catch (err) {
          req.payload.logger.warn(`No se pudo borrar el blob anterior de media ${doc.id}: ${err}`)
        }
      },
    ],
  },
}
