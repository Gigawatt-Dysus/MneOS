import { Request, Response } from 'express';

const THUNDER_API_KEY = process.env.THUNDER_API_KEY;
const THUNDER_BASE_URL = 'https://api.thundercompute.com/v1'; 

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // `bootId` is passed from the UI (e.g. 'snap:mneos-image-2026-07-16' or 'tmpl:comfyui-latest')
  const { offerId, price, leaseType, bootId } = req.body;

  if (!THUNDER_API_KEY) {
    console.error('[ThunderDeploy] THUNDER_API_KEY missing in .env.local');
    return res.status(500).json({ error: 'THUNDER_API_KEY not found in environment' });
  }

  try {
    console.log(`[ThunderDeploy] Igniting Forge on Thunder Compute...`);
    console.log(`[ThunderDeploy] Hardware: ${offerId}`);
    console.log(`[ThunderDeploy] Boot Source: ${bootId}`);
    
    // Parse the bootId to determine if it's a snapshot or a template
    const isSnapshot = typeof bootId === 'string' && bootId.startsWith('snap:');
    const sourceId = typeof bootId === 'string' ? bootId.replace('snap:', '').replace('tmpl:', '') : '';
    
    const payload: any = {
        instance_type: offerId, // e.g. "A6000"
        ssh_key_name: 'MneOS-Prime', // MneOS standard identity key
        gpu_count: 1
    };
    
    if (isSnapshot && sourceId) {
        payload.snapshot_id = sourceId;
    } else if (sourceId) {
        payload.template_id = sourceId;
    }

    console.log('[ThunderDeploy] Dispatching payload:', payload);

    const response = await fetch(`${THUNDER_BASE_URL}/instances`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${THUNDER_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ThunderDeploy] API Error ${response.status}: ${errorText}`);
        throw new Error(`Thunder API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log(`[ThunderDeploy] Instance successfully provisioned! ID: ${data.id}`);

    return res.status(200).json({ 
      status: 'success', 
      instance: data,
      message: 'Thunder node successfully ignited.'
    });
  } catch (error: any) {
    console.error(`[ThunderDeploy] Failed to deploy:`, error);
    return res.status(500).json({ error: 'Thunder Deployment Failed', details: error.message });
  }
}
