# El esquema de la base lo gobiernan las migraciones, no el push de dev

La forma del esquema en la base de producción se define **solo** por las
migraciones commiteadas en `src/migrations/`. El push automático que hace
`next dev` queda como una comodidad local: nada que llegue a producción puede
depender de él.

Hasta ahora convivían las dos vías, y de hecho ganaba el push: al 2026-09-08 la
base de producción tenía todas sus tablas y **cero** migraciones registradas en
`payload_migrations`. El esquema real y la bitácora describían mundos distintos.

Eso ya había cobrado su primera factura: `tenants.lead_stuck_after_days` existía
en la base pero no en el snapshot de migraciones, así que la siguiente
migración generada la incluyó como columna nueva. Aplicarla habría fallado en
seco contra producción, y quitarle la línea habría dejado sin esa columna a
cualquier base construida desde cero. Es el modo de falla que se repite mientras
haya dos fuentes de verdad: cada cambio de esquema puede aplicarse dos veces o
ninguna, y no hay forma de saber cuál sin ir a mirar la base.

La alternativa —seguir con push— era gratis y funciona mientras haya una sola
persona desplegando y ningún dato que doliera perder. Deja de funcionar en
cuanto un despliegue automático reorganiza el esquema sin que nadie lo haya
revisado, que es exactamente lo que no se quiere con datos de clientes.

Para cerrar el hueco sin recrear nada, el esquema que ya existía se **selló**
como punto de partida: se marcó `20260902_010237` como aplicada sin ejecutar su
SQL (ver `docs/runbooks/sellar-baseline-de-migraciones.sql`) y de ahí en
adelante todo va por `payload migrate`. Se verificó que el esquema sellado y uno
construido desde cero solo con migraciones son byte por byte el mismo.

Sellar incluye **retirar la marca del push** (`name = 'dev'`, `batch = -1`, que
escribe `pushDevSchema`). No es cosmético: mientras esa marca esté, `payload
migrate` abre un diálogo interactivo advirtiendo pérdida de datos y se queda
esperando una respuesta. Comprobado — con la marca puesta y sin una persona
delante, el comando se cuelga indefinidamente y no aplica nada. Un despliegue
automático se quedaría colgado ahí.

Mientras se preparaba ese sellado, el push volvió a adelantarse: bastó reiniciar
el `next dev` de la máquina de desarrollo —que apunta al `.env`, o sea a
producción— para que las tablas de la migración siguiente aparecieran solas en
la base. Es la demostración más clara de por qué hacía falta esta decisión, y
deja una tarea aparte: **la base de desarrollo tiene que ser otra**.

## Consecuencias

- `payload migrate` es el único camino a producción. Un despliegue que cambie
  el esquema sin una migración commiteada es un bug, no un atajo.
- El push de dev sigue vivo en local, y por eso **la base local puede divergir
  del repo sin avisar**. La forma de comprobar que una migración hace lo que
  dice es aplicarla sobre una base limpia, no sobre la de todos los días.
- Una migración generada puede traer arrastre de la época del push. Hay que leer
  el SQL antes de commitearlo, no solo confiar en `migrate:create`.
- `payload_migrations` pasa a ser un registro con valor: si alguien vuelve a
  escribir ahí a mano, se pierde la única bitácora que queda.
- Comparar dos esquemas entre servidores de versiones distintas exige cuidado:
  las versiones nuevas de Postgres catalogan las restricciones `NOT NULL` en
  `pg_constraint` y las viejas no, así que una comparación ingenua inventa
  cientos de diferencias que no existen. La nulabilidad real se lee en las
  columnas. Ver `docs/runbooks/describir-esquema.sql`.
