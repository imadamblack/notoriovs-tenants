'use client'

import {useRef, useState} from 'react'
import type {Lead, PipelineStage, QuizQuestion} from '@/components/dashboard/DashboardApp'
import {leadBadge} from '@/components/dashboard/leadPresentation'
import Button from '@/components/dashboard/ui/atoms/Button'
import KeyValueRow from '@/components/dashboard/ui/molecules/KeyValueRow'
import ContactLink from '@/components/dashboard/ui/molecules/ContactLink'
import SectionTabs from '@/components/dashboard/ui/molecules/SectionTabs'
import LeadDetailHeader from '@/components/dashboard/ui/organisms/LeadDetailHeader'
import LeadQuickEditRow from '@/components/dashboard/ui/organisms/LeadQuickEditRow'
import LeadNotesEditor from '@/components/dashboard/ui/organisms/LeadNotesEditor'
import LeadAnswersList from '@/components/dashboard/ui/organisms/LeadAnswersList'
import LeadAnswersFields from '@/components/dashboard/ui/organisms/LeadAnswersFields'
import {editableAnswers} from '@/components/dashboard/leadAnswersView'
import LeadEditForm from '@/components/dashboard/ui/organisms/LeadEditForm'

type LeadDetailPanelProps = {
  lead: Lead
  pipeline: PipelineStage[]
  /** Las preguntas del quiz del tenant, para mostrar y editar sus respuestas. */
  questions: QuizQuestion[]
  stuckAfterDays?: number | null
  onClose: () => void
  onSave: (patch: Partial<Lead>) => Promise<boolean>
  /**
   * Borra el lead, o `undefined` si esta sesión no tiene el permiso
   * `leads:delete` (un `member`). Sin la función no se pinta la acción: un
   * botón que siempre responde "no puedes" es peor que no tenerlo.
   */
  onDelete?: () => Promise<boolean>
}

type LeadForm = {
  name: string
  phone: string
  whatsapp: string
  email: string
  stage: string
  status: Lead['status']
  notes: string
  // Las respuestas del quiz son campos del lead como los de arriba: se editan
  // en esta misma forma y se guardan con el mismo botón. Solo las editables
  // (sin los datos de contacto, que ya viven en `name`, `phone`…), porque son
  // tal cual lo que se manda en el PATCH.
  answers: Record<string, unknown>
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
    answers: editableAnswers(lead.answers),
  }
}

