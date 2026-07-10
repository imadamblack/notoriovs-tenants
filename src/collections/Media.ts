import type { CollectionConfig } from 'payload'
import { del } from '@vercel/blob'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
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
