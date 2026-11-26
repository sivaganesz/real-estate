import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User, publicUser } from '../models/user';
import { COOKIE, audit, requireAuth, signSession } from '../lib/auth';
import { HttpError, parse } from '../lib/http';
import { config } from '../config';
import { aiStatus } from '../ai/client';

export const authRouter = Router();

const Login = z.object({ email: z.string().email(), password: z.string().min(1) });

authRouter.post('/login', async (req, res) => {
  const { email, password } = parse(Login, req.body);
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, 'That email and password do not match');
  }
  user.lastLoginAt = new Date();
  await user.save();
  res.cookie(COOKIE, signSession(String(user._id)), {
    httpOnly: true,
    sameSite: 'lax',
    secure: !config.isTest && process.env.NODE_ENV === 'production',
    maxAge: 7 * 86_400_000,
  });
  res.json({ user: publicUser(user) });
});

/** The session cookie, the same for a sign-in and a role switch. */
function setSession(res: import('express').Response, userId: string) {
  res.cookie(COOKIE, signSession(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: !config.isTest && process.env.NODE_ENV === 'production',
    maxAge: 7 * 86_400_000,
  });
}

/**
 * Switch role: only between the seeded demo accounts (…@estate.test), and only
 * when config.roleSwitch is on. A real account never sees it, and can never use
 * it to become anyone else.
 */
const DEMO_EMAIL = /@estate.test$/i;
async function switchTargets(currentId: string) {
  if (!config.roleSwitch) return null;
  const me = await User.findById(currentId).lean();
  if (!me || !DEMO_EMAIL.test(me.email)) return null;
  const order = { admin: 0, manager: 1, executive: 2 } as Record<string, number>;
  const demo = await User.find({ email: DEMO_EMAIL, active: true }).lean();
  return demo.sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9) || a.name.localeCompare(b.name)).map((u) => ({ id: String(u._id), name: u.name, role: u.role }));
}

authRouter.get('/switch', requireAuth, async (req, res) => {
  res.json({ options: (await switchTargets(req.actor.id)) ?? [] });
});

authRouter.post('/switch', requireAuth, async (req, res) => {
  const { userId } = parse(z.object({ userId: z.string().min(1) }), req.body);
  const targets = await switchTargets(req.actor.id);
  if (!targets) throw new HttpError(403, 'Switching roles is only for the demo accounts');
  if (!targets.some((t) => t.id === userId)) throw new HttpError(404, 'That demo account is not available');
  const user = await User.findById(userId);
  if (!user) throw new HttpError(404, 'That demo account is not available');
  user.lastLoginAt = new Date();
  await user.save();
  await audit(req.actor, 'user', user._id, 'switch', `Switched to ${user.name} (${user.role})`);
  setSession(res, String(user._id));
  res.json({ user: publicUser(user) });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.actor.id).lean();
  if (!user) throw new HttpError(401, 'Please sign in');
  res.json({ user: publicUser(user), ai: aiStatus() });
});
