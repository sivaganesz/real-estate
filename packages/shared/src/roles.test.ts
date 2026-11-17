import { describe, expect, it } from 'vitest';
import { buildRoleMatrix } from './roleMatrix';
import {
  effectivePermissions,
  normalizePermissions,
  PERMISSION_INFO,
  PERMISSIONS,
  RESERVED_PERMISSIONS,
  scopeLevel,
  SCOPED_AREAS,
  SYSTEM_ROLES,
} from './roles';

describe('roles and permissions', () => {
  it('describes every permission, and only users/roles management is reserved', () => {
    for (const p of PERMISSIONS) expect(PERMISSION_INFO[p].label, p).toBeTruthy();
    expect(RESERVED_PERMISSIONS).toEqual(['users:manage', 'roles:manage']);
  });

  it('Admin always has every permission, whatever is stored (ROLE-02)', () => {
    expect(effectivePermissions('admin', [])).toEqual([...PERMISSIONS]);
    expect(effectivePermissions('sales_manager', ['users:manage', 'properties:read'])).toEqual([
      'properties:read',
    ]);
  });

  it('system defaults follow the PRD matrix (§4.1)', () => {
    const sm = SYSTEM_ROLES.sales_manager.permissions;
    const se = SYSTEM_ROLES.sales_executive.permissions;
    expect(sm).toEqual(
      expect.arrayContaining(['properties:archive', 'properties:delete', 'hni:read']),
    );
    expect(sm).not.toContain('properties:write');
    expect(se).toContain('customers:read:own');
    expect(se).not.toContain('hni:read');
    for (const p of RESERVED_PERMISSIONS) {
      expect(sm).not.toContain(p);
      expect(se).not.toContain(p);
    }
  });

  it('normalises: drops unknown and reserved, "all" replaces "own", catalogue order', () => {
    expect(
      normalizePermissions([
        'reports:read:all',
        'nope',
        'roles:manage',
        'reports:read:own',
        'properties:read',
        'properties:read',
      ]),
    ).toEqual(['properties:read', 'reports:read:all']);
    expect(normalizePermissions(['users:manage'], { allowReserved: true })).toEqual([
      'users:manage',
    ]);
  });

  it('reads None / Own / All per scoped area', () => {
    const [customers] = SCOPED_AREAS;
    expect(scopeLevel(SYSTEM_ROLES.sales_executive.permissions, customers)).toBe('own');
    expect(scopeLevel(SYSTEM_ROLES.sales_manager.permissions, customers)).toBe('all');
    expect(scopeLevel([], customers)).toBe('none');
  });

  it('builds the matrix from any roles, including custom ones (ROLE-08)', () => {
    const matrix = buildRoleMatrix([
      { key: 'admin', permissions: effectivePermissions('admin', []) },
      { key: 'r_office', permissions: ['properties:read', 'properties:write', 'imports:run'] },
    ]);
    const row = (m: string) => matrix.find((r) => r.module === m)!.access;
    expect(row('Users & Roles')).toEqual({ admin: 'full', r_office: 'none' });
    expect(row('Bulk import')).toEqual({ admin: 'full', r_office: 'full' });
    expect(row('Leads / customers')).toEqual({ admin: 'full', r_office: 'none' });
    expect(row('Settings → Sales rules')).toEqual({ admin: 'full', r_office: 'view' });
  });
});
