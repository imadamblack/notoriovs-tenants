import KeyValueRow from '@/components/dashboard/ui/molecules/KeyValueRow'

type LeadAnswersListProps = {
  entries: [string, unknown][]
}

// Unifica las dos versiones que había (lectura y edición): ambas solo
// mostraban las respuestas, ninguna las dejaba editar.
export default function LeadAnswersList({ entries }: LeadAnswersListProps) {
  return (
    <div>
      <p className="-ft-3 font-semibold text-neutral-200 mb-2">Respuestas del quiz</p>
      <div className="flex flex-col gap-2 text-sm">
        {entries.length === 0 ? (
          <p className="text-neutral-400">Sin respuestas adicionales.</p>
        ) : (
          entries.map(([key, value]) => <KeyValueRow key={key} label={key} value={String(value)} />)
        )}
      </div>
    </div>
  )
}
