// Service worker del Dashboard (issue 36). Sin build step: Next no compila
// `public/`, así que esto es JS plano, sin imports ni TypeScript.
//
// Dos responsabilidades y nada más: mostrar el Aviso que llega por push, y
// que tocarlo abre el Lead en un toque usando el mismo `?lead={id}` que ya
// entiende DashboardApp (issue 35) — no hay wiring nuevo del lado del
// cliente, la URL basta.
//
// `skipWaiting`/`clients.claim`: sin esto, una corrección aquí se queda
// esperando a que se cierren TODAS las pestañas del Dashboard para activarse
// — el navegador instala la versión nueva pero no la pone a mandar hasta que
// no quede ninguna pestaña controlada por la vieja. Con esto, la próxima
// recarga ya la toma.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Notoriovs', {
      body: data.body || '',
      icon: '/icon-192.png',
      data: { url: data.url || '/dashboard' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL((event.notification.data && event.notification.data.url) || '/dashboard', self.location.origin)

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
      for (const client of clientList) {
        // No basta con "mismo origen": el quiz público (`/survey`) vive en el
        // mismo origen que el Dashboard, y si esa pestaña está abierta
        // aparece en `clientList` — sin filtrar por ruta, un push podía
        // navegar y enfocar el quiz en vez del Dashboard.
        if (new URL(client.url).pathname.startsWith('/dashboard') && 'focus' in client) {
          // `navigate` hay que esperarlo ANTES de `focus`: si no, `waitUntil`
          // se da por satisfecho con el `focus` (que resuelve casi de
          // inmediato) y el navegador puede matar el service worker a media
          // navegación — el clic cierra la notificación y no pasa nada más.
          if ('navigate' in client) await client.navigate(target.href)
          return client.focus()
        }
      }
      return clients.openWindow(target.href)
    }),
  )
})
