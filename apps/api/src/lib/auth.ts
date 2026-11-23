import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { can, type Permission, type Role } from '@estate/shared';
import { config } from '../config';
import { HttpError } from './http';
import { User } from '../models/user';
import { Audit } from '../models/audit';

export type Actor = { id: string; name: string; role: Role; viaAI?: boolean };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      actor: Actor;
    }
  }
}

export const COOKIE = 'estate_session';

export function signSession(userId: string) {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: '7d' });
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE] || req.headers.authorization?.replace(/^Bearer /, '');
  if (!token) throw new HttpError(401, 'Please sign in');
  let sub: string;
  try {
    sub = (jwt.verify(token, config.jwtSecret) as { sub: string }).sub;
  } catch {
    throw new HttpError(401, 'Your session has expired. Please sign in again.');
  }
  const user = await User.findById(sub).lean();
  if (!user || !user.active) throw new HttpError(401, 'Please sign in');
  req.actor = { id: String(user._id), name: user.name, role: user.role as Role };
  next();
}

export function assertCan(actor: Actor, permission: Permission, msg?: string) {
  if (!can(actor.role, permission)) throw new HttpError(403, msg ?? 'Your role does not allow this action');
}

export const requirePermission = (permission: Permission) => (req: Request, _res: Response, next: NextFunction) => {
  assertCan(req.actor, permission);
  next();
};

export async function audit(
  actor: Actor,
  entity: string,
  entityId: unknown,
  action: string,
  summary: string,
  changes?: Record<string, unknown>,
) {
  await Audit.create({ actorId: actor.id, actorName: actor.name, viaAI: !!actor.viaAI, entity, entityId, action, summary, changes });
}
