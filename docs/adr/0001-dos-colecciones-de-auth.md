# Tenant Users e Internal Users viven en colecciones separadas

Los clientes (Tenant Users) y el equipo de Notoriovs (Internal Users) se
autentican contra **dos colecciones auth distintas**, no contra una sola
colección `users` con un campo `role`. La colección de Tenant Users tiene el
panel de Payload cerrado por construcción (`admin.hidden` + `access.admin`
en falso), no por un condicional de rol.

La alternativa de una sola colección era más barata (un solo flujo de
recuperación, un solo modelo mental), pero deja el acceso al panel de Payload
dependiendo de que un condicional de rol nunca falle. Con cientos de tenants,
un bug de permisos ahí expone datos de todos los clientes a la vez, y ese es
el peor resultado posible del sistema. Separar las colecciones convierte "un
cliente no puede entrar al admin" de una regla en runtime a una propiedad
estructural.

## Consecuencias

- El flujo de recuperación de contraseña se implementa dos veces (en Payload
  son pocas líneas por colección).
- Cada colección puede tener su propia política de sesión, rate limiting y,
  a futuro, 2FA, sin negociar una con la otra.
- `userHasAccessToAllTenants: () => true` en el plugin multi-tenant deja de
  ser válido en el momento en que exista el rol `account-manager` con scope
  de tenants.
