import { z } from 'zod';
import { ROLES } from '../roles';
import { idSchema, passwordSchema, phoneSchema } from './common';

/** The signed-in user's own profile (GET /admin/profile). */
export const profileSchema = z.object({
  id: idSchema,
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  role: z.enum(ROLES),
  lastLoginAt: z.string().nullable(),
  createdAt: z.string(),
});
export type Profile = z.infer<typeof profileSchema>;

/** PATCH /admin/profile. Email and role can't be changed here; "" or null clears the phone. */
export const updateProfileBodySchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).optional(),
  phone: z
    .preprocess(
      (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
      z.union([z.null(), phoneSchema]),
    )
    .optional(),
});
export type UpdateProfileBody = z.input<typeof updateProfileBodySchema>;

/** POST /admin/profile/change-password */
export const changePasswordBodySchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password').max(128),
    newPassword: passwordSchema,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    path: ['newPassword'],
    message: 'Choose a password different from your current one',
  });
export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>;
