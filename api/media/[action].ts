import type { VercelRequest, VercelResponse } from '@vercel/node';

import eratosPalaceHandler from './handlers/eratosPalace';
import forceRebakeOrientationHandler from './handlers/forceRebakeOrientation';
import forgeReimagineHandler from './handlers/forgeReimagine';
import healThumbnailsHandler from './handlers/heal-thumbnails';
import proxyHandler from './handlers/proxy';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { action } = req.query;

  switch (action) {
    case 'eratosPalace':
      return eratosPalaceHandler(req, res);
    case 'forceRebakeOrientation':
      return forceRebakeOrientationHandler(req, res);
    case 'forgeReimagine':
      return forgeReimagineHandler(req, res);
    case 'heal-thumbnails':
      return healThumbnailsHandler(req, res);
    case 'proxy':
      return proxyHandler(req, res);
    default:
      return res.status(404).json({ error: `Media action '${action}' not found.` });
  }
}
