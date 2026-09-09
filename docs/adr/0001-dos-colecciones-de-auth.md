# Tenant Users e Internal Users viven en colecciones separadas

Los clientes (Tenant Users) y el equipo de Notoriovs (Internal Users) se
autentican contra **dos colecciones auth distintas**, no contra una sola
colección `users` con un campo `role`. La colección de Tenant Users tiene el
panel de Payload cerrado por construcción (`access.admin: () => false`), no por
un condicional de rol: `canAccessAdmin` llama esa función en cuanto el token
viene de esa colección, así que es la única puerta y está clavada en falso.

La alternativa de una sola colección era más barata (un solo flujo de
recuperación, un solo modelo mental), pero deja el acceso al panel de Payload
dependiendo de que un condicional de rol nunca falle. Con cientos de tenants,
un bug de permisos ahí expone datos de todos los clientes a la vez, y ese es
el peor resultado posible del sistema. Separar las colecciones convierte "un
cliente no puede entrar al admin" de una regla en runtime a una propiedad
estructural.

## Consecuencias

- La colección de Tenant Users **sí** es visible en el nav del admin, aunque
  la redacción original de este ADR hablara también de `admin.hidden`: un
  Internal User tiene que poder dar de alta a los usuarios de un cliente desde
  el panel, y esconder la colección solo la habría movido a una URL que hay
  que saberse de memoria. Esconderla nunca fue lo que cerraba el panel.
- El flujo de recuperación de contraseña se implementa dos veces (en Payload
  son pocas líneas por colección).
- Cada colección puede tener su propia política de sesión, rate limiting y,
  a futuro, 2FA, sin negociar una con la otra.
- `userHasAccessToAllTenants: () => true` en el plugin multi-tenant deja de
  ser válido en el momento en que exista el rol `account-manager` con scope
  de tenants.
