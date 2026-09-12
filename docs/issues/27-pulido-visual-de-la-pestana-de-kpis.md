# 27: Pulido visual de la pestaña de KPIs

**What to build:** El reporte de KPIs funciona pero se ve sin terminar: las
cuatro secciones no comparten jerarquía y la gráfica de tendencia se quedó a
medias. Esto es pulido visual, no de datos — los números ya son correctos
desde el 06.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

## Notas del cliente

- [ ] Ajustar tamaños tipográficos y de barras en `KpiStageProgressSection`
- [ ] Cambiar `KpiTrendChart` a gráfica lineal de tendencia

## Lo que se notó al cerrar el 06

- [ ] `KpiStageProgressSection` y `KpiTrendChart` importan `SectionHeading` y no
      lo usan: son las dos únicas secciones sin encabezado, así que "Ventas" y
      "Marketing" se leen como secciones y estas dos como cajas sueltas
- [ ] Las dos anidan `bg-neutral-900 p-4` dentro de otro `bg-neutral-900 p-4`:
      doble caja y doble padding
- [ ] `KpiTrendChart` arma sus etiquetas con `dangerouslySetInnerHTML` solo para
      meter un `<br/>`, y trae el valor de cada punto comentado. Desde el 06 las
      barras en cero se pintan, así que un punto sin etiqueta se nota más — con
      la gráfica lineal esto se resuelve de todos modos
- [ ] Los `StatTile` no distinguen jerarquía: "Leads totales" pesa igual que
      "Impresiones", siendo uno el KPI principal y el otro un dato de apoyo

## Antes de empezar

Decidir si el alcance es solo la pestaña de KPIs o arrastra también al Kanban:
`StatTile` y el toolbar son compartidos, y tocarlos mueve las dos vistas.
