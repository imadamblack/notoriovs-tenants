import type {QuizQuestion} from '@/components/dashboard/DashboardApp'

/**
 * Cómo se leen y se listan las respuestas del quiz en el dashboard. Lo
 * comparten la vista de solo lectura (`LeadAnswersList`) y la de edición
 * (`LeadAnswersFields`) para que las dos muestren las mismas preguntas, en el
 * mismo orden y con las mismas etiquetas.
 *
 * Las claves de contacto no se listan: el lead las tiene en sus campos
 * propios, arriba en el mismo panel, y ahí se editan. Ver
 * `isEditableAnswerKey` en src/utils/leadAnswers.ts.
 */
const CONTACT_ANSWER_KEYS = new Set(['nombre', 'telefono', 'whatsapp', 'email'])

export type AnswerRow = {
  name: string
  label: string
  /** La pregunta del quiz, o `undefined` si ya no está en el quiz. */
  question?: QuizQuestion
  value: unknown
}

export function isEmptyAnswer(value: unknown): boolean {
  if (Array.isArray(value)) return value.length === 0
  return value === null || value === undefined || value === ''
}

/** El valor como lo vio el lead: la etiqueta de la opción, no su `value`. */
export function displayAnswer(question: QuizQuestion | undefined, value: unknown): string {
  if (isEmptyAnswer(value)) return ''

  const label = (raw: unknown) =>
    question?.options.find((option) => option.value === raw)?.label ?? String(raw)

  if (Array.isArray(value)) return value.map(label).join(', ')
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (typeof value === 'object') return JSON.stringify(value)
  return label(value)
}

/**
 * Las preguntas del quiz en su orden, y después lo que el lead trae en
 * `answers` sin pregunta que lo reclame (preguntas renombradas o borradas del
 * quiz después de que contestó).
 *
 * `includeEmpty` es la diferencia entre las dos vistas: leyendo, una pregunta
 * sin respuesta solo ocupa espacio; editando, es justo la que hay que poder
 * llenar.
 */
export function answerRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  answers: Record<string, any> | null | undefined,
  questions: QuizQuestion[],
  {includeEmpty}: {includeEmpty: boolean},
): AnswerRow[] {
  const values = answers || {}
  const claimed = new Set<string>()

  const fromQuiz = questions
    .filter((question) => !CONTACT_ANSWER_KEYS.has(question.name))
    .map((question): AnswerRow => {
      claimed.add(question.name)
      return {
        name: question.name,
        label: question.label,
        question,
        value: values[question.name],
      }
    })

  const extras = Object.keys(values)
    .filter((key) => !claimed.has(key) && !CONTACT_ANSWER_KEYS.has(key))
    .map((key): AnswerRow => ({name: key, label: key, value: values[key]}))

  const rows = [...fromQuiz, ...extras]

  return includeEmpty ? rows : rows.filter((row) => !isEmptyAnswer(row.value))
}

/** Las respuestas editables del lead: todo lo que no sea un dato de contacto. */
export function editableAnswers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  answers: Record<string, any> | null | undefined,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(answers || {}).filter(([key]) => !CONTACT_ANSWER_KEYS.has(key)),
  )
}
