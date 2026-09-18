import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Issue #19: un Marketing Report pasa de ser una semana a ser un día.
// `week_start`/`week_end` no se pueden partir en días (ese detalle nunca se
// guardó), así que el histórico semanal se BORRA aquí a propósito — no es
// arrastre, está en el checklist del issue. Se repone corriendo el job
// diario de n8n sobre el rango de fechas viejo (Meta conserva hasta 37
// meses). El DELETE va ANTES de agregar `date NOT NULL`: si hubiera filas
// vivas, ese ADD COLUMN fallaría por no traer default (ver
// reference/migrations.md del skill de Payload).
//
// `reach`/`frequency` se van del modelo (no se pueden reconstruir sumando
// días). `cpm`/`ctr`/`cost_per_lead` también se van, pero por otra razón:
// siguen siendo calculables, pero como divisiones — se recalculan al vuelo
// sobre la ventana pedida en /api/tenant-dashboard/kpis, nunca se guardan,
// para que nadie termine promediando una columna que no se debe promediar.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DELETE FROM "marketing_reports";
  DROP INDEX IF EXISTS "tenant_weekStart_idx";
  ALTER TABLE "marketing_reports" ADD COLUMN IF NOT EXISTS "date" timestamp(3) with time zone NOT NULL;
  CREATE INDEX IF NOT EXISTS "tenant_date_idx" ON "marketing_reports" USING btree ("tenant_id","date");
  ALTER TABLE "marketing_reports" DROP COLUMN IF EXISTS "week_start";
  ALTER TABLE "marketing_reports" DROP COLUMN IF EXISTS "week_end";
  ALTER TABLE "marketing_reports" DROP COLUMN IF EXISTS "reach";
  ALTER TABLE "marketing_reports" DROP COLUMN IF EXISTS "frequency";
  ALTER TABLE "marketing_reports" DROP COLUMN IF EXISTS "cpm";
  ALTER TABLE "marketing_reports" DROP COLUMN IF EXISTS "ctr";
  ALTER TABLE "marketing_reports" DROP COLUMN IF EXISTS "cost_per_lead";`)
}

// El down tampoco restaura datos (no hay semanas reales que reconstruir
// desde días): deja la tabla vacía con el esquema viejo, igual que el up
// la deja vacía con el nuevo. Revertir esta migración es "vuelve al
// esquema semanal", no "recupera el histórico que se borró".
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DELETE FROM "marketing_reports";
  DROP INDEX IF EXISTS "tenant_date_idx";
  ALTER TABLE "marketing_reports" ADD COLUMN IF NOT EXISTS "week_start" timestamp(3) with time zone NOT NULL;
  ALTER TABLE "marketing_reports" ADD COLUMN IF NOT EXISTS "week_end" timestamp(3) with time zone NOT NULL;
  ALTER TABLE "marketing_reports" ADD COLUMN IF NOT EXISTS "reach" numeric;
  ALTER TABLE "marketing_reports" ADD COLUMN IF NOT EXISTS "frequency" numeric;
  ALTER TABLE "marketing_reports" ADD COLUMN IF NOT EXISTS "cpm" numeric;
  ALTER TABLE "marketing_reports" ADD COLUMN IF NOT EXISTS "ctr" numeric;
  ALTER TABLE "marketing_reports" ADD COLUMN IF NOT EXISTS "cost_per_lead" numeric;
  CREATE INDEX IF NOT EXISTS "tenant_weekStart_idx" ON "marketing_reports" USING btree ("tenant_id","week_start");
  ALTER TABLE "marketing_reports" DROP COLUMN IF EXISTS "date";`)
}
