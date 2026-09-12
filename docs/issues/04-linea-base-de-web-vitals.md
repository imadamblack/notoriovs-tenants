# 04: Línea base medida de Core Web Vitals

**What to build:** Después de las dos mejoras de servidor, una medición real que
diga dónde está ahora el cuello de botella. Sin esto se optimiza a ciegas: si el
LCP resulta ser el JavaScript del quiz, el trabajo de servidor no se nota.

**Qué se mide:** hoy los tenants no usan landings — el bloque de landing existe
en el código pero no en los datos, así que `/` redirige a `/survey`
(ver `page.tsx:162` y `:177`). El flujo real es:

- `/` → redirect a `/survey` (el salto cuenta para el TTFB de la entrada real)
- `/survey` — la página de entrada de verdad; client component con animaciones
- `/thankyou`

**Blocked by:** 01 (media directo al CDN), 03 (ISR)

**Status:** done (un criterio omitido a propósito, ver abajo)

- [x] Medición del flujo de quiz de al menos 3 tenants reales, en perfil móvil 4G
- [x] El redirect de `/` medido como parte del flujo, no como página aparte
- [x] Desglose documentado de TTFB, LCP, CLS y peso de JavaScript por página
- [x] Peso de JS de `/survey` desglosado: cuánto es el bundle del formulario y
      cuánto las animaciones
- [ ] ~~Comparación contra el estado previo~~ — OMITIDO: no existía medición
      previa guardada y se decidió no desplegar el commit anterior para obtenerla
- [x] Una lista priorizada de los siguientes cuellos de botella, con evidencia

## Resultado

Ver `../mediciones/04-linea-base-web-vitals.md`.

En corto: **el trabajo de servidor está terminado** (TTFB 63-65 ms, HIT de caché
en las 6 páginas) y **CLS es 0**. El cuello de botella se movió al cliente y es
de terceros: el pixel de Meta son 234 KB, el 54% de todo el JS, y aporta las dos
tareas largas del trace. Prioridad siguiente:

1. Diferir el pixel de Meta tras el primer pintado (234 KB fuera del crítico)
2. `sizes` en los tres `<Image fill>` de logo — hoy piden `w=1920` para 160x64
3. La cadena de entrada de 3 saltos (~195 ms), sin volver dinámica la página
