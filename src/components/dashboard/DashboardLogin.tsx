'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
    <div className="min-h-screen flex items-center justify-center bg-brand-4 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-8 flex flex-col gap-4"
      >
        <div>
          <p className="text-sm uppercase tracking-wide text-neutral-400 mb-1">Dashboard de leads</p>
          <h1 className="ft-3 font-bold text-brand-1">{companyName}</h1>
        </div>

        <label className="flex flex-col gap-1 text-sm text-neutral-600">
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            required
            className="border border-neutral-300 rounded-lg px-3 py-2 text-base text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-3"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading || !password}
          className="!bg-brand-1 !text-white rounded-lg py-2 mt-2 disabled:opacity-50"
        >
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
