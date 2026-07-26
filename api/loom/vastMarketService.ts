import { Request, Response } from 'express';

// We rely on native fetch (Node 18+). If older Node, we'd import 'node-fetch'.
const VAST_API_KEY = process.env.VAST_API_KEY;
const VAST_BASE_URL = 'https://console.vast.ai/api/v0';

export interface VastOffer {
  id: number;
  machine_id: number;
  host_id: number;
  gpu_name: string;
  gpu_count: number;
  gpu_ram: number;
  cpu_name: string;
  cpu_ram: number;
  inet_up: number;
  inet_down: number;
  inet_up_cost: number;
  inet_down_cost: number;
  dph_total: number;
  geolocation: string;
  reliability: number;
  verified: boolean;
  disk_space: number;
  dlperf?: number;
  score?: number; // Custom scoring for Commander's Choice
}

/**
 * Queries the Vast.ai /bundles API and applies the Commander's Filter.
 * RTX 4090/5090, verified hosts, gigabit speeds, <$0.60/hr.
 */
export async function getIronMarketOffers(): Promise<VastOffer[]> {
  if (!VAST_API_KEY) {
    throw new Error('VAST_API_KEY is not defined in the environment. Verify .env.local.');
  }

  // The Sovereign Blocklist: Burned nodes that hallucinated, OOM'd, threw CUDA errors, or have broken GHCR routing
  const burnedMachineIds = [
    105195, // 07-12-2026: Bricked RTX 5090 (CUDA unknown error)
  ];
  const burnedHostIds = [
    402342, // 07-12-2026: GHCR Docker Pull hanging indefinitely (198.2.214.6)
  ];

  // The Commander's Filter constraints (Tightened to prevent junk nodes)
  const query = {
    verified: { eq: true },
    external: { eq: false },
    rentable: { eq: true },
    machine_id: { notin: burnedMachineIds }, // Explicitly ban burned nodes
    host_id: { notin: burnedHostIds }, // Explicitly ban burned hosts
    gpu_name: { in: ["RTX 5090", "RTX A6000", "RTX 6000 Ada Generation", "A6000"] }, // Strictly 48GB+ VRAM for full Z-Image
    num_gpus: { eq: 1 },       // ONLY grab single-GPU nodes, no multi-GPU clusters!
    dph: { lte: 2.50 },        // Increased from 1.50 to 2.50 to unlock NA A6000 inventory
    inet_up: { gte: 200 },     // Relaxed for global datacenters
    inet_down: { gte: 200 },   // Relaxed for global datacenters
    disk_space: { gte: 150 },  // Greatly increased to accommodate 15GB Z-Image base weights + B2 payload
    disk_bw: { gte: 150 },     // Relaxed for shared datacenter storage
    pcie_bw: { gte: 8.0 },     // Allowed PCIe x8 routing (plenty for inference)
    cpu_cores: { gte: 8 },     // Allowed split-core datacenter environments
    cuda_max_good: { gte: 12.1 }, // Require modern NVIDIA datacenter drivers
    geolocation: { in: ["US", "CA"] }, // [RESTORED] SOVEREIGN DATA LOCK: North American Datacenters ONLY
    type: "on-demand"
  };

  const qString = encodeURIComponent(JSON.stringify(query));
  const url = `${VAST_BASE_URL}/bundles/?q=${qString}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${VAST_API_KEY}`
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[VastMarket] Failed to fetch offers: ${response.status} - ${errText}`);
      throw new Error(`Vast API error: ${response.status}`);
    }

    const data = await response.json() as any;
    const offers = data.offers || [];

    // Map to our clean interface and calculate "Commander's Choice" score
    const mappedOffers: VastOffer[] = offers.map((offer: any) => {
      // Normalize speed to a ~0-1 scale (assuming 1000Mbps is ideal)
      const speedScore = Math.min((offer.inet_up + offer.inet_down) / 2000, 1.0); 
      // Normalize price (0.00 is best, 0.60 is worst)
      const priceScore = 1.0 - (offer.dph_total / 0.60); 
      // Reliability is typically a percentage (0.0 - 1.0) or (0 - 100). Assuming 0-1 from Vast.
      const reliabilityScore = offer.reliability2 || offer.reliability || 0.9;
      // DLPerf is a raw float. Average is ~20, great is 150+.
      const dlperfScore = Math.min((offer.dlperf || 20) / 200, 1.0);
      
      // Commander's Choice weighting (DLPerf and Speed are king)
      const score = (speedScore * 0.25) + (priceScore * 0.15) + (reliabilityScore * 0.25) + (dlperfScore * 0.35);

      return {
        id: offer.id,
        machine_id: offer.machine_id,
        host_id: offer.host_id,
        gpu_name: offer.gpu_name,
        gpu_count: offer.num_gpus,
        gpu_ram: offer.gpu_ram,
        cpu_name: offer.cpu_name,
        cpu_ram: offer.cpu_ram,
        inet_up: offer.inet_up,
        inet_down: offer.inet_down,
        inet_up_cost: offer.inet_up_cost || 0,
        inet_down_cost: offer.inet_down_cost || 0,
        dph_total: offer.dph_total,
        geolocation: offer.geolocation || 'Unknown',
        reliability: offer.reliability2 || offer.reliability || 0,
        verified: offer.verified,
        disk_space: offer.disk_space || 0,
        dlperf: offer.dlperf,
        score
      };
    });

    // Sort by score descending so the best Commander's Choice is index 0
    mappedOffers.sort((a, b) => (b.score || 0) - (a.score || 0));

    return mappedOffers;
  } catch (error) {
    console.error('[VastMarket] Error fetching iron market offers:', error);
    throw error;
  }
}

/**
 * Express handler for the Loom UI to fetch the Iron Market telemetry
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    console.log('[VastMarket] Querying Vast.ai Iron Market...');
    const offers = await getIronMarketOffers();
    
    // Calculate Projected Session Cost for 5 hours per ADR-014
    const enrichedOffers = offers.map(offer => ({
      ...offer,
      projected_session_cost: Number((offer.dph_total * 5).toFixed(2))
    }));

    console.log(`[VastMarket] Retrieved ${enrichedOffers.length} offers matching Commander's Filter.`);

    return res.status(200).json({
      status: 'success',
      offers: enrichedOffers,
      count: enrichedOffers.length,
      commander_choice: enrichedOffers.length > 0 ? enrichedOffers[0].id : null
    });
  } catch (error: any) {
    console.error('[VastMarket] Handler Error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch Iron Market offers', 
      details: error.message 
    });
  }
}
