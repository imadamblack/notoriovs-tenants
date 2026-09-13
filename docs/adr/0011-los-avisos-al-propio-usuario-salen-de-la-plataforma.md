# Un aviso al propio usuario lo manda la plataforma, no el tubo de eventos

Las notificaciones push al Tenant User las envía la plataforma directo. No pasan
por el `eventsWebhook` del Tenant ni por ningún workflow de n8n.

Esto **no es una excepción al ADR 0008**: es que nunca estuvo dentro de su
alcance. El 0008 gobierna lo que sale **hacia un tercero** —nuestro n8n, o el
CRM del propio cliente—. Un push es el producto hablándole a su propio usuario,
igual que el correo de recuperación de contraseña, que tampoco pasa por ahí y
nadie lo llamó excepción.

## La razón dura

Una suscripción de push es el buzón de un navegador concreto de una persona
concreta, más las llaves con las que se firma el envío. Vive en nuestra base de
datos, junto al Tenant User. Mandarla por el tubo de eventos significa
exportarle credenciales de sesión de nuestros usuarios a un workflow que el
propio ADR 0008 dejó **editable por el cliente**, para que pueda apuntarlo a su
CRM. Un cliente que cambia esa URL no debería quedarse con las llaves de los
dispositivos de su equipo, ni con la capacidad de mandarles notificaciones.

La alternativa —un tubo aparte, solo para push— sería una URL por evento
disfrazada, que es justo lo que el 0008 no quiere.

## Dónde queda la línea

| El hecho le pasó a | Quién entrega | Por dónde |
| --- | --- | --- |
| El negocio del cliente, y lo consume un tercero | n8n o el CRM del cliente | `eventsWebhook` del Tenant (ADR 0008) |
| Nuestra cartera de clientes | n8n | tubo de plataforma (ADR 0008) |
| El usuario de nuestra aplicación, y lo consume él | la plataforma | directo: push, correo transaccional |

La pregunta para ubicar un aviso nuevo no es "¿es saliente?" sino **"¿quién lo
va a leer?"**. Si lo lee un sistema, va por el tubo. Si lo lee la persona que
tiene sesión en nuestro producto, lo manda el producto.

## Consecuencias

- `lead.created` dispara **dos** cosas desde el mismo hecho: el webhook al tubo
  del Tenant, como hasta hoy, y el push interno. El evento, su cuerpo y su
  versión no cambian.
- La regla `onlyWhenActive` del catálogo de eventos vale para las dos vías: un
  Tenant inactivo no manda push. La regla del dominio sigue viviendo en el
  emisor y no en un workflow.
- El push lleva el **gancho, no el dato** (ver CONTEXT.md, Aviso). El evento
  hacia n8n sí conserva los datos del Lead: son del cliente y su tubo es suyo.
  Recortar el mensaje es una decisión sobre el *mensaje*, no sobre el evento.
- La entrega del push tampoco está garantizada, igual que la de los demás
  Avisos. Un permiso revocado o los datos del navegador borrados matan la
  suscripción sin avisar, así que los errores de envío se usan para limpiarla,
  no para reintentar indefinidamente.
- Cada canal nuevo que le hable directo al usuario de la aplicación entra por
  aquí, no por el 0008, y no hace falta reabrir esta discusión para agregarlo.
