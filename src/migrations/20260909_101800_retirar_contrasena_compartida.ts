import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Se retira la contraseña compartida por Tenant: a partir de aquí el Dashboard
// de Cliente tiene una sola puerta, el Tenant User con su email y contraseña
// (ver el ADR 0001 y el issue 09).
//
// ORDEN DE DESPLIEGUE — al revés que las dos migraciones anteriores. Ellas
// AGREGABAN columnas, así que se podían aplicar antes de desplegar: el código
// viejo simplemente las ignoraba. Esta BORRA una que el código viejo pide en
// el `select` de la proyección `dashboardLogin`, así que aplicarla primero
// tumba el login del dashboard. Primero se despliega el código, después se
// corre esta migración.
//
// El `down` devuelve la columna, pero NO la contraseña: el valor se pierde con
// el DROP. Volver atrás deja a los tenants sin contraseña compartida, que es
// justamente el estado en el que ya estaban antes de aplicar esto — la única
// que quedaba viva se vació a mano desde el panel.

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "tenants" DROP COLUMN "dashboard_password";`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "tenants" ADD COLUMN "dashboard_password" varchar;`)
}
