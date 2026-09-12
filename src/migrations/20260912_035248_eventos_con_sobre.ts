import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// El tubo único de eventos del ADR 0008. Esta migración **solo agrega**:
// `quiz_webhook` y `opt_in_webhook` se borran en una segunda, después de que el
// código nuevo esté desplegado (ver abajo).
//
// POR QUÉ PARTIDA EN DOS, que es lo único no obvio de este archivo. El build se
// niega a subir código adelantado al esquema (`migrate:check`), así que la
// migración se aplica ANTES de que el código nuevo esté vivo. O sea que durante
// unos minutos corre el código VIEJO contra el esquema nuevo. El código viejo
// nombra `quiz_webhook` en sus consultas a `tenants`: si esta migración la
// borrara, esos minutos serían el panel, los sitios de los clientes y el quiz
// caídos. Agregar una columna, en cambio, el código viejo ni la ve.
//
// El `UPDATE` es lo que hace que esta migración no apague a los clientes que ya
// existen: el campo se autogenera al crear el Tenant (hook `beforeValidate`),
// así que sin este relleno los que ya estaban dados de alta quedarían con el
// tubo vacío y sin recibir un solo aviso. La URL es la misma que tenían en
// `quiz_webhook`, que es la del workflow de ese cliente en n8n.
//
// OJO CON EL SNAPSHOT (`.json` de al lado): se generó desde la config, que ya
// no declara los campos viejos, así que dice que esas columnas no existen. La
// segunda migración —la que sí las borra— hay que escribirla a mano: el
// generador no va a proponer un borrado que él ya cree hecho. El SQL exacto
// está en docs/issues/cerrados/16-notificacion-de-lead-nuevo.md.

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "tenants" ADD COLUMN "events_webhook" varchar;

  UPDATE "tenants"
     SET "events_webhook" = 'https://n8n.notoriovs.com/webhook/' || "subdomain"
   WHERE "events_webhook" IS NULL OR "events_webhook" = '';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "tenants" DROP COLUMN "events_webhook";`)
}
