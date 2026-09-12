# 19: Marketing Reports mensuales además de semanales

**What to build:** Un Marketing Report declara su granularidad: semanal o
mensual. El corte mensual se ingesta desde la fuente, no se calcula sumando
semanas, porque alcance, frecuencia, CPM y CTR no son aditivos y los números no
cuadrarían con la plataforma de anuncios. Los reportes semanales que ya existen
se conservan.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Un Marketing Report tiene un periodo con fechas y una granularidad declarada
- [ ] Los reportes semanales existentes quedan migrados como semanales, sin pérdida
- [ ] La ingesta acepta ambas granularidades y rechaza un reporte sin granularidad
- [ ] Reingestar el mismo periodo y campaña actualiza en vez de duplicar
- [ ] El dashboard distingue con claridad qué está viendo, semanal o mensual
