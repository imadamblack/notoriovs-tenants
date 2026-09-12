# 32: Las llaves de integración se generan en el panel, no en las env vars

**What to build:** Que un `superadmin` dé de alta, vea y revoque desde el panel
de Payload las llaves con las que n8n nos escribe, y que las dos env vars que
hoy hacen ese trabajo —`MARKETING_REPORT_INGEST_KEY` y `LEADS_INGEST_KEY`—
desaparezcan del `.env` y del hosting.

**Blocked by:** None (can start immediately)

**Status:** CONGELADO el 2026-09-11. No se construye por ahora.

## Por qué está congelado

Los tres costos de abajo son ciertos y ninguno es urgente. La regla 1 del **ADR
0009** —dentro de nuestro perímetro no se autentica dos veces— no prohíbe este
issue, pero sí lo baja de prioridad: mientras la única consumidora de las dos
llaves sea nuestro propio n8n y no se haya filtrado ninguna, esto compra
comodidad operativa a cambio de una colección, una pantalla, un hasheo, una
migración y una compuerta de transición que hay que acordarse de cerrar.

**Lo que lo despierta**, y entonces se hace tal como está escrito abajo:

- Una llave filtrada (un log de n8n, un screenshot, alguien que salió del
  equipo) — ahí la falta de un botón de revocar se paga en un despliegue de
  emergencia.
- El primer cliente o partner que quiera integrarse. Ojo: ése no es este issue,
  porque una llave acotada a un Tenant es una credencial de Tenant y reabre lo
  que el ADR 0007 cerró. Ver la sección "El alcance de una llave".
- Un segundo workflow que necesite su propia llave para el mismo endpoint.

## Por qué

Hoy las dos integraciones máquina-a-máquina se protegen con un secreto en una
env var (ADR 0007). Funciona, pero tiene tres costos que ya se sienten:

- **Rotar o revocar una llave es un despliegue.** Si mañana el secreto se filtra
  en un log de n8n, apagarlo exige entrar a Vercel, cambiar la variable y
  esperar el redeploy. No hay botón.
- **Solo lo puede hacer quien tenga acceso al hosting.** Es una tarea de
  operación del negocio atrapada en una consola de infraestructura.
- **No escala a más de una llave por endpoint.** El ADR pide una llave por
  integración; con env vars, "una llave por integración" y "una llave por
  endpoint" son lo mismo. El día que haya dos workflows —o que queramos darle
  la suya a un cliente que se integra— hay que inventar `..._KEY_2`.

Lo que este issue **no** cambia: las llaves siguen siendo de plataforma, no de
Tenant. El `subdomain` que viaja en el body de los dos endpoints de ingesta
sigue siendo ruteo y no autorización, exactamente por la razón del ADR 0007 y
del issue 11. Convertir esto en una credencial por Tenant es otro issue y otro
ADR (ver la nota de abajo).

- [ ] Un `superadmin` crea una llave desde el panel, le pone nombre y elige a
      qué endpoints sirve, y el valor completo se le muestra **una sola vez**
- [ ] Después de esa vez, ni el panel ni la base ni un `GET` de la API pueden
      devolver el valor completo: solo queda un prefijo o unos últimos dígitos
      para reconocerla en la lista
- [ ] Revocar una llave la deja de aceptar de inmediato, sin desplegar nada
- [ ] Revocar una llave no apaga las otras (la regla del ADR 0007: una por
      integración)
- [ ] Los dos endpoints de ingesta aceptan una llave del panel y siguen
      rechazando con 401 una llave inválida, revocada o ausente
- [ ] Si no hay ninguna llave vigente para ese endpoint, sigue rechazando todo
      (default-deny, como hoy con la env var sin configurar)
- [ ] Un `account-manager` no ve ni crea ni revoca llaves
- [ ] `MARKETING_REPORT_INGEST_KEY` y `LEADS_INGEST_KEY` ya no se leen en
      ningún lado del código, y salen de `.env.example`
- [ ] La lista deja ver cuándo se usó cada llave por última vez (para saber
      cuál se puede revocar sin romper nada)
- [ ] El ADR 0007 queda actualizado: la consecuencia que dice "cada integración
      nueva se protege con su propia env var" deja de ser cierta

## Lo que hay que decidir al implementarlo

### Cómo se guarda la llave

El ADR 0007 es tajante: *sigue prohibido guardar una credencial en texto plano*,
y la lección se llama `tenants.dashboardPassword`. Hay dos caminos y no dan lo
mismo:

- **Payload con `auth: { useAPIKey: true }`** en una colección nueva
  (`integrations`, o similar). Es lo que menos código pide: el panel ya trae el
  botón de generar y el header `Authorization: <slug> API-Key <llave>` ya lo
  entiende Payload. Pero Payload guarda esa llave **cifrada de forma
  reversible** con `PAYLOAD_SECRET`, no hasheada: quien lea la base y tenga el
  secreto la recupera. Es mejor que texto plano y peor que un hash.
- **Colección propia con la llave hasheada**, verificando a mano en cada
  endpoint. Es lo que el ADR pide literalmente y es irreversible, a cambio de
  escribir el generado, el hasheo, la comparación y la pantalla.

Elegir con el criterio del ADR, no con el del ahorro, y dejar escrito el porqué.

### El alcance de una llave

Mínimo: qué endpoints puede llamar (`marketing-reports:ingest`,
`leads:ingest`), para que revocar una no apague la otra. Resistir la tentación
de agregarle un campo `tenant` "ya que estamos": una llave acotada a un Tenant
es una credencial de Tenant, y eso reabre justo lo que el ADR 0007 cerró —el
`subdomain` del body dejaría de ser ruteo y pasaría a tener que salir del host—.
Si se quiere, es un issue aparte.

### La transición

Las llaves viven en n8n, que no es nuestro. El corte limpio rompe los dos
workflows en el momento del despliegue. Lo razonable es aceptar las dos fuentes
durante el cambio —env var **o** llave del panel— y retirar la env var cuando
n8n ya esté apuntando a la nueva. Si se hace así, dejar la fecha o el commit en
que se retira, porque una compuerta temporal que nadie cierra es permanente.

## Dónde toca

- `src/app/api/marketing-reports/ingest/route.ts` y
  `src/app/api/leads/ingest/route.ts` — la validación del header y los
  comentarios de cabecera, que hoy explican la env var.
- `src/collections/MarketingReports.ts` — el comentario que nombra la env var.
- `.env.example` — quitar las dos variables y su explicación.
- `docs/adr/0007-el-tenant-sale-del-host-segun-la-credencial.md` — la sección
  de consecuencias.
- `BACKLOG-dashboard-leads.md` — la tarea que pide poner la variable en
  producción deja de aplicar.
- Migración nueva por la colección (ADR 0006).

## Pruebas

No cae en ninguna de las tres áreas que este repo prueba (CLAUDE.md): no es
autorización del dashboard, no es aislamiento entre Tenants —la llave es de
plataforma— ni es ruteo del middleware. Verificar con la app, como el issue 11:
sin llave, con llave equivocada, con llave revocada y sin ninguna llave vigente.

## Acciones tuyas cuando esto se implemente

1. Generar las dos llaves desde el panel.
2. Actualizar los dos nodos HTTP Request de n8n con los valores nuevos.
3. Borrar `MARKETING_REPORT_INGEST_KEY` y `LEADS_INGEST_KEY` de las variables de
   entorno del hosting, ya que n8n esté funcionando con las nuevas.
