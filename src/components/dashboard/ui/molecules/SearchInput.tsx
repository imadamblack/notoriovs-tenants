import type { InputHTMLAttributes } from 'react'
import Input from '@/components/dashboard/ui/atoms/Input'
import IconSearch from '@/components/dashboard/ui/atoms/icons/IconSearch'

type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

export default function SearchInput({ className = '', ...props }: SearchInputProps) {
  return (
    <div className="relative w-full max-w-xs">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
        <IconSearch />
      </span>
      <Input type="text" className={`w-[20rem] pl-9 pr-3 -ft-3 ${className}`} {...props} />
    </div>
  )
}
