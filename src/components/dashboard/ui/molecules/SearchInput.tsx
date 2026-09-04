import type { InputHTMLAttributes } from 'react'
import Input from '@/components/dashboard/ui/atoms/Input'
import IconSearch from '@/components/dashboard/ui/atoms/icons/IconSearch'

type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

export default function SearchInput({ className = '', ...props }: SearchInputProps) {
  return (
    <div className="relative w-full">
      <span className="absolute w-8 h-8 left-6 top-1/2 -translate-y-1/2 text-neutral-300">
        <IconSearch />
      </span>
      <Input type="text" className={`w-full !rounded-full pl-[4.2rem] pr-4 py-4 ft-0 ${className}`} {...props} />
    </div>
  )
}
