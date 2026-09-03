import type { ReactNode } from 'react'

type KeyValueRowProps = {
  label: string
  value: ReactNode
}

export default function KeyValueRow({ label, value }: KeyValueRowProps) {
  const isEmpty = value === undefined || value === null || value === ''
  return (
    <div className="-ft-2 flex justify-between gap-4 border-neutral-100 pt-2 pb-4">
      <span className="text-neutral-400">{label}</span>
      <span className="text-neutral-200 text-right">{isEmpty ? '—' : value}</span>
    </div>
  )
}
