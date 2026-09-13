# Las métricas de ads se ingestan por día y las ventanas se calculan aquí

La unidad que se guarda de un Marketing Report es **un día** de una campaña.
Semana, mes y cualquier otra ventana se calculan en plataforma sumando días. La
ingesta corre diario y trae una **ventana móvil de los últimos 7 días**, pisando
lo que ya había. **`reach` y `frequency` salen del modelo.**

Esto reemplaza lo que decía el issue 19 en su primera versión: una granularidad
declarada por reporte (semanal o mensual), cada una ingestada por separado desde
la fuente.

## Lo que había, y por qué la premisa estaba a medias

El argumento contra calcular ventanas era que `reach`, `frequency`, `cpm` y
`ctr` no son aditivos, así que un mes no puede ser la suma de sus semanas. La
primera mitad es cierta y la segunda no:

| Métrica | ¿Se reconstruye desde días? |
| --- | --- |
| `spend`, `impressions`, `clicks`, `leads`, `landingPageViews` | **Sí**, se suman |
| `cpm`, `ctr`, `costPerLead` | **Sí**: son divisiones entre sumas. No se promedian los días, se divide el acumulado de la ventana |
| `reach`, `frequency` | **No**. La misma persona alcanzada el lunes y el jueves cuenta una vez en la semana, y el dato diario no dice quién era |

O sea que el obstáculo no era la granularidad: eran **dos** métricas de nueve. Y
mantener un segundo tubo de ingesta por mes, para siempre, solo por esas dos, es
caro en el lugar equivocado.

`reach` y `frequency` **se sueltan**. Son métricas de quien opera la pauta, no de
quien es dueño del negocio: lo que el cliente necesita saber es cuánto gastó,
cuántos Leads entraron y a qué costo. El día que alguien las pida, entran como lo
que son —una traída aparte, por ventana, desde la fuente— y no como la razón por
la que todo el modelo carga una granularidad declarada.

## Por qué la ventana móvil, y no "traer ayer"

La fuente sigue acomodando conversiones atribuidas a un día durante 24-72 horas.
Un job que trae ayer una sola vez y lo congela produce totales que **nunca**
cuadran con lo que el cliente ve en su propio Ads Manager. Ese descuadre no se
lee como un detalle de atribución: se lee como que el dashboard miente, y de ahí
no se recupera la confianza en el resto de los números.

Por eso el job no trae un día, trae siete y pisa. Lo que hace seguro pisar es la
llave `(tenant, campaña, día)`: reingestar **actualiza**, nunca inserta. Es el
mismo mecanismo con el que un Lead se puede reintentar sin duplicarse.

## Consecuencias

- El histórico semanal existente se **borra**: no se puede abrir en días porque
  ese detalle nunca se guardó. Se repone corriendo el job diario sobre un rango
  viejo (la fuente conserva hasta 37 meses). Conservar las dos formas de guardar
  lo mismo dejaría dos texturas en las gráficas del cliente y un modelo que
  nadie se atreve a tocar después.
- Las gráficas de tendencia pasan de cuatro puntos por mes a treinta. Es el
  efecto secundario más valioso, y el que hace que las Recomendaciones creativas
  (issue 20) puedan hablar de qué pasó **dentro** del mes.
- Nada debe promediar una columna derivada. Si `cpm`, `ctr` o `costPerLead` se
  siguen guardando por día, es dato de conveniencia: la ventana los recalcula.
  El modo de falla es alguien sacando el promedio de la columna y publicándolo.
- El día de hoy y los de la ventana móvil son **provisionales** por diseño. Si
  en algún momento el dashboard necesita distinguir "cerrado" de "todavía se
  mueve", esa distinción sale de la fecha, no de un campo nuevo.
