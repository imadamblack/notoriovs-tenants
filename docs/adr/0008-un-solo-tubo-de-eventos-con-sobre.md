# Los eventos salen con sobre, por el tubo de quien es el hecho

Hasta hoy cada integración saliente se inventó su convención. Este ADR fija una
sola, y la deja definida para los eventos que todavía no existen —empezando por
el aviso de Lead nuevo (issue 16)— sin tener que volver a abrir la discusión.

## Lo que había

Dos salidas vivas, más un campo muerto:

| Qué | A dónde | Cuerpo |
| --- | --- | --- |
| Alguien terminó el quiz | `quizWebhook`, autogenerado como `{N8N_WEBHOOK_BASE}{subdominio}` | `{tenant, subdomain, answers, leadId, submittedAt}` |
| Se dio de alta un cliente | `{N8N_WEBHOOK_BASE}tenant-created`, fija para todos | `{name, subdomain, whatsapp, email, quizWebhook, quizQuestions, createdAt}` |
| ~~Opt-in antes del quiz~~ | `optInWebhook` | **Nunca se dispara.** El campo existe en el Tenant y en el tipo de `getTenant`, pero ningún archivo lo lee. Es un campo huérfano, no una integración. |

Ninguna dice qué evento es —el que recibe lo deduce de la URL a la que llegó—,
ninguna tiene versión, y la de alta de cliente hace `await fetch(...)` dentro de
un hook de colección, o sea dentro de la transacción de Postgres. Un Lead entra
hoy por cuatro puertas y solo una de ellas avisa a alguien.

## Las decisiones

### 1. Dos tubos, y la línea entre ellos es de quién es el hecho

Hay **dos** destinos, y cuál le toca a un evento no lo decide la comodidad sino
a quién le pasó la cosa:

| Tipo de evento | Qué es | A dónde sale |
| --- | --- | --- |
| **Del Tenant** | Le pasó algo al negocio de ese cliente | Su `eventsWebhook` |
| **De plataforma** | Le pasó algo a nuestra cartera de clientes | `{EVENTS_WEBHOOK_BASE}tenants-crm`, uno solo para todos |

Dentro de cada tubo, el tipo de evento se distingue por un campo del cuerpo, no
por la URL: quien recibe tiene un solo nodo de entrada que enruta por `event`.
Eso vale para los dos, y por eso el tubo de plataforma se llama por el tubo
(`tenants-crm`) y no por un evento — si se llamara `tenant-created`, el segundo
evento de plataforma abriría una URL nueva y estaríamos otra vez en una URL por
evento, que es justo lo que este ADR no quiere.

**El `eventsWebhook` de cada Tenant nunca está vacío**: al dar de alta el Tenant
se llena solo con `{EVENTS_WEBHOOK_BASE}{subdomain}`, igual que hoy se llena
`quizWebhook`. La diferencia con `quizWebhook` es que éste **sí es editable**: el
valor autogenerado es un punto de partida, no una imposición.

Por qué los eventos del Tenant no salen a una URL de plataforma por evento:

- El consumidor no tiene por qué ser n8n. Una URL por evento, fija para todos,
  clava a n8n como *el* receptor del producto. Una URL por Tenant deja que un
  cliente apunte a su propio CRM sin que el contrato cambie — y eso es
  justamente lo que un campo de solo lectura cerraría, por eso es editable.
- Un workflow por evento igual tendría que ramificar por Tenant adentro para
  saber a qué WhatsApp notificar y con qué credenciales. La ramificación no se
  evita, solo se mueve.

**Y por qué entonces existe el tubo de plataforma.** Esta versión del ADR dice lo
contrario de la anterior, que no admitía ninguna URL común; se corrigió al
implementar el issue 16, antes de desplegar nada. El caso que la tumbó es
`tenant.created`:

- Ese evento es el que **crea** la infraestructura de un Tenant en n8n, incluida
  la ruta de su propio `eventsWebhook`. Mandarlo al tubo del cliente es mandarlo
  a una URL que todavía no escucha nadie: el campo está lleno en nuestra base y
  vacío del otro lado. El cliente nace sin aprovisionar y nada en la plataforma
  lo dice.
