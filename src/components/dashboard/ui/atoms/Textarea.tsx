import type { TextareaHTMLAttributes } from 'react'

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string
}

export default function Textarea({ label, className = '', ...props }: TextareaProps) {
  const field = <textarea className={`min-h-[3rem] ${className}`} {...props} />

  if (!label) return field

  return (
    <label className="flex flex-col gap-1 -ft-3 text-neutral-200">
      {label}
      {field}
    </label>
  )
}
