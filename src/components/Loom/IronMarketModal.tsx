import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Zap, ShieldCheck, Server, X, Activity, HardDrive } from 'lucide-react';

export interface VastOffer {
  id: number;
  gpu_name: string;
  gpu_count: number;
  gpu_ram: number;
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
  projected_session_cost: number;
}

interface IronMarketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeploy: (offerId: number | string, price: number, leaseType: 'inference' | 'training', provider: 'vast' | 'runpod' | 'thunder', templateHash?: string) => void;
  isDeploying?: boolean;
}

export const IronMarketModal: React.FC<IronMarketModalProps> = ({ isOpen, onClose, onDeploy, isDeploying = false }) => {
  const [offers, setOffers] = useState<VastOffer[]>([]);
  const [commanderChoice, setCommanderChoice] = useState<number | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<number | string | null>(null);
  const [loading, setLoading] = useState(true);
  const [leaseType, setLeaseType] = useState<'inference' | 'training'>('inference');
  const [templateHash, setTemplateHash] = useState<string>('');
  const [provider, setProvider] = useState<'vast' | 'runpod' | 'thunder'>('vast');
  const [thunderBootSource, setThunderBootSource] = useState<'snapshot' | 'comfy_template'>('snapshot');

  const RUNPOD_OFFERS: any[] = [
    {
      id: "NVIDIA RTX A6000",
      gpu_name: "RTX A6000",
      gpu_count: 1,
      gpu_ram: 48000,
      dph_total: 0.52,
      projected_session_cost: 0.52 * 5,
      geolocation: "RUNPOD SECURE CLOUD",
      reliability: 1,
      verified: true,
      inet_up: 10000,
      inet_down: 10000,
      inet_up_cost: 0,
      inet_down_cost: 0,
      disk_space: 150,
    },
    {
      id: "NVIDIA RTX 6000 Ada Generation",
      gpu_name: "RTX 6000 Ada",
      gpu_count: 1,
      gpu_ram: 48000,
      dph_total: 1.19, // Ada is usually a bit more expensive
      projected_session_cost: 1.19 * 5,
      geolocation: "RUNPOD SECURE CLOUD",
      reliability: 1,
      verified: true,
      inet_up: 10000,
      inet_down: 10000,
      inet_up_cost: 0,
      inet_down_cost: 0,
      disk_space: 150,
    }
  ];

  const THUNDER_OFFERS: any[] = [
    {
      id: "A6000",
      gpu_name: "RTX A6000",
      gpu_count: 1,
      gpu_ram: 48000,
      dph_total: 0.36,
      projected_session_cost: 0.36 * 5,
      geolocation: "THUNDER ENTERPRISE DATACENTER",
      reliability: 0.99,
      verified: true,
      inet_up: 10000,
      inet_down: 10000,
      inet_up_cost: 0,
      inet_down_cost: 0,
      disk_space: 150,
    }
  ];

  useEffect(() => {
    if (isOpen && provider === 'vast') {
      setLoading(true);
      fetch('/api/loom/vastMarketService')
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success') {
            setOffers(data.offers);
            setCommanderChoice(data.commander_choice);
            if (provider === 'vast') setSelectedOffer(data.commander_choice);
          }
        })
        .catch(err => console.error('[IronMarket] Error fetching offers:', err))
        .finally(() => setLoading(false));
    } else if (isOpen && provider === 'runpod') {
      setSelectedOffer(RUNPOD_OFFERS[0].id);
    } else if (isOpen && provider === 'thunder') {
      setSelectedOffer(THUNDER_OFFERS[0].id);
    }
  }, [isOpen, provider]);

  if (!isOpen) return null;

  const currentOffers = provider === 'vast' ? offers : provider === 'runpod' ? RUNPOD_OFFERS : THUNDER_OFFERS;

  const modalContent = (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      >
        <motion.div 
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          className="relative w-full max-w-5xl bg-slate-900 border border-emerald-500/30 rounded-lg shadow-[0_0_40px_rgba(16,185,129,0.15)] overflow-hidden font-mono text-emerald-400 flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-emerald-500/30 bg-slate-950/80">
            <div className="flex items-center gap-3">
              <Terminal className="w-5 h-5 text-emerald-500" />
              <h2 className="text-lg font-semibold tracking-widest text-emerald-50">IRON MARKET <span className="text-emerald-500/50">v2.1</span></h2>
            </div>
            
            {/* Provider Toggle */}
            <div className="flex items-center gap-2 bg-slate-900 rounded-lg p-1 border border-emerald-900/50" title="Switch compute backend. RunPod guarantees 10Gbps bandwidth for rapid Z-Image hydration.">
              <button 
                onClick={() => { setProvider('vast'); setSelectedOffer(commanderChoice); }}
                title="Vast.ai Decentralized Spot Market: Unreliable bandwidth but cost-optimized for long bakes."
                className={`px-4 py-1 text-sm font-bold tracking-widest rounded transition-all ${provider === 'vast' ? 'bg-emerald-500 text-slate-950 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'text-emerald-500/50 hover:text-emerald-400'}`}
              >
                VAST.AI
              </button>
              <button 
                onClick={() => { setProvider('runpod'); setSelectedOffer(RUNPOD_OFFERS[0].id); }}
                title="RunPod Enterprise Secure Datacenters: Flawless initialization, guaranteed 10Gbps backbone."
                className={`px-4 py-1 text-sm font-bold tracking-widest rounded transition-all ${provider === 'runpod' ? 'bg-fuchsia-500 text-slate-950 shadow-[0_0_10px_rgba(217,70,239,0.5)]' : 'text-fuchsia-500/50 hover:text-fuchsia-400'}`}
              >
                RUNPOD SECURE
              </button>
              <button 
                onClick={() => { setProvider('thunder'); setSelectedOffer(THUNDER_OFFERS[0].id); }}
                title="Thunder Compute Fast Lane: 10Gbps backbone, $0.36/hr A6000s, and instant Singleton Snapshot Wake-Up."
                className={`px-4 py-1 text-sm font-bold tracking-widest rounded transition-all flex items-center gap-2 ${provider === 'thunder' ? 'bg-amber-500 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.8)]' : 'text-amber-500/50 hover:text-amber-400'}`}
              >
                <Zap className="w-3 h-3" /> THUNDER FAST LANE
              </button>
            </div>

            <div className="flex items-center gap-4">
              <input
                type="text"
                placeholder="Template Hash ID"
                title="Override default image with a specific Vast or RunPod template hash."
                value={templateHash}
                onChange={(e) => setTemplateHash(e.target.value)}
                className="bg-slate-950 border border-emerald-900/50 rounded px-3 py-1 text-xs text-emerald-300 placeholder-emerald-800 focus:outline-none focus:border-emerald-500 transition-colors w-48 font-mono"
              />
              <button 
                onClick={() => {
                  setLoading(true);
                  if (provider === 'vast') {
                    fetch('/api/loom/vastMarketService')
                      .then(res => res.json())
                      .then(data => {
                        if (data.status === 'success') {
                          setOffers(data.offers);
                          setCommanderChoice(data.commander_choice);
                          setSelectedOffer(data.commander_choice);
                        }
                      })
                      .catch(err => console.error('[IronMarket] Error fetching offers:', err))
                      .finally(() => setLoading(false));
                  } else if (provider === 'runpod') {
                    // RunPod offers are static enterprise tier, simulate a rapid ping for UX
                    setTimeout(() => {
                      setSelectedOffer(RUNPOD_OFFERS[0].id);
                      setLoading(false);
                    }, 600);
                  } else {
                    setTimeout(() => {
                      setSelectedOffer(THUNDER_OFFERS[0].id);
                      setLoading(false);
                    }, 600);
                  }
                }} 
                title="Refresh Market Inventory" 
                className={`p-2 transition-colors rounded focus:outline-none ${provider === 'runpod' ? 'hover:bg-fuchsia-500/20 text-fuchsia-500/80 hover:text-fuchsia-400' : provider === 'thunder' ? 'hover:bg-amber-500/20 text-amber-500/80 hover:text-amber-400' : 'hover:bg-emerald-500/20 text-emerald-500/80 hover:text-emerald-400'}`}
                disabled={loading}
              >
                <Activity className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={onClose} title="Abort Deployment and Close Iron Market" className="p-2 transition-colors rounded hover:bg-emerald-500/20 text-emerald-500/50 hover:text-emerald-400 focus:outline-none">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6" style={{ scrollbarWidth: 'thin', scrollbarColor: '#10b981 transparent' }}>
            {provider === 'vast' && loading ? (
              <div className="flex flex-col items-center justify-center py-24 space-y-6">
                <Activity className="w-10 h-10 animate-pulse text-emerald-500" />
                <p className="text-lg tracking-widest animate-pulse text-emerald-500/80">POLLING DECENTRALIZED SPOT MARKET...</p>
              </div>
            ) : currentOffers.length === 0 ? (
              <div className="text-center py-20 text-red-400">
                <p className="text-lg tracking-widest">NO HARDWARE FOUND WITHIN COMMANDER'S FILTER PARAMETERS.</p>
                <p className="text-sm mt-2 opacity-70">Awaiting optimal compute topology. Re-poll later.</p>
              </div>
            ) : provider === 'thunder' ? (
              <div className="flex flex-col gap-6 h-full justify-center px-8">
                <div className="bg-amber-950/20 border border-amber-500/50 rounded-xl p-8 flex flex-col gap-6 shadow-[0_0_30px_rgba(245,158,11,0.1)]">
                  <div className="flex items-center gap-4 border-b border-amber-900/50 pb-6">
                    <ShieldCheck className="w-12 h-12 text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                    <div>
                      <h3 className="text-3xl font-bold tracking-widest text-amber-400">THUNDER SECURE LAUNCHPAD</h3>
                      <p className="text-amber-500/80 text-base tracking-wider mt-1">A6000 48GB VRAM • 10Gbps Enterprise Backbone • $0.36/hr</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-4 mt-2">
                    <label className="text-base font-bold tracking-widest text-amber-500/80">SELECT BOOT SOURCE (HYDRATION STRATEGY)</label>
                    <div className="flex gap-4">
                      <button 
                        onClick={() => setThunderBootSource('snapshot')}
                        className={`flex-1 p-5 rounded-lg border-2 transition-all text-left relative overflow-hidden ${thunderBootSource === 'snapshot' ? 'bg-amber-500/20 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.3)]' : 'border-amber-900/50 hover:border-amber-500/50 bg-slate-900/50'}`}
                      >
                        <div className="font-bold text-amber-400 text-xl mb-1 flex items-center justify-between">
                          <span>Singleton Snapshot</span>
                          {thunderBootSource === 'snapshot' && <Zap className="w-6 h-6 fill-amber-400 drop-shadow-[0_0_5px_rgba(245,158,11,0.8)]" />}
                        </div>
                        <div className="text-amber-500/70 text-sm font-mono mt-2">ID: mneos-image-2026-07-16</div>
                        <div className="text-emerald-500 text-sm mt-3 tracking-wider font-bold">INSTANT 30-SECOND WAKE-UP • NO B2 HYDRATION NEEDED</div>
                        {thunderBootSource === 'snapshot' && (
                          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-50"></div>
                        )}
                      </button>

                      <button 
                        onClick={() => setThunderBootSource('comfy_template')}
                        className={`flex-1 p-5 rounded-lg border-2 transition-all text-left ${thunderBootSource === 'comfy_template' ? 'bg-amber-500/20 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'border-amber-900/50 hover:border-amber-500/50 bg-slate-900/50'}`}
                      >
                        <div className="font-bold text-amber-400 text-xl mb-1">Thunder Default Template</div>
                        <div className="text-amber-500/70 text-sm font-mono mt-2">ID: template-comfyui-latest</div>
                        <div className="text-rose-400 text-sm mt-3 tracking-wider font-bold">REQUIRES 15 MIN B2 VAULT HYDRATION ON BOOT</div>
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-950/80 rounded-lg p-4 mt-4 border border-amber-900/30 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm text-amber-500/50 tracking-widest font-bold">INJECTED SSH IDENTITY KEY</span>
                      <span className="text-amber-400 font-mono mt-1 text-lg">MneOS-Prime (ed25519)</span>
                    </div>
                    <ShieldCheck className="w-8 h-8 text-emerald-500 opacity-60" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                {currentOffers.map((offer: any) => {
                  const isChoice = provider === 'vast' && offer.id === commanderChoice;
                  const isSelected = offer.id === selectedOffer;
                  const accentColor = provider === 'runpod' ? 'fuchsia' : 'emerald';

                  return (
                    <div 
                      key={offer.id} 
                      onClick={() => setSelectedOffer(offer.id)}
                      className={`relative group cursor-pointer transition-all duration-300 border rounded-lg p-5 flex items-center justify-between ${
                        isSelected 
                          ? `bg-${accentColor}-950/50 border-${accentColor}-400 shadow-[0_0_25px_rgba(${provider==='runpod'?'217,70,239':provider==='thunder'?'245,158,11':'16,185,129'},0.2)]` 
                          : `bg-slate-900/50 border-${accentColor}-900/50 hover:border-${accentColor}-500/50 hover:bg-slate-800`
                      }`}
                    >
                      {/* Commander's Choice Badge */}
                      {isChoice && (
                        <div className="absolute -top-3 left-4 px-3 py-1 bg-amber-500 text-slate-950 text-xs font-bold tracking-widest rounded shadow-[0_0_15px_rgba(245,158,11,0.5)] flex items-center gap-2 z-10" title="Algorithmically verified as the optimal cost/performance ratio for Vast.ai bakes.">
                          <Zap className="w-3 h-3" />
                          COMMANDER'S CHOICE
                        </div>
                      )}
                      {provider === 'runpod' && (
                        <div className="absolute -top-3 left-4 px-3 py-1 bg-fuchsia-500 text-slate-950 text-xs font-bold tracking-widest rounded shadow-[0_0_15px_rgba(217,70,239,0.5)] flex items-center gap-2 z-10" title="Tier-1 Enterprise Infrastructure. Immune to typical PyTorch/Numpy driver drift.">
                          <ShieldCheck className="w-3 h-3" />
                          ENTERPRISE DATACENTER
                        </div>
                      )}

                      <div className="flex flex-col gap-2 z-0 mt-2">
                        <div className="flex items-center gap-4">
                          <h3 className={`text-2xl font-bold tracking-wider ${isSelected ? `text-${accentColor}-50` : `text-${accentColor}-300`}`}>
                            {offer.gpu_count}x {offer.gpu_name}
                          </h3>
                          <span className={`px-3 py-1 text-base font-bold bg-slate-950 rounded text-${accentColor}-400 border border-${accentColor}-900/50`}>
                            {offer.gpu_ram}MB VRAM
                          </span>
                          <span 
                            className={`px-3 py-1 text-base font-bold bg-slate-950 rounded border flex items-center gap-2 ${leaseType === 'training' ? 'text-amber-400 border-amber-900/50' : 'text-cyan-400 border-cyan-900/50'}`}
                            title={`Storage allocation.`}
                          >
                            <HardDrive className="w-4 h-4" /> {provider === 'runpod' || provider === 'thunder' ? '150GB PERSISTENT DISK' : '150GB ALLOCATED'}
                          </span>
                          {offer.verified && (
                            <ShieldCheck className={`w-6 h-6 text-${provider==='runpod'?'fuchsia':provider==='thunder'?'amber':'blue'}-400 drop-shadow-[0_0_5px_rgba(${provider==='runpod'?'217,70,239':provider==='thunder'?'245,158,11':'96,165,250'},0.5)]`} title="Verified Datacenter Environment" />
                          )}
                        </div>
                        <div className={`flex items-center gap-6 text-lg text-${accentColor}-500/80 mt-2 font-medium`}>
                          <div className="flex items-center gap-2" title="Physical location of the compute node.">
                            <Server className="w-5 h-5" /> {offer.geolocation}
                          </div>
                          <div className="flex gap-3" title={`Bandwidth Costs: $${Number(offer.inet_down_cost || 0).toFixed(4)}/GB down, $${Number(offer.inet_up_cost || 0).toFixed(4)}/GB up. RunPod guarantees 10+ Gbps.`}>
                            <span className="text-blue-400">⬇ {offer.inet_down > 9000 ? '10+ Gbps' : offer.inet_down.toFixed(0) + ' Mbps'} <span className="text-sm opacity-70">(${Number(offer.inet_down_cost || 0).toFixed(4)}/GB)</span></span>
                            <span className={`text-${accentColor}-500/30`}>|</span>
                            <span className="text-amber-400">⬆ {offer.inet_up > 9000 ? '10+ Gbps' : offer.inet_up.toFixed(0) + ' Mbps'} <span className="text-sm opacity-70">(${Number(offer.inet_up_cost || 0).toFixed(4)}/GB)</span></span>
                          </div>
                          <div className="flex gap-3" title="Statistical reliability of this node provider completing long-running bakes.">
                            <span>Rel: {(offer.reliability * 100).toFixed(1)}%</span>
                            {offer.dlperf && (
                              <>
                                <span className={`text-${accentColor}-500/30`}>|</span>
                                <span className="text-fuchsia-400" title="Deep Learning Performance Score via PyTorch benchmarks.">DLPerf: {offer.dlperf.toFixed(1)}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className={`flex flex-col items-end text-right border-l-2 border-${accentColor}-900/50 pl-8 py-2`}>
                        <div className="text-3xl font-bold text-emerald-100 flex items-baseline gap-1">
                          ${offer.dph_total.toFixed(3)}<span className={`text-lg font-normal text-${accentColor}-500/50`}>/hr</span>
                        </div>
                        <div className={`text-base tracking-widest text-${accentColor}-500/70 mt-2 font-bold`}>
                          5HR LEASE: <span className="text-amber-500 text-lg">${offer.projected_session_cost.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Action */}
          <div className="p-6 border-t border-emerald-500/30 bg-slate-950/90 flex items-center justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-4 mb-3">
                <button
                  onClick={() => setLeaseType('inference')}
                  title="Configures node with 150GB disk and ComfyUI to support the massive full-weight Z-Image base model."
                  className={`px-6 py-3 rounded-lg text-lg font-bold tracking-widest border-2 transition-all ${leaseType === 'inference' ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)]' : 'bg-transparent border-emerald-900/50 text-emerald-700 hover:border-cyan-500/50 hover:text-cyan-500'}`}
                >
                  [ INFERENCE NODE ]
                </button>
                <button
                  onClick={() => setLeaseType('training')}
                  title="Configures node with 150GB disk, pulls the B2 Vault, and installs Ostris AI-Toolkit for Sovereign LoRA training."
                  className={`px-6 py-3 rounded-lg text-lg font-bold tracking-widest border-2 transition-all ${leaseType === 'training' ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)]' : 'bg-transparent border-emerald-900/50 text-emerald-700 hover:border-amber-500/50 hover:text-amber-600'}`}
                >
                  [ TRAINING FORGE ]
                </button>
              </div>
              <span className={`text-lg tracking-widest uppercase font-bold ${leaseType === 'training' ? 'text-amber-500' : 'text-emerald-500/70'}`}>
                {provider === 'runpod' || provider === 'thunder'
                  ? (leaseType === 'training' ? 'ALLOCATING 150GB PERSISTENT DISK • B2 VAULT HYDRATION ENABLED' : 'ALLOCATING 150GB PERSISTENT DISK • B2 INJECTION DISABLED')
                  : (leaseType === 'training' ? 'ALLOCATING 150GB DISK • B2 VAULT HYDRATION ENABLED' : 'ALLOCATING 150GB DISK • B2 INJECTION DISABLED')
                }
              </span>
              <span className="text-sm text-emerald-600 uppercase font-bold tracking-wider">{leaseType === 'training' ? 'Ostris AI-Toolkit will be provisioned' : 'Sovereign Biometrics will be applied upon lease instantiation'}</span>
            </div>
            
            <button
                disabled={!selectedOffer || isDeploying}
                title={`Deploys selected configuration to ${provider === 'runpod' ? 'RunPod' : provider === 'thunder' ? 'Thunder Compute' : 'Vast.ai'} via the background onstart injection.`}
                onClick={() => {
                  const target = currentOffers.find((o: any) => o.id === selectedOffer);
                  if (target) {
                    const bootId = provider === 'thunder' 
                      ? (thunderBootSource === 'snapshot' ? 'snap:mneos-image-2026-07-16' : 'tmpl:comfyui-latest')
                      : templateHash;
                    onDeploy(target.id, target.dph_total, leaseType, provider, bootId);
                  }
                }}
                className={`px-8 py-4 text-lg font-bold tracking-widest rounded transition-all flex items-center gap-2 ${
                  isDeploying 
                    ? 'bg-amber-500 text-slate-900 cursor-wait shadow-[0_0_20px_rgba(245,158,11,0.5)] animate-pulse' 
                    : provider === 'thunder' || leaseType === 'training' 
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.5)]'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                }`}
              >
              <Zap className={`w-5 h-5 ${isDeploying ? 'fill-current' : ''}`} />
              {isDeploying ? 'DEPLOYING...' : leaseType === 'training' ? 'IGNITE FORGE' : 'INITIATE LEASE'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};