- Los dos argumentos de arriba no le aplican. Ningún cliente quiere que le
  avisen que lo dimos de alta —ese hecho es de nuestra cartera, no de su
  negocio—, así que no hay a quién dejarle apuntarlo a otro lado. Y el workflow
  que lo recibe es justamente el que **no** ramifica por Tenant: hace lo mismo
  para todos.

Ojo con lo que **no** es esto: no es un respaldo. Un respaldo sería una segunda
ruta por la que puede salir un evento cuando la primera falta, y eso sigue sin
existir — cada evento tiene exactamente una salida posible, la que dice su
renglón del catálogo. Tampoco trae una env var nueva: la base ya está en el
código.

Lo que esta línea compra, además de destrabar el alta, es que ya está contestado
dónde caen los eventos que todavía no existen. `tenant.activated` y
`tenant.deactivated` (issue 21) son de plataforma: son hechos de la relación
comercial con el cliente, no de su negocio, y el que los escucha es el mismo que
provisiona.

No se reutiliza `quizWebhook` para esto: es de solo lectura, se reescribe en
cada guardado y es el que consumen los workflows viejos, que se van (decisión 7).
`eventsWebhook` es un campo nuevo, y la constante con la base de las URLs de n8n
pasa a llamarse `EVENTS_WEBHOOK_BASE` (era `N8N_WEBHOOK_BASE`).

**Dos cosas que hay que saber, y que son el precio de autogenerar:**

- **La URL es adivinable desde el subdominio.** Quien la adivine puede
  inventarle eventos a ese cliente; lo que se vería es un WhatsApp anunciando un
  Lead que no existe. Es el mismo riesgo que ya se acepta hoy con `quizWebhook`,
  y la razón por la que se acepta está en la decisión 6 y en el ADR 0009.
- **Cambiar el subdominio de un Tenant no repunta el webhook.** A diferencia de
  `quizWebhook`, que se reescribe en cada guardado, aquí el valor se fija una
  vez al crear y después es del que edita. Renombrar un subdominio deja el
  `eventsWebhook` apuntando al workflow viejo: si n8n lo renombró también, hay
  que corregir el campo a mano. Es preferible a lo contrario —que se repunte
  solo a una URL que en n8n no existe y los avisos se pierdan en silencio— pero
  hay que acordarse.

### 2. Todos los eventos van en el mismo sobre

```json
{
  "id": "0f3b7c8e-…",
  "event": "lead.created",
  "version": 1,
  "occurredAt": "2026-09-11T18:04:22.117Z",
  "tenant": {
    "id": 12,
    "subdomain": "acme",
    "name": "Acme Dental",
    "whatsapp": "521234567890",
    "email": "mail@mail.com"
  },
  "data": { }
}
```

- `id` — único por evento. Es con lo que el consumidor descarta duplicados.
- `event` — nombre del catálogo de abajo. `recurso.hecho`, en pasado.
- `version` — versión del esquema de `data` de *ese* evento, no del sobre. El
  sobre no cambia. Subirla es la única forma de romper `data`.
- `tenant` — quién es el cliente y **a dónde avisarle**: `id`, `subdomain`,
  `name`, y el `whatsapp` y el `email` de su información general. Van en el
  sobre y no en `data` porque la respuesta a "¿a qué número mando esto?" es la
  misma para todos los eventos, y sin ellos el consumidor tendría que mantener
  su propia tabla de contactos por cliente: una copia que se desincroniza el día
  que alguien corrige el teléfono en el admin.
  Los cinco son datos del cliente, no credenciales, y la lista se acaba ahí:
  **nunca** viajan tokens, contraseñas, URLs de webhook ni nada del grupo
  `tracking`. El cuerpo de `tenant-created` de hoy manda `quizWebhook` adentro;
  eso se acaba. El sobre se arma con esos cinco campos enumerados, no con el doc
  del Tenant.
- `data` — los datos propios del evento.

**Quién recibe el Aviso es el contacto general del Tenant, uno solo.** No viaja
una lista de Tenant Users ni sus preferencias: eso metería la libreta de
direcciones del cliente en cada evento que sale, y es justo lo que la
enumeración de arriba evita. El cliente reparte el aviso adentro como quiera. Si
algún día se pide silenciar por persona, se agrega en `data` del evento que lo
necesite, no en el sobre.

