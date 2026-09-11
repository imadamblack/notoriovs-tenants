import type { TenantQuizStep } from '@/utils/tenantQuiz'

/**
 * Las respuestas del quiz son campos del Lead como cualquier otro (issue 15).
 *
 * Un lead se equivoca al contestar ("puse 3 recámaras, son 2") y quien lo
 * atiende lo aclara por teléfono: edita la respuesta y ya. No se guarda un
 * "valor original" aparte —lo que quedó es lo que vale— porque medir sobre un
 * error del lead no le sirve a nadie: el panel, la exportación y cualquier
 * número sobre respuestas leen `Lead.answers`.
 *
 * Este módulo es lo único que decide qué respuesta se puede editar y con qué
 * valores, y lo comparten la ruta que guarda (que es quien manda) y el panel
 * que las pinta.
 */

/** Pasos del quiz que no son una pregunta con respuesta guardada. */
const NON_QUESTION_STEP_TYPES = new Set(['checkpoint', 'opt-in'])

/**
 * Las claves de contacto: viven en `answers` porque el paso de opt-in las
 * manda con todo lo demás, pero el Lead ya las tiene en campos propios
 * (`name`, `phone`…) y se editan ahí. Editarlas también aquí dejaría dos
 * verdades del mismo dato.
 */
const CONTACT_ANSWER_KEYS = new Set(['nombre', 'telefono', 'whatsapp', 'email'])

const OPTION_STEP_TYPES = new Set(['radio', 'select'])

export type LeadAnswers = Record<string, unknown>

export function isEditableAnswerKey(key: string): boolean {
  return !CONTACT_ANSWER_KEYS.has(key)
}

/** Las preguntas del quiz que sí guardan respuesta, en el orden del quiz. */
export function quizQuestions(steps: TenantQuizStep[] | null | undefined): TenantQuizStep[] {
  return (steps || []).filter(
    (step) =>
      !NON_QUESTION_STEP_TYPES.has(step.type) && Boolean(step.name) && isEditableAnswerKey(step.name),
  )
}

export function readAnswers(raw: unknown): LeadAnswers {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return { ...(raw as LeadAnswers) }
}

export type NormalizedAnswer = { ok: true; value: unknown } | { ok: false; error: string }

/**
 * Deja la respuesta editada en la misma forma en que la habría guardado el
 * quiz. Es lo que evita que editar ensucie la medición: si la pregunta es de
 * opciones, el valor tiene que ser una de esas opciones —un texto libre ahí
 * crearía una "categoría" que ningún reporte sabe contar—; si es numérica, un
 * número y no la cadena "3".
 *
 * Sin `step` (una pregunta que se renombró o se borró del quiz después de que
 * este lead lo contestara) solo se exige que el valor sea texto, número o una
 * lista de textos: no hay contra qué validar, pero tampoco hay razón para
 * dejar de poder editarla.
 */
export function normalizeAnswerValue(step: TenantQuizStep | undefined, raw: unknown): NormalizedAnswer {
  if (Array.isArray(raw) && !raw.every((item) => typeof item === 'string')) {
    return { ok: false, error: 'Esa respuesta tiene un valor que no se puede guardar' }
  }
  if (
    !Array.isArray(raw) &&
    raw !== null &&
    raw !== undefined &&
    typeof raw !== 'string' &&
    typeof raw !== 'number'
  ) {
    return { ok: false, error: 'Esa respuesta tiene un valor que no se puede guardar' }
  }

  const type = step?.type
  const options = step?.options || []
  const optionValues = new Set(options.map((option) => option.value))

  if (type === 'checkbox') {
    const list = Array.isArray(raw)
      ? raw
      : raw === null || raw === undefined || raw === ''
        ? []
        : [String(raw)]
    if (optionValues.size && !list.every((item) => optionValues.has(item))) {
      return { ok: false, error: 'Esa opción no existe en la pregunta' }
    }
    return { ok: true, value: list }
  }

  if (Array.isArray(raw)) {
    return { ok: false, error: 'Esa pregunta no admite varias respuestas' }
  }

  const text = typeof raw === 'number' ? String(raw) : (raw ?? '').toString().trim()

  // Vaciar una respuesta es una edición legítima ("eso no lo contestó él"), y
  // se guarda como cadena vacía: igual que una pregunta opcional que el lead
  // se saltó.
  if (text === '') return { ok: true, value: '' }

  if (type && OPTION_STEP_TYPES.has(type) && optionValues.size && !optionValues.has(text)) {
    return { ok: false, error: 'Esa opción no existe en la pregunta' }
  }

  if (type === 'number') {
    const parsed = Number(text)
    if (!Number.isFinite(parsed)) return { ok: false, error: 'Esa pregunta espera un número' }
    return { ok: true, value: parsed }
  }

  return { ok: true, value: text }
}

export type AnswersPatchResult = { ok: true; answers: LeadAnswers } | { ok: false; error: string }

/**
 * Mezcla lo que llega del panel con lo que ya tenía el lead, una pregunta a la
 * vez. Solo entran preguntas del quiz de este tenant y respuestas que el lead
 * ya traía (una pregunta renombrada o borrada del quiz después de que
 * contestó): una clave nueva sería un dato que nadie preguntó.
 */
export function mergeAnswersPatch(args: {
  current: LeadAnswers
  patch: unknown
  questions: TenantQuizStep[]
}): AnswersPatchResult {
  const { current, questions } = args

  if (!args.patch || typeof args.patch !== 'object' || Array.isArray(args.patch)) {
    return { ok: false, error: 'Las respuestas llegaron en un formato que no se puede guardar' }
  }

  const answers = { ...current }

  for (const [key, raw] of Object.entries(args.patch as Record<string, unknown>)) {
    if (!isEditableAnswerKey(key)) {
      return { ok: false, error: 'Ese dato se edita en los datos de contacto del lead' }
    }

    const step = questions.find((question) => question.name === key)
    if (!step && !(key in current)) {
      return { ok: false, error: 'Esa pregunta no existe en este quiz' }
    }

    const normalized = normalizeAnswerValue(step, raw)
    if (!normalized.ok) return normalized

    answers[key] = normalized.value
  }

  return { ok: true, answers }
}
