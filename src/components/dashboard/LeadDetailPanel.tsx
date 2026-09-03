'use client'

import {useRef, useState} from 'react'
import type {Lead, PipelineStage} from '@/components/dashboard/DashboardApp'
import {formatPhone} from '@/utils/formatters'

type LeadDetailPanelProps = {
  lead: Lead
  pipeline: PipelineStage[]
  onClose: () => void
  onSave: (patch: Partial<Lead>) => Promise<boolean>
}

const EXCLUDED_ANSWER_KEYS = new Set(['nombre', 'telefono', 'whatsapp', 'email'])

const STATUS_LABELS: Record<string, string> = {
  open: 'Abierto',
  won: 'Ganado',
  lost: 'Perdido',
  disqualified: 'Descalificado',
}

type LeadForm = {
  name: string
  phone: string
  whatsapp: string
  email: string
  stage: string
  status: Lead['status']
  notes: string
}

function buildFormFromLead(lead: Lead): LeadForm {
  return {
    name: lead.name || '',
    phone: lead.phone || '',
    whatsapp: lead.whatsapp || '',
    email: lead.email || '',
    stage: lead.stage,
    status: lead.status,
    notes: lead.notes || '',
  }
}

// "Días sin movimiento": mismo criterio que el badge del Kanban (KanbanBoard.tsx)
// -- se calcula contra `updatedAt` (o `createdAt` si nunca se ha tocado), ya
// que la colección `leads` no tiene un campo dedicado de "última actividad".
function daysIdle(lead: Lead): number | null {
  const raw = lead.updatedAt || lead.createdAt
  if (!raw) return null
  const ms = Date.now() - new Date(raw).getTime()
  if (Number.isNaN(ms)) return null
  return Math.max(0, Math.floor(ms / 86400000))
}

