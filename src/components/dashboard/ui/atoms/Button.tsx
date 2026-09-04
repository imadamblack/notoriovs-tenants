import type { ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'glass'
export type ButtonSize = 'md' | 'sm' | 'icon'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--dashboard-color-primary)] text-[var(--dashboard-color-primary-contrast)]',
  secondary: 'bg-neutral-700 text-neutral-200',
  ghost:
    'rounded-full border border-transparent bg-transparent text-neutral-400 backdrop-blur-none backdrop-saturate-100 ' +
    'shadow-[inset_0_1px_0_0_rgba(255,255,255,0),0_8px_24px_-8px_rgba(0,0,0,0)] ' +
    'hover:text-neutral-200',
  danger: 'bg-red-600/90 text-white',
  glass:
    'relative isolate overflow-hidden rounded-full border border-white/20 bg-white/10 text-neutral-50 ' +
    'backdrop-blur-xl backdrop-saturate-150 ' +
    'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3),0_8px_24px_-8px_rgba(0,0,0,0.5)] ' +
    'hover:bg-white/[0.16] hover:border-white/30 active:bg-white/[0.22]',
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
