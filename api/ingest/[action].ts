import type { VercelRequest, VercelResponse } from '@vercel/node';

import photosHandler from './handlers/photos';
import triageHandler from './handlers/triage';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { action } = req.query;

  switch (action) {
    case 'photos':
      return photosHandler(req, res);
    case 'triage':
      return triageHandler(req, res);
    default:
      return res.status(404).json({ error: `Ingest action '${action}' not found.` });
  }
}
