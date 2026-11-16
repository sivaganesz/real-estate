import {
  ADMIN_ROLE,
  buildRoleMatrix,
  effectivePermissions,
  isSystemRole,
  normalizePermissions,
  PERMISSION_GROUPS,
  PERMISSION_INFO,
  PERMISSIONS,
  RESERVED_PERMISSIONS,
  SCOPED_AREAS,
  SYSTEM_ROLE_KEYS,
  SYSTEM_ROLES,
} from '@real-estate/shared';
import type {
  AuthUser,
  CreateRoleBody,
  Permission,
  PermissionCatalog,
  RoleInfo,
  RoleMatrixRow,
  RoleOption,
  UpdateRoleBody,
} from '@real-estate/shared';
import { newId } from '../../db/ids';
import { withTransaction } from '../../db/transaction';
import { versionConflict } from '../../db/versionPlugin';
import { AppError, notFound } from '../../lib/errors';
import { recordChange } from '../changeLogs/changeLog.service';
import { UserModel } from '../users/user.model';
import type { RoleDoc } from './role.model';
import { RoleModel } from './role.model';
import { invalidateRoles, resolveRole } from './roleCache';

const systemOrder = (key: string) => {
  const i = (SYSTEM_ROLE_KEYS as readonly string[]).indexOf(key);
  return i === -1 ? SYSTEM_ROLE_KEYS.length : i;
};

function rejectReserved(permissions: readonly string[]): void {
  const reserved = permissions.filter((p) => RESERVED_PERMISSIONS.includes(p as Permission));
  if (reserved.length > 0) {
    throw new AppError(
      422,
      'RESERVED_PERMISSION',
      'Managing users and roles is reserved for the Admin role.',
      reserved.map((p) => ({ path: 'permissions', message: p })),
    );
  }
}

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

/**
 * Role management (PRD v2 §4.2, TRD §6.1). Only Admin reaches these endpoints
 * (`roles:manage`, reserved). Every write is logged and clears the role cache, so the
 * change applies to affected users on their next request (ROLE-05).
 */
export class RolesService {
  /** Makes sure the three system roles exist (migration 0002 and tests). */
  static async ensureSystemRoles(): Promise<void> {
    for (const key of SYSTEM_ROLE_KEYS) {
      const def = SYSTEM_ROLES[key];
      await RoleModel.updateOne(
        { key },
        {
          $setOnInsert: {
            _id: newId(),
            key,
            name: def.name,
            description: def.description,
            system: true,
            permissions: key === ADMIN_ROLE ? [] : [...def.permissions],
          },
        },
        // Insert-only: an existing role must not look changed (no version bump, no updatedAt).
        { upsert: true, timestamps: false, skipVersionBump: true } as object,
      );
    }
    invalidateRoles();
  }

  catalog(): PermissionCatalog {
    return {
      groups: [...PERMISSION_GROUPS],
      permissions: PERMISSIONS.map((key) => ({
        key,
        label: PERMISSION_INFO[key].label,
        group: PERMISSION_INFO[key].group,
        sensitive: Boolean(PERMISSION_INFO[key].sensitive),
        reserved: Boolean(PERMISSION_INFO[key].reserved),
      })),
      scopedAreas: SCOPED_AREAS.map((a) => ({ ...a, own: [...a.own], all: [...a.all] })),
    };
  }

  async list(): Promise<{ roles: RoleInfo[]; matrix: RoleMatrixRow[] }> {
    await RolesService.ensureSystemRoles();
    const docs = await RoleModel.find().lean<RoleDoc[]>();
    const counts = new Map(
      (
        await UserModel.aggregate<{ _id: string; n: number }>([
          { $group: { _id: '$role', n: { $sum: 1 } } },
        ])
      ).map((c) => [c._id, c.n]),
    );
    const updaterIds = [...new Set(docs.map((d) => d.updatedBy).filter(Boolean))] as string[];
    const updaters = new Map(
      (
        await UserModel.find({ _id: { $in: updaterIds } })
          .select('name')
          .lean<{ _id: string; name: string }[]>()
      ).map((u) => [u._id, u.name]),
    );
    const roles = docs
      .sort((a, b) => systemOrder(a.key) - systemOrder(b.key) || a.name.localeCompare(b.name))
      .map((doc): RoleInfo => {
        const permissions = effectivePermissions(doc.key, doc.permissions ?? []);
        return {
          key: doc.key,
          name: doc.name,
          description: doc.description ?? '',
          system: doc.system,
          permissions,
          customised:
            isSystemRole(doc.key) &&
            doc.key !== ADMIN_ROLE &&
            !sameSet(permissions, normalizePermissions(SYSTEM_ROLES[doc.key].permissions)),
          userCount: counts.get(doc.key) ?? 0,
          updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : null,
          updatedBy:
            doc.updatedBy && updaters.has(doc.updatedBy)
              ? { id: doc.updatedBy, name: updaters.get(doc.updatedBy)! }
              : null,
          version: doc.version ?? 0,
        };
      });
    return { roles, matrix: buildRoleMatrix(roles) };
  }

