import type { CollectionAfterChangeHook, CollectionBeforeChangeHook } from 'payload'
import { ValidationError } from 'payload'

// El Responsable de un Lead (issue 38) es un Tenant User de SU MISMO Tenant, o
// nadie. Esa regla vive aquí, en la colección, y no en las rutas del
// dashboard, por la misma razón que `lead.created` se emite desde `Leads.ts`:
// al Lead se le escribe por varias puertas —el dashboard, la edición en bulto,
// el panel de Payload— y el panel no pasa por ninguna ruta nuestra. Las rutas
// validan antes para devolver un error legible; esto es lo que no se puede
// saltar.

/** La relación llega como id o como documento poblado según el `depth`. */
export function relationId(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return id
  }
  return null
}

/**
 * Rechaza guardar un Lead cuyo Responsable no es del Tenant del Lead.
 *
 * Se revisa con los valores FINALES (lo que llega en `data` encima de lo que
 * ya tenía el documento), no solo cuando cambia `assignee`: mover un Lead a
 * otro Tenant desde el panel sin quitarle el Responsable dejaría a una persona
 * de un cliente como responsable de un Lead de otro.
 *
 * La consulta del Tenant User se guarda en `req.context` porque una edición en
 * bulto corre este hook una vez por Lead, casi siempre con la misma persona.
 */
export const assertAssigneeInLeadTenant: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  req,
}) => {
  const assigneeId = relationId('assignee' in data ? data.assignee : originalDoc?.assignee)
  if (assigneeId === null) return data

  const tenantId = relationId('tenant' in data ? data.tenant : originalDoc?.tenant)

  const cache = ((req.context.assigneeTenants as Map<string, string | null> | undefined) ??=
    new Map<string, string | null>())
  const key = String(assigneeId)

  if (!cache.has(key)) {
    const member = await req.payload.findByID({
      collection: 'tenant-users',
      id: assigneeId,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
      select: { tenant: true },
      req,
    })
    const memberTenant = relationId(member?.tenant)
    cache.set(key, memberTenant === null ? null : String(memberTenant))
  }

  if (tenantId === null || cache.get(key) !== String(tenantId)) {
    throw new ValidationError({
      collection: 'leads',
      errors: [{ path: 'assignee', message: 'El Responsable tiene que ser un usuario del mismo Tenant que el Lead.' }],
      req,
    })
  }

  return data
}

/**
 * Cuando un Tenant User cambia de Tenant (solo se puede desde el panel), sus
 * Leads del Tenant anterior vuelven a "Sin asignar": ya no es de ese equipo.
 *
 * El borrado no necesita hook: la llave foránea de `leads.assignee_id` es
 * `ON DELETE SET NULL` (ver la migración del issue 38), así que la base lo
 * hace sola y no hay forma de que quede un Lead apuntando a alguien que ya no
 * existe.
 */
export const releaseLeadsOnTenantChange: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  if (operation !== 'update') return doc

  const before = relationId(previousDoc?.tenant)
  const after = relationId(doc.tenant)
  if (before === null || String(before) === String(after)) return doc

  await req.payload.update({
    collection: 'leads',
    where: { assignee: { equals: doc.id } },
    data: { assignee: null },
    depth: 0,
    overrideAccess: true,
    req,
  })

  return doc
}
