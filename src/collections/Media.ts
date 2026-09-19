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
    {
      // Base del nombre sin sufijos de Vercel, tal como llegó la primera vez.
      // Recortar los sufijos del nombre acumulado con un regex es frágil (tienen
      // longitud variable y Vercel los trunca cerca del límite de pathname); por
      // eso guardamos el original y lo reponemos en cada re-subida (ver issue 22).
      name: 'originalFilename',
      type: 'text',
      admin: { hidden: true },
    },
  ],
  upload: {
    focalPoint: true,
  },
  hooks: {
    // Un crop o cambio de focal point sin archivo nuevo hace que Payload vuelva
    // a subir la imagen usando el `filename` actual como base. Sin esto, esa base
    // ya trae el sufijo aleatorio de la subida anterior y Vercel le agrega otro
    // encima, así que el nombre crece en cada edición (issue 22). Reponemos la
    // base original antes de que Payload arme el nuevo archivo a subir.
    beforeOperation: [
      async ({ args, operation }) => {
        if (operation !== 'update') return args

        // El tipo de `args` es la unión de todas las operaciones posibles; en
        // 'update' siempre trae `id` y `data`.
        const updateArgs = args as { data?: Record<string, unknown>; id?: number | string }

        if (args.req.file) return args // hay bytes nuevos: es una imagen distinta, no un crop/focal point
        if (!updateArgs.id) return args

        const existing = await args.req.payload.findByID({
          collection: 'media',
          id: updateArgs.id,
          req: args.req,
          overrideAccess: true,
          depth: 0,
        })

        if (existing?.originalFilename && updateArgs.data) {
          updateArgs.data.filename = existing.originalFilename
        }

        return args
      },
    ],
    // Guarda la base "limpia" (antes de que Vercel le agregue su sufijo) para la
    // próxima re-subida. Se hace después de que Payload arma el nombre, así que
    // en la propia subida original ya queda sin sufijos.
    beforeChange: [
      ({ data }) => {
        if (data?.filename) {
          data.originalFilename = data.filename
        }
        return data
      },
    ],
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
