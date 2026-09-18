import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Corrige los días que ya se ingestaron con el bug de /api/marketing-reports/ingest:
// el `date` se guardaba a MEDIANOCHE UTC, y el panel de Payload muestra las
// fechas en la hora LOCAL del navegador (ver DateCell de @payloadcms/ui, que
// no tiene forma de forzar UTC sin un componente propio). Medianoche UTC cae
// en la tarde del día anterior para México (UTC-6), así que el 17 de
// septiembre se veía como "16 de septiembre, 6:00 PM" en el admin.
//
// ESCRITA A MANO, sin `.json` propio: no hay cambio de esquema, solo un
// UPDATE de datos (mismo patrón que `20260909_050114_roles_y_scope.ts`).
// El endpoint ya quedó arreglado para guardar a mediodía UTC de aquí en
// adelante; esta migración solo empareja lo que ya se guardó mal.
//
// El filtro por hora exacta (00:00:00 UTC) es a propósito angosto: solo
// toca las filas que de verdad tienen el bug, no cualquier fila que alguien
// haya creado a mano en el admin con otra hora.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "marketing_reports"
    SET "date" = "date" + INTERVAL '12 hours'
    WHERE ("date" AT TIME ZONE 'UTC')::time = '00:00:00';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "marketing_reports"
    SET "date" = "date" - INTERVAL '12 hours'
    WHERE ("date" AT TIME ZONE 'UTC')::time = '12:00:00';
  `)
}
