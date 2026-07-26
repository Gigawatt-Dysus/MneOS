import type { VercelRequest, VercelResponse } from '@vercel/node';

import comfyWorkerHandler from '../../src/api_handlers/loom/comfyWorker';
import renderPlanHandler from '../../src/api_handlers/loom/renderPlan';
import runpodLeaseServiceHandler from '../../src/api_handlers/loom/runpodLeaseService';
import thunderDeployServiceHandler from '../../src/api_handlers/loom/thunderDeployService';
import thunderLeaseServiceHandler from '../../src/api_handlers/loom/thunderLeaseService';
import vastLeaseServiceHandler from '../../src/api_handlers/loom/vastLeaseService';
import vastMarketServiceHandler from '../../src/api_handlers/loom/vastMarketService';
import vlmInjectHandler from '../../src/api_handlers/loom/vlmInject';

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
