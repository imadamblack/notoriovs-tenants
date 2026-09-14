# 27: Pulido visual de la pestaña de KPIs

**Ola:** 1 (lanzamiento)

**What to build:** El reporte de KPIs funciona pero se ve sin terminar: las
cuatro secciones no comparten jerarquía y la gráfica de tendencia se quedó a
medias. Esto es pulido visual, no de datos — los números ya son correctos
desde el 06.

**Blocked by:** None (can start immediately)

**Status:** Hecho en la rama, **falta verlo en el dashboard real**. Lint y
`tsc` limpios; el layout se revisó en un render aislado con las mismas clases,
pero nadie lo ha abierto con datos de un tenant de verdad.

## Notas del cliente

- [x] Ajustar tamaños tipográficos y de barras en `KpiStageProgressSection`
- [x] Cambiar `KpiTrendChart` a gráfica lineal de tendencia

## Lo que se notó al cerrar el 06

- [x] `KpiStageProgressSection` y `KpiTrendChart` importan `SectionHeading` y no
      lo usan: son las dos únicas secciones sin encabezado, así que "Ventas" y
      "Marketing" se leen como secciones y estas dos como cajas sueltas
- [x] Las dos anidan `bg-neutral-900 p-4` dentro de otro `bg-neutral-900 p-4`:
      doble caja y doble padding
- [x] `KpiTrendChart` arma sus etiquetas con `dangerouslySetInnerHTML` solo para
      meter un `<br/>`, y trae el valor de cada punto comentado. Desde el 06 las
      barras en cero se pintan, así que un punto sin etiqueta se nota más — con
      la gráfica lineal esto se resuelve de todos modos
- [x] Los `StatTile` no distinguen jerarquía: "Leads totales" pesa igual que
      "Impresiones", siendo uno el KPI principal y el otro un dato de apoyo

## Antes de empezar

Decidir si el alcance es solo la pestaña de KPIs o arrastra también al Kanban:
`StatTile` y el toolbar son compartidos, y tocarlos mueve las dos vistas.

**Decidido: el alcance es solo la pestaña de KPIs.** `StatTile` y `ProgressBar`
resultaron ser exclusivos de las secciones de KPIs (no los usa nadie más), así
que se pudieron tocar sin mover el Kanban. Lo que sí es compartido —
`SectionHeading` (lo usa `TeamPanel`) y `PeriodFilter`— quedó intacto.

## Qué se cambió

**Jerarquía entre las cuatro secciones.** Las cuatro son ahora `<section>` con
`SectionHeading`: "Ventas", "Progreso por etapa", "Leads por semana",
"Marketing". El `<h1>` "Reporte" pasó de `ft-2` a `ft-3`, porque estaba del
mismo tamaño que los encabezados de sección y no se leía como título de la
pantalla. Las cuatro llevan `flex-col` explícito: el `section` global de
`globals.scss` es `flex flex-wrap md:flex-col`, así que abajo de 768 px el
encabezado y el contenido se acomodaban en fila.

**`StatTile` con tres pesos** (`emphasis`: `primary` / `default` / `support`).
`primary` es el número que resume la sección ("Leads totales", "Gasto total"),
`support` el dato de contexto que no se compara con los demás ("Impresiones").
De paso el tile adoptó el `rounded-xl border border-neutral-800` que ya usaba
la tabla de Marketing: antes era la única caja de la pestaña sin borde.

**`KpiStageProgressSection` ahora es un embudo** (fuera del alcance original:
esto sí es lógica, no pulido, y lo pidió el cliente al ver la pantalla). Cada
etapa cuenta los leads que llegaron AL MENOS hasta ahí, no los que están
sentados en ella hoy. Antes el dashboard de `ntrs` decía que 2 de 59 habían
hecho opt-in; ahora dice 59, 15, 8, 2. Se calcula como suma de sufijos sobre
`pipeline` en la ruta de KPIs (el pipeline ya viene en orden de embudo: es el
orden de las columnas del Kanban). El porcentaje se dejó sobre el total de
leads del periodo, no sobre la primera etapa, para que el hueco de la primera
barra sea exactamente el `otherCount` que la vista explica abajo. La vista
lleva una línea que lo dice, porque un "59" en la primera etapa se lee solo
como "59 atorados ahí".

Además de ese acumulado, cada etapa trae la **conversión contra la anterior**
(`stepPct`): es la que dice DÓNDE se cae el embudo, porque el porcentaje sobre
el total no distingue entre una etapa que pierde mucha gente y una que
simplemente hereda pocos leads de arriba. En `ntrs`: Survey pasa el 25.4% de
Opt In, "Agendó cita" el 53.3% de Survey y Paid el 25% de "Agendó cita" — o
sea, la fuga grande está en el primer salto, no al final. Se pinta ENTRE los
dos renglones que compara, no al lado del acumulado: puestos en la misma fila,
los dos porcentajes se confunden entre sí. Es `null` en la primera etapa y
también cuando la anterior venía en cero (ahí un "0%" se leería como una fuga
que no existe).

**`KpiStageProgressSection` (visual):** se fue la caja anidada, el encabezado ya es un
`SectionHeading` de verdad, y las etiquetas subieron de `text-sm text-neutral-600`
(casi invisible sobre `neutral-900`) a `-ft-1 text-neutral-300`. El riel de
`ProgressBar` pasó de `bg-neutral-100` a `bg-neutral-800`: un riel casi blanco
pesaba más que el dato.

**`KpiTrendChart`:** barras → línea. Es un `<polyline>` en SVG con coordenadas
en porcentaje, `preserveAspectRatio="none"` y `vectorEffect="non-scaling-stroke"`,
así que la gráfica es fluida sin medir el contenedor en el cliente. Cada punto
lleva su valor arriba (el que estaba comentado). Se fue el
`dangerouslySetInnerHTML`, y las fechas ahora se formatean con `timeZone: 'UTC'`:
`week` es un lunes UTC sin hora, y sin forzar UTC un navegador en México lo
corría al domingo previo — la etiqueta no coincidía con la semana de la tabla de
Marketing. Con más de 8 semanas las fechas se pintan salteadas para que no se
encimen (la última siempre sale).

## Falta

- [ ] Abrir la pestaña de KPIs de un tenant real y confirmar el resultado
      (los conteos del embudo ya se cuadraron contra la base de dev: 59 / 15 /
      8 / 2 para `ntrs`, que es justo lo que pidió el cliente)
- [ ] Revisarla en móvil (es donde el `flex-col` cambia comportamiento)
