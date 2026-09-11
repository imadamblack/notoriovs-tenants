'use client'

import { useState } from 'react'
import type { CreateLeadInput, CreateLeadResult, Lead, PipelineStage } from '@/components/dashboard/DashboardApp'
import Button from '@/components/dashboard/ui/atoms/Button'
import Input from '@/components/dashboard/ui/atoms/Input'
import Select from '@/components/dashboard/ui/atoms/Select'
import Textarea from '@/components/dashboard/ui/atoms/Textarea'
import SectionHeading from '@/components/dashboard/ui/atoms/SectionHeading'
import IconChevronLeft from "@/components/dashboard/ui/atoms/icons/IconChevronLeft";
import LeadDetailHeader from "@/components/dashboard/ui/organisms/LeadDetailHeader";
import {leadBadge} from "@/components/dashboard/leadPresentation";
import IconEdit from "@/components/dashboard/ui/atoms/icons/IconEdit";
import Badge from "@/components/dashboard/ui/atoms/Badge";

// Alta a mano de un lead: el que llegó por teléfono o en persona y nunca
// pasó por el quiz (issue 13). Se captura sin salir del dashboard y sin
// pedirle nada a Notoriovs.
//
// El formulario es corto a propósito: nombre y una forma de contacto es todo
// lo obligatorio, porque esto se llena mientras la persona sigue en la línea.
// Lo demás (etapa, notas) está a la mano pero se puede dejar en blanco y
// completar después desde el panel de detalle.

type NewLeadPanelProps = {
  pipeline: PipelineStage[]
  onClose: () => void
  onCreate: (input: CreateLeadInput, confirmDuplicate: boolean) => Promise<CreateLeadResult>
  /** Abre el lead que ya existía con ese teléfono, en vez de capturar otro. */
  onOpenLead: (lead: Lead) => void
}

const emptyForm = (stage: string): CreateLeadInput => ({
  name: '',
  phone: '',
  whatsapp: '',
  email: '',
  stage,
  notes: '',
})

export default function NewLeadPanel({ pipeline, onClose, onCreate, onOpenLead }: NewLeadPanelProps) {
  const [form, setForm] = useState<CreateLeadInput>(() => emptyForm(pipeline[0]?.id || ''))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // El lead que ya existía con este teléfono. Mientras esté puesto, el botón
  // de guardar confirma el duplicado en vez de volver a preguntar.
  const [duplicate, setDuplicate] = useState<Lead | null>(null)

  const update = (patch: Partial<CreateLeadInput>) => {
    setForm((f) => ({ ...f, ...patch }))
    setError(null)
    // Cambiar el número invalida el aviso: el duplicado era del teléfono
    // anterior, y confirmarlo aquí guardaría a ciegas sobre otro número.
    if ('phone' in patch || 'whatsapp' in patch) setDuplicate(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.name.trim()) {
      setError('Escribe el nombre del lead')
      return
    }
    if (!form.phone.trim() && !form.whatsapp.trim() && !form.email.trim()) {
      setError('Deja al menos un teléfono, un WhatsApp o un correo')
      return
    }

    setSaving(true)
    setError(null)
    const result = await onCreate(form, Boolean(duplicate))
    setSaving(false)

    if (result.status === 'created') {
      onClose()
      return
    }
    if (result.status === 'duplicate') {
      setDuplicate(result.duplicate)
      return
    }
    setError(result.message)
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[41rem] h-full bg-neutral-900 shadow-xl overflow-y-auto p-8 flex flex-col gap-6"
      >

          <div className="flex items-center justify-between">
            <div className="flex items-center min-w-0">
              <button
                type="button"
                onClick={onClose}
                aria-label="Volver"
                className="mr-6 bg-transparent text-neutral-400 hover:text-brand-2 p-0 w-auto"
              >
                <IconChevronLeft />
              </button>
            </div>
          </div>
          <div className="flex gap-4">
            <h2 className="flex flex-grow ft-3 font-bold text-neutral-100 truncate">Nuevo Lead</h2>
          </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            label="Nombre"
            name="name"
            value={form.name}
            onChange={(e) => update({ name: e.target.value })}
            autoFocus
          />

          <Input
            label="Teléfono"
            name="phone"
            type="tel"
            value={form.phone}
            onChange={(e) => update({ phone: e.target.value })}
          />
          <Input
            label="WhatsApp"
            name="whatsapp"
            type="tel"
            value={form.whatsapp}
            onChange={(e) => update({ whatsapp: e.target.value })}
          />
          <Input
            label="Email"
            name="email"
            type="email"
            value={form.email}
            onChange={(e) => update({ email: e.target.value })}
          />

          {pipeline.length > 0 && (
            <Select label="Etapa" value={form.stage} onChange={(e) => update({ stage: e.target.value })}>
              {pipeline.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.label}
                </option>
              ))}
            </Select>
          )}

          <Textarea
            label="Notas internas"
            rows={4}
            value={form.notes}
            onChange={(e) => update({ notes: e.target.value })}
            placeholder="De dónde salió, qué pidió…"
          />

          {/* El duplicado avisa y ofrece el lead que ya estaba, pero nunca
              cierra la puerta: el mismo número puede ser de dos personas, y
              perder un lead por eso es peor que tener dos. */}
          {duplicate && (
            <div className="flex flex-col gap-2 rounded-xl border border-neutral-600 bg-neutral-800 p-4">
              <p className="-ft-3 text-neutral-200">
                Ya tienes un lead con este teléfono
                {duplicate.name ? `: ${duplicate.name}` : ''}.
              </p>
              <div className="flex">
                <Button variant="secondary" size="sm" type="button" onClick={() => onOpenLead(duplicate)}>
                  Abrir el que ya existe
                </Button>
              </div>
              <p className="-ft-4 text-neutral-400">
                Si no es la misma persona, guarda de todos modos.
              </p>
            </div>
          )}

          {error && <p className="-ft-3 text-red-400">{error}</p>}

          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Guardando…' : duplicate ? 'Guardar de todos modos' : 'Guardar lead'}
          </Button>
          <p className="-ft-4 text-neutral-500">
            Con el nombre y una forma de contacto basta. El lead entra abierto y queda marcado como
            capturado a mano.
          </p>
        </form>
      </div>
    </div>
  )
}
