# 33: El aviso de alta de cliente mantiene abierta la transacción

**What to build:** Que el `fetch` a n8n del hook de alta de Tenants deje de
esperarse, para que un n8n lento no mantenga abierta una transacción de Postgres.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

## El problema

`src/collections/Tenants/index.ts`, hook `afterChange`:

```ts
// Fire-and-forget: no bloquea ni revierte la creación si el webhook falla.
await fetch(`${N8N_WEBHOOK_BASE}tenant-created`, { ... })
```

El comentario dice fire-and-forget y el código dice `await`. Lo de "no revierte"
sí es cierto —el error está atrapado—, pero **sí bloquea**: un hook `afterChange`
de una colección corre dentro de la transacción de Postgres del guardado, así
que mientras n8n no conteste, la transacción del alta sigue abierta. Si n8n
tarda o se cuelga, el alta del cliente se queda esperando con él.

Hoy duele poco porque dar de alta un Tenant es raro. Duele de verdad con el
issue 16, donde el mismo patrón corre en **cada Lead que entra**.

## Cómo se arregla

No esperar el `fetch`. Este despliegue es Vercel Pro, así que la forma correcta
es `waitUntil` (`@vercel/functions`): la respuesta se devuelve sin esperar y la
petición saliente sigue viva hasta terminar. Sin `waitUntil`, un `fetch` sin
`await` en serverless puede morir cuando la función se congela.

Es el mismo criterio que va a usar el emisor de eventos del ADR 0008, decisión 5.
Conviene resolver los dos con la misma pieza, para que no haya dos formas de
mandar un webhook en este repo.

- [ ] El alta de un Tenant no espera la respuesta de n8n
- [ ] Un n8n caído o lento no alarga ni revierte el guardado del Tenant
- [ ] El fallo sigue quedando en el log
- [ ] El comentario del hook dice lo que el código hace

## Pruebas

No cae en ninguna de las tres áreas que este repo prueba (`CLAUDE.md`). Se
verifica con la app: dar de alta un Tenant con `N8N_WEBHOOK_BASE` apuntando a
una URL que no contesta, y confirmar que el guardado vuelve igual de rápido.
