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

**Status:** ready-for-agent

- [ ] Abrir un Lead refleja su id en la URL, y recargar esa URL vuelve a abrirlo
- [ ] La URL abre el Lead aunque no esté en la vista o el filtro que se carga por defecto
- [ ] Cerrar el detalle limpia la URL, y el botón de atrás del navegador se comporta como se espera
- [ ] Un Lead de **otro** Tenant no se abre: la resolución pasa por el Tenant del host, igual que todo `/api/tenant-dashboard/*` (ADR 0007)
- [ ] Un Lead que ya no existe o fue borrado explica qué pasó, no deja la pantalla en blanco
- [ ] Sin sesión, el destino se guarda: el login devuelve **al Lead**, no al tablero

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
