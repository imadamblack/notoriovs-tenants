# 08: Tenant Users con login real

**What to build:** Fase *expand* de la migración de autenticación. Aparece la
colección de Tenant Users, separada de los Internal Users y sin acceso al panel
de Payload por construcción (ver ADR 0001). Un Tenant User entra al Dashboard de
Cliente con su propio email y contraseña. La contraseña compartida por Tenant
**sigue funcionando en paralelo** para no romper nada mientras se completa la
migración.

**Blocked by:** None (can start immediately)

**Status:** DESPLEGADO el 2026-09-09. Verificado contra una base local desechable (dev y build de producción); en la base real las tablas las creó el push de dev y las dos migraciones quedaron selladas el 2026-09-08 (ver ADR 0006).

- [x] Existe una colección de Tenant Users con autenticación propia, cada uno perteneciente a un solo Tenant
- [x] Un Tenant User no puede entrar al panel de Payload por ninguna vía
- [x] Iniciar sesión con email y contraseña da acceso al dashboard del Tenant correcto
- [x] Un Tenant User no puede ver datos de otro Tenant, ni cambiando el subdominio ni llamando a los endpoints directo
- [x] La contraseña compartida sigue funcionando sin cambios
- [x] Un Internal User puede crear Tenant Users desde el panel
- [x] El logout deja de ser un icono suelto del nav y vive donde toque con la sesión de Tenant User (viene del 05)

## Notas de implementación

- La sesión de Tenant User es el JWT de Payload de la colección `tenant-users`
  (cookie `payload-token`, host-only en el subdominio del cliente). Se eligió
  sobre una cookie firmada propia porque se verifica contra el documento vivo
  del usuario en cada petición: borrar un Tenant User o cerrarle la sesión lo
  saca de inmediato.
- Dar sesión de Payload a los clientes obligó a cerrar tres puertas que hasta
  ahora bastaba con `Boolean(req.user)`: `leads`, `marketing-reports` y la
  lectura por REST de `tenants` (que devolvía `dashboardPassword` y el token
  de la CAPI de TODOS los clientes a cualquiera). Ahora usan
  `isInternalUser` (`src/access/isInternalUser.ts`).
- La contraseña compartida se retira tenant por tenant vaciando el campo
  `dashboardPassword` en el admin: eso cierra esa puerta sin tocar a los
  Tenant Users. Cuando no quede ninguno, se borran `src/utils/dashboardAuth.ts`,
  su rama en `resolveDashboardAuth` y el campo del login. **Ya ocurrió:** solo
  un tenant la usaba, y todo eso se retiró junto con el 09 (ver su epílogo).

## Lo que encontró la verificación

- **`auth.depth` faltante en TenantUsers, con fuga de secretos.** Con el valor
  por omisión (2), Payload resolvía `user.tenant` como el Tenant COMPLETO en
  cada petición autenticada, y el panel serializa el usuario dentro de la
  página: un Tenant User que hiciera `POST /api/tenant-users/login` (ruta que
  Payload expone sola) y luego abriera `/admin` en el host de su tenant recibía
  un 500 cuyo HTML traía `dashboardPassword` y el grupo `tracking` —o sea el
  token de la CAPI— de su propio tenant. Reproducido en dev y en `next build`
  + `next start`. Arreglado con `auth.depth: 0`, con test de regresión.
- **Queda abierto:** ese mismo `/admin` sigue devolviendo 500 (ya sin datos) en
  vez de redirigir al login, porque el `TenantSelectionProvider` del plugin
  multi-tenant lee `tenants` con `overrideAccess: false` dentro del layout y el
  `isInternalUser` de esa colección le lanza un Forbidden antes de que el panel
  alcance a redirigir. No es fuga; es un error feo y ruido en el monitoreo.
  La solución de fondo es dejar de servir el panel de Payload en los hosts de
  tenant (hoy el middleware deja pasar `/admin` en todos).
- **La migración se editó a mano** para volver idempotentes los dos ALTER de
  `tenants.lead_stuck_after_days` (`IF NOT EXISTS` / `IF EXISTS`): esa columna
  ya existe en la base real por push de dev, pero no en el snapshot de
  migraciones, así que el generador la incluyó. La columna NO sobra —es el
  corte de "lead estancado" del dashboard—; lo que sobraba era intentar
  crearla dos veces.
- **`email` es único a nivel global**, no por tenant (índice único de Payload).
  Dos clientes distintos no pueden tener un usuario con el mismo correo.
- ~~El FK `tenant_users.tenant_id` es `ON DELETE SET NULL` sobre una columna
  `NOT NULL`: borrar un Tenant que tenga usuarios va a fallar en la base.~~
  Resuelto: `Tenants.hooks.beforeDelete` borra antes a sus Tenant Users, en la
  misma transacción. Los Leads no se tocan.
- El 500 de `/admin` en el host de un tenant se movió al issue 28.
