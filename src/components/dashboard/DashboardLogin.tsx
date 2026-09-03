'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import CenteredScreenCard from '@/components/dashboard/ui/molecules/CenteredScreenCard'
import LoginForm from '@/components/dashboard/ui/organisms/LoginForm'

type DashboardLoginProps = {
  subdomain: string
  companyName?: string | null
}

export default function DashboardLogin({ subdomain, companyName }: DashboardLoginProps) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/tenant-dashboard/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain, password }),
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

  return (
    <CenteredScreenCard>
      <LoginForm
        companyName={companyName}
        password={password}
        onPasswordChange={setPassword}
        error={error}
        loading={loading}
        onSubmit={handleSubmit}
      />
    </CenteredScreenCard>
  )
}
