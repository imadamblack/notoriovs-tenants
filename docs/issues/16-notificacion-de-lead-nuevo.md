# 16: Aviso cuando entra un Lead

**What to build:** Cuando entra un Lead, el Tenant se entera de inmediato por
WhatsApp o correo, sin tener el dashboard abierto. La plataforma emite el evento
`lead.created` con el sobre del **ADR 0008** y n8n se encarga del envío.

**Blocked by:** 09 (roles y scope) — hecho

**Status:** IMPLEMENTADO en dev, **sin desplegar**. Ver "El día del
despliegue" al final.

- [x] Al crearse un Lead —por cualquiera de las cuatro puertas— sale un evento
      `lead.created` con el sobre del ADR 0008
- [x] El Aviso llega al contacto general del Tenant (`generalInfo.whatsapp` /
      `generalInfo.email`), y trae lo mínimo para actuar: nombre, contacto y
      con qué armar el enlace (el `subdomain` en el sobre y el `id` del Lead en
      `data`) — el enlace lo arma n8n, ver "Cómo quedó"
- [x] Un fallo al emitir nunca impide que el Lead se guarde, ni revierte nada
- [x] Un Tenant inactivo no emite el evento (la regla se cumple en el emisor,
      no en n8n)
- [x] El evento sale al `eventsWebhook` de ese Tenant, que viene lleno desde el
      alta; si alguien lo dejó vacío, no se emite y queda una línea en el log

## Lo que este issue ya no decide

El transporte está decidido en el **ADR 0008** y no se vuelve a abrir: un solo
tubo por Tenant (`eventsWebhook`, autogenerado al crear y editable), el sobre
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

## Cómo quedó

Todo el transporte vive en `src/events/tenantEvents.ts`: el catálogo de eventos,
el sobre y la entrega. El emisor de `lead.created` es el hook `afterChange` de
`src/collections/Leads.ts`, con `operation === 'create'`, que es lo que cubre
las cuatro puertas de una sola vez.

El sobre no trae un enlace al Lead armado: trae el `subdomain` del cliente y el
`id` del Lead, que es con lo que n8n arma
`https://{subdomain}.notoriovs.com/dashboard`. La plataforma no publica una URL
del dashboard en ningún lado, y ponerla en el sobre sería la primera copia que
se contradice el día que cambie.

El corte del ADR 0008 se hizo completo, porque el contrato viejo y el nuevo no
conviven: entró `eventsWebhook` (editable, autogenerado al crear) y salieron
`quizWebhook`, `optInWebhook` y la URL fija `{base}tenant-created`. Los otros dos eventos del catálogo —`quiz.completed` y
`tenant.created`— salen ya por el tubo nuevo. De paso queda resuelto el
**issue 33**: ningún `fetch` a n8n se espera dentro de una transacción.

Verificado con la app contra la base local, con un receptor de webhooks local a
la mano y con la base puesta en el estado exacto en que va a quedar producción
entre las dos migraciones —columnas viejas todavía ahí, `events_webhook` ya
puesta—, donde leer, escribir y editar un Tenant siguen funcionando y el código
nuevo ni ve las columnas viejas: un submit del quiz entrega los dos eventos con su sobre al tubo del
cliente; el alta de un cliente entrega `tenant.created` al tubo de plataforma;
con el `eventsWebhook` vacío queda la línea en el log y el Lead se guarda igual;
con el webhook muerto el submit contesta en 31 ms y el fallo queda en el log. El
alta autogenera el `eventsWebhook` del cliente y un guardado posterior ya no lo
reescribe.

## El día del despliegue

El esquema se mueve en **dos** migraciones, no en una, y la razón está en el
comentario de `20260912_035248_eventos_con_sobre.ts`: el build se niega a subir
código adelantado al esquema, así que la migración siempre se aplica ANTES de
que el código nuevo esté vivo. Durante esos minutos corre el código VIEJO contra
el esquema nuevo. Una migración que agrega, el código viejo ni la ve; una que
borra `quiz_webhook` lo tira, porque lo nombra en sus consultas.

**Paso 1 — n8n, antes de tocar nada más:**

- El workflow de cada cliente (9 hoy): enrutar por el campo `event` del sobre.
  **Esto no es opcional**: después del despliegue ese workflow recibe DOS POST
  por cada submit del quiz —`quiz.completed` y `lead.created`, a la misma URL—,
  así que uno que mande WhatsApp sin mirar `event` manda dos mensajes por lead.
- El workflow de alta: leer el sobre y **cambiar de ruta**, de `tenant-created` a
  `tenants-crm` (el tubo de plataforma).
- Si no quieres una ventana en la que el cuerpo y el workflow no coincidan, deja
  cada workflow aceptando los dos: si el cuerpo trae `event`, es el sobre; si no,
  es el formato viejo. Se borra la rama vieja después. Eso no es la convivencia
  que prohíbe la decisión 7 del ADR —esa es sobre nuestro código cargando dos
  contratos para siempre—, es tolerancia de un día del lado de ellos.

**Paso 2 — la migración que agrega:**

```
npm run prod -- npm run migrate
npm run prod -- npm run migrate:status
```

Rellena el `eventsWebhook` de los clientes que ya existen con la misma URL que
tenían en `quiz_webhook`; sin ese relleno se quedarían sin recibir un solo
aviso.

**Paso 3 — merge a main.** El build comprueba que la migración esté aplicada y
sale. A partir de aquí los avisos ya salen con el sobre.

**Paso 4 — confirmar en n8n** que cada cliente tiene su workflow escuchando en
la ruta de su `eventsWebhook`, y que el de plataforma escucha en `tenants-crm`.

**Paso 5 — la migración que borra: `20260912_194122_borrar_webhooks_viejos`.**
Ya está escrita y registrada; se aplica igual que la otra y en el mismo orden
—primero la base, después el merge—, aunque aquí el orden ya no protege nada:
ningún código vivo nombra esas columnas.

```
npm run prod -- npm run migrate
```

Está escrita a mano a propósito, y el archivo explica por qué: el snapshot
(`.json`) de la primera se generó desde la config, que ya no declara esos
campos, así que el generador cree que esas columnas no existen y nunca va a
proponer borrarlas. Tampoco trae `.json` propio, porque el estado al que lleva
la base es exactamente el que el snapshot de la primera ya describe.

En desarrollo esto pasa solo: el push del dev server borra esas columnas la
próxima vez que levantes el servidor, porque la config ya no las declara.

## El hueco de `tenant.created`, y cómo se cerró

Al implementarlo salió un problema que el ADR no había visto: `tenant.created`
no puede salir al `eventsWebhook` del cliente, porque ese evento es el que
**crea** esa ruta en n8n. El campo estaría lleno en nuestra base y vacío del otro
lado, y el cliente nacería sin aprovisionar.

Se resolvió partiendo el catálogo en dos tipos de evento, no haciéndole una
excepción a uno: los eventos **del Tenant** (le pasó algo al negocio del cliente)
salen a su `eventsWebhook`; los de **plataforma** (le pasó algo a nuestra cartera
de clientes) salen a `{EVENTS_WEBHOOK_BASE}tenants-crm`, uno solo para todos, y
se enrutan por `event` del otro lado igual que los del Tenant. El ADR 0008,
decisión 1, quedó reescrito con esa línea y con por qué contradice a su versión
anterior.

El tubo se llama por el tubo y no por el evento (`tenants-crm`, no
`tenant-created`) para que el día del issue 21 los eventos de suscripción entren
por ahí en vez de abrir una URL nueva.
