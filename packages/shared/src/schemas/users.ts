import { z } from 'zod';
import { ROLES } from '../roles';
import {
  emailSchema,
  idSchema,
  paginationQuerySchema,
  passwordSchema,
  phoneSchema,
} from './common';

export const USER_STATUSES = ['invited', 'active', 'inactive'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/** Status filter on the users list; "locked" = active user locked after failed logins. */
export const USER_STATUS_FILTERS = [...USER_STATUSES, 'locked'] as const;

const nameSchema = z.string().trim().min(2, 'Name must be at least 2 characters').max(100);

/** Optional phone: an empty string means "no phone". */
const optionalPhoneSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  phoneSchema.optional(),
);

/** GET /admin/users */
export const listUsersQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  role: z.enum(ROLES).optional(),
  status: z.enum(USER_STATUS_FILTERS).optional(),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

/** POST /admin/users (invite) */
export const inviteUserBodySchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: optionalPhoneSchema,
  role: z.enum(ROLES, 'Choose a role'),
});
export type InviteUserBody = z.input<typeof inviteUserBodySchema>;

/** PATCH /admin/users/:id. Email can't be changed; phone `null` or "" clears it. */
export const updateUserBodySchema = z.object({
  name: nameSchema.optional(),
  phone: z
    .preprocess(
      (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
      z.union([z.null(), phoneSchema]),
    )
    .optional(),
  role: z.enum(ROLES).optional(),
});
export type UpdateUserBody = z.input<typeof updateUserBodySchema>;

/** POST /auth/accept-invite */
export const acceptInviteBodySchema = z.object({
  token: z.string().min(20, 'Invalid link').max(200, 'Invalid link'),
  password: passwordSchema,
});
export type AcceptInviteBody = z.infer<typeof acceptInviteBodySchema>;

/** A user as returned by the users API. */
export const userSchema = z.object({
  id: idSchema,
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  role: z.enum(ROLES),
  status: z.enum(USER_STATUSES),
  locked: z.boolean().meta({ description: 'Active but locked after too many failed logins' }),
  lockedUntil: z.string().nullable(),
  failedLoginCount: z.number().int(),
  lastLoginAt: z.string().nullable(),
  inviteExpiresAt: z
    .string()
    .nullable()
    .meta({ description: 'For invited users: when the invite link expires' }),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type User = z.infer<typeof userSchema>;

/** Status counts shown above the users table. */
export const userStatsSchema = z.object({
  active: z.number().int(),
  invited: z.number().int(),
  locked: z.number().int(),
  inactive: z.number().int(),
});
export type UserStats = z.infer<typeof userStatsSchema>;

/** Result of actions that send an email (invite, resend, reset). */
export const emailResultSchema = z.object({
  emailSent: z
    .boolean()
    .meta({ description: 'False if the email provider failed; offer to resend' }),
});

/** GET /auth/invite?token= */
export const inviteInfoSchema = z.object({
  name: z.string(),
  email: z.string(),
  role: z.enum(ROLES),
  invitedBy: z.string().nullable(),
});
export type InviteInfo = z.infer<typeof inviteInfoSchema>;
