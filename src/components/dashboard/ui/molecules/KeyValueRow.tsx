import type { ReactNode } from 'react'

type KeyValueRowProps = {
  label: string
  value: ReactNode
}

export default function KeyValueRow({ label, value }: KeyValueRowProps) {
  const isEmpty = value === undefined || value === null || value === ''
  // La etiqueta y el valor se distinguen por tamaño y peso, no solo por
  // color: a la misma medida el ojo no sabe cuál de los dos es el dato.
  return (
    <div className="flex items-baseline justify-between gap-4 border-neutral-100 pt-2 pb-4">
      <span className="-ft-2 text-neutral-400 shrink-0">{label}</span>
      <span className="ft-0 font-medium text-neutral-100 text-right">{isEmpty ? '—' : value}</span>
    </div>
  )
}
