# Línea base de Core Web Vitals — flujo de quiz

**Fecha:** 2026-09-08 · **Entorno:** producción (`*.notoriovs.com`, Vercel)
**Herramienta:** Lighthouse 12, preset móvil por defecto (Moto G Power, 4G lento:
1.6 Mbps / 150 ms RTT) · **Deploy medido:** `dpl_DgzZHNXUX4cAxynYoACy9DRyud`

Sin comparación contra el estado previo: no existía ninguna medición guardada de
antes de 01 y 03, y se decidió no desplegar el commit anterior para obtenerla.
El criterio correspondiente del issue queda sin cumplir, a propósito.

## Números

| página | TTFB | LCP sim. | LCP obs. | TBT | CLS | JS | de eso, Meta | IMG | score |
|---|---|---|---|---|---|---|---|---|---|
| avril-ramos `/survey` | 65 ms | 6115 ms | 1511 ms | 194 ms | 0.000 | 428 KB | 234 KB | 117 KB | 72 |
| rosessa-muebles `/survey` | 65 ms | 5072 ms | 2648 ms | 152 ms | 0.000 | 375 KB | 181 KB | 58 KB | 74 |
| pgc `/survey` | 64 ms | 5014 ms | 2436 ms | 127 ms | 0.000 | 372 KB | 178 KB | 32 KB | 68 |
| avril-ramos `/thankyou` | 63 ms | 2523 ms | 946 ms | 175 ms | 0.000 | 369 KB | 234 KB | 69 KB | 95 |
| rosessa-muebles `/thankyou` | 65 ms | 2508 ms | 938 ms | 119 ms | 0.000 | 316 KB | 181 KB | 38 KB | 96 |
| pgc `/thankyou` | 64 ms | 2188 ms | 901 ms | 57 ms | 0.000 | 313 KB | 178 KB | 16 KB | 99 |

**LCP sim.** es el valor de Lighthouse bajo throttling simulado (el que cuenta
para el score); **LCP obs.** es lo que ocurrió en la corrida real. La brecha
entre ambos es en sí un dato: el modelo simulado castiga la cadena de main
thread, y ahí es donde está el problema.

### Cadena de entrada `/`

`/` no lleva a `/survey` en un salto. Hace tres:

```
/  →307→  /tenant-site/{sub}/survey  →308→  /survey  →200
```

El 307 sale de `page.tsx:177` (redirige a la ruta interna absoluta); el 308 es
el middleware canonicalizando de vuelta. El 307 se sirve cacheado
(`x-vercel-cache: HIT`), pero el 308 **no**: el middleware corre en cada visita.

Medido desde una máquina de escritorio, 3 muestras por tenant: la cadena cuesta
**~195 ms** más que entrar directo a `/survey` (0.44 s vs 0.25 s). En móvil 4G,
con RTT de 150 ms, los dos saltos extra cuestan más.

## Lectura

**El trabajo de servidor está terminado.** TTFB de 63–65 ms en las 6 páginas,
`x-vercel-cache: HIT` en todas. 01 y 03 hicieron su trabajo y no queda nada que
ganar del lado del servidor. Cualquier optimización adicional de backend no se
va a notar.

**CLS es 0.000 en las 6 páginas.** No hay nada que arreglar ahí.

**El cuello de botella se movió al cliente, y es de terceros.** En `/survey` el
desglose del LCP simulado es:

| fase | avril-ramos | rosessa | pgc |
|---|---|---|---|
| TTFB | 683 ms | 686 ms | 684 ms |
| Load Delay | 0 ms | 0 ms | 0 ms |
| Load Time | 0 ms | 0 ms | 0 ms |
| **Render Delay** | **5433 ms** | **4386 ms** | **4330 ms** |

El elemento LCP es el `<h1>` del intro — texto, no imagen. `Load Delay` y
`Load Time` en 0 confirman que no espera ninguna descarga propia. Todo el costo
es render delay, y las dos tareas largas del trace son el pixel de Meta:

```
start=4978ms dur=129ms  /en_US/fbevents.js
start=5821ms dur=124ms  /signals/config/1794731378795850
start=3398ms dur= 91ms  /_next/static/chunks/4bd1b696…
```

El pixel además se carga en **cadena secuencial de 3 peticiones**
(`fbevents.js` → `signals/config` → `/tr/`), arrancando a los 604 ms.

## Cuellos de botella, priorizados

### 1. El pixel de Meta es el 54% de todo el JavaScript — 234 KB

`fbevents.js` (110 KB) + `signals/config` (123 KB). Es el bloque más pesado de
la página, la cadena de red más larga y las dos tareas largas del trace.

Evidencia: tabla de arriba (columna "de eso, Meta"), `third-party-summary`
(153 ms de blocking time), y `long-tasks`.

Es tráfico pagado, así que quitarlo no es opción — pero cargarlo diferido, tras
el primer pintado, saca 234 KB y dos tareas largas del camino crítico del LCP.
Esto es, con diferencia, la palanca más grande que queda.

### 2. Los logos se piden a `w=1920` para renderizarse a 160×64

Los cuatro `<Image fill>` del tenant-site no llevan `sizes`. Con `fill` y sin
`sizes`, Next asume `100vw` y pide la variante de 1920 px.

En el hero (`survey-form.tsx:157`) es correcto: sí ocupa la pantalla. En los
tres logos no:

- `survey/survey-form.tsx:172` — caja de `w-40 h-16` (160×64). **179 KB.**
- `thankyou/page.tsx:42`
- `not-elegible/page.tsx:45`

En avril-ramos el logo pesa **179 KB**, prácticamente lo mismo que el hero
(195 KB). Y el de `survey` se pinta con `filter: brightness(0) invert(1)`: se
descargan 179 KB de PNG a color para dibujar una silueta blanca sólida.

Agregar `sizes` es una línea por sitio.

### 3. La cadena de entrada de 3 saltos

~195 ms de sobrecosto medido en escritorio, más en móvil. El 308 no se cachea
en el edge. Se arregla haciendo que `page.tsx:177` redirija a la ruta pública
`/survey` en vez de a la interna — pero ojo, el comentario del middleware dice
que la ruta interna absoluta es deliberada: evita leer `host` con `headers()`,
que volvería la página dinámica y tiraría la caché. Hay que resolverlo sin
perder eso.

### 4. Nada más vale la pena todavía

TBT (57–194 ms) está dentro de umbral. CLS es 0. El bundle propio de Next
(~195 KB en `/survey`) es razonable para un formulario con react-hook-form y
framer-motion, y es menos de la mitad de lo que pesa el pixel. No tocarlo hasta
que 1 y 2 estén hechos y se vuelva a medir.

## Reproducir

Reportes crudos (JSON de Lighthouse) en el scratchpad de la sesión:
`reports/{tenant}--{página}.json`.

```
npx lighthouse@12 "https://<tenant>.notoriovs.com/survey" \
  --only-categories=performance --output=json --output-path=out.json \
  --chrome-flags="--headless=new"
```
