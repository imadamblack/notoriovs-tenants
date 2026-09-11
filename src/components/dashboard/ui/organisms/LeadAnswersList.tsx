import type {QuizQuestion} from '@/components/dashboard/DashboardApp'
import KeyValueRow from '@/components/dashboard/ui/molecules/KeyValueRow'
import {answerRows, displayAnswer} from '@/components/dashboard/leadAnswersView'

type LeadAnswersListProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  answers: Record<string, any> | null | undefined
  questions: QuizQuestion[]
}

/** Las respuestas del quiz, de solo lectura. Se editan en el panel de edición. */
export default function LeadAnswersList({answers, questions}: LeadAnswersListProps) {
  const rows = answerRows(answers, questions, {includeEmpty: false})

  return (
    <div>
      <p className="-ft-2 font-semibold uppercase tracking-[0.08em] text-neutral-300 mb-3">Respuestas del quiz</p>
      <div className="flex flex-col gap-2">
        {rows.length === 0 ? (
          <p className="-ft-2 text-neutral-400">Sin respuestas adicionales.</p>
        ) : (
          rows.map((row) => (
            <KeyValueRow key={row.name} label={row.label} value={displayAnswer(row.question, row.value)} />
          ))
        )}
      </div>
    </div>
  )
}
