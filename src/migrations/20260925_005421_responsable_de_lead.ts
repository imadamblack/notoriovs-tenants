import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "tenant_users" ADD COLUMN "name" varchar;
  ALTER TABLE "leads" ADD COLUMN "assignee_id" integer;
  ALTER TABLE "leads" ADD CONSTRAINT "leads_assignee_id_tenant_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."tenant_users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "leads_assignee_idx" ON "leads" USING btree ("assignee_id");
  CREATE INDEX "tenant_assignee_idx" ON "leads" USING btree ("tenant_id","assignee_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "leads" DROP CONSTRAINT "leads_assignee_id_tenant_users_id_fk";
  
  DROP INDEX "leads_assignee_idx";
  DROP INDEX "tenant_assignee_idx";
  ALTER TABLE "tenant_users" DROP COLUMN "name";
  ALTER TABLE "leads" DROP COLUMN "assignee_id";`)
}
