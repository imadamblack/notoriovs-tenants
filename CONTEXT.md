# Contexto del dominio

Glosario canónico de este repo. Solo vocabulario: nada de decisiones de
implementación (esas viven en `docs/adr/`).

## Tenant

Un cliente de Notoriovs. Tiene un **subdominio** propio (`{subdomain}.notoriovs.com`)
donde vive su landing, su quiz y su dashboard. Es la unidad de aislamiento:
todo dato del sistema pertenece a exactamente un Tenant.

No confundir con los clientes *del* Tenant, que en este sistema son **Leads**.

Un Tenant puede estar **inactivo**: su suscripción venció o fue cancelada. Un
Tenant inactivo conserva su landing y su quiz **vivos y capturando Leads** —
apagarlos significaría tirarle la publicidad que tiene corriendo— pero pierde
todo lo demás: sus Tenant Users no pueden entrar al Dashboard de Cliente, no
se envían notificaciones de Leads nuevos, y no se generan ni entregan
Recomendaciones creativas ni reportes.

## Internal User

Persona del equipo de Notoriovs. Se autentica contra el panel de Payload
(`/admin`) y puede operar sobre varios Tenants.

## Tenant User

Persona del lado del cliente que entra al **Dashboard de Cliente** de su
Tenant. **Nunca** tiene acceso al panel de Payload. Es una población distinta
de los Internal Users, no un Internal User con menos permisos.

Cuando alguien dice "admin" hay que preguntar cuál: un Internal User con rol
elevado, o un Tenant User con rol elevado dentro de su propio Tenant. Son
cosas distintas.

## Lead

Persona que llenó el quiz de un Tenant (o que se capturó a mano). Pertenece a
un Tenant. Tiene dos atributos independientes que suelen confundirse:

- **Stage** — en qué **columna del Kanban** está el Lead ahora. Es configurable
  por Tenant (cada Tenant define su propio Pipeline), así que su valor es el id
  interno de una etapa del Pipeline de ese Tenant, no un texto compartido.
- **Status** — el **resultado** del Lead: abierto, ganado, perdido o
  descalificado. Es el mismo conjunto de cuatro valores para todos los Tenants,
  y por eso es lo único con lo que se puede comparar conversión entre Tenants.

Un Lead puede estar "ganado" (Status) sentado en cualquier Stage. Mover un Lead
de Stage puede *sugerir* un Status, pero no son el mismo dato.

## Pipeline

La lista ordenada de Stages que un Tenant definió para su Kanban. Vive en el
Tenant, no en el Lead.

## Marketing Report

Métricas de campañas de ads de un Tenant para un **Period**: un rango de fechas
con granularidad declarada (semanal o mensual).

Un Marketing Report mensual **no** es la suma de los semanales: `reach`,
`frequency`, `cpm` y `ctr` no son aditivos (una misma persona alcanzada en dos
semanas cuenta una vez al mes). Cada granularidad se ingesta por separado desde
la fuente.

## Dashboard de Cliente

La aplicación que ve un Tenant User en `{subdomain}.notoriovs.com/dashboard`:
Kanban de Leads, KPIs y (a futuro) recomendaciones. Es un producto distinto del
panel de Payload, aunque compartan base de datos.

## Actor

Quien hace una petición a la API del Tenant. Hay exactamente dos tipos: un
**Tenant User** con sesión de navegador, y una **API Key** (una máquina: n8n,
un CRM externo). Ambos entran por la misma puerta y ambos quedan resueltos a
un solo Tenant, que **siempre** se deriva del host de la petición y nunca de
un parámetro que mande el cliente.

## Recomendación creativa

Texto generado automáticamente cada mes para un Tenant a partir de sus
Marketing Reports. Su alcance está **acotado por diseño**: hooks, guiones y
sugerencias creativas para mejorar anuncios. Una Recomendación nunca propone
montos, presupuestos ni decisiones de inversión — ese terreno es de una
persona de Notoriovs, y solo en el plan de agencia.

## Plan

Fuera del alcance de este producto: los planes comerciales son un asunto de
negocio, no del sistema. Hoy **no existen** como concepto en el modelo de datos: todas las
personas con acceso a la plataforma ven exactamente lo mismo. El "plan de
agencia" del que se habla comercialmente es una **capa de servicio humano**
(creación de contenido y consultoría del equipo de Notoriovs), no un conjunto
de funcionalidades desbloqueables. Mientras eso siga así, no debe construirse
feature-gating por plan en el código.

## Perfil de marca

Descripción cualitativa de un Tenant —qué vende, a quién, dolores,
objeciones, tono, diferenciadores— que Notoriovs captura una sola vez al dar
de alta al cliente. Es el insumo que permite que una Recomendación creativa
hable del negocio real y no solo de métricas.

## Tenant molde

Un Tenant marcado como plantilla, nunca activo ni publicado, que existe para
ser clonado al dar de alta un cliente de esa vertical. Trae landing, quiz,
pipeline y Perfil de marca precargados.
