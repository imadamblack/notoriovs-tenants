import type { FormEvent } from 'react'
import Input from '@/components/dashboard/ui/atoms/Input'
import Button from '@/components/dashboard/ui/atoms/Button'

type LoginFormProps = {
  companyName?: string | null
  password: string
  onPasswordChange: (value: string) => void
  error: string | null
  loading: boolean
  onSubmit: (e: FormEvent) => void
}

export default function LoginForm({
  companyName,
  password,
  onPasswordChange,
  error,
  loading,
  onSubmit,
}: LoginFormProps) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-400 mb-1">Dashboard de leads</p>
        <h1 className="ft-3 font-bold text-neutral-100">{companyName}</h1>
      </div>

      <Input
        label="Contraseña"
        type="password"
        value={password}
        onChange={(e) => onPasswordChange(e.target.value)}
        autoFocus
        required
      />

      {error && <p className="-ft-3 text-red-400">{error}</p>}

      <Button type="submit" variant="primary" disabled={loading || !password} className="mt-2">
        {loading ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  )
}
