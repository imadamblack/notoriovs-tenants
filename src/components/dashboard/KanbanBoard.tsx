'use client'

import { useState } from 'react'
import type { Lead, PipelineStage } from '@/components/dashboard/DashboardApp'

type KanbanBoardProps = {
  leads: Lead[]
  pipeline: PipelineStage[]
  onCardClick: (lead: Lead) => void
  onStatusChange: (id: string | number, status: string) => void
}

// Kanban con drag & drop nativo (HTML5 Drag and Drop API), sin librerías:
// el proyecto no tiene ninguna instalada para esto y agregar una implicaba
// depender de acceso a red para `npm install`, que no estaba disponible al
// construir esto. Para el tamaño de tablero que maneja un dashboard de
// cliente (decenas/cientos de leads, 4-6 columnas) es más que suficiente.
export default function KanbanBoard({ leads, pipeline, onCardClick, onStatusChange }: KanbanBoardProps) {
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)

  const knownKeys = new Set(pipeline.map((s) => s.key))
  const orphanLeads = leads.filter((l) => !l.status || !knownKeys.has(l.status))

  const columns = [
    ...pipeline,
    ...(orphanLeads.length ? [{ key: '__other__', label: 'Otro' }] : []),
  ]

  const leadsFor = (key: string) =>
    key === '__other__' ? orphanLeads : leads.filter((l) => l.status === key)

  if (!pipeline.length) {
    return (
      <p className="text-neutral-500 text-sm">
        Este tenant todavía no tiene un pipeline configurado. Pídele a Notoriovs que agregue etapas en
        Payload → Tenants → Dashboard Cliente → Pipeline.
      </p>
    )
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((col) => (
        <div
          key={col.key}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOverKey(col.key)
          }}
          onDragLeave={() => setDragOverKey((k) => (k === col.key ? null : k))}
          onDrop={(e) => {
            e.preventDefault()
            setDragOverKey(null)
            if (col.key === '__other__') return
            const id = e.dataTransfer.getData('text/lead-id')
            const currentStatus = e.dataTransfer.getData('text/lead-status')
            if (id && currentStatus !== col.key) onStatusChange(id, col.key)
          }}
          className={`flex-shrink-0 w-72 rounded-xl border ${
            dragOverKey === col.key ? 'border-brand-3 bg-brand-3/5' : 'border-neutral-200 bg-white/60'
          } flex flex-col max-h-full`}
        >
          <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
            <span className="font-semibold text-brand-1 text-sm">{col.label}</span>
            <span className="text-xs bg-neutral-100 text-neutral-500 rounded-full px-2 py-0.5">
              {leadsFor(col.key).length}
            </span>
          </div>
          <div className="p-2 flex flex-col gap-2 overflow-y-auto">
            {leadsFor(col.key).map((lead) => (
              <div
                key={lead.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/lead-id', String(lead.id))
                  e.dataTransfer.setData('text/lead-status', lead.status)
                }}
                onClick={() => onCardClick(lead)}
                className="bg-white rounded-lg shadow-sm border border-neutral-100 p-3 cursor-pointer hover:shadow-md transition-shadow"
              >
                <p className="font-medium text-sm text-neutral-900 truncate">{lead.name || 'Sin nombre'}</p>
                <p className="text-xs text-neutral-500 truncate">{lead.phone || lead.whatsapp || lead.email || '—'}</p>
                {lead.createdAt && (
                  <p className="text-[11px] text-neutral-400 mt-1">
                    {new Date(lead.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                  </p>
                )}
              </div>
            ))}
            {leadsFor(col.key).length === 0 && (
              <p className="text-xs text-neutral-300 text-center py-4">Sin leads</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
