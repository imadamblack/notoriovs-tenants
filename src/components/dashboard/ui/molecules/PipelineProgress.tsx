type PipelineProgressProps = {
  steps: number
  currentIndex: number
}

export default function PipelineProgress({ steps, currentIndex }: PipelineProgressProps) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: steps }).map((_, idx) => (
        <span
          key={idx}
          className={`h-4 flex-1 ${idx <= currentIndex ? 'bg-brand-3' : 'bg-neutral-700'} ${
            idx === 0 ? 'rounded-l-full' : ''
          } ${idx === steps - 1 ? 'rounded-r-full' : ''}`}
        />
      ))}
    </div>
  )
}
