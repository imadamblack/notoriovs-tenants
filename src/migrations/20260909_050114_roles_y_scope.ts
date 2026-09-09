import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// EDITADA A MANO: al SQL generado se le agregaron los dos UPDATE que rellenan
// las filas que ya existen. Sin ellos, cada columna nueva se queda con su
// DEFAULT, y ese default está pensado para las altas futuras (el rol de menos
// privilegio), no para la gente que ya está dentro:
//
//  - `users`: todos los Internal User de hoy administran a todos los clientes;
//    eso es el estado real del sistema, no un descuido. Dejarlos en
//    `account-manager` sin Tenants asignados los dejaría entrando al panel sin
//    ver un solo cliente, y sin nadie arriba que pudiera arreglarlo.
//  - `tenant_users`: los usuarios de cliente que ya existen entraron cuando el
//    dashboard no distinguía roles, así que hoy pueden todo. `owner` conserva
//    eso; degradarlos en silencio les quitaría capacidades que ya usaban.
//
// De aquí en adelante, quién es superadmin y quién account manager se reparte
// desde el panel (ver src/access/internalRoles.ts).

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('superadmin', 'account-manager');
  CREATE TYPE "public"."enum_tenant_users_role" AS ENUM('owner', 'member');
  ALTER TABLE "users" ADD COLUMN "role" "enum_users_role" DEFAULT 'account-manager' NOT NULL;
  ALTER TABLE "tenant_users" ADD COLUMN "role" "enum_tenant_users_role" DEFAULT 'member' NOT NULL;
  UPDATE "users" SET "role" = 'superadmin';
  UPDATE "tenant_users" SET "role" = 'owner';
  CREATE INDEX "users_role_idx" ON "users" USING btree ("role");
  CREATE INDEX "tenant_users_role_idx" ON "tenant_users" USING btree ("role");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "users_role_idx";
  DROP INDEX "tenant_users_role_idx";
  ALTER TABLE "users" DROP COLUMN "role";
  ALTER TABLE "tenant_users" DROP COLUMN "role";
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_tenant_users_role";`)
}
