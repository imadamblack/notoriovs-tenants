import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { isSuperadminUser, assignedTenantIds } from '@/access/internalRoles'
import { quizQuestions, normalizeAnswerValue } from '@/utils/leadAnswers'
import { headerFromQuizStep, csvRow, CSV_BOM, SOURCE_LABELS } from '@/utils/leadsCsv'
import { statusLabel } from '@/components/dashboard/leadPresentation'
import type { TenantQuizStep } from '@/utils/tenantQuiz'
import type { TenantLeadStage } from '@/utils/getTenant'

// Alta en bloque de Leads desde el panel de Payload (colección `leads`,
// componente `beforeListTable`). Mismo molde que /api/leads/ingest —fila por
// fila, sigue aunque una falle, misma asignación de `stage` (primera etapa
// del pipeline del tenant) cuando el CSV no la trae— pero pensado para un
// Internal User pegando o subiendo un CSV desde el panel, no para n8n con
// una llave de plataforma.
//
// Por qué NO es un endpoint de la colección (`Leads.endpoints`): así se
// autentica con `payload.auth()` a partir de la cookie de sesión, igual que
// cualquier otra ruta de este repo, sin depender de cómo Payload monte sus
// propias rutas REST.
//
// El tenant lo manda el cliente (el mismo que ya tiene seleccionado arriba en
// el panel, vía `useTenantSelection`) y no un `where` a mano: a diferencia del
// selector nativo del plugin —que ya filtra el dropdown a los tenants
// asignados—, este panel no pasa por ese componente, así que la verificación
// de que el tenant elegido esté entre los asignados al usuario (o que sea
// superadmin) se hace aquí a mano, tanto en POST como en GET. Sin este
// chequeo, un Account Manager podría mandar cualquier id de tenant y crear
// Leads (o leerse la estructura del quiz) fuera de sus clientes asignados —
// el control de acceso normal de `leads` no lo detiene porque `create` no
// valida `data.tenant` contra el `Where` que arma el plugin (esa restricción
// solo aplica a listar/editar/borrar).
//
// Columnas que acepta el CSV: TODOS los campos editables del Lead.
//   - Contacto: Nombre, Teléfono, WhatsApp, Correo, Notas.
//   - Etapa: por etiqueta del pipeline de este tenant (no el id interno, que
//     nadie llenando un Excel conoce). Vacía o ausente, cae a la primera
//     etapa — igual que el quiz y el ingest de n8n.
//   - Resultado y Origen: por su etiqueta (Abierto/Ganado/… , Quiz/Manual/…)
//     o su valor interno; vacíos caen a "Abierto" e "Importado".
//   - UTM Source/Medium/Campaign/Term/Content: las mismas cinco claves que
//     guarda el quiz (ver UTM_KEYS en tracking-cookies.ts).
//   - Una columna por pregunta del quiz de este tenant, con el mismo
//     encabezado (`headerFromQuizStep`) y la misma validación de opciones
//     (`normalizeAnswerValue`) que ya usan la exportación y la edición de
//     respuestas desde el panel de detalle. Reusar `leadAnswers.ts` en vez de
//     reinventar la validación es lo que evita que un CSV con una opción que
//     no existe en el quiz cree una respuesta que ningún reporte sabe contar.
//
// Deliberadamente fuera: `externalId` (es la llave de idempotencia del
// ingest de n8n, no algo que se teclee a mano) y `answers` sueltas fuera del
// quiz (ver "Otras respuestas" en leadsCsv.ts: son huérfanas de un quiz que
// cambió, no algo que un alta nueva deba poder inventar).

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const
type UtmKey = (typeof UTM_KEYS)[number]

const STATUS_VALUES = ['open', 'won', 'lost', 'disqualified'] as const
type StatusValue = (typeof STATUS_VALUES)[number]

const SOURCE_VALUES = ['quiz', 'manual', 'meta', 'whatsapp', 'import'] as const
type SourceValue = (typeof SOURCE_VALUES)[number]

type FixedTextKind = 'name' | 'phone' | 'whatsapp' | 'email' | 'notes'

const FIXED_HEADER_SYNONYMS: Record<string, FixedTextKind | 'stage' | 'status' | 'source'> = {
  nombre: 'name',
  name: 'name',
  telefono: 'phone',
  phone: 'phone',
  whatsapp: 'whatsapp',
  correo: 'email',
  email: 'email',
  'e-mail': 'email',
  notas: 'notes',
  notes: 'notes',
  etapa: 'stage',
  stage: 'stage',
  resultado: 'status',
  status: 'status',
  origen: 'source',
  source: 'source',
}

