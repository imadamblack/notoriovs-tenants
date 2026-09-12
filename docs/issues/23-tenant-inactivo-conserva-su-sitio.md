# 23: Un Tenant inactivo conserva su landing y su quiz

**What to build:** Hoy marcar un Tenant como inactivo le da 404 a su landing y a
su quiz: se le tira el tráfico de los anuncios que tiene corriendo y se le quema
el presupuesto sin que se entere. `active` pasa a significar lo que ya dice el
glosario —suscripción, no publicación—: apaga dashboard y notificaciones, y deja
el sitio público en pie capturando Leads.

Es un recorte de 21, adelantado: 21 está bloqueado por 09 y 12, y el riesgo
existe hoy con solo destildar la casilla en el panel. Aquí no se toca Stripe ni
webhooks, solo la semántica del campo que ya existe.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Un Tenant inactivo sigue sirviendo landing, quiz, gracias, no elegible y aviso de privacidad
- [ ] Un Tenant inactivo sigue capturando Leads desde su quiz
- [ ] Sus Tenant Users no entran al Dashboard de Cliente
- [ ] Qué proyecciones exigen un Tenant activo se declara en un solo lugar y se puede afirmar en un test, igual que ya se hace con los secretos
- [ ] Desactivar y reactivar un Tenant refresca sus páginas cacheadas sin desplegar

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
- Hoy el filtro `active: { equals: true }` vive en `buildTenantQuery` y aplica a
  todas las proyecciones por igual; `tenantHasDashboard` lo repite aparte y ahí
  sí debe quedarse. `quizSubmit` es fácil de pasar por alto y es justo el que
  sostiene la captura de Leads.
