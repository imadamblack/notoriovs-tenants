'use client'

import { useState } from 'react'
import type { Lead, PipelineStage } from '@/components/dashboard/DashboardApp'

type LeadDetailPanelProps = {
  lead: Lead
  pipeline: PipelineStage[]
  onClose: () => void
  onSave: (patch: Partial<Lead>) => Promise<boolean>
}

const EXCLUDED_ANSWER_KEYS = new Set(['nombre', 'telefono', 'whatsapp', 'email'])

export default function LeadDetailPanel({ lead, pipeline, onClose, onSave }: LeadDetailPanelProps) {
  const [form, setForm] = useState({
    name: lead.name || '',
    phone: lead.phone || '',
    whatsapp: lead.whatsapp || '',
    email: lead.email || '',
    status: lead.status,
    notes: lead.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    const ok = await onSave(form)
    setSaving(false)
    if (ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }
  }

  const answerEntries = Object.entries(lead.answers || {}).filter(
    ([key, value]) => !EXCLUDED_ANSWER_KEYS.has(key) && value !== undefined && value !== '',
  )

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md h-full bg-white shadow-xl overflow-y-auto p-6 flex flex-col gap-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="ft-2 font-bold text-brand-1">Detalle del lead</h2>
          <button onClick={onClose} className="!bg-transparent !text-neutral-400 hover:!text-brand-2">
            Cerrar ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm text-neutral-600">
            Nombre
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="border border-neutral-300 rounded-lg px-3 py-2 text-neutral-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-neutral-600">
            Etapa
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className="border border-neutral-300 rounded-lg px-3 py-2 text-neutral-900"
            >
              {pipeline.map((stage) => (
                <option key={stage.key} value={stage.key}>
                  {stage.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-neutral-600">
            Teléfono
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="border border-neutral-300 rounded-lg px-3 py-2 text-neutral-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-neutral-600">
            WhatsApp
            <input
              value={form.whatsapp}
              onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
              className="border border-neutral-300 rounded-lg px-3 py-2 text-neutral-900"
            />
          </label>
          <label className="col-span-2 flex flex-col gap-1 text-sm text-neutral-600">
            Email
            <input
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="border border-neutral-300 rounded-lg px-3 py-2 text-neutral-900"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm text-neutral-600">
          Notas internas
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={4}
            className="border border-neutral-300 rounded-lg px-3 py-2 text-neutral-900"
          />
        </label>

        <div>
          <p className="text-sm font-semibold text-neutral-700 mb-2">Respuestas del quiz</p>
          <div className="flex flex-col gap-2 text-sm">
            {answerEntries.length === 0 && <p className="text-neutral-400">Sin respuestas adicionales.</p>}
            {answerEntries.map(([key, value]) => (
              <div key={key} className="flex justify-between gap-4 border-b border-neutral-100 pb-1">
                <span className="text-neutral-400">{key}</span>
                <span className="text-neutral-800 text-right">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>

        {lead.createdAt && (
          <p className="text-xs text-neutral-400">
            Creado el {new Date(lead.createdAt).toLocaleString('es-MX')}
          </p>
        )}
        {lead.updatedAt && (
          <p className="text-xs text-neutral-400">
            Actualizado el {new Date(lead.updatedAt).toLocaleString('es-MX')}
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="!bg-brand-1 !text-white rounded-lg py-2 mt-auto disabled:opacity-50"
        >
          {saving ? 'Guardando…' : saved ? 'Guardado ✓' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}