export default function LeadDetailPanel({lead, pipeline, questions, stuckAfterDays, onClose, onSave, onDelete}: LeadDetailPanelProps) {
  const [mode, setMode] = useState<'read' | 'write'>('read')
  const [form, setForm] = useState<LeadForm>(() => buildFormFromLead(lead))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const lastSavedNotesRef = useRef(form.notes)

  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [readTab, setReadTab] = useState<'notas' | 'detalles'>('notas')
  const [quickSaving, setQuickSaving] = useState(false)
  const [quickSaved, setQuickSaved] = useState(false)

  // Mismo criterio que el auto-sync del backend: cambiar la etapa sugiere
  // de inmediato el resultado correspondiente, pero es solo una
  // previsualización hasta dar "Guardar".
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

  const handleDelete = async () => {
    if (!onDelete) return
    setDeleting(true)
    setDeleteError(null)
    const ok = await onDelete()
    // Si salió bien, el panel se cierra solo (el lead ya no existe) y no hay
    // nada que devolver a su estado.
    if (!ok) {
      setDeleting(false)
      setConfirmingDelete(false)
      setDeleteError('No se pudo eliminar el lead. Vuelve a intentarlo.')
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

  // Selectores rápidos del read view: a diferencia del modo edición, aquí
  // se guarda de inmediato al elegir una opción.
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

  const whatsappNumber = (form.whatsapp || form.phone || '').replace(/\D/g, '')

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[41rem] h-full bg-neutral-900 shadow-xl overflow-y-scroll overflow-x-hidden p-8 flex flex-col gap-5"
      >
        <LeadDetailHeader
          name={form.name}
          badge={mode === 'read' ? leadBadge(lead, stuckAfterDays) : null}
          mode={mode}
          onBack={mode === 'read' ? onClose : handleCancelEdit}
          onEdit={() => setMode('write')}
        />

        {mode === 'read' ? (
          <>
            <LeadQuickEditRow
              pipeline={pipeline}
              stage={form.stage}
              status={form.status}
              onStageChange={handleQuickStageChange}
              onStatusChange={handleQuickStatusChange}
            />

            <SectionTabs
              value={readTab}
              onChange={setReadTab}
              className="mt-8"
              options={[
                {value: 'notas', label: 'Notas'},
                {value: 'detalles', label: 'Detalles'},
              ]}
            />

            <div className="flex flex-col flex-grow gap-3">
              {readTab === 'detalles' ? (
                <>
                  <KeyValueRow label="WhatsApp" value={<ContactLink type="whatsapp" value={form.whatsapp} />} />
                  <KeyValueRow label="Email" value={<ContactLink type="email" value={form.email} />} />

                  <div className="mt-8">
                    <LeadAnswersList answers={lead.answers} questions={questions} />
                  </div>
                </>
              ) : (
                <LeadNotesEditor
                  value={form.notes}
                  onChange={(value) => setForm((f) => ({...f, notes: value}))}
                  onBlur={handleNotesBlur}
                  saving={notesSaving}
                  saved={notesSaved}
                  showStatus
                />
              )}
            </div>

            <div className="flex">
              {whatsappNumber && <ContactLink type="whatsapp" value={whatsappNumber} variant="button" />}
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
            <LeadEditForm
              values={form}
              pipeline={pipeline}
              onChange={(patch) => setForm((f) => ({...f, ...patch}))}
              onStageChange={handleStageChange}
            />

            <LeadAnswersFields
              answers={form.answers}
              questions={questions}
              onChange={(field, value) =>
                setForm((f) => ({...f, answers: {...f.answers, [field]: value}}))
              }
            />

            <LeadNotesEditor
              label="Notas internas"
              value={form.notes}
              onChange={(value) => setForm((f) => ({...f, notes: value}))}
              rows={4}
            />

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

            <div className="mt-auto flex flex-col gap-4">
              <div className="flex gap-4">
                <Button variant="secondary" onClick={handleCancelEdit} disabled={saving} className="flex-1 py-3">
                  Cancelar
                </Button>
                <Button variant="primary" onClick={handleSave} disabled={saving} className="flex-1">
                  {saving ? 'Guardando…' : saved ? 'Guardado ✓' : 'Guardar'}
                </Button>
              </div>

              {/* Borrar vive aquí abajo, separado y en dos pasos: es lo único
                  de este panel que no se puede deshacer. Para sacar un lead de
                  los números sin perderlo está "Descalificado" en Resultado. */}
              {onDelete && (
                <div className="border-t border-neutral-700 pt-4">
                  {confirmingDelete ? (
                    <div className="flex flex-col gap-3">
                      <p className="-ft-4 text-neutral-300">
                        Se eliminará este lead y sus respuestas para siempre. Esto no se puede deshacer.
                      </p>
                      <div className="flex gap-4">
                        <Button
                          variant="secondary"
                          onClick={() => setConfirmingDelete(false)}
                          disabled={deleting}
                          className="flex-1 py-3"
                        >
                          Cancelar
                        </Button>
                        <Button variant="danger" onClick={handleDelete} disabled={deleting} className="flex-1">
                          {deleting ? 'Eliminando…' : 'Sí, eliminar'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" className="!text-red-400" onClick={() => setConfirmingDelete(true)}>
                      Eliminar lead
                    </Button>
                  )}
                  {deleteError && <p className="-ft-4 text-red-400 mt-3">{deleteError}</p>}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
