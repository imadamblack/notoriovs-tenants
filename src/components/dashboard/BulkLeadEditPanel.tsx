'use client'

import { useState } from 'react'
import type { Lead, PipelineStage } from '@/components/dashboard/DashboardApp'
import Button from '@/components/dashboard/ui/atoms/Button'
import Select from '@/components/dashboard/ui/atoms/Select'
import IconChevronLeft from '@/components/dashboard/ui/atoms/icons/IconChevronLeft'
import { statusLabel } from '@/components/dashboard/leadPresentation'
import type { TenantMember } from '@/utils/tenantMembers'

const STATUS_VALUES: Lead['status'][] = ['open', 'won', 'lost', 'disqualified']

/** Cuántos nombres se listan antes de resumir el resto como "y N más". */
const NAMES_SHOWN = 8

/** `assignee: null` es "Sin asignar"; ausente es "sin cambio". */
export type BulkLeadPatch = { stage?: string; status?: Lead['status']; assignee?: number | string | null }

/** El valor "Sin asignar" del selector de Responsable ('' ya es "Sin cambio"). */
const UNASSIGNED = 'none'

type BulkLeadEditPanelProps = {
  /** Los leads marcados en la Lista, en el orden en que se ven. */
  leads: Lead[]
  pipeline: PipelineStage[]
  members: TenantMember[]
  viewerId: string | number
  /** Sin este permiso, el Responsable solo se toma para uno mismo o se suelta. */
  canAssignLeads: boolean
  onClose: () => void
  /** Aplica el cambio; regresa un mensaje de error, o `null` si salió bien. */
  onApply: (patch: BulkLeadPatch) => Promise<string | null>
}

// Editar varios leads a la vez (etapa, estado o responsable), desde la Lista. Mismo
// panel lateral que el detalle de un lead y que "Nuevo Lead".
//
// Elegir una etapa, un estado o un responsable NO aplica nada: hace falta el botón, que
// dice cuántos leads va a tocar, y arriba están sus nombres. Después de lo que
// pasó con "Select all" en Payload, qué se va a editar tiene que estar a la
// vista antes de guardar, no después.
export default function BulkLeadEditPanel({
  leads,
  pipeline,
  members,
  viewerId,
  canAssignLeads,
  onClose,
  onApply,
}: BulkLeadEditPanelProps) {
  const [stage, setStage] = useState('')
  const [status, setStatus] = useState<Lead['status'] | ''>('')
  const [assignee, setAssignee] = useState('')
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const count = leads.length
  const leadsWord = count === 1 ? 'lead' : 'leads'

  // Mismo criterio que el backend y que el panel de detalle: cambiar la etapa
  // sugiere el resultado que le corresponde. Se puede cambiar después.
  const handleStageChange = (nextStage: string) => {
    setStage(nextStage)
    setError(null)
    const stageInfo = pipeline.find((s) => s.id === nextStage)
    if (nextStage) setStatus(stageInfo?.isWon ? 'won' : stageInfo?.isLost ? 'lost' : 'open')
  }

  const handleApply = async () => {
    const patch: BulkLeadPatch = {}
    if (stage) patch.stage = stage
    if (status) patch.status = status
    if (assignee) patch.assignee = assignee === UNASSIGNED ? null : assignee
    setApplying(true)
    setError(null)
    const failure = await onApply(patch)
    setApplying(false)
    if (failure) {
      setError(failure)
      return
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={applying ? undefined : onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[41rem] h-full bg-neutral-900 shadow-xl overflow-y-auto p-8 flex flex-col gap-6"
      >
        <div className="flex items-center">
          <button
            type="button"
            onClick={onClose}
            disabled={applying}
            aria-label="Volver"
            className="mr-6 bg-transparent text-neutral-400 hover:text-brand-2 p-0 w-auto"
          >
            <IconChevronLeft />
          </button>
        </div>
        <h2 className="ft-3 font-bold text-neutral-100">
          Editar {count} {leadsWord}
        </h2>

        <ul className="flex flex-col gap-1 -ft-3 text-neutral-300">
          {leads.slice(0, NAMES_SHOWN).map((lead) => (
            <li key={lead.id} className="truncate">
              {lead.name || 'Sin nombre'}
            </li>
          ))}
          {count > NAMES_SHOWN && <li className="text-neutral-500">y {count - NAMES_SHOWN} más</li>}
        </ul>

        <div className="flex flex-col gap-3">
          <Select label="Etapa" value={stage} onChange={(e) => handleStageChange(e.target.value)} disabled={applying}>
            <option value="">Sin cambio</option>
            {pipeline.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>

          <Select
            label="Estado"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as Lead['status'] | '')
              setError(null)
            }}
            disabled={applying}
          >
            <option value="">Sin cambio</option>
            {STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </Select>

          {/* Un `owner` reparte a cualquiera; un `member` solo toma para sí los
              que no tienen responsable o suelta los suyos (issue 38). Los que
              no se pueden cambiar se quedan como estaban y se avisa cuántos. */}
          <Select
            label="Responsable"
            value={assignee}
            onChange={(e) => {
              setAssignee(e.target.value)
              setError(null)
            }}
            disabled={applying}
          >
            <option value="">Sin cambio</option>
            {canAssignLeads ? (
              <>
                <option value={UNASSIGNED}>Sin asignar</option>
                {members.map((member) => (
                  <option key={member.id} value={String(member.id)}>
                    {member.label}
                    {String(member.id) === String(viewerId) ? ' (yo)' : ''}
                  </option>
                ))}
              </>
            ) : (
              <>
                <option value={String(viewerId)}>Tomarlos (yo)</option>
                <option value={UNASSIGNED}>Soltar los míos</option>
              </>
            )}
          </Select>
        </div>

        {error && <p className="-ft-3 text-red-400">{error}</p>}

        <div className="mt-auto flex gap-4">
          <Button variant="secondary" onClick={onClose} disabled={applying} className="flex-1 py-3">
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleApply}
            disabled={applying || (!stage && !status && !assignee)}
            className="flex-1"
          >
            {applying ? 'Aplicando…' : `Aplicar a ${count} ${leadsWord}`}
          </Button>
        </div>
      </div>
    </div>
  )
}
