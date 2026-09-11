import type {ChangeEvent} from 'react'
import type {QuizQuestion} from '@/components/dashboard/DashboardApp'
import Input from '@/components/dashboard/ui/atoms/Input'
import Select from '@/components/dashboard/ui/atoms/Select'
import {answerRows} from '@/components/dashboard/leadAnswersView'

type LeadAnswersFieldsProps = {
  answers: Record<string, unknown>
  questions: QuizQuestion[]
  onChange: (field: string, value: unknown) => void
}

const OPTION_TYPES = new Set(['radio', 'select', 'checkbox'])

/**
 * Las respuestas del quiz como campos del lead: se editan con el mismo
 * control con el que contestó el lead —un select si la pregunta era de
 * opciones— y se guardan con el "Guardar" del panel, igual que el teléfono o
 * la etapa. Que sea un select y no un texto libre es lo que evita que editar
 * invente una categoría que ningún reporte sabe contar (la API la rechaza de
 * todos modos, ver `normalizeAnswerValue`).
 *
 * Aquí sí se listan las preguntas sin contestar: son justo las que quien
 * atiende al lead puede llenar con lo que le dijo por teléfono.
 */
export default function LeadAnswersFields({answers, questions, onChange}: LeadAnswersFieldsProps) {
  const rows = answerRows(answers, questions, {includeEmpty: true})

  if (rows.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <p className="-ft-2 font-semibold uppercase tracking-[0.08em] text-neutral-300">Respuestas del quiz</p>

      {rows.map((row) => {
        const type = row.question?.type
        const options = row.question?.options || []
        const hasOptions = Boolean(type && OPTION_TYPES.has(type) && options.length)
        const multiple = type === 'checkbox'

        if (hasOptions && multiple) {
          const checked = Array.isArray(row.value) ? row.value.map(String) : row.value ? [String(row.value)] : []

          return (
            <fieldset key={row.name} className="flex flex-col gap-1">
              <legend className="-ft-3 text-neutral-200">{row.label}</legend>
              {options.map((option) => (
                <label key={option.value} className="flex items-center gap-2 -ft-3 text-neutral-200">
                  <input
                    type="checkbox"
                    checked={checked.includes(option.value)}
                    onChange={() =>
                      onChange(
                        row.name,
                        checked.includes(option.value)
                          ? checked.filter((item) => item !== option.value)
                          : [...checked, option.value],
                      )
                    }
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>
          )
        }

        if (hasOptions) {
          return (
            <Select
              key={row.name}
              label={row.label}
              value={row.value === null || row.value === undefined ? '' : String(row.value)}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(row.name, e.target.value)}
            >
              {/* Sin respuesta es una opción de verdad: una pregunta opcional
                  que el lead se saltó, o una respuesta que resultó no ser suya. */}
              <option value="">Sin respuesta</option>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )
        }

        return (
          <Input
            key={row.name}
            label={row.label}
            type={type === 'number' ? 'number' : 'text'}
            value={row.value === null || row.value === undefined ? '' : String(row.value)}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(row.name, e.target.value)}
          />
        )
      })}
    </div>
  )
}