**Un Tenant inactivo no emite eventos de Aviso.** La regla vive en el glosario
(`CONTEXT.md`: un Tenant inactivo conserva su landing y su quiz capturando
Leads, pero no recibe avisos) y se cumple **aquí**, en el emisor: si el Tenant
está inactivo, `lead.created` no sale. El Lead se guarda igual y el cliente lo
ve en su Kanban el día que vuelva. La alternativa —mandar `active: false` en el
sobre y que el consumidor se calle— dejaría una regla del dominio viviendo en un
workflow de n8n: no la ve nadie que lea este código, no se prueba, y se rompe el
día que alguien toque ese workflow.

El sobre existe para que agregar un evento no obligue a leer los otros, y para
que un consumidor pueda tener un solo nodo de entrada que enruta por `event`.

### 3. Catálogo de eventos

Tres, y son los tres que hoy tienen quién los espere:

| Evento | Cuándo | Tubo | `data` |
| --- | --- | --- | --- |
| `lead.created` | Nace un Lead, venga por donde venga, **si el Tenant está activo** | Tenant | El Lead |
| `quiz.completed` | Alguien termina el quiz | Tenant | El Lead |
| `tenant.created` | Se da de alta un cliente | Plataforma | `quizQuestions`, `createdAt` |

**Los dos eventos que hablan de un Lead mandan el mismo `data`**, campo por
campo: `id`, `name`, `phone`, `whatsapp`, `email`, `source`, `externalId`,
`stage`, `status`, `notes`, `utm`, `answers`, `createdAt`. Lo arma una sola
función (`leadEventData`), así que no es una coincidencia que haya que mantener.

La razón es del otro lado del tubo: los dos caen en la misma URL, y si cada uno
nombrara sus campos a su manera —`id` aquí, `leadId` allá— cada workflow
necesitaría dos mapeos para los mismos dos datos. Se enruta por `event` para
decidir qué hacer, no para saber dónde está el teléfono.

Un `quiz.completed` cuyo Lead no se pudo guardar manda los mismos campos: el
contacto sale de las respuestas, y va en nulo solo lo que de verdad no existe
sin un Lead guardado (`id`, `stage`, `status`, `createdAt`). La forma no cambia
porque el guardado haya fallado — y ese es justo el momento en que alguien tiene
que atender a mano, o sea el peor para mandar un cuerpo distinto.

`tenant.created` trae un `data` casi vacío a propósito: quién es el cliente y
cómo contactarlo ya viaja en el sobre de **todos** los eventos, y repetirlo
adentro sería la primera copia que se contradice. `data` es lo que el sobre no
dice.

Cuidado con el caso obvio: `whatsapp` y `email` son opcionales en el Tenant, así
que el sobre puede traerlos vacíos. Un cliente recién dado de alta al que
todavía no le capturaron el teléfono emite `lead.created` sin a dónde avisar.
Eso lo tiene que manejar el consumidor —ignorar la notificación y dejar rastro—,
no lo resuelve este contrato.

**Candidatos, cuando alguien los pida.** Agregar un evento es un renglón en esta
tabla y un `emit()`; no es un ADR nuevo mientras el sobre no cambie. Por eso no
se emiten hoy:

- **`lead.status_changed`**. Ningún issue lo pide. Un evento que nadie escucha
  es un contrato que hay que respetar sin que nadie lo use.
- **`tenant.activated` / `tenant.deactivated`**. Serían de plataforma
  (decisión 1). Nacen del issue 21 (Stripe), que no tiene fecha. Y si el 21 termina necesitando avisar *antes* de
  desactivar, va a querer decidir su propio evento: mejor que lo encuentre sin
  escribir que escrito y teniendo que honrarlo o romperlo.
- **`lead.stage_changed`**. Además de no tener consumidor, el Stage es el id
  interno de una etapa del Pipeline de *ese* Tenant: no significa nada para un
  consumidor genérico y obligaría a publicar el Pipeline en el evento para que
  se pudiera interpretar. Lo comparable entre Tenants es el Status.
