# 02: Cada página carga solo los campos del Tenant que usa

**What to build:** Prefactor. Hoy toda página que resuelve un Tenant trae el
documento completo: bloques de landing, pasos del quiz, pipeline y credenciales,
sin importar qué necesite. Cada consumidor pasa a pedir su propia proyección, de
modo que una landing pública nunca cargue en memoria credenciales de tracking ni
secretos de acceso. Hace que el ticket de ISR sea un cambio limpio.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] La resolución de un Tenant acepta qué campos se quieren y devuelve solo esos
- [x] La landing pide identidad, hero, bloques y tracking público; el quiz pide
      sus pasos; el dashboard pide el pipeline. Criterio matizado: identidad y
      tracking los pide el layout compartido, no la landing (ver decisión 1)
- [x] Ninguna página pública carga el token de la Conversions API ni la
      contraseña del dashboard (la del dashboard hubo que arreglarla aparte,
      ver decisión 2)
- [x] Landing, quiz, thankyou, not-eligible y dashboard siguen renderizando
      igual que antes

Rama `feat/proyeccion-campos-tenant`, commits `987f0c5` (el prefactor) y
`35baced` (lo que salió de la revisión).

## Cómo quedó

`getTenantBySubdomain(subdomain, proyección)` exige nombrar una proyección y
devuelve solo esos campos, traducida a un `select` de Payload. Las 12
proyecciones viven juntas en `TENANT_PROJECTIONS` (`src/utils/getTenant.ts`),
cada una declarando también su `depth`. Los tipos se derivan de ahí: pedirle a
`tenant` un campo que la proyección no seleccionó es un error de compilación,
no un `undefined` en runtime.

`tests/int/tenantProjections.int.spec.ts` afirma sobre `PUBLIC_TENANT_PROJECTIONS`
que ninguna proyección de página pública toca `tracking.metaCapiToken` ni
`dashboardPassword` — incluido el caso de pedir el grupo `tracking` entero, que
arrastraría el token sin nombrarlo.

## Notas de verificación

- Probado contra la base real, tenant por tenant: redirección landing→survey,
  quiz (se pintan las dos imágenes), thankyou (se pinta el logo), not-eligible,
  privacy-notice, y las dos ramas del dashboard ("no disponible" en `domsa`,
  login en `solucion-erp`). Sin errores de servidor ni de consola.
- Ningún tenant de la base tiene landing configurada hoy (`landingHero` vacío y
  `landingBlocks: []` en los 9), así que el render de bloques no se pudo
  verificar con datos reales; sí se verificó que la proyección `landing`
  devuelve ambos campos.
- `tsc --noEmit` limpio y sin warnings nuevos de eslint. La suite de int pasa
  (11 tests). Queda 1 error PREVIO e independiente: `tests/int/api.int.spec.ts`
  no carga bajo jsdom (`ERR_REQUIRE_ESM` desde `html-encoding-sniffer`);
  reproducido idéntico en `main`.

## Puntos cerrados

1. **La landing no pide identidad ni tracking: los pide el layout.** El criterio
   2 estaba escrito por ruta, pero `[subdomain]/layout.tsx` envuelve a *todas*
   las páginas del tenant (quiz, thankyou, dashboard incluidos). Meter identidad
   y tracking en la proyección `landing` no habría servido de nada —el layout
   igual necesita los suyos— y meter la landing en la del layout habría hecho
   que la página del dashboard cargara bloques que no usa. Quedó partido:
   `chrome` (identidad + tracking público, compartida por todas) y `landing`
   (hero + bloques). El test documenta el corte.

2. **CORRECCIÓN — la página del dashboard sí cargaba un secreto.** Se sirve sin
   sesión (es la que muestra el login), y cargaba `dashboardPassword` en texto
   plano solo para decidir entre el login y el aviso de "no disponible". La
   primera versión del prefactor la dejaba fuera de `PUBLIC_TENANT_PROJECTIONS`,
   así que el test tampoco la cubría. Ahora esa pregunta la responde
   `tenantHasDashboard` con un `where` (`exists` + `not_equals: ''`, que es como
   el admin apaga el acceso según la descripción del campo), sin traerse el
   valor; la proyección entró a la lista pública y el test la cubre.

3. **`depth: 1` para todo iba contra la regla del repo.** `local-api.md` dice
   usar `0` salvo que se necesite el documento relacionado. Pasa a declararse
   por proyección: `1` solo donde la página pinta una Media (logo, imagen del
   quiz), `0` en las cinco proyecciones de rutas de API, que pagaban un join
   para nada. `privacy-notice` también bajó a `0`: selecciona `generalInfo`
   pero solo pinta texto.

4. **Cada página del tenant hace ahora dos consultas al Tenant** (la del layout
   y la suya) donde antes una sola, memoizada, servía a las dos. Es la
   consecuencia directa de que cada consumidor pida lo suyo, y las dos juntas
   siguen siendo una fracción del documento completo. Si el ticket 03 (ISR)
   deja de amortizarlo, revisar aquí.

## Derivados

- **`Tenants` tiene `access.read: () => true`** (`src/collections/Tenants.ts`),
  así que el endpoint REST público `/api/tenants` parece exponer el
  `dashboardPassword` y el `metaCapiToken` de todos los tenants a cualquiera.
  Es la misma credencial por otra puerta: este ticket cierra la de las páginas,
  no la de la API. Sin issue todavía.
