// Business runs on Indian time; "tomorrow 11 am" means 11 am IST wherever the server is.
process.env.TZ ??= 'Asia/Kolkata';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGODB_URI || '',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  geminiKey: process.env.GEMINI_API_KEY || '',
  aiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  uploadDir: path.resolve(here, '../uploads'),
  dataDir: path.resolve(here, '../../../.data/mongo'),
  mongoBinaryDir: path.resolve(here, '../../../node_modules/.cache/mongodb-memory-server'),
  isTest: process.env.NODE_ENV === 'test' || !!process.env.VITEST,
  /**
   * "Switch role" in the profile menu: hop between the demo accounts to see each
   * role's view. On by default outside production; in production only with ROLE_SWITCH=1.
   */
  roleSwitch: process.env.ROLE_SWITCH === '1' || (process.env.ROLE_SWITCH !== '0' && process.env.NODE_ENV !== 'production'),
};
