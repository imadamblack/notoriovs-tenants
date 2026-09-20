import * as migration_20260902_010237 from './20260902_010237';
import * as migration_20260908_233634_tenant_users from './20260908_233634_tenant_users';
import * as migration_20260909_050114_roles_y_scope from './20260909_050114_roles_y_scope';
import * as migration_20260909_101800_retirar_contrasena_compartida from './20260909_101800_retirar_contrasena_compartida';
import * as migration_20260910_004723_leads_ingest from './20260910_004723_leads_ingest';
import * as migration_20260910_224316_exportar_leads_csv from './20260910_224316_exportar_leads_csv';
import * as migration_20260912_035248_eventos_con_sobre from './20260912_035248_eventos_con_sobre';
import * as migration_20260912_194122_borrar_webhooks_viejos from './20260912_194122_borrar_webhooks_viejos';
import * as migration_20260918_151144_ingest_diario_marketing_reports from './20260918_151144_ingest_diario_marketing_reports';
import * as migration_20260918_191357_marketing_reports_date_a_mediodia from './20260918_191357_marketing_reports_date_a_mediodia';
import * as migration_20260918_213811_meta_ad_account_id_en_tenants from './20260918_213811_meta_ad_account_id_en_tenants';
import * as migration_20260919_215911_media_original_filename from './20260919_215911_media_original_filename';
import * as migration_20260919_232839_push_subscriptions from './20260919_232839_push_subscriptions';

export const migrations = [
  {
    up: migration_20260902_010237.up,
    down: migration_20260902_010237.down,
    name: '20260902_010237',
  },
  {
    up: migration_20260908_233634_tenant_users.up,
    down: migration_20260908_233634_tenant_users.down,
    name: '20260908_233634_tenant_users',
  },
  {
    up: migration_20260909_050114_roles_y_scope.up,
    down: migration_20260909_050114_roles_y_scope.down,
    name: '20260909_050114_roles_y_scope',
  },
  {
    up: migration_20260909_101800_retirar_contrasena_compartida.up,
    down: migration_20260909_101800_retirar_contrasena_compartida.down,
    name: '20260909_101800_retirar_contrasena_compartida',
  },
  {
    up: migration_20260910_004723_leads_ingest.up,
    down: migration_20260910_004723_leads_ingest.down,
    name: '20260910_004723_leads_ingest',
  },
  {
    up: migration_20260910_224316_exportar_leads_csv.up,
    down: migration_20260910_224316_exportar_leads_csv.down,
    name: '20260910_224316_exportar_leads_csv',
  },
  {
    up: migration_20260912_035248_eventos_con_sobre.up,
    down: migration_20260912_035248_eventos_con_sobre.down,
    name: '20260912_035248_eventos_con_sobre',
  },
  {
    up: migration_20260912_194122_borrar_webhooks_viejos.up,
    down: migration_20260912_194122_borrar_webhooks_viejos.down,
    name: '20260912_194122_borrar_webhooks_viejos',
  },
  {
    up: migration_20260918_151144_ingest_diario_marketing_reports.up,
    down: migration_20260918_151144_ingest_diario_marketing_reports.down,
    name: '20260918_151144_ingest_diario_marketing_reports',
  },
  {
    up: migration_20260918_191357_marketing_reports_date_a_mediodia.up,
    down: migration_20260918_191357_marketing_reports_date_a_mediodia.down,
    name: '20260918_191357_marketing_reports_date_a_mediodia',
  },
  {
    up: migration_20260918_213811_meta_ad_account_id_en_tenants.up,
    down: migration_20260918_213811_meta_ad_account_id_en_tenants.down,
    name: '20260918_213811_meta_ad_account_id_en_tenants',
  },
  {
    up: migration_20260919_215911_media_original_filename.up,
    down: migration_20260919_215911_media_original_filename.down,
    name: '20260919_215911_media_original_filename',
  },
  {
    up: migration_20260919_232839_push_subscriptions.up,
    down: migration_20260919_232839_push_subscriptions.down,
    name: '20260919_232839_push_subscriptions'
  },
];
