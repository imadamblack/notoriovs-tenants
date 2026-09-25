# 38: Responsable de un Lead y filtro por miembro

**Ola:** sin ola — sirve al Tenant que tiene más de una persona atendiendo Leads

**What to build:** cada Lead puede tener un **Responsable**: una persona del
Tenant (Owner o Member) que lo atiende, o nadie. En el Dashboard de Cliente se
puede asignar, ver y filtrar por Responsable, para que un equipo de varias
personas sepa de quién es cada Lead y cada quien encuentre los suyos.

Es una **etiqueta, no un permiso**: todos siguen viendo todos los Leads de su
Tenant, igual que hoy (CONTEXT.md → Tenant User).

**Relación con el 31:** este issue no depende del 31. Cuando el 31 exista, un
Internal User dentro del Dashboard ve el filtro y asigna exactamente como un
Owner — el criterio quedó agregado allá.

**Status:** ready-for-agent

- [ ] Los Tenant Users tienen un campo **nombre** opcional, editable desde el panel. Donde se muestra una persona, se muestra su nombre y, si no tiene, su email
- [ ] Un Lead tiene cero o un Responsable. Todo Lead nace "Sin asignar", entre por la puerta que entre (quiz, alta manual, ingest, importación, panel)
- [ ] El Responsable solo puede ser un Tenant User **del mismo Tenant que el Lead**. El servidor lo rechaza venga de donde venga (rutas del dashboard, edición en bulto, panel de Payload)
- [ ] Un Owner asigna, reasigna o quita el Responsable de cualquier Lead, a cualquier persona de su Tenant
- [ ] Un Member solo puede **tomar** un Lead sin asignar para sí mismo o **soltar** uno que tiene él. No puede asignarle a otro ni quitarle un Lead a otro
- [ ] El equipo interno asigna desde el panel de Payload; el selector solo ofrece Tenant Users del Tenant de ese Lead
- [ ] Se ve y se cambia en el panel de detalle del Lead
- [ ] La tarjeta del Kanban muestra las iniciales del Responsable
- [ ] La edición en bulto de la Lista permite asignar varios Leads a la vez, con las mismas reglas por rol (un Member solo tomar/soltar para sí)
- [ ] Filtro por Responsable con una sola opción a la vez: **Todos / Yo / Sin asignar / cada persona del Tenant**. Lo tienen todos los roles
- [ ] El filtro aplica al Kanban (incluidos sus conteos por columna), a la Lista y a la Exportación de Leads. **No** a los KPIs
- [ ] El CSV de la Exportación lleva una columna "Responsable" (nombre, o email si no tiene), y el registro de la Exportación guarda el filtro usado
- [ ] Si un Tenant User se borra o se cambia de Tenant, sus Leads vuelven a "Sin asignar"

## Fuera de alcance (decidido)

- **Asignación automática** (repartir en turnos, reglas por fuente): solo manual.
- **Aviso al Responsable** (push "te asignaron un lead"): por ahora no; si se
  hace, es un tipo de Aviso nuevo con su propio issue.
- **Webhook a n8n**: no se toca. Ni `lead.created` lleva el Responsable (siempre
  llegaría vacío, porque la asignación es posterior) ni se crea un
  `lead.assigned`.
- **KPIs por persona**: no. El gasto en anuncios no se reparte por persona y
  medir desempeño es otra conversación.
- **Recortar lo que ve un Member** a sus Leads: no. Eso convertiría la
  asignación en control de acceso y tocaría autorización, KPIs, exportación y
  Avisos.

## Notas

### Dónde vive el filtro

`src/utils/leadDashboardFilters.ts` (`readLeadFilters` + `buildLeadsWhere`) ya
es lo que comparten Kanban, conteos, Lista y exportación. El filtro por
Responsable entra ahí y los cuatro lo heredan. "Yo" se resuelve en el servidor
contra la sesión (`DashboardSession.userId`), no contra un id que mande el
cliente. "Sin asignar" es `exists: false` / `null`.

### Permisos

La regla tomar/soltar vs. asignar a cualquiera vive en el modelo de permisos
(`src/access/tenantUserPermissions.ts`), no en la UI: `sessionCan` sigue siendo
el único lugar donde una ruta pregunta si la sesión puede algo, y la UI recibe
los permisos ya resueltos (`permissionsForRole`) para no pintar controles que la
API rechaza.

### Aislamiento

El campo en `leads` es una relación a `tenant-users`. La comprobación de "mismo
Tenant" va en la colección (hook), no solo en las rutas del dashboard, porque el
panel de Payload escribe sin pasar por ellas — el mismo motivo por el que
`lead.created` se emite desde la colección. En el panel, además, `filterOptions`
por el Tenant del Lead, pero eso es comodidad: la regla es el hook.

Al proyectar el Responsable hacia el dashboard, solo `id`, `name` y `email`
del Tenant User; nunca el documento completo (`depth: 0` y proyección a mano,
como con el Tenant).

### Pruebas

Cae en aislamiento entre tenants (CLAUDE.md). Como mínimo: asignar un Lead a un
Tenant User de otro Tenant falla, por la ruta del dashboard y por la Local API
sin pasar por ella. Y en autorización del dashboard: un Member no puede
asignarle un Lead a otro ni soltar uno ajeno. Nada más.
