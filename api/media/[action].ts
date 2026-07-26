import type { VercelRequest, VercelResponse } from '@vercel/node';

import eratosPalaceHandler from '../../src/api_handlers/media/eratosPalace';
import forceRebakeOrientationHandler from '../../src/api_handlers/media/forceRebakeOrientation';
import forgeReimagineHandler from '../../src/api_handlers/media/forgeReimagine';
import healThumbnailsHandler from '../../src/api_handlers/media/heal-thumbnails';
import proxyHandler from '../../src/api_handlers/media/proxy';

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
