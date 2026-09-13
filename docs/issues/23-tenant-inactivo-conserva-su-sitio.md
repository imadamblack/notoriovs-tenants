# 23: Un Tenant inactivo conserva su landing y su quiz

**Ola:** 0 — va primero, es riesgo vivo

**What to build:** Hoy marcar un Tenant como inactivo le da 404 a su landing y a
su quiz: se le tira el tráfico de los anuncios que tiene corriendo y se le quema
el presupuesto sin que se entere. `active` pasa a significar lo que ya dice el
glosario —suscripción, no publicación—: apaga dashboard y notificaciones, y deja
el sitio público en pie capturando Leads.

Es un recorte de 21, adelantado: 21 está bloqueado por 09 y 12, y el riesgo
existe hoy con solo destildar la casilla en el panel. Aquí no se toca Stripe ni
webhooks, solo la semántica del campo que ya existe.

**Blocked by:** None (can start immediately)

**Status:** hecho y verificado en `dev`, plataforma y n8n. Falta desplegar.

- [x] Un Tenant inactivo sigue sirviendo landing, quiz, gracias, no elegible y aviso de privacidad
- [x] Un Tenant inactivo sigue capturando Leads desde su quiz
- [x] Sus Tenant Users no entran al Dashboard de Cliente
- [x] Qué proyecciones exigen un Tenant activo se declara en un solo lugar y se puede afirmar en un test, igual que ya se hace con los secretos
- [x] Desactivar y reactivar un Tenant refresca sus páginas cacheadas sin desplegar — ya lo hacía: el hook `afterChange` del Tenant invalida en toda edición

## Cómo quedó

El corte por `active` dejó de vivir en la query de todas las proyecciones y
pasó a declararse proyección por proyección, en
`ACTIVE_ONLY_TENANT_PROJECTIONS` (`src/utils/getTenant.ts`), al lado de
`PUBLIC_TENANT_PROJECTIONS`. Exigen un Tenant activo cuatro:

- `dashboardApi` — la autorización de **todas** las rutas
  `/api/tenant-dashboard/*` pasa por `resolveDashboardAuth`, así que cerrarla
  ahí las cierra todas de una.
- `dashboardQuiz` — exportación de leads a CSV y corrección de respuestas.
- `dashboardIdentity` — abrir sesión: login y reset de contraseña. Es una
  entrada nueva con los mismos campos que `identity` (solo el `id`); lo que
  las separa no son los campos sino la exigencia, porque `identity` la sigue
  usando el ingest de marketing reports, que no depende de la suscripción.
- `tenantMail` — los correos que dan acceso (invitación, recuperación).

Todo lo demás resuelve un Tenant inactivo igual que uno activo: las cinco
páginas públicas, `quizSubmit` (la captura de Leads), `conversionsApi` (el
pixel de esas páginas) y los dos ingests.

La página del dashboard es la excepción deliberada: su proyección (`dashboard`)
**no** exige Tenant activo, para que el corte lo haga `tenantHasDashboard` y el
cliente vea el aviso de "dashboard no disponible" en vez de un 404. Un 404 diría
que su sitio no existe, y su sitio sí existe: la landing sigue corriendo al
lado. `tenantHasDashboard` ahora responde dos condiciones —tener al menos un
Tenant User **y** estar activo—, que es donde la nota del issue pedía que
quedara.

`tests/int/tenantProjections.int.spec.ts` afirma las dos mitades: que ninguna
proyección del sitio público exija Tenant activo, y que las cuatro del
dashboard sí.

## Verificado

En local, el 2026-09-13, con un Tenant desactivado: las cinco páginas públicas
siguieron sirviendo, el quiz guardó su Lead y apareció en el Kanban, la página
del dashboard mostró "no disponible", el login respondió 404 y las rutas
`/api/tenant-dashboard/*` respondieron 401. Del lado de los eventos salió
**solo** `quiz.completed` —`lead.created` calló por `onlyWhenActive`, como debe—
y al reactivar el Tenant volvieron a salir los dos.

Revisado también el workflow de n8n, que era la duda abierta del issue: el aviso
de Lead nuevo cuelga de `lead.created` y no de `quiz.completed`, así que un
Tenant inactivo no manda WhatsApp. No hubo que tocar nada de ese lado.

## Notas

- **No agregar un campo nuevo aquí.** El glosario ya distingue dos ejes —el
  Tenant molde es "nunca activo **ni publicado**"— pero el interruptor de
  publicación no tiene quién lo use todavía: su primer consumidor real es 17
  ("los moldes no se sirven como sitio público"), y le toca a ese issue traerlo
  con su migración. Un booleano que nadie lee es peso muerto.
- **Consecuencia sobre 03.** El criterio "Desactivar un Tenant deja de servir su
  sitio" de 03 describía el bug, no el diseño. Al cerrar este issue hay que
  corregirlo ahí y en el ADR 0005.
- **Reduce 21.** Su criterio "la landing y el quiz de un Tenant inactivo siguen
  sirviéndose y capturando Leads" queda cubierto de antemano.
- **Los Avisos ya están cubiertos.** `lead.created` tiene
  `onlyWhenActive: true` en el catálogo de eventos y el emisor lo respeta
  (`src/events/tenantEvents.ts`, `deliveryDecision`), así que un Tenant inactivo
  ya no dispara el WhatsApp de Lead nuevo. Lo que **sí** sigue saliendo es
  `quiz.completed`, que lleva los mismos datos del Lead: si el workflow de n8n
  manda el aviso desde ese evento en vez de desde `lead.created`, el Tenant
  inactivo sigue notificando. **Revisado y sin cambios:** el aviso cuelga de
  `lead.created`, así que el Tenant inactivo no notifica (ver "Verificado").
- Hoy el filtro `active: { equals: true }` vive en `buildTenantQuery` y aplica a
  todas las proyecciones por igual; `tenantHasDashboard` lo repite aparte y ahí
  sí debe quedarse. `quizSubmit` es fácil de pasar por alto y es justo el que
  sostiene la captura de Leads.
