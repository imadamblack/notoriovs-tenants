# 20: Recomendaciones creativas mensuales

**Ola:** 2 (después de cobrar)

**What to build:** Cada mes, cada Tenant recibe una Recomendación creativa
generada automáticamente a partir de sus Marketing Reports y su Perfil de marca:
hooks, guiones y sugerencias para mejorar sus anuncios. Llega por correo y queda
disponible en el dashboard. Se publica sin revisión humana, pero su alcance está
acotado por diseño: nunca propone montos, presupuestos ni decisiones de inversión
(ver ADR 0003).

**Blocked by:** 18 (Perfil de marca), 19 (ingest diario de marketing)

**Status:** ready-for-agent

- [ ] Cada Tenant activo con datos del mes recibe una Recomendación
- [ ] La Recomendación se apoya en las métricas del mes y en el Perfil de marca del Tenant
- [ ] El output se limita a hooks, guiones y sugerencias creativas; no emite montos ni presupuestos
- [ ] Se muestra en el dashboard con un aviso visible de que fue generada automáticamente
- [ ] Se puede consultar el histórico por mes
- [ ] Un Tenant sin datos suficientes en el mes no recibe una Recomendación vacía o inventada
- [ ] Un Tenant inactivo no genera ni recibe Recomendaciones

## Por qué está en la Ola 2 y no en el lanzamiento

Decidido el 12/09/2026. Es el diferenciador del producto, pero una Recomendación
armada sobre dos semanas de datos es pobre, y la primera impresión de una función
de IA se cobra una sola vez. El lanzamiento a los clientes actuales se hace con
el Kanban y los KPIs terminados (issues 27, 19, 35, 36); esto sale cuando el
ingest diario lleve meses corriendo y el Perfil de marca del 18 esté capturado.

Con el 19 reescrito, el insumo mejora: una Recomendación mensual con datos
**diarios** ve la tendencia dentro del mes —qué semana se cayó el CTR, cuándo
subió el costo por Lead— y no una sola foto del mes. Lo que ya no va a ver es
alcance ni frecuencia, porque salieron del modelo (ver 19).
