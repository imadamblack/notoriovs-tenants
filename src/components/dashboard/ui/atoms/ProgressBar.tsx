type ProgressBarProps = {
  value: number
}

export default function ProgressBar({ value }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    // El riel va en neutral-800 (no neutral-100): la barra vive dentro de una
    // tarjeta neutral-900 y un riel casi blanco pesaba más que el dato.
    <div className="flex-1 h-4 bg-neutral-800 rounded-full overflow-hidden">
      <div className="h-full bg-brand-3 rounded-full" style={{ width: `${pct}%` }} />
    </div>
  )
}
