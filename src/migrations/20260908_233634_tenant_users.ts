import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// EDITADA A MANO (sin aplicar en ningún lado todavía): a los dos ALTER de
// `tenants.lead_stuck_after_days` se les puso IF NOT EXISTS / IF EXISTS.
//
// Esa columna es arrastre de un cambio anterior que nunca tuvo migración: la
// base de producción ya la tiene (se creó por push de dev), pero el snapshot
// de migraciones no, así que el generador la metió aquí. Sin el IF NOT EXISTS
// esta migración truena en producción; sin la línea del todo, una base creada
// desde cero se quedaría sin la columna y el corte de "lead estancado" del
// dashboard dejaría de funcionar. Idempotente sirve para los dos casos.

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "tenant_users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "tenant_users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "lead_stuck_after_days" numeric DEFAULT 21;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "tenant_users_id" integer;
  ALTER TABLE "payload_preferences_rels" ADD COLUMN "tenant_users_id" integer;
  ALTER TABLE "tenant_users_sessions" ADD CONSTRAINT "tenant_users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tenant_users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "tenant_users_sessions_order_idx" ON "tenant_users_sessions" USING btree ("_order");
  CREATE INDEX "tenant_users_sessions_parent_id_idx" ON "tenant_users_sessions" USING btree ("_parent_id");
  CREATE INDEX "tenant_users_tenant_idx" ON "tenant_users" USING btree ("tenant_id");
  CREATE INDEX "tenant_users_updated_at_idx" ON "tenant_users" USING btree ("updated_at");
  CREATE INDEX "tenant_users_created_at_idx" ON "tenant_users" USING btree ("created_at");
  CREATE UNIQUE INDEX "tenant_users_email_idx" ON "tenant_users" USING btree ("email");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tenant_users_fk" FOREIGN KEY ("tenant_users_id") REFERENCES "public"."tenant_users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_tenant_users_fk" FOREIGN KEY ("tenant_users_id") REFERENCES "public"."tenant_users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_tenant_users_id_idx" ON "payload_locked_documents_rels" USING btree ("tenant_users_id");
  CREATE INDEX "payload_preferences_rels_tenant_users_id_idx" ON "payload_preferences_rels" USING btree ("tenant_users_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "tenant_users_sessions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tenant_users" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "tenant_users_sessions" CASCADE;
  DROP TABLE "tenant_users" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_tenant_users_fk";
  
  ALTER TABLE "payload_preferences_rels" DROP CONSTRAINT "payload_preferences_rels_tenant_users_fk";
  
  DROP INDEX "payload_locked_documents_rels_tenant_users_id_idx";
  DROP INDEX "payload_preferences_rels_tenant_users_id_idx";
  ALTER TABLE "tenants" DROP COLUMN IF EXISTS "lead_stuck_after_days";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "tenant_users_id";
  ALTER TABLE "payload_preferences_rels" DROP COLUMN "tenant_users_id";`)
}
