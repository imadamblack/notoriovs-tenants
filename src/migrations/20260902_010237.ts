import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
  CREATE TYPE "public"."enum_tenants_blocks_cta_final_cta_target" AS ENUM('quiz', 'custom');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  CREATE TYPE "public"."enum_tenants_quiz_steps_type" AS ENUM('text', 'tel', 'number', 'textarea', 'radio', 'checkbox', 'select', 'state-mx', 'opt-in', 'checkpoint');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  CREATE TYPE "public"."enum_leads_status" AS ENUM('open', 'won', 'lost', 'disqualified');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  CREATE TYPE "public"."enum_leads_source" AS ENUM('quiz', 'manual');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  CREATE TYPE "public"."enum_payload_folders_folder_type" AS ENUM('media');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  CREATE TABLE IF NOT EXISTS "users_tenants" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tenant_id" integer NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "users" (
  	"id" serial PRIMARY KEY NOT NULL,
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
  
  CREATE TABLE IF NOT EXISTS "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"folder_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE IF NOT EXISTS "tenants_blocks_rich_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"body" varchar NOT NULL,
  	"cta_label" varchar,
  	"cta_link" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "tenants_blocks_stats_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"number" varchar NOT NULL,
  	"description" varchar NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "tenants_blocks_stats" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "tenants_blocks_criteria_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"body" varchar NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "tenants_blocks_criteria" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"intro" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "tenants_blocks_projects_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"zone" varchar,
  	"name" varchar NOT NULL,
  	"price" varchar,
  	"timeframe" varchar,
  	"description" varchar,
  	"badge" varchar,
  	"image_id" integer
  );
  
  CREATE TABLE IF NOT EXISTS "tenants_blocks_projects" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"intro" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "tenants_blocks_testimonials_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"message" varchar NOT NULL,
  	"name" varchar NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "tenants_blocks_testimonials" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "tenants_blocks_faq_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar NOT NULL,
  	"answer" varchar NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "tenants_blocks_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "tenants_blocks_cta_final" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar NOT NULL,
  	"body" varchar,
  	"cta_label" varchar,
  	"cta_target" "enum_tenants_blocks_cta_final_cta_target" DEFAULT 'quiz',
  	"cta_link" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "tenants_quiz_steps_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"value" varchar,
  	"disqualifies" boolean DEFAULT false
  );
  
  CREATE TABLE IF NOT EXISTS "tenants_quiz_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"type" "enum_tenants_quiz_steps_type" DEFAULT 'radio' NOT NULL,
  	"name" varchar NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"placeholder" varchar,
  	"required_message" varchar,
  	"cols" numeric,
  	"opt_in_active" boolean DEFAULT true,
  	"opt_in_fields_nombre_title" varchar DEFAULT 'Nombre',
  	"opt_in_fields_nombre_required_message" varchar DEFAULT 'Ingresa tu nombre',
  	"opt_in_fields_telefono_title" varchar DEFAULT 'Teléfono',
  	"opt_in_fields_telefono_required_message" varchar DEFAULT 'Ingresa tu teléfono',
  	"opt_in_fields_email_title" varchar DEFAULT 'Email',
  	"auto_advance" boolean DEFAULT false,
  	"checkpoint_content" jsonb,
  	"checkpoint_content_h_t_m_l" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "tenants_lead_pipeline" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"is_won" boolean DEFAULT false,
  	"is_lost" boolean DEFAULT false
  );
  
  CREATE TABLE IF NOT EXISTS "tenants" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"subdomain" varchar NOT NULL,
  	"active" boolean DEFAULT true,
  	"general_info_company_name" varchar NOT NULL,
  	"general_info_legal_name" varchar,
  	"general_info_phone" varchar,
  	"general_info_whatsapp" varchar,
  	"general_info_email" varchar,
  	"general_info_address" varchar,
  	"general_info_logo_id" integer,
  	"general_info_privacy_notice_url" varchar DEFAULT '/privacy-notice',
  	"general_info_terms_url" varchar DEFAULT '/terms-and-conditions',
  	"landing_hero_title" varchar,
  	"landing_hero_subtitle" varchar,
  	"landing_hero_image_id" integer,
  	"landing_hero_cta_label" varchar,
  	"landing_hero_cta_link" varchar,
  	"quiz_intro_title" varchar,
  	"quiz_intro_description" varchar,
  	"quiz_intro_image_id" integer,
  	"quiz_intro_cta_label" varchar,
  	"thank_you_page_title" varchar,
  	"thank_you_page_subtitle" varchar,
  	"thank_you_page_content" jsonb,
  	"thank_you_page_content_h_t_m_l" varchar,
  	"not_eligible_page_title" varchar,
  	"not_eligible_page_subtitle" varchar,
  	"not_eligible_page_content" jsonb,
  	"not_eligible_page_content_h_t_m_l" varchar,
  	"opt_in_webhook" varchar,
  	"quiz_webhook" varchar,
  	"tracking_meta_pixel_id" varchar,
  	"tracking_meta_capi_token" varchar,
  	"tracking_google_tag_id" varchar,
  	"dashboard_password" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "leads" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"name" varchar,
  	"phone" varchar,
  	"whatsapp" varchar,
  	"email" varchar,
  	"stage" varchar NOT NULL,
  	"status" "enum_leads_status" DEFAULT 'open' NOT NULL,
  	"source" "enum_leads_source" DEFAULT 'quiz',
  	"notes" varchar,
  	"answers" jsonb,
  	"utm" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "marketing_reports" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"week_start" timestamp(3) with time zone NOT NULL,
  	"week_end" timestamp(3) with time zone NOT NULL,
  	"campaign" varchar NOT NULL,
  	"impressions" numeric,
  	"reach" numeric,
  	"frequency" numeric,
  	"cpm" numeric,
  	"clicks" numeric,
  	"ctr" numeric,
  	"landing_page_views" numeric,
  	"leads" numeric,
  	"cost_per_lead" numeric,
  	"spend" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "marketing_reports_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "payload_folders_folder_type" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_payload_folders_folder_type",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "payload_folders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"folder_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"media_id" integer,
  	"tenants_id" integer,
  	"leads_id" integer,
  	"marketing_reports_id" integer,
  	"payload_folders_id" integer
  );
  
  CREATE TABLE IF NOT EXISTS "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE IF NOT EXISTS "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  DO $$ BEGIN
  ALTER TABLE "users_tenants" ADD CONSTRAINT "users_tenants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  ALTER TABLE "users_tenants" ADD CONSTRAINT "users_tenants_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  ALTER TABLE "media" ADD CONSTRAINT "media_folder_id_payload_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."payload_folders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  ALTER TABLE "tenants_blocks_rich_text" ADD CONSTRAINT "tenants_blocks_rich_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  ALTER TABLE "tenants_blocks_stats_items" ADD CONSTRAINT "tenants_blocks_stats_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tenants_blocks_stats"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  ALTER TABLE "tenants_blocks_stats" ADD CONSTRAINT "tenants_blocks_stats_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  ALTER TABLE "tenants_blocks_criteria_items" ADD CONSTRAINT "tenants_blocks_criteria_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tenants_blocks_criteria"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  ALTER TABLE "tenants_blocks_criteria" ADD CONSTRAINT "tenants_blocks_criteria_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  ALTER TABLE "tenants_blocks_projects_items" ADD CONSTRAINT "tenants_blocks_projects_items_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  ALTER TABLE "tenants_blocks_projects_items" ADD CONSTRAINT "tenants_blocks_projects_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tenants_blocks_projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  ALTER TABLE "tenants_blocks_projects" ADD CONSTRAINT "tenants_blocks_projects_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  ALTER TABLE "tenants_blocks_testimonials_items" ADD CONSTRAINT "tenants_blocks_testimonials_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tenants_blocks_testimonials"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  ALTER TABLE "tenants_blocks_testimonials" ADD CONSTRAINT "tenants_blocks_testimonials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  ALTER TABLE "tenants_blocks_faq_items" ADD CONSTRAINT "tenants_blocks_faq_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tenants_blocks_faq"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  ALTER TABLE "tenants_blocks_faq" ADD CONSTRAINT "tenants_blocks_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  ALTER TABLE "tenants_blocks_cta_final" ADD CONSTRAINT "tenants_blocks_cta_final_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  ALTER TABLE "tenants_quiz_steps_options" ADD CONSTRAINT "tenants_quiz_steps_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tenants_quiz_steps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  ALTER TABLE "tenants_quiz_steps" ADD CONSTRAINT "tenants_quiz_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  ALTER TABLE "tenants_lead_pipeline" ADD CONSTRAINT "tenants_lead_pipeline_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  ALTER TABLE "tenants" ADD CONSTRAINT "tenants_general_info_logo_id_media_id_fk" FOREIGN KEY ("general_info_logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  ALTER TABLE "tenants" ADD CONSTRAINT "tenants_landing_hero_image_id_media_id_fk" FOREIGN KEY ("landing_hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  ALTER TABLE "tenants" ADD CONSTRAINT "tenants_quiz_intro_image_id_media_id_fk" FOREIGN KEY ("quiz_intro_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  ALTER TABLE "leads" ADD CONSTRAINT "leads_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  ALTER TABLE "marketing_reports" ADD CONSTRAINT "marketing_reports_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  ALTER TABLE "marketing_reports_texts" ADD CONSTRAINT "marketing_reports_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."marketing_reports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  ALTER TABLE "payload_folders_folder_type" ADD CONSTRAINT "payload_folders_folder_type_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_folders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  ALTER TABLE "payload_folders" ADD CONSTRAINT "payload_folders_folder_id_payload_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."payload_folders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tenants_fk" FOREIGN KEY ("tenants_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_leads_fk" FOREIGN KEY ("leads_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_marketing_reports_fk" FOREIGN KEY ("marketing_reports_id") REFERENCES "public"."marketing_reports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_folders_fk" FOREIGN KEY ("payload_folders_id") REFERENCES "public"."payload_folders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  DO $$ BEGIN
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
  CREATE INDEX IF NOT EXISTS "users_tenants_order_idx" ON "users_tenants" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "users_tenants_parent_id_idx" ON "users_tenants" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "users_tenants_tenant_idx" ON "users_tenants" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX IF NOT EXISTS "media_folder_idx" ON "media" USING btree ("folder_id");
  CREATE INDEX IF NOT EXISTS "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX IF NOT EXISTS "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX IF NOT EXISTS "tenants_blocks_rich_text_order_idx" ON "tenants_blocks_rich_text" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "tenants_blocks_rich_text_parent_id_idx" ON "tenants_blocks_rich_text" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "tenants_blocks_rich_text_path_idx" ON "tenants_blocks_rich_text" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "tenants_blocks_stats_items_order_idx" ON "tenants_blocks_stats_items" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "tenants_blocks_stats_items_parent_id_idx" ON "tenants_blocks_stats_items" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "tenants_blocks_stats_order_idx" ON "tenants_blocks_stats" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "tenants_blocks_stats_parent_id_idx" ON "tenants_blocks_stats" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "tenants_blocks_stats_path_idx" ON "tenants_blocks_stats" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "tenants_blocks_criteria_items_order_idx" ON "tenants_blocks_criteria_items" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "tenants_blocks_criteria_items_parent_id_idx" ON "tenants_blocks_criteria_items" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "tenants_blocks_criteria_order_idx" ON "tenants_blocks_criteria" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "tenants_blocks_criteria_parent_id_idx" ON "tenants_blocks_criteria" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "tenants_blocks_criteria_path_idx" ON "tenants_blocks_criteria" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "tenants_blocks_projects_items_order_idx" ON "tenants_blocks_projects_items" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "tenants_blocks_projects_items_parent_id_idx" ON "tenants_blocks_projects_items" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "tenants_blocks_projects_items_image_idx" ON "tenants_blocks_projects_items" USING btree ("image_id");
  CREATE INDEX IF NOT EXISTS "tenants_blocks_projects_order_idx" ON "tenants_blocks_projects" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "tenants_blocks_projects_parent_id_idx" ON "tenants_blocks_projects" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "tenants_blocks_projects_path_idx" ON "tenants_blocks_projects" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "tenants_blocks_testimonials_items_order_idx" ON "tenants_blocks_testimonials_items" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "tenants_blocks_testimonials_items_parent_id_idx" ON "tenants_blocks_testimonials_items" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "tenants_blocks_testimonials_order_idx" ON "tenants_blocks_testimonials" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "tenants_blocks_testimonials_parent_id_idx" ON "tenants_blocks_testimonials" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "tenants_blocks_testimonials_path_idx" ON "tenants_blocks_testimonials" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "tenants_blocks_faq_items_order_idx" ON "tenants_blocks_faq_items" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "tenants_blocks_faq_items_parent_id_idx" ON "tenants_blocks_faq_items" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "tenants_blocks_faq_order_idx" ON "tenants_blocks_faq" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "tenants_blocks_faq_parent_id_idx" ON "tenants_blocks_faq" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "tenants_blocks_faq_path_idx" ON "tenants_blocks_faq" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "tenants_blocks_cta_final_order_idx" ON "tenants_blocks_cta_final" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "tenants_blocks_cta_final_parent_id_idx" ON "tenants_blocks_cta_final" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "tenants_blocks_cta_final_path_idx" ON "tenants_blocks_cta_final" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "tenants_quiz_steps_options_order_idx" ON "tenants_quiz_steps_options" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "tenants_quiz_steps_options_parent_id_idx" ON "tenants_quiz_steps_options" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "tenants_quiz_steps_order_idx" ON "tenants_quiz_steps" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "tenants_quiz_steps_parent_id_idx" ON "tenants_quiz_steps" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "tenants_lead_pipeline_order_idx" ON "tenants_lead_pipeline" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "tenants_lead_pipeline_parent_id_idx" ON "tenants_lead_pipeline" USING btree ("_parent_id");
  CREATE UNIQUE INDEX IF NOT EXISTS "tenants_subdomain_idx" ON "tenants" USING btree ("subdomain");
  CREATE INDEX IF NOT EXISTS "tenants_general_info_general_info_logo_idx" ON "tenants" USING btree ("general_info_logo_id");
  CREATE INDEX IF NOT EXISTS "tenants_landing_hero_landing_hero_image_idx" ON "tenants" USING btree ("landing_hero_image_id");
  CREATE INDEX IF NOT EXISTS "tenants_quiz_intro_quiz_intro_image_idx" ON "tenants" USING btree ("quiz_intro_image_id");
  CREATE INDEX IF NOT EXISTS "tenants_updated_at_idx" ON "tenants" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "tenants_created_at_idx" ON "tenants" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "leads_tenant_idx" ON "leads" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "leads_stage_idx" ON "leads" USING btree ("stage");
  CREATE INDEX IF NOT EXISTS "leads_status_idx" ON "leads" USING btree ("status");
  CREATE INDEX IF NOT EXISTS "leads_updated_at_idx" ON "leads" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "leads_created_at_idx" ON "leads" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "tenant_stage_idx" ON "leads" USING btree ("tenant_id","stage");
  CREATE INDEX IF NOT EXISTS "tenant_status_idx" ON "leads" USING btree ("tenant_id","status");
  CREATE INDEX IF NOT EXISTS "tenant_createdAt_idx" ON "leads" USING btree ("tenant_id","created_at");
  CREATE INDEX IF NOT EXISTS "marketing_reports_tenant_idx" ON "marketing_reports" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "marketing_reports_updated_at_idx" ON "marketing_reports" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "marketing_reports_created_at_idx" ON "marketing_reports" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "tenant_weekStart_idx" ON "marketing_reports" USING btree ("tenant_id","week_start");
  CREATE INDEX IF NOT EXISTS "marketing_reports_texts_order_parent" ON "marketing_reports_texts" USING btree ("order","parent_id");
  CREATE UNIQUE INDEX IF NOT EXISTS "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX IF NOT EXISTS "payload_folders_folder_type_order_idx" ON "payload_folders_folder_type" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "payload_folders_folder_type_parent_idx" ON "payload_folders_folder_type" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "payload_folders_name_idx" ON "payload_folders" USING btree ("name");
  CREATE INDEX IF NOT EXISTS "payload_folders_folder_idx" ON "payload_folders" USING btree ("folder_id");
  CREATE INDEX IF NOT EXISTS "payload_folders_updated_at_idx" ON "payload_folders" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "payload_folders_created_at_idx" ON "payload_folders" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_tenants_id_idx" ON "payload_locked_documents_rels" USING btree ("tenants_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_leads_id_idx" ON "payload_locked_documents_rels" USING btree ("leads_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_marketing_reports_id_idx" ON "payload_locked_documents_rels" USING btree ("marketing_reports_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_payload_folders_id_idx" ON "payload_locked_documents_rels" USING btree ("payload_folders_id");
  CREATE INDEX IF NOT EXISTS "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX IF NOT EXISTS "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX IF NOT EXISTS "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX IF NOT EXISTS "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
-- Columnas nuevas en tablas que ya existian antes de esta migracion.
-- CREATE TABLE IF NOT EXISTS de arriba no las agrega si la tabla ya
-- existia, asi que se agregan aqui de forma explicita e idempotente.
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "dashboard_password" varchar;
ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "leads_id" integer;
ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "marketing_reports_id" integer;
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "folder_id" integer;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  -- Solo revierte lo que esta migracion agrega de verdad: las tablas
  -- nuevas de este PR (leads, marketing_reports, users_tenants del plugin
  -- de multi-tenant, tenants_lead_pipeline) y las 2 columnas nuevas en
  -- tablas que ya existian. NO toca users, media, tenants, las tablas de
  -- bloques del sitio, ni las tablas core de Payload (payload_kv,
  -- payload_folders*, payload_locked_documents*, payload_preferences*,
  -- payload_migrations) porque esas ya existian antes de este PR.
  DROP TABLE IF EXISTS "leads" CASCADE;
  DROP TABLE IF EXISTS "marketing_reports_texts" CASCADE;
  DROP TABLE IF EXISTS "marketing_reports" CASCADE;
  DROP TABLE IF EXISTS "users_tenants" CASCADE;
  DROP TABLE IF EXISTS "tenants_lead_pipeline" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "leads_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "marketing_reports_id";
  ALTER TABLE "tenants" DROP COLUMN IF EXISTS "dashboard_password";
  DROP TYPE IF EXISTS "public"."enum_leads_status";
  DROP TYPE IF EXISTS "public"."enum_leads_source";
`)
}