// Dos formas de escribir cada clave UTM ("utm_source" y "utm source"): la
// plantilla descargable usa la segunda (más legible en una hoja de cálculo),
// pero conviene aceptar también la forma con guion bajo por si alguien pega
// un CSV que ya traía esas columnas de otro lado.
const UTM_HEADER_SYNONYMS: Record<string, UtmKey> = UTM_KEYS.reduce(
  (acc, key) => {
    acc[key] = key
    acc[key.replace(/_/g, ' ')] = key
    return acc
  },
  {} as Record<string, UtmKey>,
)

type ColumnTarget =
  | { kind: FixedTextKind | 'stage' | 'status' | 'source' }
  | { kind: 'utm'; utmKey: UtmKey }
  | { kind: 'answer'; step: TenantQuizStep }

type ParsedRow = {
  name?: string
  phone?: string
  whatsapp?: string
  email?: string
  notes?: string
  stage?: string
  status?: StatusValue
  source?: SourceValue
  answers: Record<string, unknown>
  utm: Record<string, string>
}

type RowResult = {
  line: number
  op: 'created' | 'skipped'
  id?: string | number
  error?: string
}

function toText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

/** Sin acentos, sin mayúsculas: para que "Teléfono" y "telefono" sean el mismo encabezado. */
function normalizeHeader(cell: string): string {
  return cell
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

function detectDelimiter(line: string): string {
  if (line.includes('\t')) return '\t'
  // `;` antes que `,`: es lo que usa la plantilla que descarga este mismo
  // panel (mismo formato que /api/tenant-dashboard/leads/export, pensado
  // para abrirse con doble clic en Excel en español).
  if (line.includes(';')) return ';'
  return ','
}

// Divide una línea respetando comillas dobles, para permitir un nombre o una
// nota con el delimitador adentro.
function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        current += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === delimiter) {
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current)
  return cells.map((cell) => cell.trim())
}

function resolveColumns(headerCells: string[], questions: TenantQuizStep[]): (ColumnTarget | null)[] {
  const quizByHeader = new Map<string, TenantQuizStep>()
  for (const step of questions) {
    quizByHeader.set(normalizeHeader(headerFromQuizStep(step)), step)
    quizByHeader.set(normalizeHeader(step.name), step)
  }

  return headerCells.map((cell) => {
    const key = normalizeHeader(cell)
    if (!key) return null
    const fixed = FIXED_HEADER_SYNONYMS[key]
    if (fixed) return { kind: fixed }
    const utmKey = UTM_HEADER_SYNONYMS[key]
    if (utmKey) return { kind: 'utm', utmKey }
    const step = quizByHeader.get(key)
    return step ? { kind: 'answer', step } : null
  })
}

/**
 * Una celda de radio/select/checkbox puede traer la etiqueta ("Sí", "2
 * recámaras") o el value interno de la opción: ambos son válidos, porque la
 * plantilla descargable pone la etiqueta (lo que el lead ve) y alguien
 * reimportando un export puesto en mayúsculas o con espacios distintos no
 * debería fallar por eso.
 */
function resolveOptionValue(step: TenantQuizStep, cellText: string): string {
  const options = step.options || []
  if (!options.length) return cellText

  const match = options.find(
    (option) => normalizeHeader(option.value) === normalizeHeader(cellText) || normalizeHeader(option.label) === normalizeHeader(cellText),
  )
  return match?.value ?? cellText
}

function parseAnswerCell(step: TenantQuizStep, cellText: string): ReturnType<typeof normalizeAnswerValue> {
  if (step.type === 'checkbox') {
    // Varias opciones en una celda van separadas por "|", igual que las junta
    // la exportación a CSV (ver `text()` en leadsCsv.ts).
    const values = cellText
      .split('|')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => resolveOptionValue(step, part))
    return normalizeAnswerValue(step, values)
  }
  return normalizeAnswerValue(step, resolveOptionValue(step, cellText))
}

/** Etapa por etiqueta ("Contactado"), y por id interno como respaldo si alguien reimporta un export crudo. */
function resolveStageId(pipeline: TenantLeadStage[], cellText: string): string | undefined {
  const key = normalizeHeader(cellText)
  const byLabel = pipeline.find((stage) => normalizeHeader(stage.label) === key)
  if (byLabel?.id) return byLabel.id
  const byId = pipeline.find((stage) => stage.id === cellText)
  return byId?.id ?? undefined
}

