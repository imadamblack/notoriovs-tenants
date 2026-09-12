import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// La segunda mitad del corte del ADR 0008: se van las dos columnas del contrato
// viejo, que desde el despliegue anterior ya no las lee nadie.
//
// POR QUÉ VA APARTE de `20260912_035248_eventos_con_sobre` (que es donde está el
// razonamiento largo): una migración se aplica ANTES de que el código nuevo esté
// vivo, porque el build se niega a subir código adelantado al esquema. Si el
// borrado hubiera viajado en aquélla, esos minutos habrían sido el código viejo
// —que todavía nombra `quiz_webhook` en sus consultas a `tenants`— corriendo
// contra una tabla sin esa columna: el panel, los sitios de los clientes y el
// quiz caídos. Ahora no hay tal ventana, porque ya no queda código que las
// nombre.
//
// ESCRITA A MANO, y no es pereza del generador: el snapshot (`.json`) de la
// migración anterior se generó desde la config, que ya no declara estos campos,
// así que para el generador estas columnas no existen y no propone borrarlas.
// Por lo mismo esta migración no trae `.json` propio: el estado al que lleva la
// base es exactamente el que aquel snapshot ya describe, así que la siguiente
// migración que alguien genere va a diferenciar contra el snapshot correcto.
//
// El `down` las devuelve vacías y no restaura sus valores: `quiz_webhook` se
// regeneraba solo en cada guardado del Tenant y `opt_in_webhook` nunca lo leyó
// nadie. Lo que sí hay que saber es que revertir esta migración NO devuelve el
// contrato viejo: eso lo tendría que revertir el código.

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "tenants" DROP COLUMN IF EXISTS "quiz_webhook";
  ALTER TABLE "tenants" DROP COLUMN IF EXISTS "opt_in_webhook";`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "tenants" ADD COLUMN "quiz_webhook" varchar;
  ALTER TABLE "tenants" ADD COLUMN "opt_in_webhook" varchar;`)
}
