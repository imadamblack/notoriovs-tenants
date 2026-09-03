export type EmptyStateVariant = 'loading' | 'loading-more' | 'empty' | 'error'

type EmptyStateProps = {
  variant: EmptyStateVariant
  message?: string
  onRetry?: () => void
  className?: string
}

const DEFAULT_MESSAGES: Record<EmptyStateVariant, string> = {
  loading: 'Cargando…',
  'loading-more': 'Cargando más…',
  empty: 'Sin leads',
  error: 'Error al cargar. Reintentar',
}

export default function EmptyState({ variant, message, onRetry, className = '' }: EmptyStateProps) {
  const text = message ?? DEFAULT_MESSAGES[variant]

  if (variant === 'error') {
    return (
      <button onClick={onRetry} className={`bg-transparent text-red-400 -ft-4 text-center py-2 underline ${className}`}>
        {text}
      </button>
    )
  }

  return <p className={`-ft-4 text-neutral-600 text-center py-4 ${className}`}>{text}</p>
}
