'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Lead, LeadUpdateEvent, PipelineStage } from '@/components/dashboard/DashboardApp'

type KanbanBoardProps = {
  subdomain: string
  pipeline: PipelineStage[]
  onCardClick: (lead: Lead) => void
  onStageChange: (lead: Lead, stage: string) => Promise<Lead | null>
  updateEvent: LeadUpdateEvent | null
}

type SortKey = 'created_desc' | 'created_asc' | 'name_asc'

const SORT_LABELS: Record<SortKey, string> = {
  created_desc: 'Más recientes',
  created_asc: 'Más antiguos',
  name_asc: 'Nombre A-Z',
}

const STATUS_BADGE: Record<string, { label: string; className: string } | undefined> = {
  won: {label: 'Ganado', className: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30'},
  lost: {label: 'Perdido', className: 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30'},
  disqualified: {label: 'Descalificado', className: 'bg-neutral-600/20 text-neutral-400 ring-1 ring-neutral-600/30'},
}

const AVATAR_COLORS = [
  'bg-brand-3/20 text-brand-3',
  'bg-amber-500/20 text-amber-400',
  'bg-sky-500/20 text-sky-400',
  'bg-fuchsia-500/20 text-fuchsia-400',
  'bg-orange-500/20 text-orange-400',
]

// Cuántas tarjetas/filas trae cada página. El Kanban pide de a poco por
// columna (nunca necesita mostrar miles de tarjetas a la vez); la Lista
// pide un poco más porque es una tabla de "cargar más", no columnas.
const PAGE_SIZE_BOARD = 30
const PAGE_SIZE_LIST = 50
const SEARCH_DEBOUNCE_MS = 350

type ColumnState = {
  leads: Lead[]
  page: number
  totalDocs: number
  hasNextPage: boolean
  loading: boolean
  loadingMore: boolean
  error: boolean
}

const emptyColumn: ColumnState = {
  leads: [],
  page: 0,
  totalDocs: 0,
  hasNextPage: false,
  loading: false,
  loadingMore: false,
  error: false,
}

function initials(name?: string | null) {
  const clean = (name || '').trim()
  if (!clean) return '?'
  const parts = clean.split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || clean[0].toUpperCase()
}

function avatarColor(name?: string | null) {
  const key = (name || '').trim()
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) % AVATAR_COLORS.length
  return AVATAR_COLORS[hash] || AVATAR_COLORS[0]
}

// "Días sin movimiento": lo único parecido a una señal de urgencia que
// tenemos disponible con los datos reales del lead (no hay campo de
// "última actividad" ni de valor monetario en la colección `leads`), así
// que se calcula contra `updatedAt` (o `createdAt` si nunca se ha tocado).
// Entre más días sin cambios, más "caliente" se pinta la tarjeta: es una
// señal visual de "este lead se está enfriando", no un dato exacto de CRM.
function daysIdle(lead: Lead): number | null {
  const raw = lead.updatedAt || lead.createdAt
  if (!raw) return null
  const ms = Date.now() - new Date(raw).getTime()
  if (Number.isNaN(ms)) return null
  return Math.max(0, Math.floor(ms / 86400000))
}

function idleBadge(days: number | null) {
  if (days === null) return null
  if (days < 1) return {label: '<1d', className: 'bg-neutral-700 text-neutral-200'}
  if (days < 15) return {label: `${days}d`, className: 'bg-red-600/90 text-white'}
  if (days < 45) return {label: `${days}d`, className: 'bg-red-700 text-white'}
  return {label: `${days}d`, className: 'bg-red-900 text-red-100'}
}

function cardTone(lead: Lead, days: number | null) {
  if (lead.status === 'won') {
    return 'bg-gradient-to-br from-emerald-900/70 via-emerald-950/60 to-neutral-900 border-emerald-700/40'
  }
  if (lead.status === 'lost') {
    return 'bg-neutral-900/80 border-red-900/30'
  }
  if (lead.status === 'disqualified') {
    return 'bg-neutral-900/50 border-neutral-800 opacity-60'
  }
  if (days === null || days < 2) return 'bg-neutral-800 border-neutral-800'
  if (days < 15) return 'bg-gradient-to-br from-red-950/50 via-neutral-900 to-neutral-900 border-red-900/30'
  if (days < 45) return 'bg-gradient-to-br from-red-950/80 via-red-950/40 to-neutral-900 border-red-900/40'
  return 'bg-gradient-to-br from-red-950 via-[#3a0a0a] to-black border-red-800/50'
}

function formatDate(raw?: string) {
  if (!raw) return null
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('es-MX', {day: '2-digit', month: 'short', year: 'numeric'})
}

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
      <circle cx="11" cy="11" r="7"/>
      <path d="m21 21-4.3-4.3" strokeLinecap="round"/>
    </svg>
  )
}