  async options(): Promise<RoleOption[]> {
    const { roles } = await this.list();
    return roles.map(({ key, name, description, system }) => ({ key, name, description, system }));
  }

  private async find(key: string): Promise<RoleDoc> {
    await RolesService.ensureSystemRoles();
    const doc = await RoleModel.findOne({ key }).lean<RoleDoc>();
    if (!doc) throw notFound('Role not found');
    return doc;
  }

  private async get(key: string): Promise<RoleInfo> {
    const { roles } = await this.list();
    return roles.find((r) => r.key === key)!;
  }

  /** ROLE-04: a custom role from a name, a description and permissions. */
  async create(actor: AuthUser, input: CreateRoleBody): Promise<RoleInfo> {
    rejectReserved(input.permissions ?? []);
    const key = `r_${newId()}`;
    const permissions = normalizePermissions(input.permissions ?? []);
    try {
      await withTransaction(async () => {
        await RoleModel.create([
          {
            key,
            name: input.name,
            description: input.description ?? '',
            system: false,
            permissions,
            createdBy: actor.id,
            updatedBy: actor.id,
          },
        ]);
        await recordChange({
          actorId: actor.id,
          entity: 'role',
          entityId: key,
          action: 'role_created',
          changes: { name: [null, input.name], permissions: [null, permissions] },
        });
      });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) throw duplicateName();
      throw err;
    }
    invalidateRoles();
    return this.get(key);
  }

  /**
   * ROLE-05: custom roles fully; Sales Manager / Executive permissions only; Admin never.
   * `expectedVersion` (If-Match) rejects an edit based on an outdated copy.
   */
  async update(
    actor: AuthUser,
    key: string,
    input: UpdateRoleBody,
    expectedVersion: number,
  ): Promise<RoleInfo> {
    const before = await this.find(key);
    if (key === ADMIN_ROLE) {
      throw new AppError(403, 'SYSTEM_ROLE_LOCKED', 'The Admin role always has every permission.');
    }
    if (before.system && (input.name !== undefined || input.description !== undefined)) {
      throw new AppError(
        422,
        'SYSTEM_ROLE_LOCKED',
        "System roles can't be renamed. You can change their permissions.",
      );
    }
    if ((before.version ?? 0) !== expectedVersion) throw versionConflict(before.version ?? 0);
    if (input.permissions) rejectReserved(input.permissions);

    const set: Record<string, unknown> = { updatedBy: actor.id };
    if (input.name !== undefined) set.name = input.name;
    if (input.description !== undefined) set.description = input.description;
    const permissions = input.permissions ? normalizePermissions(input.permissions) : undefined;
    if (permissions) set.permissions = permissions;
    await this.write(actor, before, set, permissions);
    return this.get(key);
  }

  /** ROLE-05: Sales Manager / Executive back to the defaults of PRD §4.1. */
  async reset(actor: AuthUser, key: string): Promise<RoleInfo> {
    const before = await this.find(key);
    if (!isSystemRole(key) || key === ADMIN_ROLE) {
      throw new AppError(
        422,
        'NOT_RESETTABLE',
        'Only Sales Manager and Sales Executive can be reset.',
      );
    }
    const permissions = normalizePermissions(SYSTEM_ROLES[key].permissions);
    await this.write(actor, before, { permissions, updatedBy: actor.id }, permissions);
    return this.get(key);
  }

  private async write(
    actor: AuthUser,
    before: RoleDoc,
    set: Record<string, unknown>,
    permissions: Permission[] | undefined,
  ): Promise<void> {
    try {
      await withTransaction(async () => {
        const written = await RoleModel.updateOne(
          { key: before.key, version: before.version ?? 0 },
          { $set: set },
        );
        if (written.matchedCount === 0) throw versionConflict((before.version ?? 0) + 1);
        const changes: Record<string, [unknown, unknown]> = {};
        if (set.name !== undefined && set.name !== before.name)
          changes.name = [before.name, set.name];
        if (permissions && !sameSet(permissions, before.permissions ?? [])) {
          changes.permissions = [before.permissions ?? [], permissions];
        }
        if (Object.keys(changes).length > 0) {
          await recordChange({
            actorId: actor.id,
            entity: 'role',
            entityId: before.key,
            action: 'role_updated',
            changes,
          });
        }
      });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) throw duplicateName();
      throw err;
    }
    invalidateRoles();
  }

  /** ROLE-06: custom roles only, and only when no user has the role. */
  async remove(actor: AuthUser, key: string): Promise<void> {
    const role = await this.find(key);
    if (role.system) {
      throw new AppError(403, 'SYSTEM_ROLE_LOCKED', "System roles can't be deleted.");
    }
    await withTransaction(async () => {
      const userCount = await UserModel.countDocuments({ role: key });
      if (userCount > 0) {
        throw new AppError(
          409,
          'ROLE_IN_USE',
          `${userCount} user(s) have this role. Move them to another role first.`,
          [{ path: 'userCount', message: String(userCount) }],
        );
      }
      await RoleModel.deleteOne({ key });
      await recordChange({
        actorId: actor.id,
        entity: 'role',
        entityId: key,
        action: 'role_deleted',
        changes: { name: [role.name, null] },
      });
    });
    invalidateRoles();
  }

  /** ROLE-06: moves every user of a role to another one, in one transaction. */
  async moveUsers(actor: AuthUser, from: string, to: string): Promise<{ moved: number }> {
    if (from === to) throw new AppError(422, 'SAME_ROLE', 'Choose a different role.');
    await this.find(from);
    await this.find(to);
    if (from === ADMIN_ROLE) {
      throw new AppError(
        422,
        'ADMINS_ONE_BY_ONE',
        'Change Admins one at a time from the Users list, so the account stays managed.',
      );
    }
    const moved = await withTransaction(async () => {
      // Touch the destination role: a concurrent delete of it conflicts with this move.
      await RoleModel.updateOne({ key: to }, { $currentDate: { guardAt: true } }, {
        timestamps: false,
        skipVersionBump: true,
      } as object);
      const result = await UserModel.updateMany(
        { role: from },
        { $set: { role: to, updatedBy: actor.id } },
      );
      await recordChange({
        actorId: actor.id,
        entity: 'role',
        entityId: from,
        action: 'users_moved',
        changes: { role: [from, to], users: [result.modifiedCount, null] },
      });
      return result.modifiedCount;
    });
    return { moved };
  }
}

