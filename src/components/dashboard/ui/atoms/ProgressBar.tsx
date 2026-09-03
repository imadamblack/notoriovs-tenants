type ProgressBarProps = {
  value: number
}

export default function ProgressBar({ value }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className="flex-1 h-3 bg-neutral-100 rounded-full overflow-hidden">
      <div className="h-full bg-brand-3" style={{ width: `${pct}%` }} />
    </div>
  )
}