- **"suscripción vencida"** (issue 21). "Vencida" es un hecho de facturación, y
  este sistema no lo conoce. Lo que sí conocería es que el Tenant quedó
  inactivo.

Un submit del quiz produce **dos** eventos: `quiz.completed` y `lead.created`.
No es redundancia: hoy, si el guardado del Lead falla, el quiz igual avisa a
n8n, y colapsarlos en uno perdería ese aviso. El que sirve para notificar al
cliente es `lead.created` —es el único que dispara las cuatro puertas—; el del
quiz es para lo que n8n ya hace con las respuestas.

**Que salgan los dos siempre es decisión, no descuido**, y se revisó al
implementar el issue 16: como los dos mandan el mismo `data`, se puede hacer que
la ruta del quiz emita **solo** cuando el guardado falló, y entonces sale un
único evento por submit. Se descartó por ahora: los workflows ya tienen que
enrutar por `event` de todos modos, y un evento que solo aparece cuando algo se
rompe es un camino que nadie ejerce hasta el día que importa. El precio de esta
decisión hay que tenerlo presente y es concreto: **un workflow que no enrute por
`event` manda dos mensajes por cada lead**, y como los cuerpos son idénticos,
nada más los distingue.

### 4. Qué evento produce cada puerta por la que entra un Lead

| Puerta | Evento(s) |
| --- | --- |
| `POST /api/quiz-submit` | `quiz.completed` + `lead.created` (`source: quiz`) |
| `POST /api/tenant-dashboard/leads` (alta a mano del cliente) | `lead.created` (`source: manual`) |
| `POST /api/leads/ingest` (n8n) | `lead.created` (`source: meta \| whatsapp \| import`) **solo cuando el resultado es `created`**. Un reintento que cae en `updated` por `externalId` no emite nada: la idempotencia de la ingesta no sirve de nada si el evento vuelve a salir. |
| Panel de Payload | `lead.created` con el `source` que se haya capturado |

Las cuatro se cubren con **un solo punto de emisión**: un hook `afterChange` de
la colección `leads`, con `operation === 'create'`. No hay que acordarse de
emitir en cada ruta nueva, y el panel de Payload —que no pasa por ninguna ruta
nuestra— queda cubierto gratis. `quiz.completed` sí se emite desde su ruta,
porque no es un hecho de ninguna colección.

### 5. Se manda y no se espera: un POST, sin cola

El emisor hace **un `POST` y no espera la respuesta** (`waitUntil`, que este
despliegue tiene por ser Vercel Pro). Si falla, queda una línea en el log y se
acabó. No hay cola, no hay reintentos, no hay bitácora de entregas.

Lo que **no** se hace, y por qué, porque la versión anterior de este ADR decía
lo contrario: encolar el evento en la cola de jobs de Payload y entregarlo desde
un worker. Aquello suponía un contenedor Node de vida larga con `jobs.autoRun`,
y **producción es Vercel**: no hay proceso de vida larga que corra el runner, así
que el evento se habría quedado encolado sin quien lo entregue. Se podía
resolver con un Vercel Cron por minuto, pero entonces el precio de la cola es un
cron, una colección de jobs, una migración, una purga en el runbook y hasta un
minuto de retraso en el aviso.

Lo que se compra con eso es reintento y bitácora. Y lo que se pierde sin ellos,
dicho sin adorno: si n8n está caído dos minutos, ese aviso no se manda nunca.
**El Lead no se pierde** —está guardado y visible en el Kanban del cliente—; se
pierde la inmediatez. Para "avisa cuando entra un Lead", entre las dos puntas
nuestras, eso se acepta.

Lo que sí hay que respetar al implementarlo:

- **No esperar el `fetch` dentro del hook.** Un hook `afterChange` de una
  colección corre **dentro de la transacción de Postgres**: un `await fetch` a
  un n8n lento es una transacción abierta. Esto ya pasa hoy en el hook de alta
  de Tenants (`src/collections/Tenants/index.ts`), donde además el comentario
  dice "fire-and-forget: no bloquea" y sí bloquea. Es el issue 33.
