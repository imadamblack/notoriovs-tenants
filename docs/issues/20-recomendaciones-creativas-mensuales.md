# 20: Recomendaciones creativas mensuales

**What to build:** Cada mes, cada Tenant recibe una Recomendación creativa
generada automáticamente a partir de sus Marketing Reports y su Perfil de marca:
hooks, guiones y sugerencias para mejorar sus anuncios. Llega por correo y queda
disponible en el dashboard. Se publica sin revisión humana, pero su alcance está
acotado por diseño: nunca propone montos, presupuestos ni decisiones de inversión
(ver ADR 0003).

**Blocked by:** 18 (Perfil de marca), 19 (reportes mensuales)

**Status:** ready-for-agent

- [ ] Cada Tenant activo con datos del mes recibe una Recomendación
- [ ] La Recomendación se apoya en las métricas del mes y en el Perfil de marca del Tenant
- [ ] El output se limita a hooks, guiones y sugerencias creativas; no emite montos ni presupuestos
- [ ] Se muestra en el dashboard con un aviso visible de que fue generada automáticamente
- [ ] Se puede consultar el histórico por mes
- [ ] Un Tenant sin datos suficientes en el mes no recibe una Recomendación vacía o inventada
- [ ] Un Tenant inactivo no genera ni recibe Recomendaciones
