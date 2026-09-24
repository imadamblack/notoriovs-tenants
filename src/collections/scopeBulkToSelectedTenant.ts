import type { CollectionBeforeOperationHook, Where } from 'payload'
import { getTenantFromCookie } from '@payloadcms/plugin-multi-tenant/utilities'

/**
 * Acota las ediciones y borrados EN BULTO del panel al tenant seleccionado en
 * el selector de `multiTenantPlugin`.
 *
 * Por qué hace falta: el plugin filtra el listado con `admin.baseFilter`, pero
 * Payload solo aplica ese filtro al PINTAR la tabla. El "Select all (N)" de la
 * edición/borrado en bulto arma su `where` solo con los filtros de la URL, sin
 * el del tenant, y el control de acceso no lo recupera porque un superadmin ve
 * todos los tenants. Resultado: la tabla decía "512" (los de un cliente) y el
 * PATCH tocó los 1065 leads de todos los clientes. Lo mismo habría pasado con
 * "Delete".
 *
 * Solo actúa sobre operaciones en bulto (traen `where`, no `id`), que vienen de
 * la REST API (`overrideAccess: false`) y con un tenant elegido en la cookie.
 * Las rutas propias y el cleanup del plugin usan `overrideAccess: true` y
 * filtran por su cuenta, así que no pasan por aquí. Sin tenant elegido ("todos")
 * la tabla muestra todo y el bulto toca todo: eso sí es lo que se ve.
 */
export const scopeBulkToSelectedTenant: CollectionBeforeOperationHook = ({
  args,
  operation,
  overrideAccess,
  req,
}) => {
  if (operation !== 'update' && operation !== 'delete') return args
  if (overrideAccess) return args
  if (!('where' in args) || !args.where) return args
  if ('id' in args && args.id !== undefined) return args

  const tenantId = getTenantFromCookie(req.headers, req.payload.db.defaultIDType)
  if (tenantId === null) return args

  const tenantScope: Where = { tenant: { equals: tenantId } }
  return { ...args, where: { and: [args.where, tenantScope] } }
}
