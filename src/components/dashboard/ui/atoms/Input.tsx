import type { InputHTMLAttributes } from 'react'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
}

export default function Input({ label, className = '', ...props }: InputProps) {
  const field = <input className={`min-h-[3rem] ${className}`} {...props} />

  if (!label) return field

  return (
    <label className="flex flex-col gap-1 -ft-3 text-neutral-200">
      {label}
      {field}
    </label>
  )
}
