'use client'

import { useRef, type InputHTMLAttributes } from 'react'
import Input from '@/components/dashboard/ui/atoms/Input'
import IconSearch from '@/components/dashboard/ui/atoms/icons/IconSearch'
import IconCross from '@/components/dashboard/ui/atoms/icons/IconCross'

type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  /** Sin esto no se dibuja el botón de limpiar: quién es dueño del texto es
   *  el padre, así que él decide qué significa vaciarlo. */
  onClear?: () => void
}

export default function SearchInput({ className = '', onClear, value, ...props }: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const showClear = Boolean(onClear) && String(value ?? '') !== ''

  const handleClear = () => {
    onClear?.()
    // Limpiar no debe sacar al usuario del campo: sigue escribiendo ahí.
    inputRef.current?.focus()
  }

  return (
    <div className="relative w-full">
      <span className="absolute w-8 h-8 left-6 top-1/2 -translate-y-1/2 text-neutral-300">
        <IconSearch />
      </span>
      <Input
        ref={inputRef}
        type="text"
        value={value}
        className={`w-full !rounded-full pl-[4.2rem] ${showClear ? 'pr-[4.2rem]' : 'pr-4'} py-4 ft-0 ${className}`}
        {...props}
      />
      {showClear && (
        <button
          type="button"
          onClick={handleClear}
          title="Limpiar búsqueda"
          aria-label="Limpiar búsqueda"
          className="absolute right-5 top-1/2 -translate-y-1/2 w-8 h-8 p-0 rounded-full bg-transparent text-neutral-300 hover:text-neutral-100"
        >
          <IconCross />
        </button>
      )}
    </div>
  )
}
