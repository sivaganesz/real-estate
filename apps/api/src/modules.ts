import { Router } from 'express';
import { propertiesRouter, projectsRouter } from './modules/properties';
import { importsRouter } from './modules/imports';
import { publicProperty } from './services/properties';

/**
 * Business modules mount here, one line each. Importing a module also
 * registers its AI tools, offline intents and demo data.
 */
export const modules: { path: string; router: Router }[] = [
  { path: '/properties', router: propertiesRouter },
  { path: '/projects', router: projectsRouter },
  { path: '/imports', router: importsRouter },
];

/** Routes buyers can open without signing in. */
export const publicRouter = Router();
publicRouter.get('/properties/:token', async (req, res) => {
  res.json({ property: await publicProperty(req.params.token) });
});
