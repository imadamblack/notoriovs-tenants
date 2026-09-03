import IconGrid from '@/components/dashboard/ui/atoms/icons/IconGrid'
import IconList from '@/components/dashboard/ui/atoms/icons/IconList'

export type BoardView = 'kanban' | 'list'

type ViewToggleProps = {
  value: BoardView
  onChange: (view: BoardView) => void
}

const OPTIONS = [
  { value: 'kanban' as const, label: 'Vista de tablero', Icon: IconGrid },
  { value: 'list' as const, label: 'Vista de lista', Icon: IconList },
]

export default function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center rounded-lg border border-neutral-600 overflow-hidden">
      {OPTIONS.map(({ value: optionValue, label, Icon }) => (
        <button
          key={optionValue}
          type="button"
          onClick={() => onChange(optionValue)}
          title={label}
          aria-label={label}
          aria-pressed={value === optionValue}
          className={`border-none rounded-none px-4 py-3 flex items-center ${
            value === optionValue ? 'bg-brand-3/60 text-white' : 'bg-neutral-900 text-neutral-400'
          }`}
        >
          <Icon />
        </button>
      ))}
    </div>
  )
}
