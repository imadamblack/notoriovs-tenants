# Backlog: Dashboard de leads por tenant

Todo el trabajo de esta funcionalidad vive en la rama `feature/tenant-leads-dashboard` (creada a partir de `main`), para no tocar producción directamente. Este archivo es el checklist de lo que falta para dejarla lista y mergear con confianza.

## 1. Levantar el proyecto en local (bloqueante, primero que nada)

- [x] `npm install` — trae `@payloadcms/plugin-multi-tenant`. Hecho (commit "FIX: importMap errors").
- [x] `pnpm run generate:types` / `npm run generate:types` — `src/payload-types.ts` ya se regeneró de verdad. **Ojo:** cada vez que se agregue o cambie un campo en `Leads.ts`/`MarketingReports.ts`/`Tenants.ts` (como el cambio de `stage`/`status` de esta misma sesión) hay que volver a correrlo; mientras tanto el archivo puede traer parches escritos a mano documentados en comentarios.
- [x] `npm run dev` levanta, aparecen **Leads** y **Marketing Reports**, y el selector de tenant en el admin.
- [ ] `npm run build` completo al menos una vez en un entorno con red y con acceso a la base de datos.
- [ ] `npm run lint` — no se pudo correr desde el entorno donde se armó la rama (el `eslint.config.mjs` tronaba con un error de configuración); confirmar si es algo puntual de ese entorno o un problema real del proyecto.

## 2. Variables de entorno

- [ ] Agregar `MARKETING_REPORT_INGEST_KEY` a `.env` (local) y a las variables de entorno de producción/hosting. Es el secreto que valida las llamadas del workflow de n8n al endpoint `/api/marketing-reports/ingest`. Mientras no exista, ese endpoint rechaza todo (default-deny a propósito).

## 3. Configuración por tenant (Payload admin)

- [ ] Definir `dashboardPassword` en cada tenant que se quiera activar (Tenants → Dashboard Cliente). Mientras esté vacío, ese tenant ve un mensaje de "dashboard no disponible" en vez del login.
- [ ] Revisar el pipeline default (`Nuevo → Contactado → Calificado → Ganado → Perdido`) por tenant y ajustarlo si algún cliente maneja etapas distintas (ej. inmobiliarias con "Cita agendada" o "Visitó").
- [ ] Confirmar que "Ganado"/"Perdido" (o como se llamen en cada tenant) tengan marcado `isWon`/`isLost` en el pipeline. **Actualización:** `Leads` ahora separa `stage` (la etapa/columna del Kanban) de `status` (abierto/ganado/perdido/descalificado, fijo para todos los tenants). `isWon`/`isLost` ya no se usan para calcular la conversión directamente; solo sirven para que el `status` se autoactualice cuando un lead se mueve a esa etapa. La conversión del reporte de KPIs se calcula ya directo de `status`.
- [ ] Decidir si algún usuario interno de Payload debe quedar restringido a ciertos tenants, o si todos siguen viendo todo (hoy `userHasAccessToAllTenants` está en `true` para todos).

## 4. Integración con n8n (KPIs de marketing)

- [ ] Compartir el workflow de n8n que arma los KPIs semanales de ads (el que hoy escribe al Google Sheet).
- [ ] Agregar un nodo HTTP Request en ese workflow apuntando a `POST /api/marketing-reports/ingest`, header `x-ingest-key`, body `{ subdomain, reports: [...] }` con las mismas columnas que ya usa el Sheet.
- [ ] Correr una prueba real con datos de un tenant y confirmar que aparecen en la pestaña de KPIs del dashboard.
- [ ] Decidir si se conserva el Sheet como respaldo indefinidamente o solo durante un periodo de transición.

## 5. QA manual antes de mergear a producción

