'use client'

import { useState, type ChangeEvent } from 'react'
import type { Lead } from '@/components/dashboard/DashboardApp'
import type { TenantMember } from '@/utils/tenantMembers'
import Avatar from '@/components/dashboard/ui/atoms/Avatar'
import Button from '@/components/dashboard/ui/atoms/Button'
import Select from '@/components/dashboard/ui/atoms/Select'
import { assigneeIdOf, assigneeLabelOf } from '@/components/dashboard/leadAssignee'

type LeadAssigneeControlProps = {
  lead: Lead
  members: TenantMember[]
  viewerId: string | number
  /** Repartir a cualquiera (`owner`) o solo tomar/soltar el propio (`member`). */
  canAssignLeads: boolean
  onSave: (patch: Partial<Lead>) => Promise<boolean>
}

// El Responsable de un Lead en el panel de detalle (issue 38). Se guarda al
// elegir, igual que los selectores rápidos de etapa y estado de arriba.
//
// Lo que se ofrece depende del rol, y es lo mismo que la API vuelve a exigir
// por su cuenta (`canChangeAssignee`): a quien no puede repartir no se le
// pinta un selector que la ruta le va a rechazar, sino el único botón que sí
// le toca — tomarlo si está libre, soltarlo si es suyo, nada si es de otro.
export default function LeadAssigneeControl({
  lead,
  members,
  viewerId,
  canAssignLeads,
  onSave,
}: LeadAssigneeControlProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentId = assigneeIdOf(lead)
  const currentLabel = assigneeLabelOf(lead, members)
  const isMine = currentId !== null && currentId === String(viewerId)

  const save = async (next: string | number | null) => {
    setSaving(true)
    setError(null)
    const ok = await onSave({ assignee: next })
    setSaving(false)
    if (!ok) setError('No se pudo cambiar el responsable')
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-4">
        <span className="-ft-2 text-neutral-400 shrink-0">Responsable</span>

        {canAssignLeads ? (
          <Select
            value={currentId ?? ''}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => save(e.target.value || null)}
            disabled={saving}
            aria-label="Cambiar responsable"
            className="bg-neutral-800 text-neutral-200 border-0 h-12 px-4 -ft-2 truncate cursor-pointer max-w-[60%]"
          >
            <option value="">Sin asignar</option>
            {/* Alguien que ya no está en la lista (se dio de alta después de
                abrir el Dashboard) se conserva como opción para no mostrar
                "Sin asignar" en un lead que sí tiene responsable. */}
            {currentId !== null && !members.some((m) => String(m.id) === currentId) && (
              <option value={currentId}>{currentLabel}</option>
            )}
            {members.map((member) => (
              <option key={member.id} value={String(member.id)}>
                {member.label}
                {String(member.id) === String(viewerId) ? ' (yo)' : ''}
              </option>
            ))}
          </Select>
        ) : (
          <div className="flex items-center gap-3 min-w-0">
            {currentLabel ? (
              <span className="flex items-center gap-2 min-w-0 text-neutral-100 -ft-1">
                <Avatar name={currentLabel} />
                <span className="truncate">{isMine ? `${currentLabel} (yo)` : currentLabel}</span>
              </span>
            ) : (
              <span className="text-neutral-400 -ft-1">Sin asignar</span>
            )}
            {currentId === null && (
              <Button variant="secondary" size="sm" disabled={saving} onClick={() => save(viewerId)}>
                {saving ? 'Guardando…' : 'Tomarlo'}
              </Button>
            )}
            {isMine && (
              <Button variant="secondary" size="sm" disabled={saving} onClick={() => save(null)}>
                {saving ? 'Guardando…' : 'Soltarlo'}
              </Button>
            )}
          </div>
        )}
      </div>
      {error && <p className="-ft-3 text-red-400">{error}</p>}
    </div>
  )
}