function resolveStatus(cellText: string): StatusValue | undefined {
  const key = normalizeHeader(cellText)
  if ((STATUS_VALUES as readonly string[]).includes(key)) return key as StatusValue
  return STATUS_VALUES.find((value) => normalizeHeader(statusLabel(value)) === key)
}

function resolveSource(cellText: string): SourceValue | undefined {
  const key = normalizeHeader(cellText)
  if ((SOURCE_VALUES as readonly string[]).includes(key)) return key as SourceValue
  const entry = Object.entries(SOURCE_LABELS).find(([, label]) => normalizeHeader(label) === key)
  return entry ? (entry[0] as SourceValue) : undefined
}

function parseDataRow(
  cells: string[],
  columns: (ColumnTarget | null)[],
  pipeline: TenantLeadStage[],
): { row: ParsedRow; errors: string[] } {
  const row: ParsedRow = { answers: {}, utm: {} }
  const errors: string[] = []

  columns.forEach((column, i) => {
    if (!column) return
    const cellText = (cells[i] ?? '').trim()

    switch (column.kind) {
      case 'name':
      case 'phone':
      case 'whatsapp':
      case 'email':
      case 'notes': {
        const text = toText(cellText)
        if (text !== undefined) row[column.kind] = text
        return
      }
      case 'utm': {
        const text = toText(cellText)
        if (text !== undefined) row.utm[column.utmKey] = text
        return
      }
      case 'stage': {
        if (!cellText) return
        const stageId = resolveStageId(pipeline, cellText)
        if (!stageId) {
          errors.push(`"Etapa": "${cellText}" no existe en el pipeline de este tenant`)
          return
        }
        row.stage = stageId
        return
      }
      case 'status': {
        if (!cellText) return
        const status = resolveStatus(cellText)
        if (!status) {
          errors.push(`"Resultado": "${cellText}" no es un resultado válido`)
          return
        }
        row.status = status
        return
      }
      case 'source': {
        if (!cellText) return
        const source = resolveSource(cellText)
        if (!source) {
          errors.push(`"Origen": "${cellText}" no es un origen válido`)
          return
        }
        row.source = source
        return
      }
      case 'answer': {
        if (!cellText) return
        const normalized = parseAnswerCell(column.step, cellText)
        if (!normalized.ok) {
          errors.push(`"${headerFromQuizStep(column.step)}": ${normalized.error}`)
          return
        }
        row.answers[column.step.name] = normalized.value
        return
      }
    }
  })

  return { row, errors }
}

type ParseResult =
  | { ok: true; columns: (ColumnTarget | null)[]; dataLines: string[]; delimiter: string }
  | { ok: false; error: string }

function parseHeaderAndLines(text: string, questions: TenantQuizStep[]): ParseResult {
  const lines = text
    .replace(/^﻿/, '') // BOM, por si suben un CSV exportado desde Excel
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')

  if (!lines.length) return { ok: false, error: 'No se encontraron filas para importar' }

  const delimiter = detectDelimiter(lines[0])
  const headerCells = splitLine(lines[0], delimiter)
  const columns = resolveColumns(headerCells, questions)

  const hasContactColumn = columns.some(
    (c) => c?.kind === 'name' || c?.kind === 'phone' || c?.kind === 'whatsapp' || c?.kind === 'email',
  )
  if (!hasContactColumn) {
    return {
      ok: false,
      error:
        'No se reconoció el encabezado. La primera fila debe traer al menos una columna de contacto (Nombre, Teléfono, WhatsApp o Correo) — descarga la plantilla para no fallar por un nombre de columna distinto.',
    }
  }

  return { ok: true, columns, dataLines: lines.slice(1), delimiter }
}

function exampleValueForStep(step: TenantQuizStep): string {
  if (step.options?.length) {
    return step.type === 'checkbox'
      ? step.options.slice(0, 2).map((o) => o.label).join(' | ')
      : step.options[0].label
  }
  switch (step.type) {
    case 'tel':
      return '3312345678'
    case 'number':
      return '3'
    case 'state-mx':
      return 'Jalisco'
    case 'textarea':
      return 'Ejemplo de respuesta larga'
    default:
      return 'Ejemplo de respuesta'
  }
}

