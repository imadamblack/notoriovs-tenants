'use client'

import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import type {Lead, LeadUpdateEvent, PipelineStage} from '@/components/dashboard/DashboardApp'
import Select from '@/components/dashboard/ui/atoms/Select'
import IconSort from '@/components/dashboard/ui/atoms/icons/IconSort'
import IconClock from '@/components/dashboard/ui/atoms/icons/IconClock'
import IconFilter from '@/components/dashboard/ui/atoms/icons/IconFilter'
import SearchInput from '@/components/dashboard/ui/molecules/SearchInput'
import ViewToggle, {type BoardView} from '@/components/dashboard/ui/molecules/ViewToggle'
import BoardScrollIndicator from '@/components/dashboard/ui/molecules/BoardScrollIndicator'
import StageColumn from '@/components/dashboard/ui/organisms/StageColumn'
import LeadListTable from '@/components/dashboard/ui/organisms/LeadListTable'

type KanbanBoardProps = {
  subdomain: string
  pipeline: PipelineStage[]
  stuckAfterDays?: number | null
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

// Filtro de tiempo: sobre `createdAt` (cuándo llegó el lead), ventana
// rodante desde ahora (24h/7d/30d/90d), no día de calendario (ver el
// comentario de SINCE_DAYS en leadDashboardFilters.ts, del lado del
// servidor). 'all' ("Máximo") no manda parámetro, es el estado actual.
type SinceKey = 'today' | '7d' | '30d' | '3m' | 'all'

const SINCE_LABELS: Record<SinceKey, string> = {
  today: 'Hoy',
  '7d': '7 días',
  '30d': '30 días',
  '3m': '3 meses',
  all: 'Máximo',
}

// Filtro de status. 'stuck' ("Estancados") es sintético: no es un valor de
// Lead.status, se resuelve en el servidor a "abierto y sin actividad hace
// más de Tenant.leadStuckAfterDays" (ver leadDashboardFilters.ts). 'all'
// ("Todos") no manda parámetro.
type StatusFilterKey = 'all' | 'stuck' | 'open' | 'won' | 'lost' | 'disqualified'

const STATUS_FILTER_LABELS: Record<StatusFilterKey, string> = {
  all: 'Todos',
  stuck: 'Estancados',
  open: 'Abiertos',
  won: 'Ganados',
  lost: 'Perdidos',
  disqualified: 'Descalificados',
}

// Cuántas tarjetas/filas trae cada página. El Kanban pide de a poco por
// columna; la Lista pide un poco más porque es una tabla de "cargar más".
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

// Kanban con drag & drop nativo (HTML5 Drag and Drop API), sin librerías.
// Las columnas agrupan por `stage` (etapa del pipeline), no por `status`.
// Cada columna pide sus propios leads paginados a GET /api/tenant-dashboard/
// leads (?stage=...&page=...); los conteos vienen de .../leads/counts. Esto
// es lo que hace viable un tenant con miles de leads sin traer todo a la vez
// (ver `handleColumnScroll`/`handleListScroll`: cargan la siguiente página
// al acercarse al fondo del contenedor, sin botón).
export default function KanbanBoard({subdomain, pipeline, stuckAfterDays, onCardClick, onStageChange, updateEvent}: KanbanBoardProps) {
  const [view, setView] = useState<BoardView>('kanban')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('created_desc')
  const [sinceKey, setSinceKey] = useState<SinceKey>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>('all')

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
  const [boardScrollProgress, setBoardScrollProgress] = useState(0)

  const columnScrollRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const listScrollRef = useRef<HTMLDivElement | null>(null)
  const boardScrollRef = useRef<HTMLDivElement | null>(null)

  const pipelineIds = useMemo(() => new Set(pipeline.map((s) => s.id)), [pipeline])
  const showOtherColumn = otherCount > 0
  const boardColumns = useMemo(
    () => [...pipeline, ...(showOtherColumn ? [{id: '__other__', label: 'Otro'}] : [])],
    [pipeline, showOtherColumn],
  )

  const currentColumnIndex = useMemo(() => {
    if (boardColumns.length <= 1) return 0
    return Math.min(boardColumns.length - 1, Math.round(boardScrollProgress * (boardColumns.length - 1)))
  }, [boardScrollProgress, boardColumns.length])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [search])

  const buildParams = useCallback(
    (extra: Record<string, string>) => {
      const params = new URLSearchParams({subdomain, sort: sortKey, ...extra})
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (sinceKey !== 'all') params.set('since', sinceKey)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      return params
    },
    [subdomain, sortKey, debouncedSearch, sinceKey, statusFilter],
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
    if (sinceKey !== 'all') params.set('since', sinceKey)
    if (statusFilter !== 'all') params.set('status', statusFilter)
    const res = await fetch(`/api/tenant-dashboard/leads/counts?${params}`)
    if (!res.ok) return
    const data = await res.json()
    setStageCounts(data.counts || {})
    setOtherCount(data.other || 0)
    setTotalCount(data.total || 0)
  }, [subdomain, debouncedSearch, sinceKey, statusFilter])

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

  useEffect(() => {
    if (view !== 'kanban' || !showOtherColumn) return
    loadColumn('__other__', 1)
  }, [view, showOtherColumn, loadColumn])

  useEffect(() => {
    if (view !== 'list') return
    loadList(1)
  }, [view, loadList])

  // Reconcilia un cambio de lead (drag&drop o guardado desde el panel de
  // detalle) contra el estado local, sin volver a pedirle nada al servidor.
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

  // Cubre el caso en el que la página que acaba de cargar no alcanza a
  // llenar el contenedor (pantalla alta, pocas tarjetas): ahí nunca
  // aparecería scroll que disparara la siguiente página.
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

  const handleBoardScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const max = el.scrollWidth - el.clientWidth
    setBoardScrollProgress(max > 0 ? el.scrollLeft / max : 0)
  }, [])

  const handleDrop = async (stageKey: string) => {
    setDragOverKey(null)
    const lead = draggingLead
    setDraggingLead(null)
    if (!lead || stageKey === '__other__' || lead.stage === stageKey) return

    // La reconciliación real ocurre en el efecto que escucha `updateEvent`
    // arriba. Aquí solo se dispara el PATCH y se atenúa la tarjeta en vuelo.
    setPendingLeadId(String(lead.id))
    await onStageChange(lead, stageKey)
    setPendingLeadId(null)
  }

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
        <div className="hidden md:flex items-center gap-4">
          <ViewToggle value={view} onChange={setView}/>
          <div className="flex items-center gap-2 text-neutral-400 -ft-3">
            {visibleTotal} leads
          </div>
        </div>

        <div className="flex flex-grow items-center justify-between md:justify-end gap-4">
          <div className="flex items-center gap-2">
            <div className="relative h-[4.7rem] w-[4.7rem] shrink-0" title={`Ordenar: ${SORT_LABELS[sortKey]}`}>
              <Select
                id="sort-select"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                aria-label="Ordenar leads"
                className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
              >
                {Object.entries(SORT_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 isolate flex items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10 text-neutral-50 backdrop-blur-xl backdrop-saturate-150 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3),0_8px_24px_-8px_rgba(0,0,0,0.5)] peer-hover:border-white/30 peer-hover:bg-white/[0.16] peer-focus:border-white/30 peer-focus:bg-white/[0.16]"
              >
                <span className="w-6 h-6">
                  <IconSort/>
                </span>
              </div>
            </div>

            <div
              className={`relative h-[4.7rem] w-[4.7rem] shrink-0 ${statusFilter === 'stuck' ? 'opacity-40' : ''}`}
              title={statusFilter === 'stuck' ? 'Filtro de tiempo desactivado con "Estancados"' : `Tiempo: ${SINCE_LABELS[sinceKey]}`}
            >
              <Select
                id="since-select"
                value={sinceKey}
                disabled={statusFilter === 'stuck'}
                onChange={(e) => setSinceKey(e.target.value as SinceKey)}
                aria-label="Filtrar leads por tiempo"
                className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
              >
                {Object.entries(SINCE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 isolate flex items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10 text-neutral-50 backdrop-blur-xl backdrop-saturate-150 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3),0_8px_24px_-8px_rgba(0,0,0,0.5)] peer-hover:border-white/30 peer-hover:bg-white/[0.16] peer-focus:border-white/30 peer-focus:bg-white/[0.16]"
              >
                <span className="w-6 h-6">
                  <IconClock/>
                </span>
              </div>
            </div>

            <div className="relative h-[4.7rem] w-[4.7rem] shrink-0" title={`Status: ${STATUS_FILTER_LABELS[statusFilter]}`}>
              <Select
                id="status-select"
                value={statusFilter}
                onChange={(e) => {
                  const next = e.target.value as StatusFilterKey
                  setStatusFilter(next)
                  // "Estancados" ya filtra por tiempo sin actividad; dejar
                  // el filtro de "Tiempo" (que filtra por fecha de creación)
                  // prendido casi siempre da 0 resultados (un lead creado,
                  // digamos, hoy no puede llevar semanas sin actividad).
                  if (next === 'stuck') setSinceKey('all')
                }}
                aria-label="Filtrar leads por status"
                className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
              >
                {Object.entries(STATUS_FILTER_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 isolate flex items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10 text-neutral-50 backdrop-blur-xl backdrop-saturate-150 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3),0_8px_24px_-8px_rgba(0,0,0,0.5)] peer-hover:border-white/30 peer-hover:bg-white/[0.16] peer-focus:border-white/30 peer-focus:bg-white/[0.16]"
              >
                <span className="w-6 h-6">
                  <IconFilter/>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar leads"/>
          </div>
        </div>
      </div>

      {view === 'kanban' ? (
        <div className="flex flex-col flex-grow min-h-0">
          <BoardScrollIndicator count={boardColumns.length} activeIndex={currentColumnIndex}/>
          <div
            ref={boardScrollRef}
            onScroll={handleBoardScroll}
            className="flex flex-grow gap-3 overflow-x-auto md:p-4 min-h-0 snap-x snap-mandatory"
          >
            {boardColumns.map((col) => {
              const state = columnData[col.id] ?? emptyColumn
              const count = stageCounts[col.id] ?? (col.id === '__other__' ? otherCount : state.totalDocs)
              return (
                <StageColumn
                  key={col.id}
                  label={col.label}
                  count={count}
                  leads={state.leads}
                  loading={state.loading}
                  loadingMore={state.loadingMore}
                  error={state.error}
                  isDragOver={dragOverKey === col.id}
                  pendingLeadId={pendingLeadId}
                  stuckAfterDays={stuckAfterDays}
                  scrollRef={(el) => {
                    columnScrollRefs.current[col.id] = el
                  }}
                  onScroll={handleColumnScroll(col.id)}
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
                  onRetry={() => loadColumn(col.id, 1)}
                  onCardClick={onCardClick}
                  onCardDragStart={setDraggingLead}
                  onCardDragEnd={() => {
                    setDraggingLead(null)
                    setDragOverKey(null)
                  }}
                />
              )
            })}
          </div>
        </div>
      ) : (
        <div ref={listScrollRef} onScroll={handleListScroll} className="flex-grow overflow-y-auto p-4 min-h-0">
          <LeadListTable
            leads={listLeads}
            pipeline={pipeline}
            stuckAfterDays={stuckAfterDays}
            onRowClick={onCardClick}
            loading={listLoading}
            loadingMore={listLoadingMore}
          />
        </div>
      )}
    </div>
  )
}
