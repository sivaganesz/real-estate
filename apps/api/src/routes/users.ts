import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { ROLES } from '@estate/shared';
import { User, publicUser } from '../models/user';
import { audit, requirePermission } from '../lib/auth';
import { badRequest, notFound, parse } from '../lib/http';

export const usersRouter = Router();

/** Everyone can list colleagues (for assignment pickers); only admins change them. */
usersRouter.get('/', async (_req, res) => {
  const users = await User.find().sort({ role: 1, name: 1 }).lean();
  res.json({ users: users.map(publicUser) });
});

const NewUser = z.object({
  name: z.string().trim().min(2),
  email: z.string().email(),
  phone: z.string().trim().default(''),
  role: z.enum(ROLES),
  managerId: z.string().nullish(),
  password: z.string().min(8, 'Use at least 8 characters'),
});

usersRouter.post('/', requirePermission('users.manage'), async (req, res) => {
  const input = parse(NewUser, req.body);
  const user = await User.create({ ...input, passwordHash: await bcrypt.hash(input.password, 10) });
  await audit(req.actor, 'user', user._id, 'create', `Added ${user.name} as ${user.role}`);
  res.status(201).json({ user: publicUser(user) });
});

const EditUser = NewUser.omit({ password: true }).partial().extend({ active: z.boolean().optional(), password: z.string().min(8).optional() });

usersRouter.patch('/:id', requirePermission('users.manage'), async (req, res) => {
  const input = parse(EditUser, req.body);
  if (req.params.id === req.actor.id && (input.active === false || (input.role && input.role !== 'admin'))) {
    throw badRequest('You cannot deactivate or demote yourself');
  }
  const user = await User.findById(req.params.id);
  if (!user) throw notFound('User');
  const { password, ...rest } = input;
  Object.assign(user, rest);
  if (password) user.passwordHash = await bcrypt.hash(password, 10);
  await user.save();
  await audit(req.actor, 'user', user._id, 'update', `Updated ${user.name}`);
  res.json({ user: publicUser(user) });
});
