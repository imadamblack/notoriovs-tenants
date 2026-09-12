# 10: Correo transaccional, recuperación de contraseña e invitaciones

**What to build:** El sistema puede mandar correo. Con eso, un Tenant User que
olvidó su contraseña la recupera solo, y un `owner` invita a un compañero a su
Tenant sin que Notoriovs intervenga. Los correos salen del dominio de Notoriovs,
con el nombre del Tenant visible en el remitente.

**Blocked by:** 08 (Tenant Users con login real), 00 (cuenta de SendGrid verificada)

**Status:** IMPLEMENTADO en la rama `feat/10-correo-recuperacion-e-invitaciones` (2026-09-09). Falta el prerrequisito humano del 00: la llave `SENDGRID_API_KEY` y el remitente verificado. Sin ella el código no manda correo — lo imprime en la consola — así que la rama es segura de desplegar antes de que exista la cuenta.

- [x] Un Tenant User pide recuperar su contraseña, recibe el correo y la cambia
- [x] El enlace de recuperación expira y no se puede reusar
- [x] Pedir recuperación para un email inexistente no revela si esa cuenta existe
- [x] Un `owner` invita por email a un compañero, que define su contraseña y entra al Tenant correcto
- [x] Una invitación no puede usarse para entrar a un Tenant distinto al que la emitió
- [x] Los correos salen del dominio de Notoriovs con el nombre del Tenant en el remitente visible

## Notas de implementación

- **Un solo mecanismo para los dos flujos.** Recuperar contraseña e invitar
  usan el mismo `resetPasswordToken` de la colección de auth y aterrizan en la
  misma pantalla (`/dashboard/nueva-contrasena`). Payload ya trae lo que es
  fácil escribir mal: el token vence y se consume al usarse (deja la
  expiración en "ahora"). Lo único distinto es la vida del enlace: 2 horas
  recuperando, 7 días invitando. Por eso NO se declara
  `auth.forgotPassword.expiration` en la colección — ganaría sobre el valor
  que pasa cada llamada.
- **El invitado nace con una contraseña aleatoria** que nadie ve ni se
  comunica: la cuenta solo se abre canjeando el token del correo.
- **La URL del enlace se arma desde `ROOT_DOMAIN`, nunca desde el `Host`** de
  la petición (`src/utils/tenantUrl.ts`). Con el host del cliente, pedir la
  recuperación de una cuenta ajena con un `Host:` propio mandaría el token al
  atacante.
- **SendGrid por `fetch` a su API v3**, sin dependencias nuevas y sin SMTP:
  una sesión SMTP no sobrevive bien a una función serverless. Sin
  `SENDGRID_API_KEY` el adaptador no se monta y Payload imprime el correo en
  consola, que es lo que se quiere en local.
- **Remitente:** `"{Empresa del Tenant}" <no-reply@notoriovs.com>`. Dominio
  nuestro (un solo remitente verificado), nombre visible del cliente.
- **No hace falta migración:** `reset_password_token` y
  `reset_password_expiration` ya existían en `tenant_users` desde el 08.

## Lo que se verificó

Contra la base de desarrollo y el build de producción (`next start`), con
usuarios de prueba creados y borrados al final:

- recuperación de un correo inexistente: misma respuesta, sin correo;
- canje del enlace: abre sesión, y el segundo intento con el mismo enlace
  falla;
- la contraseña vieja deja de servir;
- un token del tenant A rechazado desde el subdominio del tenant B (probado
  con los dos flujos, recuperación e invitación);
- un `owner` invita y el invitado entra al tenant correcto con su rol;
- un `member` recibe 403 al invitar y al listar el equipo.

## Lo que queda fuera

- Cambiar el rol de alguien o removerlo del equipo desde el dashboard. El
  panel lista al equipo y agrega gente; quitar y degradar sigue siendo del
  admin de Payload hasta que se pida.
