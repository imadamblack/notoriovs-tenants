# 30: Los e2e no sobreviven a un `next dev` en frío

**What to build:** `npm run test:e2e` pasa entera en ~20s si el servidor ya
está caliente, pero contra un `.next` recién borrado el login del admin no
vuelve a tiempo y el `beforeAll` muere por timeout — probado con 90s y con 240s
de presupuesto. El POST a `/api/users/login` sale (se ve en la traza de red) y
la respuesta no llega dentro de la espera.

No es la separación de bases (issue 29): se descartó el push de esquema
simultáneo apagándolo (`PAYLOAD_SCHEMA_PUSH=false`) y el síntoma es el mismo. Se
descartó también que sea el selector: con el servidor caliente los mismos
selectores pasan.

Lo que queda por medir es cuánto tarda de verdad esa petición en frío y por qué:
si es compilación bajo demanda del dev server (y entonces la respuesta es
precalentar mejor, o correr los e2e contra `next build && next start`), o si se
queda esperando algo.

**Blocked by:** None

**Status:** CERRADO el 2026-09-11 — no se hace.

- [ ] `npm run test:e2e` pasa desde un `.next` borrado, sin trucos de tiempo
- [ ] Queda escrito si los e2e deben correr contra `dev` o contra un build

## Notas

- Medir antes de tocar nada: cada intento con `rm -rf .next` cuesta ~4 minutos,
  así que conviene una sola corrida instrumentada que registre cuándo vuelve el
  POST, en vez de subir timeouts a ciegas. Ese fue el error de la primera vuelta.
- `tests/warmupServer.ts` ya precompila `/admin/login`, `/api/users/me` y `/`
  antes del primer test. No alcanza, lo que apunta a que lo caro es lo que se
  compila *después* del login (el dashboard y sus componentes propios).
- Correr los e2e contra `next build && next start` los haría representativos de
  producción y quitaría el problema de raíz, a cambio de esperar el build.

## Por qué se cierra

Este issue pide arreglar los e2e, y los e2e **se quitaron a propósito** (commit
3786da6, "la suite de pruebas se recorta a lo que falla en silencio").
`CLAUDE.md` lo dice explícitamente: la suite cubre tres áreas —autorización del
dashboard, aislamiento entre Tenants y ruteo del middleware— y *no se propone
restaurar los e2e*. Entre este issue y `CLAUDE.md`, manda `CLAUDE.md`.

Lo que el issue quería comprobar (que la app levanta y responde en frío) se
verifica usando la app, no con una suite.
