'use client'

// Helpers del lado del cliente para el push del Dashboard (issue 36). Nada
// de esto corre en el servidor: pide permiso, registra el service worker y
// habla con /api/tenant-dashboard/push/subscriptions.

export type PushSupport = 'unsupported' | 'ios-needs-install' | 'ready'

/**
 * `ios-needs-install`: Safari de iPhone/iPad no deja ni pedir el permiso de
 * notificaciones hasta que el Dashboard está agregado a la pantalla de
 * inicio (`window.navigator.standalone`). No hay una API directa para "es
 * Safari, no instalado": es la comprobación estándar, aunque no elegante.
 */
export function detectPushSupport(): PushSupport {
  if (typeof window === 'undefined') return 'unsupported'
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'unsupported'
  }

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const isStandalone =
    ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone)) ||
    window.matchMedia('(display-mode: standalone)').matches

  if (isIos && !isStandalone) return 'ios-needs-install'
  return 'ready'
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register('/sw.js', { scope: '/dashboard' })
}

/** Conversión estándar de la VAPID public key (base64url) al formato que pide `applicationServerKey`. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64Safe)
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)))
}

export async function subscribeToPush(registration: ServiceWorkerRegistration): Promise<PushSubscription> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!publicKey) throw new Error('Falta NEXT_PUBLIC_VAPID_PUBLIC_KEY')

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  })

  const json = subscription.toJSON()
  const res = await fetch('/api/tenant-dashboard/push/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
      userAgent: navigator.userAgent,
    }),
  })
  if (!res.ok) {
    await subscription.unsubscribe()
    throw new Error('No se pudo guardar la suscripción')
  }

  return subscription
}

export async function unsubscribeFromPush(subscription: PushSubscription): Promise<void> {
  const endpoint = subscription.endpoint
  await subscription.unsubscribe()
  await fetch(`/api/tenant-dashboard/push/subscriptions?endpoint=${encodeURIComponent(endpoint)}`, {
    method: 'DELETE',
  })
}
