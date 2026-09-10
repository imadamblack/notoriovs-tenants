'use client'

import { useCallback, useEffect, useState } from 'react'
import Button from '@/components/dashboard/ui/atoms/Button'
import Input from '@/components/dashboard/ui/atoms/Input'
import Select from '@/components/dashboard/ui/atoms/Select'
import EmptyState from '@/components/dashboard/ui/atoms/EmptyState'
import SectionHeading from '@/components/dashboard/ui/atoms/SectionHeading'
import { TENANT_USER_ROLE_OPTIONS, type TenantUserRole } from '@/access/tenantUserPermissions'

// El equipo del cliente, administrado por su propio `owner`: aquí es donde
// deja de hacer falta que Notoriovs dé de alta a mano a cada persona.
//
// Este panel solo se pinta para quien tiene `users:manage`, pero eso es
// cortesía de la interfaz: las dos rutas que consume lo vuelven a comprobar
// contra la sesión del servidor.

type TeamMember = {
  id: string | number
  email: string
  role: TenantUserRole
  createdAt?: string
}

type TeamPanelProps = {
  /** Email de quien está viendo, para señalarse en la lista. */
  accountEmail: string
  onClose: () => void
}

const ROLE_LABELS: Record<TenantUserRole, string> = {
  owner: 'Propietario',
  member: 'Miembro',
}

export default function TeamPanel({ accountEmail, onClose }: TeamPanelProps) {
  const [members, setMembers] = useState<TeamMember[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<TenantUserRole>('member')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)

  const load = useCallback(async () => {
    setLoadError(false)
    try {
      const res = await fetch('/api/tenant-dashboard/users')
      if (!res.ok) {
        setLoadError(true)
        return
      }
      const data = await res.json()
      setMembers(data.users || [])
    } catch {
      setLoadError(true)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviting(true)
    setError(null)
    setSent(null)

    try {
      const res = await fetch('/api/tenant-dashboard/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error || 'No se pudo invitar')
        return
      }

      setSent(`Le mandamos la invitación a ${email}.`)
      setEmail('')
      load()
    } catch {
      setError('Error de conexión, intenta de nuevo')
    } finally {
      setInviting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[32rem] h-full bg-neutral-900 shadow-xl overflow-y-auto p-8 flex flex-col gap-6"
      >
        <div className="flex items-center justify-between gap-4">
          <SectionHeading>Usuarios</SectionHeading>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar">
            Cerrar
          </Button>
        </div>

        <form onSubmit={handleInvite} className="flex flex-col gap-3">
          <Input
            label="Invitar por correo"
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="persona@empresa.com"
            required
          />
          <Select label="Rol" value={role} onChange={(e) => setRole(e.target.value as TenantUserRole)}>
            {TENANT_USER_ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>

          {error && <p className="-ft-3 text-red-400">{error}</p>}
          {sent && <p className="-ft-3 text-neutral-300">{sent}</p>}

          <Button type="submit" variant="primary" disabled={inviting}>
            {inviting ? 'Mandando…' : 'Mandar invitación'}
          </Button>
          <p className="-ft-4 text-neutral-500">
            Recibe un correo para definir su contraseña. La invitación vence en 7 días.
          </p>
        </form>

        <div className="flex flex-col">
          {loadError && <EmptyState variant="error" message="No se pudo cargar el equipo. Reintentar" onRetry={load} />}
          {!loadError && members === null && <EmptyState variant="loading" />}
          {!loadError && members?.length === 0 && (
            <EmptyState variant="empty" message="Todavía no hay nadie más" />
          )}
          {members?.map((member) => (
            <div
              key={String(member.id)}
              className="flex items-center justify-between gap-4 py-3 border-b border-neutral-700"
            >
              <p className="-ft-3 text-neutral-200 break-all">
                {member.email}
                {member.email === accountEmail && <span className="text-neutral-500"> (tú)</span>}
              </p>
              <p className="-ft-4 text-neutral-400 shrink-0">{ROLE_LABELS[member.role]}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
