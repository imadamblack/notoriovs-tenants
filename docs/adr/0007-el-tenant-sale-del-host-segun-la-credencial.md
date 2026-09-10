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

La fuga que el ADR 0002 quería evitar es una sola: credencial del Tenant A más
Tenant B elegido por el cliente. Eso exige que existan credenciales por Tenant,
y no existen. Mientras no existan, el `subdomain` en el body de una integración
de plataforma no puede escalar a nada.

Lo que sí seguía en pie del 0002 —que el dashboard recibe el subdominio del
cliente— resultó ser menos grave de lo que el ADR suponía: desde el issue 09,
`resolveDashboardAuth` compara el `tenantId` de la sesión contra el del
subdominio y rechaza si no coinciden, así que el parámetro solo puede achicar el
alcance de una sesión, nunca ampliarlo. Queda como deuda de forma, no como
agujero, y se paga en el issue 12.

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