- **Un fallo al emitir nunca revierte ni impide la escritura.** El error se
  atrapa y se registra; el Lead ya está guardado.
- Si un Tenant se quedó sin `eventsWebhook` —alguien lo borró editando— el
  evento no se manda y se deja una línea en el log. No es un error: es un
  sistema sin consumidor configurado. No debería pasar, porque el campo se llena
  solo al crear.

El día que la entrega importe de verdad —un cliente que factura contra ese
aviso, o n8n cayéndose seguido— la cola se agrega sin tocar nada de lo demás:
mismo sobre, mismo catálogo, otro transporte.

### 6. Los eventos no van autenticados, y es decisión, no olvido

Cada entrega lleva estos headers, y nada más:

```
Content-Type: application/json
X-Notoriovs-Event: lead.created
X-Notoriovs-Delivery: 0f3b7c8e-…
```

Ninguno de los dos es seguridad: `event` sirve para enrutar y `delivery` para
descartar duplicados. No hay firma, no hay token, no hay secreto que generar,
rotar ni guardar en ningún lado.

Las dos puntas del tubo son nuestras: nuestro servidor manda, nuestro n8n
recibe, sobre TLS. Es la regla 1 del ADR 0009 —dentro del perímetro no se
autentica dos veces—, y el `eventsWebhook` no viaja a ninguna página pública ni
a ninguna respuesta del dashboard, así que no hay tercero que pueda conocerlo.

Lo que se acepta a cambio, dicho sin adorno: quien llegue a conocer la URL de un
`eventsWebhook` puede inventarle eventos a ese cliente, y lo que se vería es un
WhatsApp anunciando un Lead que no existe. No escala más allá de eso —este tubo
solo sale, nunca escribe en la plataforma— y no es una regresión: la URL se
autogenera desde el subdominio (decisión 1), o sea que es tan adivinable como la
de hoy, ni más ni menos.

El supuesto que sostiene todo esto es **que el destino es nuestro**. El día que
un cliente apunte su `eventsWebhook` a un sistema que no controlamos, ese día
hay que autenticar. No pide un mecanismo de plataforma ni un ADR nuevo: es el
header que ese destino pida, en un campo de texto al lado de la URL, y como es
una credencial que presentamos hacia afuera va cifrada con `payload.encrypt()`,
no hasheada — un hash no se puede volver a leer, y para mandarlo hay que leerlo.
Mientras el destino sea nuestro, no se construye.

### 7. Compatibilidad: corte seco, sin convivencia

El contrato viejo y el nuevo **no conviven**. En el mismo despliegue entra
`eventsWebhook` con el sobre y salen del CÓDIGO `quizWebhook`, la URL fija
`{base}tenant-created` y `optInWebhook`, que ya no lo lee nadie.

Las dos columnas viejas se borran de la base **después**, en una segunda
migración. No es una convivencia de contratos: nada las lee desde el momento del
despliegue, son dos columnas muertas esperando el sepelio. Es por el orden en
que ocurre un despliegue —la migración se aplica antes de que el código nuevo
esté vivo, porque el build lo exige—, así que una migración que borre lo que el
código viejo todavía nombra lo tira durante esos minutos. Ver el comentario de
`20260912_035248_eventos_con_sobre.ts`.

El alta de cliente cambia de URL, no solo de cuerpo: pasa de
`{base}tenant-created` a `{base}tenants-crm`, el tubo de plataforma de la
decisión 1. Es el mismo workflow escuchando en otra ruta.

La convivencia existe para no romperle la integración a un tercero que no
controlamos. Aquí son dos workflows y son nuestros: se migran a leer el sobre el
mismo día. Una fase de transición sin fecha es permanente, y mientras dure, un
submit del quiz sale dos veces y el cliente recibe dos WhatsApps.

**Acción tuya el día del despliegue, antes de subir el código:** que los dos
workflows de n8n lean el sobre, y que el de alta escuche en `tenants-crm`.

## Qué tiene que hacer quien dé de alta un cliente nuevo en n8n

