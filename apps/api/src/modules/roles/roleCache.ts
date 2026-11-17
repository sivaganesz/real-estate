import { effectivePermissions, isSystemRole, SYSTEM_ROLES } from '@real-estate/shared';
import type { Permission, RoleKey } from '@real-estate/shared';
import type { RoleDoc } from './role.model';
import { RoleModel } from './role.model';

export interface ResolvedRole {
  key: RoleKey;
  name: string;
  description: string;
  system: boolean;
  /** Effective permissions (Admin: the whole catalogue). */
  permissions: Permission[];
}

/** Safety net when more than one API instance runs: other instances reload this often. */
const TTL_MS = 30_000;

let cache: { loadedAt: number; roles: Map<RoleKey, ResolvedRole> } | null = null;
let loading: Promise<Map<RoleKey, ResolvedRole>> | null = null;

function fromDefaults(key: RoleKey): ResolvedRole | null {
  if (!isSystemRole(key)) return null;
  const def = SYSTEM_ROLES[key];
  return {
    key,
    name: def.name,
    description: def.description,
    system: true,
    permissions: effectivePermissions(key, def.permissions),
  };
}

async function load(): Promise<Map<RoleKey, ResolvedRole>> {
  const docs = await RoleModel.find().lean<RoleDoc[]>();
  const roles = new Map<RoleKey, ResolvedRole>();
  for (const doc of docs) {
    roles.set(doc.key, {
      key: doc.key,
      name: doc.name,
      description: doc.description ?? '',
      system: doc.system,
      permissions: effectivePermissions(doc.key, doc.permissions ?? []),
    });
  }
  return roles;
}

/**
 * Role → permissions, cached in memory (TRD §6.1). Every role write calls
 * `invalidateRoles()`, so a change applies to this instance on the next request. A system
 * role not yet in the database (fresh install before migrations, tests) uses its defaults.
 */
export async function resolveRole(key: RoleKey): Promise<ResolvedRole | null> {
  if (!cache || Date.now() - cache.loadedAt > TTL_MS) {
    const gen = generation;
    loading ??= load().finally(() => {
      loading = null;
    });
    const roles = await loading;
    // A role changed while this load was running: its result may be stale, so don't keep it.
    if (gen === generation) cache = { loadedAt: Date.now(), roles };
    else return (await load()).get(key) ?? fromDefaults(key);
  }
  return cache!.roles.get(key) ?? fromDefaults(key);
}

/** Bumped by every role write; loads started before it are discarded. */
let generation = 0;

export function invalidateRoles(): void {
  generation++;
  cache = null;
  loading = null;
}
