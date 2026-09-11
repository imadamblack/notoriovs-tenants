import type { TenantLeadStage } from '@/utils/getTenant'
import type { TenantQuizStep } from '@/utils/tenantQuiz'
import { statusLabel } from '@/components/dashboard/leadPresentation'

// Armado del CSV que un Tenant User descarga desde el dashboard (issue 14).
//
// El archivo se abre haciendo doble clic en Excel en español, así que manda
// el formato que Excel espera en esa configuración regional y no el de la
// especificación:
//
//   - Separador `;` y no `,`. Excel parte las columnas por el "separador de
//     listas" del sistema, que en español (México y España) es el punto y
//     coma. Con comas, un Excel en español pone todo el renglón en la
//     columna A y el cliente ve un archivo roto.
//   - BOM al inicio (U+FEFF). Sin él, Excel lee el archivo como ANSI y los
//     acentos salen como "MartÃ­nez". El BOM es lo que le dice que es UTF-8.
//   - Fin de línea CRLF, que es lo que espera Excel en Windows.
//
// Nada de esto le estorba a Google Sheets ni a un import a un CRM: los dos
// detectan el separador y el BOM solos.
export const CSV_BOM = '\uFEFF'
const DELIMITER = ';'
const NEWLINE = '\r\n'

/**
 * Un valor que Excel interpretaría como fórmula si lo dejáramos tal cual.
 * Las respuestas del quiz las escribe el propio lead, así que un texto que
 * empieza con `=` o `+` llega a este archivo desde afuera: Excel lo
 * ejecutaría al abrirlo (y algunas fórmulas leen archivos o llaman a la
 * red). Se neutraliza anteponiendo un apóstrofo, que Excel usa justamente
 * para decir "esto es texto"; el valor se sigue leyendo igual en la celda.
 */
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r']

