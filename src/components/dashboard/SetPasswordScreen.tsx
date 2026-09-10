'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Input from '@/components/dashboard/ui/atoms/Input'
import Button from '@/components/dashboard/ui/atoms/Button'
import BrandHeading from '@/components/dashboard/ui/molecules/BrandHeading'

type SetPasswordScreenProps = {
  subdomain: string
  companyName?: string | null
  token: string
}

/** El mismo mínimo que exige el servidor; aquí solo evita un viaje de ida y vuelta. */
const MIN_LENGTH = 8

export default function SetPasswordScreen({ subdomain, companyName, token }: SetPasswordScreenProps) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < MIN_LENGTH) {
      setError(`La contraseña debe tener al menos ${MIN_LENGTH} caracteres.`)
      return
    }
    if (password !== confirmation) {
      setError('Las dos contraseñas no coinciden.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/tenant-dashboard/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain, token, password }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'No se pudo cambiar la contraseña')
        return
      }

      // La ruta ya dejó la sesión abierta en la cookie: se entra directo al
      // dashboard, sin pedir de nuevo la contraseña que se acaba de escribir.
      // `replace` y no `push` para que el botón de atrás no regrese a un
      // enlace que ya se consumió.
      router.replace(`/dashboard`)
      router.refresh()
    } catch {
      setError('Error de conexión, intenta de nuevo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-neutral-950 px-4">
      <div className="reading-container">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <BrandHeading companyName={companyName} />

          {token ? (
            <>
              <p className="-ft-3 text-neutral-400">
                Elige la contraseña con la que vas a entrar de ahora en adelante.
              </p>

              <Input
                label="Contraseña nueva"
                type="password"
                name="password"
                autoComplete="new-password"
                minLength={MIN_LENGTH}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
              />

              <Input
                label="Repítela"
                type="password"
                name="password-confirmation"
                autoComplete="new-password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                required
              />

              {error && <p className="-ft-3 text-red-400">{error}</p>}

              <Button type="submit" variant="primary" disabled={loading} className="mt-2">
                {loading ? 'Guardando…' : 'Guardar y entrar'}
              </Button>
            </>
          ) : (
            <p className="-ft-3 text-red-400">
              A este enlace le falta el token. Ábrelo tal como llegó en el correo, sin recortarlo.
            </p>
          )}

          <a href="/dashboard" className="-ft-4 text-neutral-400 underline self-start">
            Ir a iniciar sesión
          </a>
        </form>
      </div>
    </div>
  )
}
