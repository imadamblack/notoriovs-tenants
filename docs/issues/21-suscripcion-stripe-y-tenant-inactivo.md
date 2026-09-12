# 21: Suscripción de Stripe y Tenant inactivo

**What to build:** El estado de la suscripción de cada Tenant vive en el sistema
y lo dicta el proveedor de pagos por webhook, nunca lo que diga el navegador al
volver. Un `owner` gestiona su suscripción y la cancela desde el portal del
propio proveedor, sin que Notoriovs maneje datos de pago. Al vencer una
suscripción cancelada, el Tenant queda **inactivo**: se apagan dashboard,
notificaciones y reportes, pero su landing y su quiz **siguen vivos capturando
Leads**, porque apagarlos sería tirarle la publicidad que tiene corriendo.

**Blocked by:** 09 (roles y scope) — hecho

**Status:** ready-for-agent

- [ ] Cada Tenant guarda su identificador de cliente, su suscripción y su estado
- [ ] El webhook del proveedor es la única fuente de verdad del estado, y verifica su firma
- [ ] Un `owner` llega al portal del proveedor y puede cancelar, cambiar tarjeta y ver facturas
- [ ] Cancelar mantiene el acceso hasta el final del periodo pagado
- [ ] Al vencer, el Tenant queda inactivo: sus Tenant Users no entran al dashboard, no hay notificaciones y no se generan reportes ni Recomendaciones
- [ ] La landing y el quiz de un Tenant inactivo siguen sirviéndose y capturando Leads
- [ ] Reactivar el pago devuelve el acceso sin intervención manual
- [ ] Un `member` no ve nada de facturación
