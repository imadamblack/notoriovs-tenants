import * as migration_20260902_010237 from './20260902_010237';
import * as migration_20260908_233634_tenant_users from './20260908_233634_tenant_users';
import * as migration_20260909_050114_roles_y_scope from './20260909_050114_roles_y_scope';
import * as migration_20260909_101800_retirar_contrasena_compartida from './20260909_101800_retirar_contrasena_compartida';
import * as migration_20260910_004723_leads_ingest from './20260910_004723_leads_ingest';

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
    name: '20260910_004723_leads_ingest'
  },
];
