import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User, publicUser } from '../models/user';
import { COOKIE, requireAuth, signSession } from '../lib/auth';
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

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.actor.id).lean();
  if (!user) throw new HttpError(401, 'Please sign in');
  res.json({ user: publicUser(user), ai: aiStatus() });
});
