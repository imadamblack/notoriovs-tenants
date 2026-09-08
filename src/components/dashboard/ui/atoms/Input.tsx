import type { InputHTMLAttributes, Ref } from 'react'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  // React 19 pasa `ref` como prop normal; solo hay que tiparlo para que el
  // spread de abajo lo lleve hasta el <input>.
  ref?: Ref<HTMLInputElement>
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
