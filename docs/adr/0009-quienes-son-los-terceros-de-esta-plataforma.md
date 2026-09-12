# Quiénes son los terceros de esta plataforma

Este ADR no decide nada nuevo: pone en un solo lugar el supuesto con el que ya
se decidieron el 0007 (no se construye la API v1) y el 0008 (los eventos salen
sin firmar), y que hasta hoy se volvía a argumentar desde cero en cada issue con
olor a seguridad. Existe para que la próxima vez se cite, no se rediscuta.

## Quién toca este sistema

**Dentro de nuestro control:**

- El **equipo de Notoriovs** en el panel de Payload, con su cuenta nominal
  (Internal User).
- **n8n**, que corre en nuestra infraestructura y es hoy el único cliente
  máquina. Nos escribe por los dos endpoints de ingesta y recibe lo que sale.
- La **base de datos** y el **hosting**, que son nuestros.

**Fuera de nuestro control, y son dos:**

- El **Tenant User**: el cliente dentro del Dashboard de Cliente de su propio
  Tenant. Es un tercero real, autenticado, y es la frontera que sí se defiende.
- El **público anónimo** que llena un quiz en la landing de un Tenant. Nadie lo
  autentica ni puede autenticarlo: es el producto.

## Las dos reglas que salen de ahí

1. **Dentro del perímetro no se autentica dos veces.** Entre nuestro servidor y
   nuestro n8n, sobre TLS, no se construye firma, token rotatorio ni secreto
   compartido "por si acaso". Lo que protege una credencial ahí es algo que ya
   es nuestro de los dos lados.
2. **La frontera que se defiende es Tenant contra Tenant.** El trabajo de
   seguridad de esta plataforma es que la sesión del cliente A nunca alcance un
   dato del cliente B. De ahí sale la regla del 0007 —el Tenant de una petición
   con credencial de Tenant se deriva del host, nunca de un parámetro—, la
   enumeración de campos en todo lo que sale del Tenant hacia una página
   pública, y dos de las tres áreas que este repo sí prueba (ver `CLAUDE.md`).

El corolario incómodo, dicho a propósito: **construir defensa de perímetro
interno tiene un costo y no compra nada**. Una API Key por Tenant sin un tercero
a quien dársela, un webhook firmado cuyas dos puntas son nuestras, o un segundo
factor entre nuestro propio servidor y nuestro propio n8n, son una colección,
una pantalla, una rotación y un ADR que mantener sin usuario. Mientras el
inventario de arriba no cambie, la respuesta por defecto a "¿y si le ponemos
autenticación a esto?" es **no**, y el que quiera el sí tiene que nombrar al
tercero.

## El hueco, nombrado y aceptado

`POST /api/quiz-submit` **no pide credencial y recibe el `subdomain` en el
cuerpo**. Cualquiera en internet puede meterle Leads inventados al Kanban de
cualquier cliente y —con el issue 16— hacerle sonar el WhatsApp. No es un
descuido: el quiz es la puerta por la que entra el negocio y tiene que ser
pública, igual que lo es el formulario de cualquier landing.

Se acepta. Lo que se acepta exactamente es **spam de Leads falsos**, no fuga de
datos: esa ruta solo escribe, escribe un Lead y nada más, y no devuelve nada del
Tenant. El costo de que pase es que el cliente ve basura en su Kanban y recibe
avisos de Leads que no existen.

Lo que lo despertaría, y entonces se pone rate limit por IP o un captcha en la
landing: que le pase a un cliente de verdad. Hasta hoy no ha pasado.

Que esto quede escrito es la mitad del punto de este ADR. Un documento que dice
"todos los terceros están bajo nuestro control" y calla la única puerta abierta
al mundo es peor que no tenerlo: es la frase que alguien cita dentro de un año
para justificar la siguiente.

## Qué haría falta para que este ADR deje de valer

Cualquiera de estas tres, y solo estas tres:

- Un **tercero integrándose** por API: un CRM del cliente, un partner, un
  cliente que quiere escribirnos desde su propio sistema. Ahí aparece la API Key
  por Tenant, que es el segundo tipo de Actor del 0007, y su Tenant sale del
  host igual que el de una sesión.
- Un **destino que no controlamos**: el día que un Tenant apunte su
  `eventsWebhook` a su propio sistema, el tubo saliente deja de tener las dos
  puntas nuestras y hay que autenticar (0008, decisión 6).
- **n8n dejando de ser nuestro**: si la automatización se mueve a un servicio de
  terceros o la opera alguien de fuera, las llaves de ingesta dejan de ser un
  trámite interno.
