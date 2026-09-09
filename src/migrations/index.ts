import * as migration_20260902_010237 from './20260902_010237';
import * as migration_20260908_233634_tenant_users from './20260908_233634_tenant_users';

export const migrations = [
  {
    up: migration_20260902_010237.up,
    down: migration_20260902_010237.down,
    name: '20260902_010237',
  },
  {
    up: migration_20260908_233634_tenant_users.up,
    down: migration_20260908_233634_tenant_users.down,
    name: '20260908_233634_tenant_users'
  },
];
