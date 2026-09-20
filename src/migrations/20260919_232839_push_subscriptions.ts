import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_push_subscriptions_notification_types" AS ENUM('lead-new');
  CREATE TABLE "push_subscriptions_notification_types" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_push_subscriptions_notification_types",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "push_subscriptions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"tenant_user_id" integer NOT NULL,
  	"endpoint" varchar NOT NULL,
  	"keys_p256dh" varchar NOT NULL,
  	"keys_auth" varchar NOT NULL,
  	"user_agent" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "push_subscriptions_id" integer;
  ALTER TABLE "push_subscriptions_notification_types" ADD CONSTRAINT "push_subscriptions_notification_types_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."push_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_tenant_user_id_tenant_users_id_fk" FOREIGN KEY ("tenant_user_id") REFERENCES "public"."tenant_users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "push_subscriptions_notification_types_order_idx" ON "push_subscriptions_notification_types" USING btree ("order");
  CREATE INDEX "push_subscriptions_notification_types_parent_idx" ON "push_subscriptions_notification_types" USING btree ("parent_id");
  CREATE INDEX "push_subscriptions_tenant_idx" ON "push_subscriptions" USING btree ("tenant_id");
  CREATE INDEX "push_subscriptions_tenant_user_idx" ON "push_subscriptions" USING btree ("tenant_user_id");
  CREATE UNIQUE INDEX "push_subscriptions_endpoint_idx" ON "push_subscriptions" USING btree ("endpoint");
  CREATE INDEX "push_subscriptions_updated_at_idx" ON "push_subscriptions" USING btree ("updated_at");
  CREATE INDEX "push_subscriptions_created_at_idx" ON "push_subscriptions" USING btree ("created_at");
  CREATE INDEX "tenant_tenantUser_idx" ON "push_subscriptions" USING btree ("tenant_id","tenant_user_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_push_subscriptions_fk" FOREIGN KEY ("push_subscriptions_id") REFERENCES "public"."push_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_push_subscriptions_id_idx" ON "payload_locked_documents_rels" USING btree ("push_subscriptions_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "push_subscriptions_notification_types" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "push_subscriptions" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "push_subscriptions_notification_types" CASCADE;
  DROP TABLE "push_subscriptions" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_push_subscriptions_fk";
  
  DROP INDEX "payload_locked_documents_rels_push_subscriptions_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "push_subscriptions_id";
  DROP TYPE "public"."enum_push_subscriptions_notification_types";`)
}
