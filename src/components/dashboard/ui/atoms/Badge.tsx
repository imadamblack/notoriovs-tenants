export type BadgeTone = 'success' | 'danger' | 'neutral' | 'urgent-1' | 'urgent-2' | 'urgent-3'
export type BadgeSize = 'sm' | 'lg'

type BadgeProps = {
  label: string
  tone?: BadgeTone
  size?: BadgeSize
  className?: string
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  success: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30',
  danger: 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30',
  neutral: 'bg-neutral-600/20 text-neutral-400 ring-1 ring-neutral-600/30',
  'urgent-1': 'bg-red-600/90 text-white',
  'urgent-2': 'bg-red-700 text-white',
  'urgent-3': 'bg-red-900 text-red-100',
}

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: 'text-[10px] px-2 py-0.5',
  lg: 'text-[1rem] px-4',
}

export default function Badge({ label, tone = 'neutral', size = 'sm', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center justify-center font-semibold rounded-full ${TONE_CLASSES[tone]} ${SIZE_CLASSES[size]} ${className}`}
    >
      {label}
    </span>
  )
}
