import type { Router } from 'express';

/**
 * Business modules mount here, one line each. Importing a module also
 * registers its AI tools and offline intents.
 */
export const modules: { path: string; router: Router }[] = [];