async function authorizeTenant(payload: Awaited<ReturnType<typeof getPayload>>, req: NextRequest, tenantId: number) {
  const { user } = await payload.auth({ headers: req.headers })
  if (user?.collection !== 'users') {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) } as const
  }
  if (!tenantId) {
    return { error: NextResponse.json({ error: 'Falta seleccionar un tenant' }, { status: 400 }) } as const
  }
  if (!isSuperadminUser(user) && !assignedTenantIds(user).some((id) => String(id) === String(tenantId))) {
    return {
      error: NextResponse.json({ error: 'Ese tenant no está entre los asignados a tu usuario' }, { status: 403 }),
    } as const
  }
  return { user } as const
}

export async function POST(req: NextRequest) {
  const payload = await getPayload({ config })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const tenantId = Number(body?.tenant)
  const auth = await authorizeTenant(payload, req, tenantId)
  if ('error' in auth) return auth.error
  const { user } = auth

  const text = typeof body?.text === 'string' ? body.text : ''
  if (!text.trim()) {
    return NextResponse.json({ error: 'Falta el CSV a importar' }, { status: 400 })
  }

  const tenant = await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
    overrideAccess: true,
  })
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 })
  }

  // Misma regla que /api/quiz-submit y /api/leads/ingest: sin una etapa
  // explícita en el CSV, el lead nace en la primera etapa del pipeline.
  const pipeline = tenant.leadPipeline || []
  const firstStage = pipeline[0]?.id || 'nuevo'
  const questions = quizQuestions(tenant.quizSteps || [])

  const parsed = parseHeaderAndLines(text, questions)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const results: RowResult[] = []

  for (let i = 0; i < parsed.dataLines.length; i++) {
    const cells = splitLine(parsed.dataLines[i], parsed.delimiter)
    const { row, errors } = parseDataRow(cells, parsed.columns, pipeline)

    if (errors.length) {
      results.push({ line: i + 1, op: 'skipped', error: errors.join('; ') })
      continue
    }

    if (!row.name && !row.phone && !row.whatsapp && !row.email) {
      results.push({ line: i + 1, op: 'skipped', error: 'La fila no trae nombre ni forma de contacto' })
      continue
    }

    try {
      const created = await payload.create({
        collection: 'leads',
        data: {
          tenant: tenantId,
          name: row.name,
          phone: row.phone,
          whatsapp: row.whatsapp,
          email: row.email,
          notes: row.notes,
          answers: Object.keys(row.answers).length ? row.answers : null,
          utm: Object.keys(row.utm).length ? row.utm : null,
          stage: row.stage || firstStage,
          status: row.status || 'open',
          source: row.source || 'import',
        },
        user,
        overrideAccess: false,
      })
      results.push({ line: i + 1, op: 'created', id: created.id })
    } catch (err) {
      results.push({ line: i + 1, op: 'skipped', error: String(err) })
    }
  }

  return NextResponse.json({ ok: true, results })
}

// Plantilla de muestra: mismos encabezados que espera el POST de arriba
// (campos fijos + Etapa/Resultado/Origen/UTM + una columna por pregunta del
// quiz de ESTE tenant), con una fila de ejemplo. Bajarla y volver a subirla
// debe funcionar sin tocarle nada, que es la prueba de que ambos lados leen
// el mismo formato.
export async function GET(req: NextRequest) {
  const payload = await getPayload({ config })
  const { searchParams } = new URL(req.url)
  const tenantId = Number(searchParams.get('tenant'))

  const auth = await authorizeTenant(payload, req, tenantId)
  if ('error' in auth) return auth.error

  const tenant = await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
    overrideAccess: true,
  })
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 })
  }

  const questions = quizQuestions(tenant.quizSteps || [])
  const firstStageLabel = tenant.leadPipeline?.[0]?.label || ''

  const header = [
    'Nombre',
    'Teléfono',
    'WhatsApp',
    'Correo',
    'Notas',
    'Etapa',
    'Resultado',
    'Origen',
    'UTM Source',
    'UTM Medium',
    'UTM Campaign',
    'UTM Term',
    'UTM Content',
    ...questions.map(headerFromQuizStep),
  ]
  const example = [
    'Juana Pérez',
    '3312345678',
    '3312345678',
    'juana@ejemplo.com',
    'Ejemplo de nota',
    firstStageLabel,
    statusLabel('open'),
    SOURCE_LABELS.import,
    'facebook',
    'cpc',
    'leads-septiembre',
    '',
    '',
    ...questions.map(exampleValueForStep),
  ]

  const csv = CSV_BOM + csvRow(header) + csvRow(example)
  const filename = `leads-plantilla-${tenant.subdomain || tenantId}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
