# 03: Landings y quizzes servidos estáticos con revalidación bajo demanda

**What to build:** Hoy cada clic de un anuncio dispara una consulta a la base y
renderiza el HTML desde cero, y si la base está fría el visitante espera. Las
páginas públicas de cada Tenant pasan a servirse pregeneradas desde el CDN, y
guardar un Tenant en Payload actualiza su sitio en segundos sin necesidad de
desplegar. El dashboard y los endpoints siguen siendo dinámicos.

**Blocked by:** 02 (proyección de campos del Tenant)

**Status:** done

- [x] Landing, quiz, thankyou y not-eligible se sirven desde caché, no se rearman por visita
- [x] La validación del host se resuelve antes de la página, de modo que la página no fuerza render dinámico
- [x] Guardar un Tenant en Payload refresca sus páginas en segundos, sin desplegar
- [x] Desactivar un Tenant deja de servir su sitio. OJO: este criterio describía
      el comportamiento actual, que contradice al glosario (un Tenant inactivo
      conserva landing y quiz vivos). Se cumplió tal cual estaba escrito, pero
      la conducta correcta la define 23 y ahí se corrige
- [x] Un Tenant creado nuevo queda disponible sin desplegar
- [x] El envío del quiz, el pixel y el tracking siguen funcionando sobre páginas cacheadas
- [x] El dashboard y los endpoints siguen siendo dinámicos y no se cachean

Rama `feat/paginas-estaticas-por-tenant`, commit `2913a29`. Decisión en
`docs/adr/0005-paginas-publicas-estaticas-con-invalidacion-al-guardar.md`.

Queda fuera y sin issue propio: cambiar una Media no invalida las páginas que
la pintan (esperan al TTL de una hora).

La primera versión llegó a producción invalidando cero páginas:
`revalidatePath(ruta, 'layout')` acepta la llamada, no lanza error y no purga
nada. Corregido en `fix/invalidacion-por-ruta-concreta` (PR #6, commit
`8c9d7b0`) pasando la ruta concreta de cada página.

Verificado en producción con `dissalud` el 2026-09-08: guardar el tenant llevó
las cinco páginas de `HIT` a `REVALIDATED` con `age=0` —`/survey` venía con 746
segundos acumulados— y 20 s después las cinco estaban de vuelta en `HIT`
estable.
