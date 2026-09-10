import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// La bitácora de exportaciones de Leads a CSV (colección `lead-exports`, ver
// issue 14).
//
// El `down` está EDITADO A MANO. El generador lo dejaba así: dropear
// `lead_exports` con CASCADE —que ya se lleva por delante la llave foránea de
// `payload_locked_documents_rels`— y acto seguido dropear esa misma llave por
// su nombre, que para entonces ya no existe. Tal cual venía, revertir esta
// migración truena a la mitad y deja la base con la columna colgada. Los
// `IF EXISTS` la hacen reversible de verdad.

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "lead_exports" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"exported_by_id" integer,
  	"exported_by_email" varchar NOT NULL,
  	"lead_count" numeric NOT NULL,
  	"filters_label" varchar NOT NULL,
  	"filters" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "lead_exports_id" integer;
  ALTER TABLE "lead_exports" ADD CONSTRAINT "lead_exports_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "lead_exports" ADD CONSTRAINT "lead_exports_exported_by_id_tenant_users_id_fk" FOREIGN KEY ("exported_by_id") REFERENCES "public"."tenant_users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "lead_exports_tenant_idx" ON "lead_exports" USING btree ("tenant_id");
  CREATE INDEX "lead_exports_exported_by_idx" ON "lead_exports" USING btree ("exported_by_id");
  CREATE INDEX "lead_exports_updated_at_idx" ON "lead_exports" USING btree ("updated_at");
  CREATE INDEX "lead_exports_created_at_idx" ON "lead_exports" USING btree ("created_at");
  CREATE INDEX "tenant_createdAt_1_idx" ON "lead_exports" USING btree ("tenant_id","created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_lead_exports_fk" FOREIGN KEY ("lead_exports_id") REFERENCES "public"."lead_exports"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_lead_exports_id_idx" ON "payload_locked_documents_rels" USING btree ("lead_exports_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "lead_exports" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "lead_exports" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_lead_exports_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_lead_exports_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "lead_exports_id";`)
}