function IconGrid() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[1.6rem] h-[1.6rem]">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  )
}

function IconList() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[1.6rem] h-[1.6rem]">
      <path d="M8 6h13M8 12h13M8 18h13" strokeLinecap="round"/>
      <path d="M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round"/>
    </svg>
  )
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
      <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
    </svg>
  )
}

// Kanban con drag & drop nativo (HTML5 Drag and Drop API), sin librerías:
// el proyecto no tiene ninguna instalada para esto y agregar una implicaba
// depender de acceso a red para `npm install`, que no estaba disponible al
// construir esto.
//
// Las columnas agrupan por `stage` (la etapa del pipeline), no por
// `status`: son dos cosas independientes desde que se separaron (ver
// comentario en Leads.ts). El `status` (abierto/ganado/perdido/
// descalificado) se muestra como una etiqueta chiquita en la tarjeta, y
// también tiñe la tarjeta completa (verde = ganado).
//
// A diferencia de la versión anterior (que traía TODOS los leads del
// tenant de una sola vez y filtraba/agrupaba en memoria), cada columna
// pide sus propios leads paginados a GET /api/tenant-dashboard/leads
// (?stage=...&page=...), y los conteos de cada columna vienen de
// GET .../leads/counts (un COUNT(*) por etapa, no un fetch completo). Esto
// es lo que hace viable un tenant con miles de leads: el Kanban nunca
// necesita traer más que lo que cabe a la vista + lo que el scroll
// infinito vaya pidiendo (ver `handleColumnScroll`/`handleListScroll` más
// abajo: cargan la siguiente página al acercarse al fondo del contenedor,
// sin botón).
export default function KanbanBoard({subdomain, pipeline, onCardClick, onStageChange, updateEvent}: KanbanBoardProps) {
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('created_desc')

  const [columnData, setColumnData] = useState<Record<string, ColumnState>>({})
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({})
  const [otherCount, setOtherCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)

  const [listLeads, setListLeads] = useState<Lead[]>([])
  const [listPage, setListPage] = useState(0)
  const [listTotalDocs, setListTotalDocs] = useState(0)
  const [listHasNextPage, setListHasNextPage] = useState(false)
  const [listLoading, setListLoading] = useState(false)
  const [listLoadingMore, setListLoadingMore] = useState(false)

  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const [draggingLead, setDraggingLead] = useState<Lead | null>(null)
  const [pendingLeadId, setPendingLeadId] = useState<string | null>(null)

  // Refs a los contenedores con scroll de cada columna y de la Lista, para
  // el scroll infinito: se leen en el handler de `onScroll` y también para
  // detectar el caso "la página cargó pero no llenó el contenedor" (pocas
  // tarjetas, pantalla alta), donde nunca habría scroll que disparar la
  // siguiente página si no se revisa aparte.
  const columnScrollRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const listScrollRef = useRef<HTMLDivElement | null>(null)

  const pipelineIds = useMemo(() => new Set(pipeline.map((s) => s.id)), [pipeline])
  const showOtherColumn = otherCount > 0
  // Se calcula aquí (antes de cualquier `return` temprano y antes de los
  // efectos de scroll infinito que lo usan) para que ya exista sin importar
  // si el tenant tiene pipeline configurado o no.
  const boardColumns = useMemo(
    () => [...pipeline, ...(showOtherColumn ? [{id: '__other__', label: 'Otro'}] : [])],
    [pipeline, showOtherColumn],
  )

  // Espera a que el usuario deje de teclear antes de pegarle al servidor.
  // Antes esto era gratis (el filtro corría en memoria sobre lo que ya
  // estaba cargado); ahora cada búsqueda dispara una llamada de red por
  // columna, así que sí importa no hacerlo en cada tecla.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [search])

  const buildParams = useCallback(
    (extra: Record<string, string>) => {
      const params = new URLSearchParams({subdomain, sort: sortKey, ...extra})
      if (debouncedSearch) params.set('search', debouncedSearch)
      return params
    },
    [subdomain, sortKey, debouncedSearch],
  )

  const loadColumn = useCallback(
    async (stageKey: string, page: number) => {
      setColumnData((cols) => ({
        ...cols,
        [stageKey]: {...(cols[stageKey] ?? emptyColumn), loading: page === 1, loadingMore: page > 1, error: false},
      }))

      const params = buildParams({stage: stageKey, page: String(page), limit: String(PAGE_SIZE_BOARD)})
      try {
        const res = await fetch(`/api/tenant-dashboard/leads?${params}`)
        if (!res.ok) throw new Error('request failed')
        const data = await res.json()
        setColumnData((cols) => {
          const prev = cols[stageKey] ?? emptyColumn
          return {
            ...cols,
            [stageKey]: {
              leads: page === 1 ? data.leads : [...prev.leads, ...data.leads],
              page: data.page,
              totalDocs: data.totalDocs,
              hasNextPage: data.hasNextPage,
              loading: false,
              loadingMore: false,
              error: false,
            },
          }
        })
      } catch {
        setColumnData((cols) => ({
          ...cols,
          [stageKey]: {...(cols[stageKey] ?? emptyColumn), loading: false, loadingMore: false, error: true},
        }))
      }
    },
    [buildParams],
  )

  const loadCounts = useCallback(async () => {
    const params = new URLSearchParams({subdomain})
    if (debouncedSearch) params.set('search', debouncedSearch)
    const res = await fetch(`/api/tenant-dashboard/leads/counts?${params}`)
    if (!res.ok) return
    const data = await res.json()
    setStageCounts(data.counts || {})
    setOtherCount(data.other || 0)
    setTotalCount(data.total || 0)
  }, [subdomain, debouncedSearch])

  const loadList = useCallback(
    async (page: number) => {
      setListLoading(page === 1)
      setListLoadingMore(page > 1)
      const params = buildParams({page: String(page), limit: String(PAGE_SIZE_LIST)})
      try {
        const res = await fetch(`/api/tenant-dashboard/leads?${params}`)
        if (!res.ok) throw new Error('request failed')
        const data = await res.json()
        setListLeads((prev) => (page === 1 ? data.leads : [...prev, ...data.leads]))
        setListPage(data.page)
        setListTotalDocs(data.totalDocs)
        setListHasNextPage(data.hasNextPage)
      } finally {
        setListLoading(false)
        setListLoadingMore(false)
      }
    },
    [buildParams],
  )

  useEffect(() => {
    if (view !== 'kanban') return
    loadCounts()
    for (const stage of pipeline) loadColumn(stage.id, 1)
  }, [view, pipeline, loadCounts, loadColumn])

  // La columna "Otro" solo existe si hay leads huérfanos; se dispara aparte
  // porque depende del conteo (async) para saber si debe existir. Solo se
  // recarga cuando aparece/desaparece o cuando cambian orden/búsqueda, no
  // en cada pequeño ajuste optimista de `otherCount`.
  useEffect(() => {
    if (view !== 'kanban' || !showOtherColumn) return
    loadColumn('__other__', 1)
  }, [view, showOtherColumn, loadColumn])

  useEffect(() => {
    if (view !== 'list') return
    loadList(1)
  }, [view, loadList])

  // Reconcilia un cambio de lead (drag&drop o guardado desde el panel de
  // detalle) contra el estado local, sin volver a pedirle nada al
  // servidor: quita la tarjeta de su columna anterior, la agrega/actualiza
  // en la columna correspondiente a su nueva etapa, ajusta los badges de
  // conteo, y refleja el cambio en la Lista si el lead está ahí. Es la
  // única fuente de verdad para mover tarjetas (ver `handleDrop`, que solo
  // dispara el PATCH y deja que este efecto haga el resto).
  useEffect(() => {
    if (!updateEvent) return
    const {lead, previousStage} = updateEvent
    const targetKey = pipelineIds.has(lead.stage) ? lead.stage : '__other__'

    setColumnData((cols) => {
      const next = {...cols}
      const fromKey = pipelineIds.has(previousStage) ? previousStage : '__other__'
      if (fromKey !== targetKey && next[fromKey]) {
        next[fromKey] = {
          ...next[fromKey],
          leads: next[fromKey].leads.filter((l) => String(l.id) !== String(lead.id)),
          totalDocs: Math.max(0, next[fromKey].totalDocs - 1),
        }
      }
      if (next[targetKey]) {
        const exists = next[targetKey].leads.some((l) => String(l.id) === String(lead.id))
        next[targetKey] = {
          ...next[targetKey],
          leads: exists
            ? next[targetKey].leads.map((l) => (String(l.id) === String(lead.id) ? lead : l))
            : [lead, ...next[targetKey].leads],
          totalDocs: exists ? next[targetKey].totalDocs : next[targetKey].totalDocs + 1,
        }
      }
      return next
    })

    if (previousStage !== lead.stage) {
      setStageCounts((counts) => {
        const next = {...counts}
        if (previousStage in next) next[previousStage] = Math.max(0, next[previousStage] - 1)
        if (lead.stage in next) next[lead.stage] = (next[lead.stage] ?? 0) + 1
        return next
      })
      const fromWasOther = !pipelineIds.has(previousStage)
      const toIsOther = targetKey === '__other__'
      if (fromWasOther && !toIsOther) setOtherCount((c) => Math.max(0, c - 1))
      if (!fromWasOther && toIsOther) setOtherCount((c) => c + 1)
    }

    setListLeads((leads) => leads.map((l) => (String(l.id) === String(lead.id) ? lead : l)))
  }, [updateEvent, pipelineIds])

  // Scroll infinito, parte 1: dispara la siguiente página cuando el
  // usuario se acerca al fondo del contenedor con scroll de la columna.
  const handleColumnScroll = useCallback(
    (stageKey: string) => (e: React.UIEvent<HTMLDivElement>) => {
      const state = columnData[stageKey]
      if (!state || state.loading || state.loadingMore || !state.hasNextPage) return
      const el = e.currentTarget
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 150) {
        loadColumn(stageKey, state.page + 1)
      }
    },
    [columnData, loadColumn],
  )

  // Scroll infinito, parte 2: cubre el caso en el que la página que acaba
  // de cargar no alcanza a llenar el contenedor (pantalla alta, pocas
  // tarjetas en esa etapa): ahí nunca aparecería una barra de scroll que
  // el usuario pudiera mover, así que sin esto se quedaría "atorado" sin
  // poder ver el resto aunque sí haya más páginas.
  useEffect(() => {
    if (view !== 'kanban') return
    for (const col of boardColumns) {
      const state = columnData[col.id]
      if (!state || state.loading || state.loadingMore || !state.hasNextPage) continue
      const el = columnScrollRefs.current[col.id]
      if (el && el.scrollHeight <= el.clientHeight + 4) {
        loadColumn(col.id, state.page + 1)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnData, view, loadColumn])

  const handleListScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (listLoading || listLoadingMore || !listHasNextPage) return
      const el = e.currentTarget
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 150) {
        loadList(listPage + 1)
      }
    },
    [listLoading, listLoadingMore, listHasNextPage, listPage, loadList],
  )

  useEffect(() => {
    if (view !== 'list' || listLoading || listLoadingMore || !listHasNextPage) return
    const el = listScrollRef.current
    if (el && el.scrollHeight <= el.clientHeight + 4) {
      loadList(listPage + 1)
    }
  }, [listLeads, view, listLoading, listLoadingMore, listHasNextPage, listPage, loadList])

  const handleDrop = async (stageKey: string) => {
    setDragOverKey(null)
    const lead = draggingLead
    setDraggingLead(null)
    if (!lead || stageKey === '__other__' || lead.stage === stageKey) return

    // La reconciliación real (mover la tarjeta entre columnas) ocurre en el
    // efecto que escucha `updateEvent` arriba, una sola fuente de verdad
    // compartida con el panel de detalle. Aquí solo se dispara el PATCH y
    // se muestra la tarjeta "atenuada" mientras está en vuelo.
    setPendingLeadId(String(lead.id))
    await onStageChange(lead, stageKey)
    setPendingLeadId(null)
  }

  const stageLabel = (id: string) => pipeline.find((s) => s.id === id)?.label || id || 'Sin etapa'

  if (!pipeline.length) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
        <p className="text-neutral-400 -ft-2">
          Este tenant todavía no tiene un pipeline configurado. Pídele a Notoriovs que agregue etapas en
          Payload → Tenants → Dashboard Cliente → Pipeline.
        </p>
      </div>
    )
  }

  const visibleTotal = view === 'list' ? listTotalDocs : totalCount

  return (
    <div className="flex flex-col flex-grow bg-neutral-800 shadow-2xl overflow-hidden min-h-0">

      <div className="px-5 py-3 border-b border-neutral-600 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="flex items-center rounded-lg border border-neutral-600 overflow-hidden">
            <div
              onClick={() => setView('kanban')}
              className={`!border-none !rounded-none px-4 py-3 flex items-center ${
                view === 'kanban' ? '!bg-brand-3/60 !text-white' : '!bg-neutral-900 !text-neutral-400'
              }`}
              title="Vista de tablero"
            >
              <IconGrid/>
            </div>
            <div
              onClick={() => setView('list')}
              className={`!border-none !rounded-none px-4 py-3 flex items-center ${
                view === 'list' ? '!bg-brand-3/60 !text-white' : '!bg-neutral-900 !text-neutral-400'
              }`}
              title="Vista de lista"
            >
              <IconList/>
            </div>
          </div>
          {/*<button*/}
          {/*  disabled*/}
          {/*  title="Alta manual de leads: próximamente"*/}
          {/*  className="!bg-brand-5 !text-white opacity-50 cursor-not-allowed px-4 py-[.6rem] -ft-3 font-medium rounded-lg flex items-center gap-2"*/}
          {/*>*/}
          {/*  <IconPlus/>*/}
          {/*  Lead*/}
          {/*</button>*/}
        </div>

        <div className="flex items-center gap-2 text-neutral-400 -ft-3">
          {visibleTotal} leads
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 -ft-3 text-neutral-400">
            <span>↓</span>
            <select
              id="filter"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="!bg-neutral-900 w-[8rem] !border !border-neutral-800 !text-neutral-200 rounded-lg px-4 py-1.5 -ft-4"
            >
              {Object.entries(SORT_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="relative w-full max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
            <IconSearch/>
          </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar leads"
              className="w-[20rem] !bg-neutral-900 !border !border-neutral-600 !text-neutral-100 placeholder:text-neutral-500 rounded-lg pl-9 pr-3 py-2 -ft-3 focus:!border-brand-3 focus:!outline-none"
            />
          </div>
        </div>
      </div>

      {/* Board */}
      {view === 'kanban' ? (
        <div className="flex flex-grow gap-3 overflow-x-auto p-4 min-h-0">
          {boardColumns.map((col) => {
            const state = columnData[col.id] ?? emptyColumn
            const count = stageCounts[col.id] ?? (col.id === '__other__' ? otherCount : state.totalDocs)
            return (
              <div
                key={col.id}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOverKey(col.id)
                }}
                onDragLeave={() => setDragOverKey((k) => (k === col.id ? null : k))}
                onDrop={(e) => {
                  e.preventDefault()
                  if (col.id === '__other__') {
                    setDragOverKey(null)
                    setDraggingLead(null)
                    return
                  }
                  handleDrop(col.id)
                }}
                className={`flex-shrink-0 w-[280px] rounded-xl border flex flex-col h-full min-h-0 ${
                  dragOverKey === col.id
                    ? 'border-brand-3 bg-brand-3/5'
                    : 'border-neutral-800 bg-neutral-900'
                }`}
              >
                <div className="px-3.5 py-3 border-b border-neutral-800 flex items-center justify-between shrink-0">
                  <span className="font-semibold text-neutral-100 -ft-3 truncate">{col.label}</span>
                  <span className="-ft-4 bg-neutral-800 text-neutral-400 rounded-full px-2 py-0.5 shrink-0 ml-2">
                    {count}
                  </span>
                </div>
                <div
                  ref={(el) => {
                    columnScrollRefs.current[col.id] = el
                  }}
                  onScroll={handleColumnScroll(col.id)}
                  className="p-2 flex flex-col gap-2 overflow-y-auto flex-1 min-h-0"
                >
                  {state.loading && state.leads.length === 0 && (
                    <p className="-ft-4 text-neutral-600 text-center py-4">Cargando…</p>
                  )}
                  {state.error && (
                    <button
                      onClick={() => loadColumn(col.id, 1)}
                      className="!bg-transparent !text-red-400 -ft-4 text-center py-2 underline"
                    >
                      Error al cargar. Reintentar
                    </button>
                  )}
                  {state.leads.map((lead) => {
                    const badge = STATUS_BADGE[lead.status]
                    const days = daysIdle(lead)
                    const badgeIdle = lead.status === 'open' ? idleBadge(days) : null
                    const date = formatDate(lead.createdAt)
                    const isPending = pendingLeadId === String(lead.id)
                    return (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={() => setDraggingLead(lead)}
                        onDragEnd={() => {
                          setDraggingLead(null)
                          setDragOverKey(null)
                        }}
                        onClick={() => onCardClick(lead)}
                        className={`rounded-lg border p-3 cursor-pointer transition-shadow hover:shadow-lg hover:shadow-black/30 ${cardTone(
                          lead,
                          days,
                        )} ${isPending ? 'opacity-40 pointer-events-none' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium -ft-3 text-neutral-100 truncate">{lead.name || 'Sin nombre'}</p>
                          {badge && (
                            <span
                              className={`shrink-0 text-[10px] font-medium rounded-full px-2 py-0.5 ${badge.className}`}>
                              {badge.label}
                            </span>
                          )}
                        </div>
                        <p className="-ft-4 text-neutral-400 truncate mt-0.5">
                          {lead.whatsapp || lead.phone || lead.email || '—'}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold ${avatarColor(
                                lead.name,
                              )}`}
                            >
                              {initials(lead.name)}
                            </span>
                            {date && <span className="text-[10px] text-neutral-500">{date}</span>}
                          </div>
                          {badgeIdle && (
                            <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${badgeIdle.className}`}>
                              {badgeIdle.label}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {!state.loading && !state.error && state.leads.length === 0 && (
                    <p className="-ft-4 text-neutral-600 text-center py-4">Sin leads</p>
                  )}
                  {/* Scroll infinito: sin botón. `state.hasNextPage` sigue
                      controlando si hay algo más que traer; el indicador de
                      abajo solo confirma que se está trayendo. */}
                  {state.loadingMore && (
                    <p className="-ft-4 text-neutral-600 text-center py-2">Cargando más…</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div ref={listScrollRef} onScroll={handleListScroll} className="flex-grow overflow-y-auto p-4 min-h-0">
          <table className="w-full border-collapse">
            <thead>
            <tr className="text-left text-neutral-500 -ft-4 uppercase tracking-wide">
              <th className="py-2 px-3 font-medium">Nombre</th>
              <th className="py-2 px-3 font-medium">Contacto</th>
              <th className="py-2 px-3 font-medium">Etapa</th>
              <th className="py-2 px-3 font-medium">Status</th>
              <th className="py-2 px-3 font-medium">Creado</th>
            </tr>
            </thead>
            <tbody>
            {listLoading && listLeads.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center -ft-3 text-neutral-600">
                  Cargando…
                </td>
              </tr>
            )}
            {listLeads.map((lead) => {
              const badge = STATUS_BADGE[lead.status]
              return (
                <tr
                  key={lead.id}
                  onClick={() => onCardClick(lead)}
                  className="cursor-pointer border-t border-neutral-800 hover:bg-neutral-900/60"
                >
                  <td className="py-2.5 px-3 -ft-3 text-neutral-100">{lead.name || 'Sin nombre'}</td>
                  <td className="py-2.5 px-3 -ft-4 text-neutral-400">
                    {lead.whatsapp || lead.phone || lead.email || '—'}
                  </td>
                  <td className="py-2.5 px-3 -ft-4 text-neutral-400">{stageLabel(lead.stage)}</td>
                  <td className="py-2.5 px-3">
                    {badge ? (
                      <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${badge.className}`}>
                          {badge.label}
                        </span>
                    ) : (
                      <span className="text-[10px] text-neutral-500">Abierto</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 -ft-4 text-neutral-500">{formatDate(lead.createdAt) || '—'}</td>
                </tr>
              )
            })}
            {!listLoading && listLeads.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center -ft-3 text-neutral-600">
                  Sin leads
                </td>
              </tr>
            )}
            </tbody>
          </table>
          {listLoadingMore && (
            <p className="-ft-4 text-neutral-600 text-center py-3">Cargando más…</p>
          )}
        </div>
      )}
    </div>
  )
}
