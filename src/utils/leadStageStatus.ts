import type { TenantDoc } from '@/utils/getTenant'

export const LEAD_STATUSES = new Set(['open', 'won', 'lost', 'disqualified'])

type StageStatusPatch = { stage?: unknown; status?: unknown }

/**
 * Valida `stage`/`status` de una edición contra el pipeline del tenant y
 * resuelve el `status` que le toca a la etapa. Lo comparten el PATCH de un
 * lead y el de varios (`leads/bulk`): mover 30 leads a "Ganado" desde la Lista
 * tiene que dejarlos igual que arrastrarlos uno por uno en el Kanban.
 *
 * Mover de etapa re-sincroniza `status` (arrastrar a la columna "Ganado" marca
 * el lead como ganado), salvo que la misma edición ya traiga un `status`
 * explícito: el panel de detalle muestra los dos campos y no se pisa lo que el
 * usuario eligió a propósito.
 */
export function resolveStageAndStatus<T extends StageStatusPatch>(
  tenant: Pick<TenantDoc, 'leadPipeline'>,
  data: T,
): { ok: true; data: T } | { ok: false; error: string } {
  const next = { ...data }

  if ('stage' in next) {
    const matchedStage = tenant.leadPipeline?.find((stage) => stage.id === next.stage)
    if (tenant.leadPipeline?.length && !matchedStage) {
      return { ok: false, error: 'Etapa inválida para este tenant' }
    }
    if (!('status' in next)) {
      next.status = matchedStage?.isWon ? 'won' : matchedStage?.isLost ? 'lost' : 'open'
    }
  }

  if ('status' in next && !LEAD_STATUSES.has(next.status as string)) {
    return { ok: false, error: 'Status inválido' }
  }

  return { ok: true, data: next }
}
