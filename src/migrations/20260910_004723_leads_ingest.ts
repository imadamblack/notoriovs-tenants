import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Lo que necesita POST /api/leads/ingest, el endpoint por el que n8n mete
// Leads que no pasaron por el quiz (ver el issue 11):
//
//   - tres valores más en `source` (meta, whatsapp, import), para que un lead
//     de Meta Ads no tenga que disfrazarse de `manual`;
//   - `external_id`, el id que el lead trae de su sistema de origen. Es lo
//     único que permite que n8n reintente el mismo envío sin duplicar: el
//     endpoint busca por (tenant, external_id) y actualiza si ya existe. De
//     ahí el índice compuesto; el simple lo pone Payload por el `index: true`
//     del campo.
//
// ORDEN DE DESPLIEGUE: primero la migración, después el código. Solo AGREGA
// (valores al enum, una columna nullable, dos índices), así que el código
// viejo la ignora sin enterarse.
//
// `ALTER TYPE ... ADD VALUE` corre dentro de la transacción de la migración:
// Postgres lo permite desde la 12 mientras el valor nuevo no se USE en esa
// misma transacción, y aquí no se usa (dev corre 16, producción 18).

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_leads_source" ADD VALUE 'meta';
  ALTER TYPE "public"."enum_leads_source" ADD VALUE 'whatsapp';
  ALTER TYPE "public"."enum_leads_source" ADD VALUE 'import';
  ALTER TABLE "leads" ADD COLUMN "external_id" varchar;
  CREATE INDEX "leads_external_id_idx" ON "leads" USING btree ("external_id");
  CREATE INDEX "tenant_externalId_idx" ON "leads" USING btree ("tenant_id","external_id");`)
}

// Volver atrás achica el enum a ('quiz', 'manual'), y el cast de vuelta
// revienta si quedó aunque sea un lead con uno de los valores nuevos. Por eso
// el UPDATE de arriba: esos leads pasan a `manual`, que es lo más cercano a la
// verdad (entraron sin pasar por el quiz). Se pierde de qué canal vinieron —
// es el precio de revertir, y por eso `external_id` se borra al final: sin él
// no queda ni rastro del ingest.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   UPDATE "leads" SET "source" = 'manual' WHERE "source" IN ('meta', 'whatsapp', 'import');
  ALTER TABLE "leads" ALTER COLUMN "source" SET DATA TYPE text;
  ALTER TABLE "leads" ALTER COLUMN "source" SET DEFAULT 'quiz'::text;
  DROP TYPE "public"."enum_leads_source";
  CREATE TYPE "public"."enum_leads_source" AS ENUM('quiz', 'manual');
  ALTER TABLE "leads" ALTER COLUMN "source" SET DEFAULT 'quiz'::"public"."enum_leads_source";
  ALTER TABLE "leads" ALTER COLUMN "source" SET DATA TYPE "public"."enum_leads_source" USING "source"::"public"."enum_leads_source";
  DROP INDEX "leads_external_id_idx";
  DROP INDEX "tenant_externalId_idx";
  ALTER TABLE "leads" DROP COLUMN "external_id";`)
}
