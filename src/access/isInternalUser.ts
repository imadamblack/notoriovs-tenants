import type { Access } from 'payload'

/**
 * Solo el equipo de Notoriovs. Se compara la **colección** de la que viene el
 * token, no un rol ni `Boolean(req.user)`.
 *
 * La diferencia dejó de ser cosmética cuando los Tenant Users ganaron sesión
 * de Payload propia (issue 08): con `Boolean(req.user)`, la cookie de un
 * cliente pasaba el control de acceso de `leads` y `marketing-reports`, y un
 * `GET /api/leads` a pelo le habría devuelto los leads de TODOS los tenants
 * —justo el peor resultado posible del sistema, el que motiva el ADR 0001.
 *
 * Los datos que un Tenant User sí puede ver no salen por aquí: las rutas de
 * /api/tenant-dashboard/* usan `overrideAccess: true` y filtran por el tenant
 * que resolvió `resolveDashboardAuth` a partir del host.
 */
export const isInternalUser: Access = ({ req }) => req.user?.collection === 'users'
