// El catálogo de tipos de Aviso que un Tenant User puede apagar sin revocar
// el permiso del navegador (issue 36). Arranca con un solo renglón a
// propósito: agregar el segundo tipo (resumen diario, lead sin atender) es
// una línea aquí, no rehacer el modelo.
//
// Es un catálogo distinto de `EVENT_CATALOG` en `src/events/tenantEvents.ts`:
// ese gobierna el sobre que sale hacia n8n (ADR 0008); este gobierna qué
// puede silenciar un dispositivo del propio Aviso interno (ADR 0011).

export type NotificationType = 'lead-new'

export const NOTIFICATION_CATALOG: Record<NotificationType, { label: string }> = {
  'lead-new': { label: 'Lead nuevo' },
}

export const NOTIFICATION_TYPE_OPTIONS = Object.entries(NOTIFICATION_CATALOG).map(
  ([value, { label }]) => ({ value: value as NotificationType, label }),
)

export function isNotificationType(value: unknown): value is NotificationType {
  return typeof value === 'string' && value in NOTIFICATION_CATALOG
}
