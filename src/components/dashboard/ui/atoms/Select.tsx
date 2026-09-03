import type { SelectHTMLAttributes } from 'react'

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string
}

export default function Select({ label, className = '', children, ...props }: SelectProps) {
  const field = (
    <select className={`min-h-[3rem] ${className}`} {...props}>
      {children}
    </select>
  )

  if (!label) return field

  return (
    <label className="flex flex-col gap-1 -ft-3 text-neutral-200">
      {label}
      {field}
    </label>
  )
}