**Nada**, y no porque haya un workflow común que reciba todos los eventos de
todos, sino porque n8n **se provisiona solo**: el hook `afterChange` del alta
dispara `tenant.created` al tubo de plataforma, y del otro lado hay un workflow
que crea la infraestructura de ese Tenant en n8n —incluida la ruta en la que va
a escuchar su `eventsWebhook`, que se deduce del `subdomain` del sobre igual que
la deducimos nosotros—.

Que la URL del `eventsWebhook` no viaje en el sobre no es un olvido: ninguna URL
de webhook viaja adentro (decisión 2), y el que provisiona no la necesita porque
la sabe armar.

Solo hay trabajo en el caso excepcional: si el cliente quiere sus eventos en su
propio sistema, se edita `eventsWebhook` en Tenants → Webhooks.

**Y aquí está el evento que sí duele perder.** La decisión 5 acepta que un
evento no entregado se pierde, con el argumento de que lo perdido es un aviso y
no un dato. Para `tenant.created` no es así: si ese evento no llega, el Tenant
queda **sin infraestructura en n8n**, y entonces no se pierde un aviso — se
pierden *todos* los de ese cliente, para siempre, y nada en la plataforma lo
dice. El síntoma aparece semanas después como "a este cliente nunca le llegan
sus leads".

No se resuelve con una cola (ver decisión 5), se resuelve mirando: **acción tuya
al dar de alta un cliente**, confirmar en n8n que su infraestructura quedó
creada. Es una vez por cliente y es el momento en que ya estás ahí.

Del lado de n8n, cada workflow —el de cada Tenant y el de plataforma— tiene que
hacer dos cosas: descartar por `X-Notoriovs-Delivery` lo ya visto y enrutar por
`event`. Autenticación no tiene que verificar ninguna: el nodo Webhook se deja
sin autenticar a propósito (decisión 6). Y no hace falta que conteste rápido:
nadie está esperando su respuesta.

## Consecuencias

- Un campo nuevo en Tenants (`eventsWebhook`) con su migración, y **ninguna env
  var nueva**: el campo se autogenera al crear el Tenant y después es editable, y
  la URL del tubo de plataforma es una constante al lado de la base que ya
  estaba. El único requisito para emitir es tener a dónde, y siempre se tiene.
- **No** se enciende la cola de jobs de Payload. Nada que purgar en los
  runbooks, nada que configurar en el despliegue.
- El bloque `tenant` del sobre se arma con sus cinco campos enumerados, no
  esparciendo el doc. Es la misma regla que sostiene las páginas públicas: lo
  que sale del Tenant se enumera, no se filtra. Y como ahora va en **todos** los
  eventos, un descuido ahí ya no se escapa por un evento sino por los tres.
- El issue 16 ya no tiene nada que decidir sobre el transporte: emite
  `lead.created` —que es del Tenant, así que sale por el tubo del Tenant—, y lo
  consume el workflow de ese cliente. Lo que sí cambió es a quién
  avisa —el contacto general del Tenant, no cada Tenant User con su
  interruptor—, y ese issue quedó recortado en consecuencia.
- El issue 32 **no** hereda nada de aquí. Sigue siendo sobre las llaves de
  entrada, que son las que sí se hashean. Esta salida no usa secretos.

## Actualizaciones

### 2026-09-12 — Los avisos al propio usuario no salen por aquí (ADR 0011)

Las notificaciones push al Tenant User las manda la plataforma directo. **No es
una excepción a este ADR**: lo que este ADR gobierna es lo que sale hacia un
tercero, y un push es el producto hablándole a su propio usuario, igual que el
correo de recuperación de contraseña, que tampoco pasó nunca por aquí.

La razón por la que no puede pasar: una suscripción de push es una credencial de
sesión de un dispositivo de nuestro usuario, y el `eventsWebhook` es **editable
por el cliente** justo para que apunte a su CRM. Mandarlas ahí sería entregarle
las llaves de los dispositivos de su equipo a una URL que él controla.

`lead.created` no cambia: el mismo hecho dispara el webhook de siempre **y** el
push interno, y `onlyWhenActive` vale para los dos. El ADR 0011 deja escrita la
pregunta con la que se ubica un aviso nuevo: no "¿es saliente?", sino "¿quién lo
va a leer?".
