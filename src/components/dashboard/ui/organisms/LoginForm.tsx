import type { FormEvent } from 'react'
import Input from '@/components/dashboard/ui/atoms/Input'
import Button from '@/components/dashboard/ui/atoms/Button'
import AdminLogo from "@/components/AdminLogo";
import IconCross from "@/components/dashboard/ui/atoms/icons/IconCross";

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
      <div className="flex items-baseline relative">
        <h1 className="ft-4 font-bold text-neutral-100">{companyName}</h1>
        <span className="ft-4 inline-block w-[0.8em] h-[0.8em] mx-1 text-neutral-100">
          <IconCross />
        </span>
        <p className="ft-4 font-bold text-neutral-100">CRM</p>
        <div className="ml-2 w-12 h-12 self-center flex items-center">
          <AdminLogo color="--dashboard-color-text"/>
        </div>
      </div>

      <Input
        label="Contraseña"
        type="password"
        name="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => onPasswordChange(e.target.value)}
        autoFocus
        required
      />

      {error && <p className="-ft-3 text-red-400">{error}</p>}

      <Button type="submit" variant="primary" disabled={loading} className="mt-2">
        {loading ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  )
}
