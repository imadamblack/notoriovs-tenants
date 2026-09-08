'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import KanbanBoard from '@/components/dashboard/KanbanBoard'
import LeadDetailPanel from '@/components/dashboard/LeadDetailPanel'
import KpiReport from '@/components/dashboard/KpiReport'
import DashboardNav from '@/components/dashboard/ui/organisms/DashboardNav'
import { DEFAULT_SINCE_KEY, type SinceKey } from '@/utils/dashboardPeriod'

export type PipelineStage = { id: string; label: string; isWon?: boolean | null; isLost?: boolean | null }

export type Lead = {
  id: string | number
  tenant: string | number
  name?: string | null
  phone?: string | null
  whatsapp?: string | null
  email?: string | null
  stage: string
  status: 'open' | 'won' | 'lost' | 'disqualified'
  source?: string | null
  notes?: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  answers?: Record<string, any> | null
  createdAt?: string
  updatedAt?: string
}

// Se emite cada vez que un lead cambia (drag&drop en el Kanban o guardado
// desde el panel de detalle), para que la vista que lo esté mostrando (una
// columna del Kanban, la Lista) reconcilie su copia local sin tener que
// re-pedirle todo al servidor. `previousStage` es la etapa ANTES del
// cambio: sin ella, una columna no sabría de dónde quitar la tarjeta cuando
// el lead se movió de etapa desde el panel de detalle (en vez de
// arrastrado, donde el propio drag ya conoce su origen).
export type LeadUpdateEvent = { lead: Lead; previousStage: string }

export type DashboardTab = 'kanban' | 'kpis'

type DashboardAppProps = {
  subdomain: string
  companyName?: string | null
  pipeline: PipelineStage[]
  stuckAfterDays?: number | null
}

export default function DashboardApp({ subdomain, companyName, pipeline, stuckAfterDays }: DashboardAppProps) {
  const router = useRouter()
  const [tab, setTab] = useState<DashboardTab>('kanban')
  // El periodo es del dashboard entero, no de una pestaña: el listado de
  // Leads y los KPIs lo comparten para que los números de una vista se
  // puedan verificar contra la otra sin volver a elegir el rango.
  const [sinceKey, setSinceKey] = useState<SinceKey>(DEFAULT_SINCE_KEY)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [updateEvent, setUpdateEvent] = useState<LeadUpdateEvent | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [kpis, setKpis] = useState<any>(null)
  const [loadingKpis, setLoadingKpis] = useState(true)

  const loadKpis = useCallback(async () => {
    const params = new URLSearchParams({ subdomain })
    if (sinceKey !== 'all') params.set('since', sinceKey)
    const res = await fetch(`/api/tenant-dashboard/kpis?${params.toString()}`)
    if (res.ok) setKpis(await res.json())
  }, [subdomain, sinceKey])

  useEffect(() => {
    setLoadingKpis(true)
    loadKpis().finally(() => setLoadingKpis(false))
  }, [loadKpis])

  // Único punto que hace el PATCH real contra la API. El Kanban (drag&drop)
  // y el panel de detalle lo llaman por igual; cada uno reconcilia después
  // su propia copia local vía `updateEvent` (ya no hay un arreglo central
  // de "todos los leads" en memoria: ver KanbanBoard, que ahora carga cada
  // columna/página por su cuenta).
  const updateLead = useCallback(
    async (lead: Lead, patch: Partial<Lead>): Promise<Lead | null> => {
      const res = await fetch('/api/tenant-dashboard/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain, id: lead.id, ...patch }),
      })
      if (!res.ok) return null

      const data = await res.json()
      const updated = data.lead as Lead
      setSelectedLead((current) => (current && String(current.id) === String(updated.id) ? updated : current))
      setUpdateEvent({ lead: updated, previousStage: lead.stage })
      loadKpis()
      return updated
    },
    [subdomain, loadKpis],
  )

  const handleLogout = async () => {
    await fetch('/api/tenant-dashboard/logout', { method: 'POST' })
    router.refresh()
  }

  return (
    <div className="fixed inset-0 bg-neutral-800 flex flex-col">
      <DashboardNav companyName={companyName} tab={tab} onTabChange={setTab} onLogout={handleLogout} />

      <main className="flex-1 overflow-auto min-h-0">
        {tab === 'kanban' ? (
          <KanbanBoard
            subdomain={subdomain}
            pipeline={pipeline}
            stuckAfterDays={stuckAfterDays}
            onCardClick={setSelectedLead}
            onStageChange={(lead, stage) => updateLead(lead, { stage })}
            updateEvent={updateEvent}
            sinceKey={sinceKey}
            onSinceChange={setSinceKey}
          />
        ) : (
          <KpiReport
            data={kpis}
            pipeline={pipeline}
            loading={loadingKpis}
            sinceKey={sinceKey}
            onSinceChange={setSinceKey}
          />
        )}
      </main>

      {selectedLead && (
        <LeadDetailPanel
          lead={selectedLead}
          pipeline={pipeline}
          stuckAfterDays={stuckAfterDays}
          onClose={() => setSelectedLead(null)}
          onSave={async (patch) => Boolean(await updateLead(selectedLead, patch))}
        />
      )}
    </div>
  )
}
