type BoardScrollIndicatorProps = {
  count: number
  activeIndex: number
}

export default function BoardScrollIndicator({ count, activeIndex }: BoardScrollIndicatorProps) {
  if (count <= 1) return null
  return (
    <div className="md:hidden flex shrink-0">
      {Array.from({ length: count }).map((_, idx) => (
        <span key={idx} className={`h-1.5 flex-1 ${idx === activeIndex ? 'bg-brand-3' : 'bg-neutral-700'}`} />
      ))}
    </div>
  )
}
