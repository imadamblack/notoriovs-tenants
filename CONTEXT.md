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
(`/admin`) y puede operar sobre varios Tenants. Tiene uno de dos roles:

- **Superadmin** — todos los Tenants. Es quien da de alta y de baja clientes, y
  quien reparte roles y asignaciones.
- **Account Manager** — solo los Tenants que tiene **asignados**. Ve y edita
  esos clientes, sus Leads, sus Marketing Reports y sus Tenant Users, y nada
  más. No borra Tenants.

## Tenant User

Persona del lado del cliente que entra al **Dashboard de Cliente** de su
Tenant. **Nunca** tiene acceso al panel de Payload. Es una población distinta
de los Internal Users, no un Internal User con menos permisos.

Tiene uno de dos roles, que valen **solo dentro de su Tenant**:

- **Owner** — todo lo de su empresa: además de los Leads y los KPIs, gestiona a
  los usuarios de su Tenant y su facturación, y puede borrar Leads.
- **Member** — trabaja los Leads (incluido marcarlos como descalificados) y ve
  los KPIs completos, gasto en anuncios y costo por Lead incluidos. No borra
  Leads ni gestiona usuarios.

Cuando alguien dice "admin" hay que preguntar cuál: un Superadmin del equipo, o
el Owner de un Tenant. Son cosas distintas.

## Lead

Persona interesada en lo que vende un Tenant, venga de donde venga: el quiz, un
alta a mano, el formulario nativo de Meta Ads, un WhatsApp o una lista que nos
pasó el cliente. Pertenece a un Tenant. Tiene dos atributos independientes que
suelen confundirse:

- **Stage** — en qué **columna del Kanban** está el Lead ahora. Es configurable
  por Tenant (cada Tenant define su propio Pipeline), así que su valor es el id
  interno de una etapa del Pipeline de ese Tenant, no un texto compartido.
- **Status** — el **resultado** del Lead: abierto, ganado, perdido o
  descalificado. Es el mismo conjunto de cuatro valores para todos los Tenants,
  y por eso es lo único con lo que se puede comparar conversión entre Tenants.

Un Lead puede estar "ganado" (Status) sentado en cualquier Stage. Mover un Lead
de Stage puede *sugerir* un Status, pero no son el mismo dato.

Un tercer atributo, **Source**, dice por cuál de esas puertas entró. Los que no
vienen del quiz ni del alta a mano los mete n8n por
`POST /api/leads/ingest`, y pueden traer el id que tienen en su sistema de
origen (el del lead en Meta, por ejemplo): es lo único que permite reintentar
un envío sin duplicar al Lead. Un reintento actualiza sus datos de contacto,
pero nunca le devuelve el Stage ni el Status — eso es del cliente desde que
tocó el Kanban.

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

## Exportación de Leads

Una descarga en CSV de los Leads que un Tenant User tenía filtrados en su
Dashboard de Cliente. Es la principal vía por la que los datos personales de
los Leads de un Tenant salen de la plataforma en bloque: una vez descargado, el
archivo ya no está sujeto a ningún control de acceso.

Por eso cada Exportación queda registrada —quién, cuándo, cuántos Leads y con
qué filtros— y ese registro no se puede editar ni borrar desde el panel. No es
una bitácora de uso: es la única forma de responderle a un cliente qué se llevó
alguien y cuándo.

## Actor

Quien hace una petición a la API de un Tenant y queda resuelto a **un solo**
Tenant. Hoy hay exactamente un tipo: un **Tenant User** con sesión de
navegador, cuyo Tenant se deriva del host de la petición.

Las integraciones máquina-a-máquina (n8n) **no** son Actores: no actúan "como"
un Tenant sino a nivel plataforma, con una llave compartida que ya alcanza a
todos los Tenants, y dicen en el cuerpo de la petición sobre cuál escriben.
Que no sean Actores es lo que permite eso sin abrir una fuga: una credencial
de Tenant combinada con un Tenant elegido por el cliente sí sería una.

Una **API Key por Tenant** —para dársela a un tercero, un CRM externo— no
existe. El día que exista será el segundo tipo de Actor, y entonces su Tenant
tendrá que salir del host igual que el de una sesión.

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
