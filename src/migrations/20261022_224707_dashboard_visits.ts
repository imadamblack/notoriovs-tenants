import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "dashboard_visits" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"user_id" integer,
  	"user_email" varchar NOT NULL,
  	"ticket_hash" varchar NOT NULL,
  	"ticket_expires_at" timestamp(3) with time zone NOT NULL,
  	"entered_at" timestamp(3) with time zone,
  	"session_hash" varchar,
  	"session_expires_at" timestamp(3) with time zone,
  	"ended_at" timestamp(3) with time zone,
  	"return_url" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "dashboard_visits_id" integer;
  ALTER TABLE "dashboard_visits" ADD CONSTRAINT "dashboard_visits_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "dashboard_visits" ADD CONSTRAINT "dashboard_visits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "dashboard_visits_tenant_idx" ON "dashboard_visits" USING btree ("tenant_id");
  CREATE INDEX "dashboard_visits_user_idx" ON "dashboard_visits" USING btree ("user_id");
  CREATE UNIQUE INDEX "dashboard_visits_ticket_hash_idx" ON "dashboard_visits" USING btree ("ticket_hash");
  CREATE UNIQUE INDEX "dashboard_visits_session_hash_idx" ON "dashboard_visits" USING btree ("session_hash");
  CREATE INDEX "dashboard_visits_updated_at_idx" ON "dashboard_visits" USING btree ("updated_at");
  CREATE INDEX "dashboard_visits_created_at_idx" ON "dashboard_visits" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_dashboard_visits_fk" FOREIGN KEY ("dashboard_visits_id") REFERENCES "public"."dashboard_visits"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_dashboard_visits_id_idx" ON "payload_locked_documents_rels" USING btree ("dashboard_visits_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "dashboard_visits" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "dashboard_visits" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_dashboard_visits_fk";
  
  DROP INDEX "payload_locked_documents_rels_dashboard_visits_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "dashboard_visits_id";`)
}
