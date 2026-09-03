import type { ReactNode } from 'react'

type SectionHeadingProps = {
  children: ReactNode
}

export default function SectionHeading({ children }: SectionHeadingProps) {
  return <h2 className="font-semibold text-brand-1 mb-3">{children}</h2>
}
