import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../../lib/password';
import { MIGRATIONS } from '../../migrations';
import { buildTestApp, startTestDatabase } from '../../test/helpers';
import { ChangeLogModel } from '../changeLogs/changeLog.model';
import { PropertyModel } from '../properties/property.model';
import { PropertySubcategoryModel } from '../propertyTypes/propertyTypes.model';
import { UserModel } from '../users/user.model';
import { RoleModel } from './role.model';

const PASSWORD = 'Correct-horse-9';
const ADMIN = '/api/v1/admin';

describe('role management (PRD §4.2)', () => {
  let db: Awaited<ReturnType<typeof startTestDatabase>>;
  let ctx: Awaited<ReturnType<typeof buildTestApp>>;
  let adminToken: string;

  const createUser = async (email: string, role: string, name = email.split('@')[0]!) =>
    UserModel.create({
      name,
      email,
      role,
      status: 'active',
      passwordHash: await hashPassword(PASSWORD),
    });
  const signIn = async (email: string) =>
    (await request(ctx.app).post('/api/v1/auth/login').send({ email, password: PASSWORD })).body
      .data.accessToken as string;
  const as = (token: string) => ({
    get: (path: string) =>
      request(ctx.app).get(`${ADMIN}${path}`).set('authorization', `Bearer ${token}`),
    post: (path: string, body?: object) =>
      request(ctx.app).post(`${ADMIN}${path}`).set('authorization', `Bearer ${token}`).send(body),
    patch: (path: string, body: object, version?: number) => {
      const req = request(ctx.app).patch(`${ADMIN}${path}`).set('authorization', `Bearer ${token}`);
      return (version === undefined ? req : req.set('if-match', `"${version}"`)).send(body);
    },
    delete: (path: string) =>
      request(ctx.app).delete(`${ADMIN}${path}`).set('authorization', `Bearer ${token}`),
  });
  const admin = () => as(adminToken);
  const roleOf = async (key: string) =>
    (await admin().get('/roles')).body.data.roles.find((r: { key: string }) => r.key === key);

  beforeAll(async () => {
    db = await startTestDatabase();
    await Promise.all([UserModel.syncIndexes(), RoleModel.syncIndexes()]);
  });
  afterAll(async () => db.stop());
  beforeEach(async () => {
    await db.clear();
    ctx = await buildTestApp();
    await createUser('owner@company.com', 'admin', 'Owner');
    adminToken = await signIn('owner@company.com');
  });

  it('lists the three system roles with user counts and a matrix column per role', async () => {
    await createUser('ravi@company.com', 'sales_executive');
    const res = await admin().get('/roles');
    expect(res.status).toBe(200);
    expect(
      res.body.data.roles.map((r: { key: string; userCount: number }) => [r.key, r.userCount]),
    ).toEqual([
      ['admin', 1],
      ['sales_manager', 0],
      ['sales_executive', 1],
    ]);
    const usersRow = res.body.data.matrix.find(
      (r: { module: string }) => r.module === 'Users & Roles',
    );
    expect(usersRow.access).toEqual({
      admin: 'full',
      sales_manager: 'none',
      sales_executive: 'none',
    });
    const leads = res.body.data.matrix.find(
      (r: { module: string }) => r.module === 'Leads / customers',
    );
    expect(leads.access).toMatchObject({ sales_manager: 'full', sales_executive: 'own' });
    expect((await admin().get('/permissions')).body.data.permissions).toContainEqual(
      expect.objectContaining({ key: 'users:manage', reserved: true }),
    );
  });

  it('only Admin manages roles (ROLE-03)', async () => {
    await createUser('sm@company.com', 'sales_manager');
    const sm = as(await signIn('sm@company.com'));
    expect((await sm.get('/roles')).status).toBe(403);
    expect((await sm.post('/roles', { name: 'Sneaky', permissions: [] })).status).toBe(403);
    expect((await sm.get('/roles/options')).status).toBe(403);
  });

  it('a custom role end to end: create, assign, edit (applies next request), delete rules (ROLE-04–06, 09)', async () => {
    const created = await admin().post('/roles', {
      name: 'Office staff',
      description: 'Adds properties and runs imports',
      permissions: ['properties:read', 'properties:write', 'reports:read:own', 'reports:read:all'],
    });
    expect(created.status).toBe(201);
    const office = created.body.data;
    expect(office).toMatchObject({ system: false, name: 'Office staff', userCount: 0 });
    expect(office.key).toMatch(/^r_/);
    // "All" replaces "Own" for a scoped area.
    expect(office.permissions).toEqual(['properties:read', 'properties:write', 'reports:read:all']);
    // Names are unique regardless of case.
    expect((await admin().post('/roles', { name: 'office STAFF' })).status).toBe(409);

    // Assign it through Invite user, then the user signs in with exactly those permissions.
    await createUser('meena@company.com', office.key, 'Meena');
    const meenaToken = await signIn('meena@company.com');
    const me = await request(ctx.app)
      .get('/api/v1/auth/me')
      .set('authorization', `Bearer ${meenaToken}`);
    expect(me.body.data).toMatchObject({ role: office.key, roleName: 'Office staff' });
    expect((await as(meenaToken).get('/users')).status).toBe(403);
    expect((await as(meenaToken).get('/imports')).status).toBe(403);

    // The Admin adds Bulk import: Meena's next request has it, with no sign-out.
    const edited = await admin().patch(
      `/roles/${office.key}`,
      { permissions: [...office.permissions, 'imports:run'] },
      office.version,
    );
    expect(edited.status).toBe(200);
    expect((await as(meenaToken).get('/imports')).status).toBe(200);
    // A stale edit is refused.
    expect(
      (await admin().patch(`/roles/${office.key}`, { name: 'Office team' }, office.version)).status,
    ).toBe(409);

    // In use: can't delete until its users are moved.
    const blocked = await admin().delete(`/roles/${office.key}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toMatchObject({ code: 'ROLE_IN_USE', details: [{ message: '1' }] });
    const moved = await admin().post(`/roles/${office.key}/move-users`, {
      toRole: 'sales_executive',
    });
    expect(moved.body.data).toEqual({ moved: 1 });
    expect((await UserModel.findOne({ email: 'meena@company.com' }).lean())!.role).toBe(
      'sales_executive',
    );
    expect((await admin().delete(`/roles/${office.key}`)).status).toBe(204);

    const actions = (await ChangeLogModel.find({ entity: 'role' }).sort({ at: 1 }).lean()).map(
      (l) => l.action,
    );
    expect(actions).toEqual(['role_created', 'role_updated', 'users_moved', 'role_deleted']);
  });

  it('reserved permissions can never be given to another role (ROLE-03)', async () => {
    const res = await admin().post('/roles', { name: 'Helper', permissions: ['users:manage'] });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('RESERVED_PERMISSION');
    const sm = await roleOf('sales_manager');
    expect(
      (await admin().patch('/roles/sales_manager', { permissions: ['roles:manage'] }, sm.version))
        .status,
    ).toBe(422);
  });

  it('system roles: Admin is locked; others keep their name but permissions can change and reset (ROLE-01/02/05)', async () => {
    const adminRole = await roleOf('admin');
    expect(
      (await admin().patch('/roles/admin', { permissions: [] }, adminRole.version)).status,
    ).toBe(403);
    expect((await admin().delete('/roles/sales_executive')).status).toBe(403);

    const se = await roleOf('sales_executive');
    expect(
      (await admin().patch('/roles/sales_executive', { name: 'Agent' }, se.version)).status,
    ).toBe(422);
    const changed = await admin().patch(
      '/roles/sales_executive',
      { permissions: [...se.permissions, 'properties:archive'] },
      se.version,
    );
    expect(changed.body.data).toMatchObject({ customised: true });
    const reset = await admin().post('/roles/sales_executive/reset');
    expect(reset.body.data).toMatchObject({ customised: false });
    expect(reset.body.data.permissions).not.toContain('properties:archive');
  });

  it('migration 0003 renames v1 property statuses, and reverses while no v2-only status is used', async () => {
    const props = PropertyModel.collection;
    await props.insertMany([
      { _id: 'p-pub' as never, code: 'RE-T-1', status: 'published' },
      { _id: 'p-unp' as never, code: 'RE-T-2', status: 'unpublished' },
      { _id: 'p-sold' as never, code: 'RE-T-3', status: 'sold' },
    ]);
    const m = MIGRATIONS.find((x) => x.id === '0003-property-statuses')!;
    await m.up();
    const status = async (id: string) => (await props.findOne({ _id: id as never }))!.status;
    expect([await status('p-pub'), await status('p-unp'), await status('p-sold')]).toEqual([
      'available',
      'on_hold',
      'sold',
    ]);
    await m.down!();
    expect(await status('p-pub')).toBe('published');
    await m.up();
    await props.updateOne({ _id: 'p-sold' as never }, { $set: { status: 'reserved' } });
    await expect(m.down!()).rejects.toThrow(/Under negotiation, Reserved/);
  });

  it('migration 0004 backfills legal checks and derived fields, and can run twice', async () => {
    await PropertySubcategoryModel.collection.insertOne({
      _id: 'sub-plot' as never,
      legalChecklist: [
        { key: 'sale_deed', label: 'Sale deed', verifies: '', mandatory: true },
        { key: 'tax_receipts', label: 'Tax receipts', verifies: '', mandatory: false },
      ],
    });
    await PropertyModel.collection.insertOne({
      _id: 'p-old' as never,
      code: 'RE-PLT-000009',
      title: 'Old plot',
      subcategoryId: 'sub-plot',
      purpose: 'sale',
      price: { amount: 2_400_000, basis: 'total' },
      area: { value: 1200, unit: 'sqft', sqft: 1200 },
      location: { city: 'Madurai', locality: 'Ponmeni' },
      status: 'available',
    });
    const m = MIGRATIONS.find((x) => x.id === '0004-property-v2-fields')!;
    await m.up();
    await PropertyModel.collection.updateOne(
      { _id: 'p-old' as never },
      { $set: { 'legal.0.status': 'verified' } },
    );
    await m.up(); // again: the verified check stays verified
    const p = (await PropertyModel.collection.findOne({ _id: 'p-old' as never }))!;
    expect(p.pricePerSqft).toBe(2000);
    expect(p.legal.map((c: { key: string; status: string }) => [c.key, c.status])).toEqual([
      ['sale_deed', 'verified'],
      ['tax_receipts', 'not_collected'],
    ]);
    expect(p.legalSummary).toMatchObject({ total: 2, verified: 1, openMandatory: [] });
    expect(p.searchText).toBe('re-plt-000009 old plot madurai ponmeni');
    expect(p.location).toMatchObject({ roadType: '', roadWidthFt: null });
  });

  it('migration 0002 maps v1 roles: Super Admin → Admin, Sales Agent → Sales Executive (ROLE-10)', async () => {
    await UserModel.collection.insertMany([
      {
        _id: 'u-sa' as never,
        name: 'SA',
        email: 'sa@x.com',
        role: 'super_admin',
        status: 'active',
      },
      {
        _id: 'u-ag' as never,
        name: 'AG',
        email: 'ag@x.com',
        role: 'sales_agent',
        status: 'active',
      },
    ]);
    await MIGRATIONS.find((m) => m.id === '0002-roles')!.up();
    expect((await UserModel.findById('u-sa').lean())!.role).toBe('admin');
    expect((await UserModel.findById('u-ag').lean())!.role).toBe('sales_executive');
    expect(await RoleModel.countDocuments({ system: true })).toBe(3);
  });
});
