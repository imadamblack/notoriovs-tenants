import type { FormEvent } from 'react'
import Input from '@/components/dashboard/ui/atoms/Input'
import Button from '@/components/dashboard/ui/atoms/Button'
import BrandHeading from '@/components/dashboard/ui/molecules/BrandHeading'

type LoginFormProps = {
  companyName?: string | null
  email: string
  onEmailChange: (value: string) => void
  password: string
  onPasswordChange: (value: string) => void
  error: string | null
  loading: boolean
  onSubmit: (e: FormEvent) => void
  /** Cambia a la pantalla que pide el enlace de recuperación. */
  onForgotPassword: () => void
}

export default function LoginForm({
  companyName,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  error,
  loading,
  onSubmit,
  onForgotPassword,
}: LoginFormProps) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <BrandHeading companyName={companyName} />

      <Input
        label="Email"
        type="email"
        name="email"
        autoComplete="username"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
        required
        autoFocus
      />

      <Input
        label="Contraseña"
        type="password"
        name="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => onPasswordChange(e.target.value)}
        required
      />

      {error && <p className="-ft-3 text-red-400">{error}</p>}

      <Button type="submit" variant="primary" disabled={loading} className="mt-2">
        {loading ? 'Entrando…' : 'Entrar'}
      </Button>

      {/* `type="button"` a propósito: dentro de un <form>, un botón sin tipo
          envía el formulario. */}
      <button
        type="button"
        onClick={onForgotPassword}
        className="bg-transparent -ft-4 text-neutral-400 underline self-start"
      >
        ¿Olvidaste tu contraseña?
      </button>
    </form>
  )
}