function escapeCell(raw: string): string {
  const value = FORMULA_PREFIXES.some((prefix) => raw.startsWith(prefix)) ? `'${raw}` : raw

  // Se entrecomilla siempre que el valor traiga algo que rompería la fila.
  // Las comillas de adentro se duplican, que es como las escapa el formato.
  return /[";\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function csvRow(cells: string[]): string {
  return cells.map(escapeCell).join(DELIMITER) + NEWLINE
}

/** Los campos del Lead que necesita el CSV. Nada de la forma de la UI. */
export type ExportableLead = {
  name?: string | null
  phone?: string | null
  whatsapp?: string | null
  email?: string | null
  stage: string
  status: 'open' | 'won' | 'lost' | 'disqualified'
  source?: string | null
  notes?: string | null
  answers?: Record<string, unknown> | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type LeadCsvColumn = {
  header: string
  value: (lead: ExportableLead) => string
}

const SOURCE_LABELS: Record<string, string> = {
  quiz: 'Quiz',
  manual: 'Manual',
  meta: 'Meta Ads',
  whatsapp: 'WhatsApp',
  import: 'Importado',
}

// Las mismas claves de `answers` que el panel de detalle no repite abajo:
// ya viajan como columnas fijas (Nombre/Teléfono/WhatsApp/Correo), porque
// el paso de opt-in del quiz es el que llena esos campos del Lead.
const CONTACT_ANSWER_KEYS = new Set(['nombre', 'telefono', 'whatsapp', 'email'])

/** Los pasos del quiz que no son una pregunta con respuesta guardada. */
const NON_QUESTION_STEP_TYPES = new Set(['checkpoint', 'opt-in'])

function text(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(' | ')
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/**
 * El título de la pregunta tal como lo ve el lead, listo para un encabezado
 * de columna: `quizSteps.title` admite HTML simple (se pinta con
 * dangerouslySetInnerHTML en el quiz), y un `<br>` dentro de una celda de
 * Excel no es un encabezado, es basura.
 */
export function headerFromQuizStep(step: TenantQuizStep): string {
  const title = (step.title || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()

  // Sin título (un paso que solo tiene placeholder) el nombre interno del
  // campo es mejor encabezado que una columna sin nombre.
  return title || step.name
}

/**
 * Traduce el valor guardado a la etiqueta que el lead vio en pantalla. Las
 * respuestas de opción se guardan por `value` ("2-recamaras"), y esa cadena
 * no es lo que el cliente quiere leer en su hoja de cálculo.
 */
function answerToLabel(step: TenantQuizStep, raw: unknown): string {
  const options = step.options
  if (!options?.length) return text(raw)

  const label = (value: unknown) =>
    options.find((option) => option.value === value)?.label ?? text(value)

  return Array.isArray(raw) ? raw.map(label).filter(Boolean).join(' | ') : label(raw)
}

/**
 * Fecha en el formato que lee un hispanohablante: `10/09/2026 14:32`.
 *
 * En hora de la Ciudad de México, fija. El Tenant no guarda zona horaria en
 * ningún lado (ver la nota de `dashboardPeriod.ts`), y una fecha en UTC en la
 * hoja de un cliente se lee mal por seis horas: el lead que entró a las 9 de
 * la noche aparecería como del día siguiente. El día que haya un cliente
 * fuera de este huso, la zona tendrá que salir del Tenant.
 *
 * Se arma parte por parte en vez de con `toLocaleString` porque este último
 * mete una coma entre la fecha y la hora, y una coma dentro de una celda es
 * justo lo que rompe el archivo al reimportarlo en cualquier herramienta que
 * sí separe por comas.
 */
export function formatCsvDate(raw?: string | null): string {
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return ''

  const parts = new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Mexico_City',
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''

  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`
}

/**
 * Las columnas del CSV de este tenant: primero los campos fijos del Lead, y
 * luego una por pregunta del quiz EN EL ORDEN DEL QUIZ, con el título que se
 * le muestra al lead como encabezado.
 *
 * La última columna, "Otras respuestas", recoge lo que quedó en `answers` sin
 * pregunta que lo reclame: preguntas que se renombraron o se borraron del
 * quiz después de que ese lead lo contestara. Es una columna que casi
 * siempre va vacía, y existe para que cambiar el quiz nunca haga desaparecer
 * en silencio lo que un lead contestó.
 */
export function buildLeadCsvColumns(
  pipeline: TenantLeadStage[],
  quizSteps: TenantQuizStep[],
): LeadCsvColumn[] {
  const stageLabels = new Map(pipeline.filter((s) => s.id).map((s) => [s.id as string, s.label]))
  const questions = quizSteps.filter(
    (step) => !NON_QUESTION_STEP_TYPES.has(step.type) && Boolean(step.name),
  )
  const questionKeys = new Set(questions.map((step) => step.name))

  return [
    { header: 'Nombre', value: (lead) => text(lead.name) },
    { header: 'Teléfono', value: (lead) => text(lead.phone) },
    { header: 'WhatsApp', value: (lead) => text(lead.whatsapp) },
    { header: 'Correo', value: (lead) => text(lead.email) },
    // Una etapa que ya no existe en el pipeline (renombrada, borrada) es la
    // misma columna "Otro" que muestra el Kanban.
    { header: 'Etapa', value: (lead) => stageLabels.get(lead.stage) ?? 'Otro' },
    { header: 'Resultado', value: (lead) => statusLabel(lead.status) },
    { header: 'Origen', value: (lead) => (lead.source ? SOURCE_LABELS[lead.source] ?? lead.source : '') },
    { header: 'Fecha de alta', value: (lead) => formatCsvDate(lead.createdAt) },
    { header: 'Última actualización', value: (lead) => formatCsvDate(lead.updatedAt) },
    { header: 'Notas internas', value: (lead) => text(lead.notes) },
    ...questions.map(
      (step): LeadCsvColumn => ({
        header: headerFromQuizStep(step),
        value: (lead) => answerToLabel(step, lead.answers?.[step.name]),
      }),
    ),
    {
      header: 'Otras respuestas',
      value: (lead) =>
        Object.entries(lead.answers || {})
          .filter(
            ([key, value]) =>
              !questionKeys.has(key) &&
              !CONTACT_ANSWER_KEYS.has(key) &&
              value !== null &&
              value !== undefined &&
              value !== '',
          )
          .map(([key, value]) => `${key}: ${text(value)}`)
          .join(' | '),
    },
  ]
}

export function csvHeaderRow(columns: LeadCsvColumn[]): string {
  return csvRow(columns.map((column) => column.header))
}

export function csvLeadRow(columns: LeadCsvColumn[], lead: ExportableLead): string {
  return csvRow(columns.map((column) => column.value(lead)))
}

/** `leads-acme-2026-09-10.csv`: dice de quién es y de cuándo, sin abrirlo. */
export function leadCsvFilename(subdomain: string, now: Date = new Date()): string {
  return `leads-${subdomain}-${now.toISOString().slice(0, 10)}.csv`
}
