import type { ReactNode } from 'react'

type CenteredScreenCardProps = {
  children: ReactNode
  maxWidth?: 'sm' | 'md'
}

const MAX_WIDTH_CLASSES: Record<'sm' | 'md', string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
}

export default function CenteredScreenCard({ children, maxWidth = 'sm' }: CenteredScreenCardProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 px-4">
      <div className={`w-full ${MAX_WIDTH_CLASSES[maxWidth]} bg-neutral-900 rounded-2xl shadow-sm p-8`}>
        {children}
      </div>
    </div>
  )
}
