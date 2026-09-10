import type { FormEvent } from 'react'
import Input from '@/components/dashboard/ui/atoms/Input'
import Button from '@/components/dashboard/ui/atoms/Button'
import BrandHeading from '@/components/dashboard/ui/molecules/BrandHeading'

type ForgotPasswordFormProps = {
  companyName?: string | null
  email: string
  onEmailChange: (value: string) => void
  /**
   * El acuse de recibo. Es el MISMO exista o no la cuenta: la API contesta
   * igual a propósito, y la interfaz no puede delatar lo que el servidor se
   * guardó (ver la ruta /api/tenant-dashboard/forgot-password).
   */
  sent: string | null
  error: string | null
  loading: boolean
  onSubmit: (e: FormEvent) => void
  onBack: () => void
}

export default function ForgotPasswordForm({
  companyName,
  email,
  onEmailChange,
  sent,
  error,
  loading,
  onSubmit,
  onBack,
}: ForgotPasswordFormProps) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <BrandHeading companyName={companyName} />

      {sent ? (
        <p className="-ft-3 text-neutral-200">{sent}</p>
      ) : (
        <>
          <p className="-ft-3 text-neutral-400">
            Escribe el correo con el que entras y te mandamos un enlace para elegir una contraseña
            nueva.
          </p>

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

          {error && <p className="-ft-3 text-red-400">{error}</p>}

          <Button type="submit" variant="primary" disabled={loading} className="mt-2">
            {loading ? 'Mandando…' : 'Mandarme el enlace'}
          </Button>
        </>
      )}

      <button
        type="button"
        onClick={onBack}
        className="bg-transparent -ft-4 text-neutral-400 underline self-start"
      >
        Volver a iniciar sesión
      </button>
    </form>
  )
}
