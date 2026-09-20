'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import KanbanBoard from '@/components/dashboard/KanbanBoard'
import LeadDetailPanel from '@/components/dashboard/LeadDetailPanel'
import LeadDetailHeader from '@/components/dashboard/ui/organisms/LeadDetailHeader'
import EmptyState from '@/components/dashboard/ui/atoms/EmptyState'
import KpiReport from '@/components/dashboard/KpiReport'
import DashboardNav from '@/components/dashboard/ui/organisms/DashboardNav'
import TeamPanel from '@/components/dashboard/TeamPanel'
import NotificationSettingsPanel from '@/components/dashboard/NotificationSettingsPanel'
import NewLeadPanel from '@/components/dashboard/NewLeadPanel'
import { DEFAULT_SINCE_KEY, type SinceKey } from '@/utils/dashboardPeriod'
import type { DashboardPermissions } from '@/access/tenantUserPermissions'

export type PipelineStage = { id: string; label: string; isWon?: boolean | null; isLost?: boolean | null }

/**
 * Una pregunta del quiz del tenant, recortada a lo que necesita el panel de
 * detalle para mostrar la respuesta y dejar editarla: cómo se llama el campo,
 * cómo se le preguntó al lead y qué opciones tenía.
 */
export type QuizQuestion = {
  name: string
  label: string
  type: string
  options: { label: string; value: string }[]
}



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
export type LeadUpdateEvent = { lead: Lead; previousStage: string; deleted?: boolean; created?: boolean }

/** Lo que se captura en el alta a mano (ver NewLeadPanel). */
export type CreateLeadInput = {
  name: string
  phone: string
  whatsapp: string
  email: string
  stage: string
  notes: string
}

/**
 * Tres desenlaces distintos, no un booleano: `duplicate` no es un error —es
 * un aviso con un lead adentro, para poder ofrecer abrirlo— y la interfaz
 * tiene que poder distinguirlo de "no se pudo guardar".
 */
export type CreateLeadResult =
  | { status: 'created'; lead: Lead }
  | { status: 'duplicate'; duplicate: Lead }
  | { status: 'error'; message: string }

export type DashboardTab = 'kanban' | 'kpis'

type DashboardAppProps = {
  companyName?: string | null
  /** Email del Tenant User con el que está firmada la sesión. */
  accountEmail: string
  /** Lo que el rol de esta sesión permite. Resuelto en el servidor, ver `sessionPermissions`. */
  permissions: DashboardPermissions
  pipeline: PipelineStage[]
  stuckAfterDays?: number | null
  questions: QuizQuestion[]
}

/**
 * Cómo va la carga del Lead que nombra `?lead=` en la URL (issue 35): `idle`
 * es "no hay nada que traer, o ya lo tenemos" — el caso normal de abrir una
 * tarjeta que ya está en memoria, que no espera a ningún fetch.
 */
type LeadPanelStatus = 'idle' | 'loading' | 'not-found' | 'failed'

