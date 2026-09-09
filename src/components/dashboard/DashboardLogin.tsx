'use client'

import {useState} from 'react'
import {useRouter} from 'next/navigation'
import LoginForm from '@/components/dashboard/ui/organisms/LoginForm'
import ForgotPasswordForm from '@/components/dashboard/ui/organisms/ForgotPasswordForm'

type DashboardLoginProps = {
  subdomain: string
  companyName?: string | null
}

// La puerta del dashboard, con sus dos estados: entrar y pedir recuperación.
// Es una sola pantalla y no dos rutas porque el segundo estado es una salida
// del primero, y una ruta aparte perdería el nombre del cliente que ya está
// en pantalla.
export default function DashboardLogin({subdomain, companyName}: DashboardLoginProps) {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const switchMode = (next: 'login' | 'forgot') => {
    setMode(next)
    setError(null)
    setSent(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/tenant-dashboard/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({subdomain, email, password}),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'No se pudo iniciar sesión')
        return
      }

      router.refresh()
    } catch {
      setError('Error de conexión, intenta de nuevo')
    } finally {
      setLoading(false)
    }
  }

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/tenant-dashboard/forgot-password', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({subdomain, email}),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error || 'No se pudo mandar el correo')
        return
      }

      setSent(data.message || 'Si esa cuenta existe, te mandamos un correo.')
    } catch {
      setError('Error de conexión, intenta de nuevo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-neutral-950 px-4">
      <div className="reading-container">
        {mode === 'login' ? (
          <LoginForm
            companyName={companyName}
            email={email}
            onEmailChange={setEmail}
            password={password}
            onPasswordChange={setPassword}
            error={error}
            loading={loading}
            onSubmit={handleSubmit}
            onForgotPassword={() => switchMode('forgot')}
          />
        ) : (
          <ForgotPasswordForm
            companyName={companyName}
            email={email}
            onEmailChange={setEmail}
            sent={sent}
            error={error}
            loading={loading}
            onSubmit={handleForgot}
            onBack={() => switchMode('login')}
          />
        )}
      </div>
    </div>
  )
}
