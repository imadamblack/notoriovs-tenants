import type { Payload } from 'payload'

// La suscripción de push de `id`, pero solo si es de ESTE tenant Y de ESTE
// Tenant User. Calcada de `findLeadOfTenant` (leadDashboardFilters.ts), con
// una comprobación de más: un Lead es del tenant, un dispositivo es de una
// persona — un `owner` no administra las suscripciones de un `member`, cada
// quien la suya.
export async function findSubscriptionOfTenant(
  payload: Payload,
  id: string | number,
  tenantId: string | number,
  tenantUserId: string | number,
) {
  const subscription = await payload.findByID({
    collection: 'push-subscriptions',
    id,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
  })

  if (!subscription) return null

  const subscriptionTenantId =
    typeof subscription.tenant === 'object'
      ? (subscription.tenant as { id?: unknown })?.id
      : subscription.tenant
  const subscriptionTenantUserId =
    typeof subscription.tenantUser === 'object'
      ? (subscription.tenantUser as { id?: unknown })?.id
      : subscription.tenantUser

  if (String(subscriptionTenantId) !== String(tenantId)) return null
  if (String(subscriptionTenantUserId) !== String(tenantUserId)) return null

  return subscription
}
