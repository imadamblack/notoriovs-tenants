# 34: El login también deriva el Tenant del host

**What to build:** Las tres rutas pre-credencial del Dashboard de Cliente
—`login`, `forgot-password`, `reset-password`— dejan de recibir el `subdomain`
en el cuerpo y lo derivan del `Host`, como ya hacen todas las demás desde el
issue 12. Un host que no es de ningún Tenant rechaza el login en vez de dejar
una sesión válida sin destino.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

## Por qué

El ADR 0007 dejó vivas esas tres rutas con el `subdomain` en el cuerpo para no
cerrarle la puerta a una **entrada única de login**: una sola pantalla, en un
host compartido, donde el cliente se identifica y de ahí sale a su dashboard.

Esa pantalla no existe, no está en ningún issue y nadie la ha pedido. Es el
mismo razonamiento con el que el 0007 mató la API v1 —mientras no haya quien lo
pida, es mantenimiento sin usuario—, aplicado al revés.

Y no sale gratis. Dos costos, los dos reconocidos por el propio ADR:

- **La excepción se copia.** Mientras "el Tenant sale del host" tenga una
  excepción, el que escriba la siguiente ruta tiene de dónde copiar la forma
  equivocada.
- **La sesión sin destino.** Hoy, identificarse desde un host que no es de
  ningún Tenant (el del admin, el dominio raíz) responde `ok` y deja la cookie
  puesta, pero el dashboard no abre y la pantalla no explica nada.

Decidido el 11/09/2026; anotado en la sección de actualizaciones del ADR 0007.
Si algún día se quiere la entrada única, reabrir esto cuesta lo mismo que
cerrarlo hoy.

- [ ] `login`, `forgot-password` y `reset-password` derivan el Tenant del host
      y ya no leen `subdomain` del cuerpo
- [ ] Un host sin Tenant (el del panel, el dominio raíz) rechaza el login con un
      mensaje claro, y **no** deja cookie
- [ ] El cliente deja de mandar `subdomain` en esas tres llamadas
- [ ] El correo de recuperación sigue llegando con el enlace al host correcto
- [ ] La regla "el Tenant sale del host" queda sin excepciones en todo
      `/api/tenant-dashboard/*`

## Pruebas

Cae de lleno en **autorización del dashboard**, una de las tres áreas que este
repo sí prueba (`CLAUDE.md`). Como mínimo: login correcto desde el host del
Tenant entra; el mismo login desde un host sin Tenant no entra y no deja cookie;
un `subdomain` en el cuerpo se ignora y no cambia a qué Tenant se entra.

## Ojo en desarrollo

Igual que pasó con el issue 12: hay que entrar por `{sub}.localhost:3000`, no
por `localhost:3000`, o el login deja de funcionar en local.
