import type { ReactNode } from 'react'

type SectionHeadingProps = {
  children: ReactNode
}

export default function SectionHeading({ children }: SectionHeadingProps) {
  return <h2 className="ft-2 font-semibold text-neutral-100 mb-3">{children}</h2>
}
