'use client'

import { useCallback, useEffect, useState } from 'react'
import Button from '@/components/dashboard/ui/atoms/Button'
import EmptyState from '@/components/dashboard/ui/atoms/EmptyState'
import SectionHeading from '@/components/dashboard/ui/atoms/SectionHeading'
import { NOTIFICATION_TYPE_OPTIONS, type NotificationType } from '@/notifications/catalog'
import {
  detectPushSupport,
  registerServiceWorker,
  subscribeToPush,
  unsubscribeFromPush,
  type PushSupport,
} from '@/utils/dashboardPush'

// Activar/apagar Avisos push en ESTE dispositivo (issue 36). No es
// administración de equipo: cada Tenant User ve y controla solo su propio
// dispositivo, sin permiso especial — por eso no hay gate de rol en la
// entrada del menú que abre este panel (a diferencia de TeamPanel).
//
// La mitad del trabajo es la rama de iOS: Safari no deja ni pedir el
// permiso hasta que el Dashboard está agregado a la pantalla de inicio, así
// que ese estado tiene su propia pantalla, antes de llegar al interruptor.

type RemoteSubscription = { id: string | number; endpoint: string; notificationTypes: NotificationType[] }

type PanelProps = { onClose: () => void }

export default function NotificationSettingsPanel({ onClose }: PanelProps) {
  const [support, setSupport] = useState<PushSupport | null>(null)
  const [permission, setPermission] = useState<NotificationPermission | null>(null)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [browserSubscription, setBrowserSubscription] = useState<PushSubscription | null>(null)
  const [remote, setRemote] = useState<RemoteSubscription | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const detected = detectPushSupport()
    setSupport(detected)
    if (detected !== 'ready') return

    setPermission(Notification.permission)

    const reg = await registerServiceWorker().catch(() => null)
    setRegistration(reg)
    const sub = (await reg?.pushManager.getSubscription()) || null
    setBrowserSubscription(sub)

    if (sub) {
      const res = await fetch('/api/tenant-dashboard/push/subscriptions').catch(() => null)
      if (res?.ok) {
        const data = await res.json()
        const match = (data.subscriptions as RemoteSubscription[]).find((s) => s.endpoint === sub.endpoint)
        setRemote(match || null)
      }
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleEnable = async () => {
    setError(null)
    setBusy(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') {
        setError('Sin permiso del navegador no se pueden activar las notificaciones.')
        return
      }
      const reg = registration || (await registerServiceWorker())
      setRegistration(reg)
      const sub = await subscribeToPush(reg)
      setBrowserSubscription(sub)
      await refresh()
    } catch {
      setError('No se pudo activar. Intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  const handleDisable = async () => {
    if (!browserSubscription) return
    setBusy(true)
    try {
      await unsubscribeFromPush(browserSubscription)
      setBrowserSubscription(null)
      setRemote(null)
    } finally {
      setBusy(false)
    }
  }

  const handleToggleType = async (type: NotificationType, checked: boolean) => {
    if (!remote) return
    const current = new Set(remote.notificationTypes)
    if (checked) current.add(type)
    else current.delete(type)
    const notificationTypes = Array.from(current)

    setRemote({ ...remote, notificationTypes })
    await fetch('/api/tenant-dashboard/push/subscriptions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: remote.id, notificationTypes }),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[32rem] h-full bg-neutral-900 shadow-xl overflow-y-auto p-8 flex flex-col gap-6"
      >
        <div className="flex items-center justify-between gap-4">
          <SectionHeading>Notificaciones</SectionHeading>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar">
            Cerrar
          </Button>
        </div>

        {support === null && <EmptyState variant="loading" />}

        {support === 'unsupported' && (
          <p className="-ft-3 text-neutral-300">
            Este navegador no soporta notificaciones push. Prueba desde Chrome o desde el Dashboard instalado.
          </p>
        )}

        {support === 'ios-needs-install' && (
          <div className="flex flex-col gap-3">
            <p className="-ft-3 text-neutral-300">
              En iPhone, Safari solo permite activar notificaciones si el Dashboard está agregado a tu pantalla de
              inicio.
            </p>
            <ol className="-ft-3 text-neutral-300 list-decimal list-inside flex flex-col gap-2">
              <li>Toca el ícono de Compartir en la barra de Safari.</li>
              <li>Elige &quot;Agregar a inicio&quot;.</li>
              <li>Abre el Dashboard desde el ícono que aparece en tu pantalla de inicio.</li>
              <li>Vuelve a Notificaciones desde ahí para activarlas.</li>
            </ol>
          </div>
        )}

        {support === 'ready' && (
          <div className="flex flex-col gap-4">
            {!browserSubscription ? (
              <>
                <p className="-ft-3 text-neutral-300">
                  Recibe un aviso en este dispositivo cuando llegue un Lead nuevo. El aviso nunca incluye nombre,
                  teléfono ni correo del Lead.
                </p>
                {permission === 'denied' && (
                  <p className="-ft-4 text-red-400">
                    Bloqueaste las notificaciones para este sitio. Actívalas desde los ajustes del navegador.
                  </p>
                )}
                {error && <p className="-ft-4 text-red-400">{error}</p>}
                <Button variant="primary" onClick={handleEnable} disabled={busy || permission === 'denied'}>
                  {busy ? 'Activando…' : 'Activar notificaciones'}
                </Button>
              </>
            ) : (
              <>
                <p className="-ft-3 text-neutral-300">Notificaciones activas en este dispositivo.</p>
                <div className="flex flex-col gap-2">
                  {NOTIFICATION_TYPE_OPTIONS.map((option) => (
                    <label key={option.value} className="flex items-center gap-3 -ft-3 text-neutral-200">
                      <input
                        type="checkbox"
                        checked={remote?.notificationTypes.includes(option.value) ?? false}
                        onChange={(e) => handleToggleType(option.value, e.target.checked)}
                        disabled={!remote}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
                <Button variant="secondary" onClick={handleDisable} disabled={busy}>
                  Apagar en este dispositivo
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
