# 35: Un Lead se puede abrir por URL

**Ola:** 1 (lanzamiento)

**What to build:** `{sub}.notoriovs.com/dashboard?lead=123` aterriza con la
tarjeta de ese Lead abierta. Hoy no existe: `selectedLead` es estado de React y
no se refleja en la dirección (`src/components/dashboard/DashboardApp.tsx`), así
que no hay forma de enlazar a un Lead desde ningún lado.

Es prerrequisito del **issue 36** (push notifications): un aviso que lleva el
gancho y no el dato solo sirve si la liga abre el Lead en un toque. También
tiene valor solo: un Tenant User le pasa un Lead a un compañero pegando un link.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Abrir un Lead refleja su id en la URL, y recargar esa URL vuelve a abrirlo
- [x] La URL abre el Lead aunque no esté en la vista o el filtro que se carga por defecto
- [x] Cerrar el detalle limpia la URL, y el botón de atrás del navegador se comporta como se espera
- [x] Un Lead de **otro** Tenant no se abre: la resolución pasa por el Tenant del host, igual que todo `/api/tenant-dashboard/*` (ADR 0007)
- [x] Un Lead que ya no existe o fue borrado explica qué pasó, no deja la pantalla en blanco
- [x] Sin sesión, el destino se guarda: el login devuelve **al Lead**, no al tablero

## Lo que muerde

- **El Lead puede no estar cargado.** El Kanban trae las tarjetas de sus
  columnas paginadas; el Lead del link puede estar fuera de lo que se pidió. Hay
  que poder traer uno por id, no confiar en que ya venía en la lista.
- **El retorno tras el login.** Es lo que hace que la liga sea "un toque" o dos.
  La sesión dura 30 días (`TenantUsers.tokenExpiration`), así que el caso normal
  ni pasa por aquí — pero el que sí pasa es justo el usuario nuevo al que le
  llega su primer aviso.
- **El aislamiento.** Un id de Lead es un número adivinable. Cae en una de las
  tres áreas que este repo sí prueba (CLAUDE.md, aislamiento entre tenants):
  como mínimo, un id de otro Tenant en el host propio no abre nada.

## Cómo quedó

- **Traer un Lead suelto:** `GET /api/tenant-dashboard/leads/[id]`
  (`src/app/api/tenant-dashboard/leads/[id]/route.ts`), nuevo. Reusa
  `findLeadOfTenant` — antes vivía copiado dentro de `leads/route.ts`, ahora
  exportado desde `leadDashboardFilters.ts` — para que el mismo id de otro
  tenant se rechace igual (404) que en el PATCH/DELETE que ya existían.
- **La URL no la mueve el router de Next.** `DashboardApp` es parte de una
  página `force-dynamic`; con `router.push`/`replace` cada apertura o cierre
  de un Lead volvía a pedirle el árbol entero al servidor. Se usa la Web
  History API directamente (`history.pushState`/`replaceState` +
  un listener de `popstate` para el botón atrás), y `?lead=` en la URL es la
  fuente de verdad de "hay un Lead abierto".
- **El retorno tras el login salió gratis.** `DashboardLogin` nunca navega —
  hace `router.refresh()` sobre la misma URL — así que `?lead=123` sigue en la
  barra de direcciones durante todo el login y `DashboardApp` lo recoge al
  montar. No hizo falta un `returnTo` explícito.
- **Bug encontrado en el camino:** borrar (o cerrar) un Lead que se había
  abierto con `history.pushState` dependía de que `history.back()` disparara
  su `popstate` para limpiar `leadIdParam`; mientras tanto, el efecto que
  sincroniza la URL veía `selectedLead` ya en `null` con `leadIdParam` todavía
  apuntando al Lead recién cerrado, y disparaba un fetch de más — que si el
  cierre fue por un borrado, contestaba 404 y reabría el panel como "ya no
  existe" justo después de cerrado. `closeLead` ahora limpia `leadIdParam` de
  forma síncrona y descarta cualquier fetch en curso, sin esperar al evento.
- Verificado a mano contra la base de dev (`ntrs`): abrir/recargar/cerrar,
  botón atrás, id de otro tenant, id borrado, y login sin sesión con
  `?lead=` en la URL.
