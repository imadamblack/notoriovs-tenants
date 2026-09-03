type SectionTabsOption<T extends string> = {
  value: T
  label: string
}

type SectionTabsProps<T extends string> = {
  value: T
  options: SectionTabsOption<T>[]
  onChange: (value: T) => void
  className?: string
}

export default function SectionTabs<T extends string>({ value, options, onChange, className = '' }: SectionTabsProps<T>) {
  return (
    <div className={`flex bg-neutral-800 rounded-full p-1 ${className}`}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`flex-1 rounded-full py-2 -ft-4 ${
            value === option.value ? 'bg-neutral-600 text-white' : 'bg-transparent text-neutral-400'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
