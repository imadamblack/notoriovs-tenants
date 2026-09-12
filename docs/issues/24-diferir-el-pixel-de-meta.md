# 24: Diferir el pixel de Meta fuera del camino crítico

**What to build:** El pixel de Meta son 234 KB — el 54% de todo el JavaScript de
`/survey` — y aporta las dos tareas largas del trace. Se carga en cadena
secuencial de 3 peticiones (`fbevents.js` → `signals/config` → `/tr/`) empezando
a los 604 ms. Cargarlo después del primer pintado saca 234 KB y ~253 ms de tareas
largas del camino crítico del LCP.

**Blocked by:** 04 (línea base medida) — hecho

**Status:** ready-for-agent

**Evidencia:** `../mediciones/04-linea-base-web-vitals.md`, secciones "Lectura" y
cuello de botella 1.

## El riesgo, que es el punto del issue

Esto es tráfico pagado. Quitar el pixel no es opción y diferirlo mal es peor que
no tocarlo: si el usuario rebota antes de que dispare, se pierde el PageView y
con él la atribución. Cualquier implementación tiene que garantizar que el evento
sale, no solo que sale tarde.

Hay una decisión que tomar antes de escribir código: cuánto diferir (tras `load`,
en `requestIdleCallback`, en la primera interacción) y qué garantía de disparo se
acepta a cambio de los 234 KB.

- [ ] Decidido y documentado el punto de carga, con su garantía de disparo
- [ ] El PageView sigue llegando a Meta en los 3 tenants, verificado en el
      Events Manager, no solo en el network tab
- [ ] Los eventos de conversión del quiz (ver `src/services/fbEvents`) siguen
      disparando y atribuyendo igual
- [ ] Remedición con el mismo perfil: LCP y TBT de `/survey` contra la tabla de 04
- [ ] Ningún tenant queda sin pixel por una condición de carrera de hidratación
