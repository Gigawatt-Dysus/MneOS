import type { VercelRequest, VercelResponse } from '@vercel/node';

import commitPurifiedSchema from '../../src/api_handlers/admin/commitPurifiedSchema';
import deleteTimelineEvent from '../../src/api_handlers/admin/deleteTimelineEvent';
import fetchPurificationPayload from '../../src/api_handlers/admin/fetchPurificationPayload';
import rehydrateMessage from '../../src/api_handlers/admin/rehydrateMessage';
import transplantAsset from '../../src/api_handlers/admin/transplantAsset';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { action } = req.query;

  switch (action) {
    case 'commitPurifiedSchema':
      return commitPurifiedSchema(req, res);
    case 'deleteTimelineEvent':
      return deleteTimelineEvent(req, res);
    case 'fetchPurificationPayload':
      return fetchPurificationPayload(req, res);
    case 'rehydrateMessage':
      return rehydrateMessage(req, res);
    case 'transplantAsset':
      return transplantAsset(req, res);
    default:
      return res.status(404).json({ error: `Admin action '${action}' not found.` });
  }
}