- [ ] Login del dashboard: contraseña correcta entra, incorrecta rechaza, tenant sin contraseña configurada muestra el mensaje de "no disponible".
- [ ] Kanban: arrastrar una tarjeta entre columnas actualiza el estado y persiste después de recargar la página.
- [ ] Panel de detalle: editar nombre/teléfono/email/notas/etapa/resultado guarda correctamente y se refleja en el Kanban sin recargar. Confirmar también que cambiar la "Etapa" ahí sugiere el "Resultado" correcto (ganado/perdido/abierto) sin pisar un resultado elegido a mano.
- [ ] Kanban: mover una tarjeta a una etapa marcada como "Ganado"/"Perdido" en el pipeline del tenant debe reflejarse como tal en el `status` del lead (verlo en el panel de detalle o en el badge de la tarjeta).
- [ ] **Si ya se crearon leads de prueba antes de este cambio de esquema** (`stage`/`status` separados), borrarlos o corregirlos a mano: van a tener `stage` vacío (campo nuevo, requerido) y un `status` con el valor viejo (la etapa como texto libre), que ya no es una de las 4 opciones válidas.
- [ ] KPIs: revisar que se vean bien tanto con 0 leads (estado vacío) como con datos reales.
- [ ] **Aislamiento entre tenants** (la prueba de seguridad más importante de todas): confirmar que la sesión de un tenant no puede leer ni editar leads de otro tenant, ni cambiando el subdominio en la URL ni llamando directo a los endpoints de `/api/tenant-dashboard/*`.
- [ ] Un usuario interno de Payload sigue viendo todo correctamente en el admin después de instalar el plugin, y el selector de tenant filtra bien las listas de Leads y Marketing Reports.
- [ ] Enviar un lead real desde el quiz de un tenant de prueba y confirmar que llega tanto a n8n (como siempre) como a la colección `leads` en Payload.

## 6. Antes de deployar a producción

- [ ] **Revisar cómo se aplican los cambios de esquema a la base de Postgres de producción.** Este proyecto no tiene carpeta `migrations/` ni un script `payload migrate` configurado, lo que sugiere que hoy depende del modo "push" automático de Payload (que solo corre en desarrollo por default). Antes de mergear, hay que confirmar explícitamente cómo se van a crear las tablas nuevas (`leads`, `marketing_reports`, más las que agregue el plugin de multi-tenant en `users`) en la base de producción: correr `payload migrate:create` + `payload migrate` como paso de deploy, o confirmar que el mecanismo actual ya las crea solo. Esto es lo único de todo el backlog que, si se salta, puede tumbar producción.
- [ ] Probar el flujo completo en un ambiente de staging/preview si existe, antes del deploy final.
- [ ] Mergear `feature/tenant-leads-dashboard` a `main` solo después de que los puntos 1 a 5 estén en verde.

## 7. Mejoras futuras (no bloquean el lanzamiento)

- [ ] Decidir si los leads descalificados en el quiz (cuando una respuesta tipo radio tiene marcado "descalifica") deben guardarse también en el Kanban (hoy el formulario nunca llama a `/api/quiz-submit` en ese caso, así que ni siquiera llegan al Sheet actual). Con el `status` nuevo ya existe un lugar natural para esto (`status: 'disqualified'`); falta decidir en qué etapa (`stage`) caerían y conectar ese flujo.
- [ ] Exportar leads a CSV desde el dashboard de cliente.
- [ ] Notificaciones (email/WhatsApp) cuando un lead cambia de etapa.
- [x] Paginación real en `/api/tenant-dashboard/leads` (`stage`/`status`/`search`/`sort`/`page`/`limit`, ya no trae hasta 1000 leads en una sola llamada) + `GET /api/tenant-dashboard/leads/counts` para los badges de cantidad. El Kanban carga cada columna paginada con scroll infinito (sin botón: dispara la siguiente página al acercarse al fondo de la columna, y también si la primera página no llena el contenedor) en vez de todo el tenant de un jalón; la Lista quedó con el mismo scroll infinito como efecto colateral de compartir la misma API, pero todavía no tiene virtualización real (ver siguiente punto).
- [ ] Virtualizar la tabla de la vista Lista (react-window / tanstack-virtual) para tenants de miles de leads; hoy solo tiene "Cargar más" paginado, no ventanas de renderizado.
- [ ] Pruebas automatizadas (el proyecto ya tiene Vitest y Playwright configurados) para las colecciones y rutas nuevas: `leads`, `marketing-reports`, `/api/tenant-dashboard/*`, `/api/quiz-submit`, `/api/marketing-reports/ingest`.
- [ ] Evaluar migrar de "captura manual" a "jalar automático de Meta Ads API" para los KPIs de marketing, si en algún momento se vuelve una carga operativa mantenerlo vía n8n + Sheet.
