# 36: Push notifications al Tenant User

**Ola:** 1 (lanzamiento)

**What to build:** Cuando entra un Lead, al Tenant User le llega una
notificación push en su teléfono, y al tocarla aterriza en ese Lead dentro del
Dashboard. El push **lleva el gancho, no el dato**: dice que hay un Lead nuevo y
de dónde vino, nunca el nombre ni el teléfono. El dato vive en el Dashboard, que
es donde el cliente tiene que aprender a entrar.

No reemplaza al WhatsApp: se suma. Apagar el WhatsApp cuando el push funcione es
una decisión de operación que se toma en n8n, fuera de este repo.

**Blocked by:** 35 (abrir un Lead por URL)

**Status:** ready-for-agent

- [ ] Un Tenant User activa las notificaciones desde el Dashboard y le llegan
- [ ] Tocar la notificación abre ese Lead en el Dashboard de su Tenant, en un toque
- [ ] El texto del push no incluye nombre, teléfono ni email del Lead
- [ ] Un Tenant **inactivo** no genera push, igual que no genera Avisos
- [ ] La suscripción es por usuario y por dispositivo, y se puede apagar por tipo de aviso
- [ ] Una suscripción muerta (permiso revocado, datos del navegador borrados) se
      limpia sola en vez de acumular errores de envío
- [ ] Las suscripciones de un Tenant no son visibles ni utilizables desde otro
- [ ] En iPhone hay una pantalla que enseña a instalar el Dashboard, distinta de la de Android

## El push sale de la plataforma, no del tubo de eventos

El ADR 0008 dice que toda integración saliente pasa por el `eventsWebhook` del
Tenant hacia n8n. El push **no entra ahí**, y no es una excepción: es que nunca
estuvo dentro. Lo que gobierna el 0008 es lo que sale **hacia terceros** —n8n,
el CRM del cliente—; un push es el producto hablándole a su propio usuario,
como el correo de recuperación de contraseña, que tampoco pasa por n8n.

La razón dura: las suscripciones son credenciales de sesión de tus usuarios y
viven en tu base de datos. Mandarlas a un workflow sería exportarlas. Ver el
**ADR 0011**.

`lead.created` y su cuerpo **no se tocan**. El mismo hecho dispara dos cosas: el
webhook al tubo del Tenant, como hoy, y el push interno. La regla
`onlyWhenActive` del catálogo de eventos vale igual para las dos.

## iPhone

En Android el push es un permiso y ya. En iPhone **no existe** salvo que el
usuario agregue el Dashboard a su pantalla de inicio desde Safari, y sin eso ni
siquiera se le puede pedir el permiso. Es restricción de Apple, no hay forma de
evitarla. La mayoría de los clientes de Notoriovs están en iPhone, así que la
pantalla que enseña a instalar **no es un extra**: es la mitad del issue.

Hoy no hay nada de PWA en el repo: ni manifest, ni service worker, ni librería
de envío. Se construye desde cero.

## Un solo tipo de aviso, con la puerta abierta

Arranca solo con "Lead nuevo". El catálogo de tipos existe desde el primer día
aunque tenga un renglón, para que el segundo no obligue a rehacer nada, y el
usuario apaga **por tipo**: si la única forma de callar algo es revocar el
permiso del navegador, se pierde el canal para siempre y no se recupera.

Candidatos que **no** entran ahora: resumen diario, Lead sin atender en X horas,
reporte del mes listo.

## Por qué, y qué lo justifica

El aviso por WhatsApp se manda hoy por dos vías y ninguna aguanta: la oficial
vía Twilio con plantilla aprobada falla por volumen, y la de respaldo
(Evolution API, no oficial) se bloquea por ser lo que es. La entrega real ronda
7 de cada 10. El push saca ese canal de la ecuación y quita la dependencia de
Meta para avisarle a un cliente de algo que pasó en su propia cuenta.

Y el gancho sin dato es lo que convierte el aviso en tráfico al producto en vez
de en un sustituto del producto: un mensaje que ya trae el nombre y el teléfono
le permite al cliente atender el Lead sin abrir el Dashboard nunca.
