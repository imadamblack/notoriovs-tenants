import type { ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'md' | 'sm' | 'icon'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--dashboard-color-primary)] text-[var(--dashboard-color-primary-contrast)]',
  secondary: 'bg-neutral-700 text-neutral-200',
  ghost: 'bg-transparent text-neutral-400 hover:text-neutral-200',
  danger: 'bg-red-600/90 text-white',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: 'px-4 py-2',
  sm: 'px-3 py-1.5 -ft-4',
  icon: 'w-11 h-11 p-0',
}

export default function Button({ variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    />
  )
}
