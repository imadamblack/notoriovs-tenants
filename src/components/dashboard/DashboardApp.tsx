'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import KanbanBoard from '@/components/dashboard/KanbanBoard'
import LeadDetailPanel from '@/components/dashboard/LeadDetailPanel'
import KpiReport from '@/components/dashboard/KpiReport'

export type PipelineStage = { key: string; label: string; isWon?: boolean | null; isLost?: boolean | null }

export type Lead = {
  id: string | number
  tenant: string | number
  name?: string | null
  phone?: string | null
  whatsapp?: string | null
  email?: string | null
  status: string
  source?: string | null
  notes?: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  answers?: Record<string, any> | null
  createdAt?: string
  updatedAt?: string
}

type DashboardAppProps = {
  subdomain: string
  companyName?: string | null
  pipeline: PipelineStage[]
}

type Tab = 'kanban' | 'kpis'

export default function DashboardApp({ subdomain, companyName, pipeline }: DashboardAppProps) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('kanban')
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [kpis, setKpis] = useState<any>(null)

  const loadLeads = useCallback(async () => {
    const res = await fetch(`/api/tenant-dashboard/leads?subdomain=${encodeURIComponent(subdomain)}`)
    if (res.ok) {
      const data = await res.json()
      setLeads(data.leads || [])
    }
  }, [subdomain])

  const loadKpis = useCallback(async () => {
    const res = await fetch(`/api/tenant-dashboard/kpis?subdomain=${encodeURIComponent(subdomain)}`)
    if (res.ok) setKpis(await res.json())
  }, [subdomain])

  useEffect(() => {
    setLoading(true)
    Promise.all([loadLeads(), loadKpis()]).finally(() => setLoading(false))
  }, [loadLeads, loadKpis])

  const updateLead = useCallback(
    async (id: string | number, patch: Partial<Lead>) => {
      // Optimista: refleja el cambio de inmediato en la UI (clave para que
      // el drag&drop del Kanban se sienta instantáneo) y revierte si falla.
      const previous = leads
      // Comparación por String(): dataTransfer del Kanban solo puede llevar
      // texto, así que `id` llega como string aunque `lead.id` sea numérico
      // (Postgres). Sin este cast, el `===` nunca hace match y la tarjeta se
      // queda "pegada" en la columna vieja aunque el guardado sí funcione.
      setLeads((current) => current.map((l) => (String(l.id) === String(id) ? { ...l, ...patch } : l)))

      const res = await fetch('/api/tenant-dashboard/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain, id, ...patch }),
      })

      if (!res.ok) {
        setLeads(previous)
        return false
      }

      const data = await res.json()
      setLeads((current) => current.map((l) => (String(l.id) === String(id) ? data.lead : l)))
      setSelectedLead((current) => (current && String(current.id) === String(id) ? data.lead : current))
      loadKpis()
      return true
    },
    [leads, subdomain, loadKpis],
  )

  const handleLogout = async () => {
    await fetch('/api/tenant-dashboard/logout', { method: 'POST' })
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-brand-4 flex flex-col">
      <header className="bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-400">Dashboard de leads</p>
          <h1 className="ft-2 font-bold text-brand-1">{companyName}</h1>
        </div>
        <nav className="flex items-center gap-2">
          <button
            onClick={() => setTab('kanban')}
            className={`!border-none px-4 py-2 rounded-full text-sm font-medium ${
              tab === 'kanban' ? '!bg-brand-1 !text-white' : '!bg-transparent !text-neutral-500'
            }`}
          >
            Kanban
          </button>
          <button
            onClick={() => setTab('kpis')}
            className={`!border-none px-4 py-2 rounded-full text-sm font-medium ${
              tab === 'kpis' ? '!bg-brand-1 !text-white' : '!bg-transparent !text-neutral-500'
            }`}
          >
            KPIs
          </button>
          <button onClick={handleLogout} className="!bg-transparent !text-neutral-400 text-sm ml-2 hover:!text-brand-2">
            Salir
          </button>
        </nav>
      </header>

      <main className="flex-1 p-6 overflow-auto">
        {loading ? (
          <p className="text-neutral-400 text-sm">Cargando…</p>
        ) : tab === 'kanban' ? (
          <KanbanBoard
            leads={leads}
            pipeline={pipeline}
            onCardClick={setSelectedLead}
            onStatusChange={(id, status) => updateLead(id, { status })}
          />
        ) : (
          <KpiReport data={kpis} pipeline={pipeline} />
        )}
      </main>

      {selectedLead && (
        <LeadDetailPanel
          lead={selectedLead}
          pipeline={pipeline}
          onClose={() => setSelectedLead(null)}
          onSave={(patch) => updateLead(selectedLead.id, patch)}
        />
      )}
    </div>
  )
}
