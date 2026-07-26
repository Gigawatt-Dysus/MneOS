import type { VercelRequest, VercelResponse } from '@vercel/node';

import comfyWorkerHandler from './handlers/comfyWorker';
import renderPlanHandler from './handlers/renderPlan';
import runpodLeaseServiceHandler from './handlers/runpodLeaseService';
import thunderDeployServiceHandler from './handlers/thunderDeployService';
import thunderLeaseServiceHandler from './handlers/thunderLeaseService';
import vastLeaseServiceHandler from './handlers/vastLeaseService';
import vastMarketServiceHandler from './handlers/vastMarketService';
import vlmInjectHandler from './handlers/vlmInject';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { action } = req.query;

  switch (action) {
    case 'comfyWorker':
      return comfyWorkerHandler(req, res);
    case 'renderPlan':
      return renderPlanHandler(req, res);
    case 'runpodLeaseService':
      return runpodLeaseServiceHandler(req, res);
    case 'thunderDeployService':
      return thunderDeployServiceHandler(req, res);
    case 'thunderLeaseService':
      return thunderLeaseServiceHandler(req, res);
    case 'vastLeaseService':
      return vastLeaseServiceHandler(req, res);
    case 'vastMarketService':
      return vastMarketServiceHandler(req, res);
    case 'vlmInject':
      return vlmInjectHandler(req, res);
    default:
      return res.status(404).json({ error: `Loom action '${action}' not found.` });
  }
}