export default function DashboardApp({
  companyName,
  accountEmail,
  permissions,
  pipeline,
  stuckAfterDays,
  questions,
}: DashboardAppProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<DashboardTab>('kanban')
  // El periodo es del dashboard entero, no de una pestaña: el listado de
  // Leads y los KPIs lo comparten para que los números de una vista se
  // puedan verificar contra la otra sin volver a elegir el rango.
  const [sinceKey, setSinceKey] = useState<SinceKey>(DEFAULT_SINCE_KEY)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  // El id de `?lead=` en la URL, que es la fuente de verdad de "hay un Lead
  // abierto": arranca leyendo la URL con la que se sirvió la página (para
  // que recargar `?lead=123` lo vuelva a abrir) y de ahí en más solo lo
  // mueve `openLead`/`closeLead` y el listener de `popstate` (el botón
  // atrás del navegador). Se actualiza con la Web History API directamente
  // y no con el router de Next.js: esta página es `force-dynamic`, así que
  // navegar con `router.push`/`replace` volvería a pedirle el árbol entero
  // al servidor por cada tarjeta que se abre o se cierra.
  const [leadIdParam, setLeadIdParam] = useState<string | null>(() => searchParams.get('lead'))
  const [leadPanelStatus, setLeadPanelStatus] = useState<LeadPanelStatus>('idle')
  // Si el Lead abierto llegó de un `history.pushState` propio (se abrió
  // clickeando una tarjeta) o no (se llegó ya con `?lead=` en la URL, por
  // recarga o por un link externo). Solo en el primer caso cerrar puede
  // usar `history.back()`; si no, no hay a dónde volver y hay que limpiar
  // la URL a mano con `replaceState`.
  const pushedLeadRef = useRef(false)
  const leadRequestRef = useRef(0)
  const [teamOpen, setTeamOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [newLeadOpen, setNewLeadOpen] = useState(false)
  const [updateEvent, setUpdateEvent] = useState<LeadUpdateEvent | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [kpis, setKpis] = useState<any>(null)
  // `refreshing` NO desmonta el reporte: al cambiar de periodo (o al
  // guardar un lead) se dejan en pantalla los números anteriores hasta que
  // llegan los nuevos, y solo cambian los valores. Antes esto era un
  // `loading` que sustituía todo el body por "Cargando…", así que cada
  // recarga repintaba la pantalla entera y se veía como un parpadeo.
  const [refreshing, setRefreshing] = useState(true)

  // Descarta respuestas que llegan fuera de orden: cambiar de periodo dos
  // veces seguidas dispara dos fetches y el primero puede contestar al
  // final, dejando en pantalla los números del rango que ya no está
  // seleccionado.
  const kpiRequestRef = useRef(0)

  const loadKpis = useCallback(async () => {
    const requestId = ++kpiRequestRef.current
    setRefreshing(true)
    try {
      const params = new URLSearchParams()
      if (sinceKey !== 'all') params.set('since', sinceKey)
      const res = await fetch(`/api/tenant-dashboard/kpis?${params.toString()}`)
      if (requestId !== kpiRequestRef.current) return
      if (res.ok) setKpis(await res.json())
    } finally {
      if (requestId === kpiRequestRef.current) setRefreshing(false)
    }
  }, [sinceKey])

  useEffect(() => {
    loadKpis()
  }, [loadKpis])

  // El botón atrás/adelante del navegador no pasa por `openLead`/`closeLead`
  // (esos usan `pushState`/`replaceState`, que no disparan `popstate`): hay
  // que escucharlo aparte para que "recargar y luego ir atrás" cierre el
  // panel igual que si se hubiera clickeado la X.
  useEffect(() => {
    const onPopState = () => {
      setLeadIdParam(new URLSearchParams(window.location.search).get('lead'))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // Trae un Lead suelto por id (issue 35): a diferencia de `onCardClick`, que
  // ya recibe el objeto completo de una tarjeta en memoria, `?lead=123` en la
  // URL puede nombrar uno que el Kanban nunca pidió (otra página, otro
  // filtro). `leadRequestRef` descarta una respuesta que llega tarde si
  // mientras tanto la URL ya apunta a otro lead (o a ninguno).
  const loadLeadById = useCallback(async (id: string) => {
    const requestId = ++leadRequestRef.current
    setLeadPanelStatus('loading')
    try {
      const res = await fetch(`/api/tenant-dashboard/leads/${encodeURIComponent(id)}`)
      if (requestId !== leadRequestRef.current) return
      if (res.status === 404) {
        setLeadPanelStatus('not-found')
        return
      }
      if (!res.ok) {
        setLeadPanelStatus('failed')
        return
      }
      const data = await res.json()
      if (requestId !== leadRequestRef.current) return
      setSelectedLead(data.lead as Lead)
      setLeadPanelStatus('idle')
    } catch {
      if (requestId === leadRequestRef.current) setLeadPanelStatus('failed')
    }
  }, [])

  // La URL manda: si no trae `lead`, no hay panel (cierre por atrás del
  // navegador incluido). Si trae uno que ya es el que está en pantalla
  // (se abrió con `openLead`, que ya tiene el objeto completo) no hace
  // falta ir por él otra vez.
  useEffect(() => {
    if (!leadIdParam) {
      setSelectedLead(null)
      setLeadPanelStatus('idle')
      return
    }
    if (selectedLead && String(selectedLead.id) === leadIdParam) return
    loadLeadById(leadIdParam)
  }, [leadIdParam, selectedLead, loadLeadById])

  // Abre un Lead ya conocido (una tarjeta del Kanban/la Lista, o el
  // duplicado que ofrece NewLeadPanel) y lo refleja en la URL con
  // `pushState`: es lo que permite pegar el link y que el atrás del
  // navegador cierre el panel en vez de salir del dashboard.
  const openLead = useCallback((lead: Lead) => {
    setSelectedLead(lead)
    setLeadPanelStatus('idle')
    const url = new URL(window.location.href)
    url.searchParams.set('lead', String(lead.id))
    window.history.pushState(null, '', url)
    pushedLeadRef.current = true
    setLeadIdParam(String(lead.id))
  }, [])

  const closeLead = useCallback(() => {
    setSelectedLead(null)
    setLeadPanelStatus('idle')
    // Síncrono con lo de arriba y no a la espera del `popstate` de
    // `history.back()` (que llega en un evento aparte, más tarde): si no,
    // en ese instante `leadIdParam` se queda apuntando al lead que se acaba
    // de cerrar con `selectedLead` ya en `null`, y el efecto de "la URL
    // manda" lee eso como "hay que ir por él" y dispara un fetch que —si el
    // cierre fue por un borrado— contesta 404 y reabre el panel como "ya no
    // existe" justo después de cerrado.
    setLeadIdParam(null)
    // Invalida cualquier `loadLeadById` que ya haya arrancado con el id
    // viejo antes de este cierre: sin esto, esa respuesta tardía igual
    // pisaría el `idle` de arriba al llegar.
    leadRequestRef.current += 1
    if (pushedLeadRef.current) {
      pushedLeadRef.current = false
      // Vuelve a lo que había antes de abrir, en vez de apilar un estado más.
      window.history.back()
    } else {
      // Se llegó con `?lead=` ya puesto en la URL (recarga, link externo):
      // no hay un "antes" en el historial de esta pestaña al que volver, así
      // que limpiar la URL es reemplazar, no navegar.
      const url = new URL(window.location.href)
      url.searchParams.delete('lead')
      window.history.replaceState(null, '', url)
    }
  }, [])

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
        body: JSON.stringify({ id: lead.id, ...patch }),
      })
      if (!res.ok) return null

      const data = await res.json()
      const updated = data.lead as Lead
      setSelectedLead((current) => (current && String(current.id) === String(updated.id) ? updated : current))
      setUpdateEvent({ lead: updated, previousStage: lead.stage })
      loadKpis()
      return updated
    },
    [loadKpis],
  )

  // Alta a mano de un lead (issue 13). Vive aquí y no en el panel por la
  // misma razón que `updateLead`: es quien conoce el `updateEvent` con el
  // que el Kanban mete la tarjeta nueva sin recargar, y los KPIs que hay
  // que volver a pedir.
  const createLead = useCallback(
    async (input: CreateLeadInput, confirmDuplicate: boolean): Promise<CreateLeadResult> => {
      let res: Response
      try {
        res = await fetch('/api/tenant-dashboard/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...input, confirmDuplicate }),
        })
      } catch {
        return { status: 'error', message: 'Error de conexión, intenta de nuevo' }
      }

      const data = await res.json().catch(() => ({}))

      if (res.status === 409 && data.duplicate) {
        return { status: 'duplicate', duplicate: data.duplicate as Lead }
      }
      if (!res.ok) {
        return { status: 'error', message: data.error || 'No se pudo guardar el lead' }
      }

      const lead = data.lead as Lead
      // `previousStage` es la misma etapa en la que nació: un lead nuevo no
      // viene de ninguna columna. `created` es lo que le dice a la vista que
      // lo agregue (y suba el contador) en vez de reubicar uno que ya tenía.
      setUpdateEvent({ lead, previousStage: lead.stage, created: true })
      loadKpis()
      return { status: 'created', lead }
    },
    [loadKpis],
  )

  // Borrar de verdad, no descalificar: el lead desaparece de la base. Solo
  // llega aquí quien tiene el permiso `leads:delete` (la ruta lo vuelve a
  // comprobar); un `member` no ve el botón.
  const deleteLead = useCallback(
    async (lead: Lead): Promise<boolean> => {
      const params = new URLSearchParams({ id: String(lead.id) })
      const res = await fetch(`/api/tenant-dashboard/leads?${params.toString()}`, { method: 'DELETE' })
      if (!res.ok) return false

      // Cierra el panel y limpia `?lead=` de la URL: el id que nombraba ya
      // no existe, dejarlo llevaría a "lead no encontrado" con solo recargar.
      closeLead()
      // El mismo evento que usa una edición: cada vista reconcilia su copia
      // local. `deleted` es lo que le dice a la columna que quite la tarjeta
      // en vez de moverla.
      setUpdateEvent({ lead, previousStage: lead.stage, deleted: true })
      loadKpis()
      return true
    },
    [loadKpis, closeLead],
  )

  const handleLogout = async () => {
    await fetch('/api/tenant-dashboard/logout', { method: 'POST' })
    router.refresh()
  }

  return (
    <div className="fixed inset-0 bg-neutral-800 flex flex-col">
      <DashboardNav
        companyName={companyName}
        accountEmail={accountEmail}
        tab={tab}
        onTabChange={setTab}
        onLogout={handleLogout}
        onManageUsers={permissions.canManageUsers ? () => setTeamOpen(true) : undefined}
        onManageNotifications={() => setNotificationsOpen(true)}
      />

      <main className="flex-1 overflow-auto min-h-0">
        {tab === 'kanban' ? (
          <KanbanBoard
            pipeline={pipeline}
            stuckAfterDays={stuckAfterDays}
            onCardClick={openLead}
            onCreateLead={() => setNewLeadOpen(true)}
            onStageChange={(lead, stage) => updateLead(lead, { stage })}
            updateEvent={updateEvent}
            sinceKey={sinceKey}
            onSinceChange={setSinceKey}
          />
        ) : (
          <KpiReport
            data={kpis}
            pipeline={pipeline}
            refreshing={refreshing}
            sinceKey={sinceKey}
            onSinceChange={setSinceKey}
          />
        )}
      </main>

      {teamOpen && (
        <TeamPanel accountEmail={accountEmail} onClose={() => setTeamOpen(false)} />
      )}

      {notificationsOpen && (
        <NotificationSettingsPanel onClose={() => setNotificationsOpen(false)} />
      )}

      {newLeadOpen && (
        <NewLeadPanel
          pipeline={pipeline}
          onClose={() => setNewLeadOpen(false)}
          onCreate={createLead}
          onOpenLead={(lead) => {
            setNewLeadOpen(false)
            openLead(lead)
          }}
        />
      )}

      {(leadPanelStatus === 'loading' || leadPanelStatus === 'not-found' || leadPanelStatus === 'failed') && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={closeLead}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[41rem] h-full bg-neutral-900 shadow-xl overflow-y-scroll overflow-x-hidden p-8 flex flex-col gap-5"
          >
            <LeadDetailHeader name="" badge={null} mode="write" onBack={closeLead} onEdit={() => {}} />
            <div className="flex-1 flex items-center justify-center">
              {leadPanelStatus === 'loading' ? (
                <EmptyState variant="loading" message="Cargando lead…" />
              ) : leadPanelStatus === 'not-found' ? (
                <EmptyState variant="empty" message="Este lead ya no existe o fue eliminado." />
              ) : (
                <EmptyState
                  variant="error"
                  message="No se pudo cargar el lead. Reintentar"
                  onRetry={() => leadIdParam && loadLeadById(leadIdParam)}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {selectedLead && leadPanelStatus === 'idle' && (
        <LeadDetailPanel
          lead={selectedLead}
          pipeline={pipeline}
          stuckAfterDays={stuckAfterDays}
          onClose={closeLead}
          questions={questions}
          onSave={async (patch) => Boolean(await updateLead(selectedLead, patch))}
          onDelete={permissions.canDeleteLeads ? () => deleteLead(selectedLead) : undefined}
        />
      )}
    </div>
  )
}
