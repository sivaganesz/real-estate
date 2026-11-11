import { emailSchema, passwordSchema } from '@real-estate/shared';
import { z } from 'zod';
import { hashPassword } from '../lib/password';
import { DEFAULT_COMPANY_SETTINGS } from '../modules/settings/company.defaults';
import { SettingsModel } from '../modules/settings/settings.model';
import { UserModel } from '../modules/users/user.model';

export const superAdminSeedSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: emailSchema,
  password: passwordSchema,
});
export type SuperAdminSeed = z.infer<typeof superAdminSeedSchema>;

/**
 * Creates the first Super Admin. Does nothing if a Super Admin already exists, so it is
 * safe to run more than once.
 */
export async function seedSuperAdmin(input: SuperAdminSeed): Promise<'created' | 'exists'> {
  const existing = await UserModel.exists({ role: 'super_admin' });
  if (existing) return 'exists';

  await UserModel.create({
    name: input.name,
    email: input.email,
    role: 'super_admin',
    status: 'active',
    passwordHash: await hashPassword(input.password),
  });
  return 'created';
}

/** Creates the default company settings document if it doesn't exist yet. */
export async function seedCompanySettings(): Promise<'created' | 'exists'> {
  const existing = await SettingsModel.exists({ key: 'company' });
  if (existing) return 'exists';
  await SettingsModel.create({ key: 'company', value: DEFAULT_COMPANY_SETTINGS });
  return 'created';
}
