# 07: Extraer la configuración de Tenants a módulos

**What to build:** Prefactor. La definición del Tenant concentra en un solo
archivo la landing, el quiz, el pipeline y la configuración de integraciones, y
ya es difícil de navegar. Se reparte en módulos por área, sin cambiar ni un campo
ni el esquema de la base. Hace baratos los dos tickets que vienen después.

**Blocked by:** None (can start immediately)

**Status:** hecho en `dev`, sin desplegar

- [x] La configuración queda repartida por área: identidad, landing, quiz, pipeline, integraciones
- [x] No hay cambio de esquema: no se genera ninguna migración
- [x] El panel de Payload se ve y se comporta exactamente igual que antes
- [x] Los tipos generados no cambian

Hecho en `refactor/configuracion-de-tenants-por-modulos` (1 commit).
`src/collections/Tenants.ts` (686 líneas) pasa a ser `src/collections/Tenants/`:
`index.ts` solo ensambla los hooks de colección y el orden de los tabs, y el
resto se reparte en `identity.ts`, `landing.ts`, `quiz.ts` (que se queda con
`STEP_TYPES` y con las páginas de salida del quiz, Thank You y No Elegible),
`integrations.ts` (con `N8N_WEBHOOK_BASE`) y `pipeline.ts`. El import en
`payload.config.ts` no cambia: `./collections/Tenants` ahora resuelve al
directorio.

La ausencia de cambio observable se verificó, no se asumió: se serializó el
árbol completo de la colección —incluidas las funciones de `condition` y los
hooks, volcadas como código fuente— desde la versión modular y desde `HEAD`, y
el diff sale vacío; `payload generate:types` produce el mismo
`payload-types.ts` byte por byte. Sin migración y sin cambios en el importmap.

Queda sin comprobar a ojo el panel autenticado: el admin redirige a login y no
se capturaron credenciales. El árbol de campos idéntico cubre el criterio, pero
un recorrido de los siete tabs no sobra.

Aparte, se topó con algo que ya venía roto y no se tocó por quedar fuera del
alcance: `tests/int/api.int.spec.ts` no arranca por un `ERR_REQUIRE_ESM` en
`html-encoding-sniffer` (dependencia de `node_modules`). Falla igual en el árbol
sin tocar, verificado con `git stash`. Los otros 6 suites (57 tests) pasan.
Merece su propio ticket.
