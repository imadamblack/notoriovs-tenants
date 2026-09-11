# El tenant sale del host cuando la credencial es de un tenant; una llave de plataforma lo dice en el body

Supersede al ADR 0002, que pedía una API pública y versionada en
`{subdomain}.notoriovs.com/api/v1/*` con dos tipos de Actor y API Keys por
Tenant guardadas hasheadas. Nada de eso se construyó, y ya no se va a
construir con esa forma.

La regla se parte en dos según **de quién es la credencial**:

- **Credencial de un Tenant** (hoy: la sesión de navegador de un Tenant User).
  Su Tenant se deriva **siempre** del host de la petición, nunca de un
  parámetro. El navegador no puede falsificar el `Host`.
- **Credencial de plataforma** (hoy: las llaves de ingesta que usa nuestro
  propio n8n). Ya autoriza a todos los Tenants por definición, así que el
  `subdomain` que trae el cuerpo de la petición es **ruteo, no autorización**.
  Derivarlo del host no agregaría ni una garantía: obligaría a n8n a llamar a
  cada host para decir lo mismo.
- **Todavía sin credencial** (iniciar sesión, pedir el enlace de recuperación,
  canjearlo). No hay credencial que clasificar: son las rutas donde alguien se
  identifica por primera vez. Ahí el `subdomain` sigue viniendo del cuerpo, a
  propósito — ver Consecuencias.

La fuga que el ADR 0002 quería evitar es una sola: credencial del Tenant A más
Tenant B elegido por el cliente. Eso exige que existan credenciales por Tenant,
y no existen. Mientras no existan, el `subdomain` en el body de una integración
de plataforma no puede escalar a nada.

Lo que sí seguía en pie del 0002 —que el dashboard recibe el subdominio del
cliente— resultó ser menos grave de lo que el ADR suponía: desde el issue 09,
`resolveDashboardAuth` compara el `tenantId` de la sesión contra el del
subdominio y rechaza si no coinciden, así que el parámetro solo puede achicar el
alcance de una sesión, nunca ampliarlo. Era deuda de forma, no un agujero, y se
pagó en el issue 12: las rutas que exigen sesión ya no aceptan ese parámetro.

La alternativa era construir v1 tal como estaba especificada. Se descartó
porque no hay un tercero integrándose: el único cliente máquina es nuestro
propio n8n. Una API Key por Tenant existe para dársela a alguien de afuera;
mientras no haya afuera, es una colección, una pantalla, un hasheo y una
rotación que mantener sin usuario. El día que aparezca ese tercero, la API Key
por Tenant será el segundo tipo de Actor y su Tenant tendrá que salir del host,
igual que el de una sesión — esa parte del 0002 sigue siendo la decisión
correcta, solo que a futuro.

## Consecuencias

- No hay `/api/v1/*` ni `resolveActor`. Las rutas del producto siguen siendo
  `/api/tenant-dashboard/*` para el dashboard y los endpoints de ingesta
  (`/api/marketing-reports/ingest` y `/api/leads/ingest`) para n8n.
- La consecuencia que el 0002 anticipaba sobre el middleware **no aplica**: un
  route handler de Next lee el `Host` de su propia petición, así que
  `middleware.ts` puede seguir dejando pasar `/api/*` sin tocar. Tampoco hay
  que confirmar nada sobre el catch-all de Payload en `/api/[...slug]`.
- Una integración de plataforma nueva se protege con su propia env var y
  rechaza todo si no está configurada (default-deny), como
  `MARKETING_REPORT_INGEST_KEY`. Una llave por integración, no una llave para
  todas: revocar una no debe apagar las otras.
- Sigue prohibido guardar una credencial en texto plano. Las llaves de
  plataforma viven en env vars, no en la base; el día que se guarde una API Key
  de Tenant, va hasheada. Eso del 0002 no se negocia — es la lección de
  `tenants.dashboardPassword`.
- El glosario cambia: hoy hay **un** tipo de Actor, no dos, y las integraciones
  máquina-a-máquina no son Actores (ver `CONTEXT.md`).
- Las tres rutas pre-credencial (`login`, `forgot-password`, `reset-password`)
  conservan el `subdomain` en el cuerpo **para dejar abierta una entrada única
  de login**: una sola pantalla, en un host compartido, donde el cliente se
  identifica y de ahí sale a su dashboard. Ese diseño exige que la pantalla diga
  a qué Tenant va, porque el host es de todos por definición. Derivarlas del
  host hoy cerraría esa puerta, y no compraría ninguna garantía: la cookie de
  sesión es host-only, así que una sesión abierta en el host equivocado no llega
  a los datos de nadie.
- El precio de lo anterior, y hay que saberlo: identificarse desde un host que
  no es de ningún Tenant (el del admin, el dominio raíz) responde `ok` y deja la
  cookie, pero el dashboard no abre. Sesión válida sin destino, sin explicación
  en pantalla. Es interno —un cliente nunca llega a esos hosts—, y el día que la
  entrada única se descarte, se cierra rechazando en el login los hosts sin
  Tenant.