/**
 * ROLE-02: there must always be at least one active Admin. Call inside the transaction
 * that demotes or deactivates `userId`. Touching the Admin role document makes two
 * concurrent demotions conflict, so they can't both pass the count (write skew).
 */
export async function assertAnotherActiveAdmin(userId: string): Promise<void> {
  await RoleModel.updateOne(
    { key: ADMIN_ROLE },
    {
      $currentDate: { guardAt: true },
      $setOnInsert: {
        _id: newId(),
        name: SYSTEM_ROLES.admin.name,
        description: SYSTEM_ROLES.admin.description,
        system: true,
        permissions: [],
      },
    },
    { upsert: true, timestamps: false, skipVersionBump: true } as object,
  );
  const others = await UserModel.countDocuments({
    _id: { $ne: userId },
    role: ADMIN_ROLE,
    status: 'active',
  });
  if (others === 0) {
    throw new AppError(
      409,
      'LAST_ADMIN',
      'There must always be at least one active Admin. Make someone else an Admin first.',
    );
  }
}

/** A role key a user may be given: it must exist. */
export async function assertRoleExists(key: string): Promise<void> {
  if (!(await resolveRole(key))) {
    throw new AppError(
      422,
      'UNKNOWN_ROLE',
      'This role no longer exists. Reload and choose another.',
    );
  }
}

const duplicateName = () => new AppError(409, 'DUPLICATE', 'A role with this name already exists.');
