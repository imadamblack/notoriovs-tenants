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

## Actualizaciones

El cuerpo de arriba queda como se escribió: su valor es el razonamiento del día
que se decidió. Lo que cambió después se anota aquí, fechado.

### 2026-09-11 — La regla se queda sin excepciones: el login también sale del host

Se cierra la excepción de las tres rutas pre-credencial (`login`,
`forgot-password`, `reset-password`). Pasan a derivar el Tenant del host como
todas las demás, y un host sin Tenant rechaza el login en vez de dejar una
sesión válida sin destino.

La excepción se sostenía en una **entrada única de login** que no existe, no
está en ningún issue y nadie ha pedido. Es el mismo razonamiento con el que este
ADR mató la API v1 —mientras no haya quien lo pida, es mantenimiento sin
usuario—, aplicado al revés. Y una excepción viva a una regla de seguridad es la
que alguien copia al escribir la siguiente ruta, cosa que este mismo ADR admitía.

Si la entrada única llega algún día, reabrirla cuesta lo mismo que cerrarla hoy.
Es el **issue 34**.

### 2026-09-11 — El perímetro se declara aparte, en el ADR 0009

El supuesto que sostiene la mitad de este ADR —"no hay un tercero
integrándose"— dejó de vivir suelto aquí: está en el **ADR 0009**, con el
inventario de quién toca el sistema, las dos reglas que salen de ahí, y el hueco
que este ADR nunca nombró (`/api/quiz-submit` es público y sin credencial).
Cuando alguien quiera volver a discutir si hace falta autenticar algo entre
nuestro servidor y nuestro n8n, se cita el 0009.

### 2026-09-11 — Las llaves de ingesta se quedan en env vars, por ahora

La consecuencia que dice *"una integración de plataforma nueva se protege con su
propia env var"* sigue vigente. El **issue 32** proponía moverlas al panel —para
poder rotar y revocar sin desplegar— y quedó **congelado**: sus tres argumentos
son de comodidad operativa, todos ciertos, y ninguno urgente mientras la única
consumidora sea nuestro propio n8n y no se haya filtrado ninguna llave. Lo
despierta una llave filtrada, o el primer cliente que quiera integrarse.

Lo que no se mueve en ningún escenario: generadas donde sea, las llaves de
**entrada** se guardan hasheadas. Los eventos salientes del ADR 0008 no llevan
credencial, así que ahí no hay nada que guardar.
