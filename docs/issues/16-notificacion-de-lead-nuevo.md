# 16: Aviso cuando entra un Lead

**What to build:** Cuando entra un Lead, el Tenant se entera de inmediato por
WhatsApp o correo, sin tener el dashboard abierto. La plataforma emite el evento
`lead.created` con el sobre del **ADR 0008** y n8n se encarga del envío.

**Blocked by:** 09 (roles y scope) — hecho

**Status:** ready-for-agent

- [ ] Al crearse un Lead —por cualquiera de las cuatro puertas— sale un evento
      `lead.created` con el sobre del ADR 0008
- [ ] El Aviso llega al contacto general del Tenant (`generalInfo.whatsapp` /
      `generalInfo.email`), y trae lo mínimo para actuar: nombre, contacto y
      enlace directo al Lead
- [ ] Un fallo al emitir nunca impide que el Lead se guarde, ni revierte nada
- [ ] Un Tenant inactivo no emite el evento (la regla se cumple en el emisor,
      no en n8n)
- [ ] Un Tenant sin `eventsWebhook` sale por `EVENTS_WEBHOOK_URL`; sin ninguna
      de las dos, no se emite y queda una línea en el log

## Lo que este issue ya no decide

El transporte está decidido en el **ADR 0008** y no se vuelve a abrir: un solo
tubo por Tenant (`eventsWebhook`, con `EVENTS_WEBHOOK_URL` de default), el sobre
con `id`/`event`/`version`/`occurredAt`/`tenant`/`data`, un solo punto de
emisión en el hook `afterChange` de `leads`, un `POST` sin esperar la respuesta,
sin cola y sin reintentos.

## Por qué ya no hay interruptor por persona

El planteamiento original pedía notificar *a los Tenant Users* y que cada uno
pudiera apagarse sus avisos. Se recortó el 11/09/2026: el Aviso va al **contacto
general del Tenant**, uno solo, y quién lo lee adentro de la empresa es asunto
del cliente (ver `CONTEXT.md`, entrada *Aviso*).

La razón no es ahorro de trabajo: mandar la lista de destinatarios en el evento
significa meter la libreta de direcciones del cliente —nombres y teléfonos de
sus empleados— en cada mensaje que sale hacia n8n, que es justo lo que la
enumeración de campos del sobre existe para evitar. Y el interruptor por persona
no lo ha pedido ningún cliente todavía.

El día que se pida, se agrega en `data` del evento que lo necesite, no en el
sobre.

## Ojo con esto al implementarlo

El hook corre **dentro de la transacción de Postgres**, así que el `fetch` no se
espera (`waitUntil`). El mismo problema ya existe hoy en el hook de alta de
Tenants y se arregla en el **issue 33**; conviene hacer los dos con el mismo
criterio.
