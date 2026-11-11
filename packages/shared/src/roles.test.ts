import { describe, expect, it } from 'vitest';
import { PERMISSIONS, hasPermission, isRole, permissionsFor } from './roles';

describe('roles and permissions', () => {
  it('gives Super Admin every permission', () => {
    expect(permissionsFor('super_admin')).toEqual(PERMISSIONS);
  });

  it('only lets Super Admin manage users', () => {
    expect(hasPermission('super_admin', 'users:manage')).toBe(true);
    expect(hasPermission('admin', 'users:manage')).toBe(false);
    expect(hasPermission('sales_agent', 'users:manage')).toBe(false);
  });

  it('lets Admin edit settings but not Sales Agent', () => {
    expect(hasPermission('admin', 'settings:edit')).toBe(true);
    expect(hasPermission('sales_agent', 'settings:edit')).toBe(false);
  });

  it('limits Sales Agents to their own appointments', () => {
    expect(hasPermission('sales_agent', 'appointments:read:own')).toBe(true);
    expect(hasPermission('sales_agent', 'appointments:read:all')).toBe(false);
  });

  it('recognises valid roles', () => {
    expect(isRole('admin')).toBe(true);
    expect(isRole('owner')).toBe(false);
  });
});
