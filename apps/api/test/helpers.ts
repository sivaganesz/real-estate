import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app';
import { connectDb, disconnectDb } from '../src/db/connect';
import { resetAndSeed, DEMO_PASSWORD } from '../src/db/seed';

export async function setup() {
  await connectDb({ ephemeral: true });
  await resetAndSeed();
  return createApp();
}

export const teardown = disconnectDb;

export type Agent = ReturnType<typeof request.agent>;

export async function login(app: Express, email: string): Promise<Agent> {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password: DEMO_PASSWORD });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}

export const EMAIL = {
  admin: 'admin@estate.test',
  manager: 'manager@estate.test',
  priya: 'priya@estate.test',
  arun: 'arun@estate.test',
};