function idleBadge(status: string, days: number | null) {
  if (status === 'open') {
    if (days === null) return null
    if (days < 1) return {label: '<1d', className: 'bg-neutral-700 text-neutral-200'}
    if (days < 15) return {label: `${days}d`, className: 'bg-red-600/90 text-white'}
    if (days < 45) return {label: `${days}d`, className: 'bg-red-700 text-white'}
    return {label: `${days}d`, className: 'bg-red-900 text-red-100'}
  }
  const STATUS_BADGE: Record<string, { label: string; className: string } | undefined> = {
    won: {label: 'Ganado', className: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30'},
    lost: {label: 'Perdido', className: 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30'},
    disqualified: {label: 'Descalificado', className: 'bg-neutral-600/20 text-neutral-400 ring-1 ring-neutral-600/30'},
  }

  return STATUS_BADGE[status] || null
}

function ReadField({id, label, value}: { id: string, label: string; value: string }) {
  switch (label) {
    case 'Nombre':
    case 'Teléfono':
      return null;

    case 'WhatsApp':
      return (
        <div key={id} className="-ft-2 flex justify-between gap-4 border-neutral-100 pt-2 pb-4">
          <span className="text-neutral-400">{label}</span>
          <a href={`https://wa.me/${value}`} target="_blank" className='underline text-brand-3'>{formatPhone(value)}</a>
        </div>
      )

    case 'Email':
      return (
        <div key={id} className="-ft-2 flex justify-between gap-4 border-neutral-100 pt-2 pb-4">
          <span className="text-neutral-400">{label}</span>
          <a href={`mailto:${value}`} target="_blank" className='underline text-brand-3'>{value}</a>
        </div>
      )

    case 'Status':
      return (
        <div key={id} className="-ft-2 flex justify-between gap-4 border-neutral-100 pt-2 pb-4">
          <span className="text-neutral-400">{label}</span>
          <span className="text-neutral-200 text-right">{String(value) || '—'}</span>
        </div>
      )

    case 'Etapa':
      return (
        <div key={id} className="-ft-2 flex justify-between gap-4 border-neutral-100 pt-2 pb-4">
          <span className="text-neutral-400">{label}</span>
          <span className="text-neutral-200 text-right">{String(value) || '—'}</span>
        </div>
      )

    default:
      return (
        <div key={id} className="-ft-2 flex justify-between gap-4 border-neutral-100 pt-2 pb-4">
          <span className="text-neutral-400">{label}</span>
          <span className="text-neutral-200 text-right">{String(value) || '—'}</span>
        </div>
      )
  }
}

export default function LeadDetailPanel({lead, pipeline, onClose, onSave}: LeadDetailPanelProps) {
  const [mode, setMode] = useState<'read' | 'write'>('read')
  const [form, setForm] = useState<LeadForm>(() => buildFormFromLead(lead))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const lastSavedNotesRef = useRef(form.notes)

  // Read view: Etapa y Status se eligen con <select> nativos (accesibles y
  // confiables en mobile), estilizados para verse como pill/ícono; pestañas
  // Notas/Detalles.
  const [readTab, setReadTab] = useState<'notas' | 'detalles'>('notas')
  const [quickSaving, setQuickSaving] = useState(false)
  const [quickSaved, setQuickSaved] = useState(false)

  // Mismo criterio que el auto-sync del backend (PATCH /api/tenant-dashboard/
  // leads): cambiar la etapa sugiere de inmediato el resultado correspondiente
  // ("Ganado"/"Perdido" si la etapa está marcada así en el pipeline del
  // tenant, "Abierto" si no), pero es solo una previsualización en el
  // formulario, el usuario la puede corregir en el select de "Resultado"
  // antes de guardar.
  const handleStageChange = (newStage: string) => {
    const stageInfo = pipeline.find((s) => s.id === newStage)
    setForm((f) => ({
      ...f,
      stage: newStage,
      status: stageInfo?.isWon ? 'won' : stageInfo?.isLost ? 'lost' : 'open',
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    const ok = await onSave(form)
    setSaving(false)
    if (ok) {
      lastSavedNotesRef.current = form.notes
      setSaved(true)
      setMode('read')
      setTimeout(() => setSaved(false), 1500)
    }
  }

  const handleCancelEdit = () => {
    setForm(buildFormFromLead(lead))
    setMode('read')
  }

  const handleNotesBlur = async () => {
    if (form.notes === lastSavedNotesRef.current) return
    setNotesSaving(true)
    setNotesSaved(false)
    const ok = await onSave({notes: form.notes})
    setNotesSaving(false)
    if (ok) {
      lastSavedNotesRef.current = form.notes
      setNotesSaved(true)
      setTimeout(() => setNotesSaved(false), 1500)
    }
  }

  // Selectores rápidos del read view: a diferencia del modo edición (donde
  // el cambio de etapa/status es solo una previsualización hasta dar
  // "Guardar"), aquí se guarda de inmediato al elegir una opción, igual que
  // ya pasa con las Notas al perder foco.
  const handleQuickStageChange = async (newStage: string) => {
    if (newStage === form.stage) return
    const previousForm = form
    const stageInfo = pipeline.find((s) => s.id === newStage)
    const nextStatus: Lead['status'] = stageInfo?.isWon ? 'won' : stageInfo?.isLost ? 'lost' : 'open'
    setForm((f) => ({...f, stage: newStage, status: nextStatus}))
    setQuickSaving(true)
    setQuickSaved(false)
    const ok = await onSave({stage: newStage, status: nextStatus})
    setQuickSaving(false)
    if (ok) {
      setQuickSaved(true)
      setTimeout(() => setQuickSaved(false), 1500)
    } else {
      setForm(previousForm)
    }
  }

  const handleQuickStatusChange = async (newStatus: Lead['status']) => {
    if (newStatus === form.status) return
    const previousForm = form
    setForm((f) => ({...f, status: newStatus}))
    setQuickSaving(true)
    setQuickSaved(false)
    const ok = await onSave({status: newStatus})
    setQuickSaving(false)
    if (ok) {
      setQuickSaved(true)
      setTimeout(() => setQuickSaved(false), 1500)
    } else {
      setForm(previousForm)
    }
  }

  const answerEntries = Object.entries(lead.answers || {}).filter(
    ([key, value]) => !EXCLUDED_ANSWER_KEYS.has(key) && value !== undefined && value !== '',
  )

  const whatsappNumber = (form.whatsapp || form.phone || '').replace(/\D/g, '')
  const currentStageIndex = pipeline.findIndex((s) => s.id === form.stage)
  const badgeIdle = idleBadge(lead.status, daysIdle(lead));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[41rem] h-full bg-neutral-900 shadow-xl overflow-y-scroll overflow-x-hidden p-8 flex flex-col gap-5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center min-w-0">
            <div
              onClick={mode === 'read' ? onClose : handleCancelEdit}
              className="mr-6 !text-neutral-400 hover:!text-brand-2 ft-8 cursor-pointer">
              ‹
            </div>
          </div>
          {mode === 'read' && (
            <button
              onClick={() => setMode('write')}
              title="Editar lead"
              aria-label="Editar lead"
              className="!bg-transparent !text-neutral-300 w-11 h-11 !p-0 flex items-center justify-center shrink-0 ml-4"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="20" height="20"
                   fill="currentColor">
                <path
                  d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h357l-80 80H200v560h560v-278l80-80v358q0 33-23.5 56.5T760-120H200Zm280-360ZM360-360v-170l367-367q12-12 27-18t30-6q16 0 30.5 6t26.5 18l56 57q11 12 17 26.5t6 29.5q0 15-5.5 29.5T897-728L530-360H360Zm481-424-56-56 56 56ZM440-440h56l232-232-28-28-29-28-231 231v57Zm260-260-29-28 29 28 28 28-28-28Z"/>
              </svg>
            </button>
          )}
        </div>

        {mode === 'read' ? (
          <>
            <div className="flex gap-4">
              <h2 className="flex flex-grow ft-2 font-bold text-neutral-200 truncate">{form.name}</h2>
              {badgeIdle && (
                <span
                  className={`flex items-center justify-center px-4 text-[1rem] font-semibold rounded-full ${badgeIdle.className}`}
                >
                  {badgeIdle.label}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-6">
              <div className="flex gap-4">
                <select
                  value={form.stage}
                  onChange={(e) => handleQuickStageChange(e.target.value)}
                  aria-label="Cambiar etapa"
                  className="flex-grow !bg-neutral-800 !text-neutral-200 border-0 rounded-lg h-16 px-4 -ft-1 font-medium truncate cursor-pointer"
                >
                  {pipeline.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.label}
                    </option>
                  ))}
                </select>

                <div className="relative shrink-0 w-16 h-16">
                  <select
                    value={form.status}
                    onChange={(e) => handleQuickStatusChange(e.target.value as Lead['status'])}
                    title="Cambiar status"
                    aria-label="Cambiar status"
                    className="peer absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  >
                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 !bg-neutral-800 !text-neutral-200 rounded-lg flex items-center justify-center -ft-1"
                  >
                    ⋮
                  </div>
                </div>
              </div>

              <div className="flex gap-1">
                {pipeline.map((stage, idx) => {
                  const isFirst = idx === 0;
                  const isLast = idx === pipeline.length - 1;
                  return (
                    <span
                      key={stage.id}
                      className={`h-4 flex-1 ${idx <= currentStageIndex ? 'bg-brand-3' : 'bg-neutral-700'} ${isFirst && 'rounded-l-full'} ${isLast && 'rounded-r-full'}`}
                    />
                  )
                })}
              </div>
            </div>

            <div className="flex bg-neutral-800 rounded-full mt-8 p-1">
              <button
                onClick={() => setReadTab('notas')}
                className={`flex-1 rounded-full py-2 -ft-4 hover:!translate-y-0 ${
                  readTab === 'notas' ? '!bg-neutral-600 !text-white' : '!bg-transparent !text-neutral-400'
                }`}
              >
                Notas
              </button>
              <button
                onClick={() => setReadTab('detalles')}
                className={`flex-1 rounded-full py-2 -ft-4 hover:!translate-y-0 ${
                  readTab === 'detalles' ? '!bg-neutral-600 !text-white' : '!bg-transparent !text-neutral-400'
                }`}
              >
                Detalles
              </button>
            </div>

            <div className="flex flex-col flex-grow gap-3">
              {readTab === 'detalles' ? (
                <>
                  <ReadField id="telefono" label="Teléfono" value={form.phone}/>
                  <ReadField id="whatsapp" label="WhatsApp" value={form.whatsapp}/>
                  <ReadField id="email" label="Email" value={form.email}/>

                  <p className="-ft-3 font-semibold text-neutral-200 mt-8 mb-2">Respuestas del quiz</p>
                  <div className="flex flex-col gap-2 text-sm">
                    {answerEntries.length === 0 && <p className="text-neutral-400">Sin respuestas adicionales.</p>}
                    {answerEntries.map(([key, value]) => (
                      <ReadField key={key} id={key} label={key} value={value}/>
                    ))}
                  </div>
                </>
              ) : (
                <label className="flex flex-col gap-1 -ft-3 text-neutral-200">
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({...f, notes: e.target.value}))}
                    onBlur={handleNotesBlur}
                    rows={10}
                    className="border border-neutral-300 px-3 py-2 min-h-[3rem] text-neutral-900"
                  />
                  <span className="-ft-4 text-neutral-400 h-4">
                    {notesSaving ? 'Guardando…' : notesSaved ? 'Guardado ✓' : ''}
                  </span>
                </label>
              )}
            </div>
            <div className="flex">
              {whatsappNumber && (
                <a
                  href={`https://wa.me/${whatsappNumber}`}
                  target="_blank"
                  className="flex-1 text-center !bg-brand-3 !text-white rounded-md py-4 -ft-2 font-medium"
                >
                  WhatsApp
                </a>
              )}
            </div>
            {lead.createdAt && (
              <p className="-ft-4 text-neutral-400">
                Creado el {new Date(lead.createdAt).toLocaleString('es-MX')}
              </p>
            )}
            {lead.updatedAt && (
              <p className="-ft-4 text-neutral-400">
                Actualizado el {new Date(lead.updatedAt).toLocaleString('es-MX')}
              </p>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 -ft-3 text-neutral-200">
                Nombre
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({...f, name: e.target.value}))}
                  className="border border-neutral-300 px-3 py-2 min-h-[3rem] text-neutral-900"
                />
              </label>
              <label className="flex flex-col gap-1 -ft-3 text-neutral-200">
                Etapa
                <select
                  value={form.stage}
                  onChange={(e) => handleStageChange(e.target.value)}
                  className="border border-neutral-300 px-3 py-2 min-h-[3rem] text-neutral-900"
                >
                  {pipeline.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 -ft-3 text-neutral-200">
                Resultado
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({...f, status: e.target.value as typeof form.status}))}
                  className="border border-neutral-300 px-3 py-2 min-h-[3rem] text-neutral-900"
                >
                  <option value="open">Abierto</option>
                  <option value="won">Ganado</option>
                  <option value="lost">Perdido</option>
                  <option value="disqualified">Descalificado</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 -ft-3 text-neutral-200">
                Teléfono
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({...f, phone: e.target.value}))}
                  className="border border-neutral-300 px-3 py-2 min-h-[3rem] text-neutral-900"
                />
              </label>
              <label className="flex flex-col gap-1 -ft-3 text-neutral-200">
                WhatsApp
                <input
                  value={form.whatsapp}
                  onChange={(e) => setForm((f) => ({...f, whatsapp: e.target.value}))}
                  className="border border-neutral-300 px-3 py-2 min-h-[3rem] text-neutral-900"
                />
              </label>
              <label className="col-span-2 flex flex-col gap-1 text-3m text-neutral-200">
                Email
                <input
                  value={form.email}
                  onChange={(e) => setForm((f) => ({...f, email: e.target.value}))}
                  className="border border-neutral-300 px-3 py-2 min-h-[3rem] text-neutral-900"
                />
              </label>
            </div>

            <div>
              <p className="-ft-3 font-semibold text-neutral-200 mb-2">Respuestas del quiz</p>
              <div className="flex flex-col gap-2 text-sm">
                {answerEntries.length === 0 && <p className="text-neutral-400">Sin respuestas adicionales.</p>}
                {answerEntries.map(([key, value]) => (
                  <div key={key} className="-ft-2 flex justify-between gap-4 border-b border-neutral-100 pb-1">
                    <span className="text-neutral-400">{key}</span>
                    <span className="text-neutral-200 text-right">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>

            <label className="flex flex-col gap-1 -ft-3 text-neutral-200">
              Notas internas
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({...f, notes: e.target.value}))}
                rows={4}
                className="border border-neutral-300 px-3 py-2 min-h-[3rem] text-neutral-900"
              />
            </label>

            {lead.createdAt && (
              <p className="-ft-4 text-neutral-400">
                Creado el {new Date(lead.createdAt).toLocaleString('es-MX')}
              </p>
            )}
            {lead.updatedAt && (
              <p className="-ft-4 text-neutral-400">
                Actualizado el {new Date(lead.updatedAt).toLocaleString('es-MX')}
              </p>
            )}

            <div className="mt-auto flex gap-4">
              <button
                onClick={handleCancelEdit}
                disabled={saving}
                className="!bg-neutral-700 !text-neutral-200 rounded-lg py-3 flex-1 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="!bg-brand-5 !text-white rounded-lg py-2 flex-1 disabled:opacity-50"
              >
                {saving ? 'Guardando…' : saved ? 'Guardado ✓' : 'Guardar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
