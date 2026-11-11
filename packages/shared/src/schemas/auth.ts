import { z } from 'zod';
import { PERMISSIONS, ROLES } from '../roles';
import { emailSchema, idSchema, passwordSchema } from './common';

/** POST /auth/login */
export const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(128),
});
export type LoginBody = z.infer<typeof loginBodySchema>;

/** POST /auth/forgot-password */
export const forgotPasswordBodySchema = z.object({ email: emailSchema });
export type ForgotPasswordBody = z.infer<typeof forgotPasswordBodySchema>;

/** POST /auth/reset-password */
export const resetPasswordBodySchema = z.object({
  token: z.string().min(20, 'Invalid link').max(200, 'Invalid link'),
  password: passwordSchema,
});
export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;

/** The signed-in user, as returned by /auth/login and /auth/me. */
export const authUserSchema = z.object({
  id: idSchema,
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  role: z.enum(ROLES),
  permissions: z.array(z.enum(PERMISSIONS)),
});
export type AuthUser = z.infer<typeof authUserSchema>;

/** Login / refresh response. The refresh token is set as an httpOnly cookie, not returned. */
export const sessionResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int().meta({ description: 'Access token lifetime in seconds' }),
  user: authUserSchema,
});
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
