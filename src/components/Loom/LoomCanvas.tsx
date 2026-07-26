import React, { useState, useCallback, useRef } from 'react';
import {
  useReactFlow,
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Node,
  Edge,
  Connection,
  Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import GenerativeNode from './GenerativeNode';
import DirectorConsole from './DirectorConsole';
import { useGigiAuth } from '../../hooks/useGigiAuth';
import { doc, setDoc, getDoc, db } from '../../services/sovereignDbAdapter';
import exifr from 'exifr';
import { IronMarketModal } from './IronMarketModal';
import { BakeryPrepModal } from './BakeryPrepModal';
import { AlertTriangle, Trash2, Zap, Archive } from 'lucide-react';
const nodeTypes = {
  generativeNode: GenerativeNode,
};

const LowVisionControls = () => {
  const { fitView, setViewport, zoomIn, zoomOut } = useReactFlow();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Panel position="top-left" className="z-50 pointer-events-none mt-2 ml-2 flex flex-col items-start">
      {/* Handle (Always visible) */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="pointer-events-auto px-4 py-2 bg-slate-900/80 backdrop-blur-md border border-white/10 hover:border-cyan-500/50 hover:bg-cyan-900/30 text-slate-300 hover:text-cyan-400 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.5)] transition-all flex items-center gap-2 mb-2"
        title="Toggle Canvas Controls"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6"/></svg>
        <span className="text-xs font-bold tracking-wider uppercase">Canvas Controls</span>
      </button>

      {/* Rolldown Panel */}
      <div className={`transition-all duration-300 ease-out pointer-events-auto origin-top ${isOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-4 scale-95 pointer-events-none absolute top-12'}`}>
        <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-3 shadow-[0_20px_50px_rgba(0,0,0,0.7)] flex gap-2">
          <button 
            onClick={() => zoomIn({ duration: 300 })}
            className="px-4 py-2 bg-black/40 hover:bg-cyan-900/50 border border-white/5 hover:border-cyan-500/30 text-slate-200 hover:text-white rounded-xl font-bold text-sm shadow-inner transition-all flex items-center gap-2 whitespace-nowrap"
          >
            ➕ Zoom In
          </button>
          <button 
            onClick={() => zoomOut({ duration: 300 })}
            className="px-4 py-2 bg-black/40 hover:bg-cyan-900/50 border border-white/5 hover:border-cyan-500/30 text-slate-200 hover:text-white rounded-xl font-bold text-sm shadow-inner transition-all flex items-center gap-2 whitespace-nowrap"
          >
            ➖ Zoom Out
          </button>
          <div className="w-px bg-white/10 mx-1 self-stretch" />
          <button 
            onClick={() => setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 500 })}
            className="px-4 py-2 bg-cyan-900/30 hover:bg-cyan-800/60 border border-cyan-500/20 hover:border-cyan-400 text-cyan-300 hover:text-cyan-100 rounded-xl font-bold text-sm shadow-inner transition-all flex items-center gap-2 whitespace-nowrap"
          >
            🔍 Reset View
          </button>
          <button 
            onClick={() => fitView({ duration: 500, padding: 0.2 })}
            className="px-4 py-2 bg-purple-900/30 hover:bg-purple-800/60 border border-purple-500/20 hover:border-purple-400 text-purple-300 hover:text-purple-100 rounded-xl font-bold text-sm shadow-inner transition-all flex items-center gap-2 whitespace-nowrap"
          >
            🖼️ Fit Screen
          </button>
        </div>
      </div>
    </Panel>
  );
};

const IronStatusWidget = ({ instances, onTerminate }: { instances: any[], onTerminate: (id: string, provider: string) => void }) => {
  if (!instances || instances.length === 0) return null;
  
  return (
    <div className="flex flex-col gap-2 pointer-events-auto">
      {instances.map((instance: any) => {
        // Viability Predictor & Pizza Tracker Logic
        let viability = 'ASSESSING';
        let viabilityColor = 'text-slate-400';
        let statusMsg = instance.status_msg || 'Awaiting initial telemetry...';
        
        const uptimeSeconds = (Date.now() / 1000) - (instance.start_date || (Date.now() / 1000));

        let progress = 10;
        let progressLabel = "ALLOCATING HARDWARE";

        const isFullyReady = instance.actual_status === 'running';

        if (statusMsg.includes('No such container') || statusMsg.includes('Error') || statusMsg.includes('BackOff')) {
          viability = 'CRITICAL FAILURE';
          viabilityColor = 'text-red-500 font-bold animate-pulse';
          progress = 100;
          progressLabel = "NODE BRICKED";
        } else if (isFullyReady) {
          viability = 'HEALTHY';
          viabilityColor = 'text-green-400 font-bold';
          progress = 100;
          progressLabel = "NODE IGNITED / READY";
        } else if (statusMsg.includes('Download complete') || statusMsg.includes('Verifying Checksum') || statusMsg.includes('Pull complete') || statusMsg.includes('Extracting')) {
          viability = 'EXECUTING ONSTART PAYLOAD';
          viabilityColor = 'text-fuchsia-400';
          progress = 65;
          progressLabel = "EXECUTING PAYLOAD";
        } else if (statusMsg.includes('Pulling') || statusMsg.includes('Retrying') || statusMsg.includes('Downloading')) {
          if (uptimeSeconds > 600) { // 10 minutes stuck on pull/retrying
            viability = 'STALLED DOCKER PULL';
            viabilityColor = 'text-amber-500 font-bold';
            progress = 35;
            progressLabel = "STALLED PULL / RETRYING";
          } else {
            viability = 'EXTRACTING IMAGE';
            viabilityColor = 'text-blue-400';
            progress = 35;
            progressLabel = "PULLING BASE IMAGE";
          }
        } else if (uptimeSeconds > 900) {
          // Catch-all: 15+ minutes and still not running
          viability = 'TIMEOUT / CRITICAL STALL';
          viabilityColor = 'text-red-500 font-bold animate-pulse';
          progress = 100;
          progressLabel = "ABORT RECOMMENDED";
        }

        return (
          <div key={instance.id} className="group bg-slate-900/95 backdrop-blur-xl border border-cyan-500/40 rounded-lg p-3 flex flex-col gap-2 shadow-[0_0_20px_rgba(0,255,255,0.15)] transition-all duration-500 hover:border-cyan-400 w-[360px] overflow-hidden relative">
             
             {/* Header (Always Visible) */}
             <div className={`flex items-center justify-between transition-all ${isFullyReady ? 'border-b-0 pb-0' : 'border-b border-cyan-500/20 pb-2'}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${isFullyReady ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]' : viability.includes('CRITICAL') || viability.includes('TIMEOUT') ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]'}`} />
                  <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-widest">{instance.machine_id} - {instance.gpu_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {isFullyReady && <span className="text-[9px] font-bold text-green-400 uppercase tracking-widest">ONLINE</span>}
                  <span className="text-[10px] font-mono text-cyan-200/70 leading-none bg-slate-950 px-2 py-1 rounded border border-cyan-900/50">${Number(instance.dph_total || 0).toFixed(3)}/hr</span>
                  <button 
                    onClick={() => onTerminate(instance.id, isNaN(Number(instance.id)) ? 'runpod' : 'vast')} 
                    title="Execute Guillotine (Terminate Node)"
                    className="ml-1 p-1 bg-red-950/40 hover:bg-red-600/30 text-red-500 hover:text-red-400 rounded border border-red-900/50 hover:border-red-500/50 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
             </div>
             
             {/* Collapsible Body (Hidden when Ready, unless hovered) */}
             <div className={`flex flex-col gap-1 transition-all duration-500 ${isFullyReady ? 'max-h-0 opacity-0 group-hover:max-h-[300px] group-hover:opacity-100 group-hover:mt-2' : 'max-h-[300px] opacity-100 mt-0'}`}>
               
               {isFullyReady && <div className="border-t border-cyan-500/20 pt-2 mb-1" />}

               <div className="flex justify-between items-center">
                 <span className="text-[10px] text-slate-400 uppercase tracking-widest leading-none">STATE: <span className="text-cyan-300">{instance.cur_state} | {instance.actual_status}</span></span>
                 <span className="text-[10px] text-slate-400 uppercase tracking-widest leading-none">UPTIME: {Math.floor(uptimeSeconds / 60)}m {Math.floor(uptimeSeconds % 60)}s</span>
               </div>
               
               <div className="mt-1 p-2 bg-black/50 rounded border border-slate-800 font-mono text-[10px] text-emerald-400 break-words whitespace-pre-wrap max-h-[80px] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                 &gt; {statusMsg.trim()}
               </div>
               
               <div className="flex justify-between items-center mt-1 pt-1 border-t border-slate-800">
                 <span className="text-[9px] text-slate-500 uppercase tracking-widest">VIABILITY PREDICTION:</span>
                 <span className={`text-[10px] uppercase tracking-widest ${viabilityColor}`}>{viability}</span>
               </div>

               {/* Domino's Pizza Tracker */}
               <div className="mt-1">
                 <div className="flex justify-between text-[8px] font-bold text-cyan-500/70 mb-1 tracking-widest">
                   <span>{progressLabel}</span>
                   <span>{progress}%</span>
                 </div>
                 <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                   <div 
                     className={`h-full transition-all duration-1000 ${viability.includes('CRITICAL') || viability.includes('TIMEOUT') ? 'bg-red-500' : progress === 100 ? 'bg-green-500' : 'bg-cyan-500'}`} 
                     style={{ width: `${progress}%` }} 
                   />
                 </div>
               </div>
             </div>
          </div>
        );
      })}
    </div>
  );
};

export const LoomCanvas: React.FC = () => {
  const { user } = useGigiAuth();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activePlan, setActivePlan] = useState<any | null>(null);
  const [nodePromptForEdit, setNodePromptForEdit] = useState<string | undefined>(undefined);
  const [nodeReferenceImage, setNodeReferenceImage] = useState<string | undefined>(undefined);
  const [nodeToDelete, setNodeToDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isIronMarketOpen, setIsIronMarketOpen] = useState(false);
  const [activeLease, setActiveLease] = useState<any>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [activeInstances, setActiveInstances] = useState<any[]>([]);
  const [isBakeryPrepOpen, setIsBakeryPrepOpen] = useState(false);

  React.useEffect(() => {
    const fetchInstances = async () => {
      try {
        const [vastRes, runpodRes] = await Promise.all([
          fetch('/api/loom/vastLeaseService'),
          fetch('/api/loom/runpodLeaseService')
        ]);
        
        let allInstances: any[] = [];
        
        if (vastRes.ok) {
          const vastData = await vastRes.json();
          if (vastData.status === 'success') {
            allInstances = [...allInstances, ...(vastData.data || [])];
          }
        }
        
        if (runpodRes.ok) {
          const runpodData = await runpodRes.json();
          if (runpodData.status === 'success') {
            allInstances = [...allInstances, ...(runpodData.data || [])];
          }
        }
        
        setActiveInstances(allInstances);
      } catch (err) {
        console.error('[LoomCanvas] Failed to fetch instances:', err);
      }
    };
    
    fetchInstances();
    const interval = setInterval(fetchInstances, 5000); // Poll every 5s for better real-time tracking
    return () => clearInterval(interval);
  }, []);

  const handleDeployLease = async (offerId: number | string, price: number, leaseType: 'inference' | 'training', provider: 'vast' | 'runpod', templateHash?: string) => {
    try {
      console.log(`[LoomCanvas] Initiating lease deploy for offer ${offerId} on ${provider.toUpperCase()}...`);
      setIsDeploying(true);

      const endpoint = provider === 'runpod' ? '/api/loom/runpodLeaseService' : '/api/loom/vastLeaseService';
      const payload = provider === 'runpod' 
        ? { gpuTypeId: offerId, leaseType, templateHash }
        : { offerId, price, leaseType, templateHash };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      console.log(`[LoomCanvas] Response status: ${res.status}`);
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (err) {
        throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
      }

      if (data.status === 'success') {
        setActiveLease(data.data);
        setIsIronMarketOpen(false);
      } else {
        alert(`Deploy failed: ${data.details || data.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      console.error('[LoomCanvas] Deploy catch block error:', e);
      alert(`Network error deploying lease: ${e.message}`);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleTerminateLease = async (id: string | number, provider: string) => {
    if (!window.confirm(`[WARNING] Execute Guillotine on ${provider.toUpperCase()} node ${id}? This will physically destroy the container and wipe all ephemeral data. Proceed?`)) return;
    try {
      const endpoint = provider === 'runpod' ? '/api/loom/runpodLeaseService' : '/api/loom/vastLeaseService';
      const payload = provider === 'runpod' ? { podId: id } : { instanceId: id };
      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setActiveInstances(prev => prev.filter(i => i.id !== id));
      } else {
        alert('Failed to execute Guillotine on remote node.');
      }
    } catch (e) {
      console.error('Failed to terminate lease:', e);
    }
  };

  React.useEffect(() => {
    const handleDeleteNode = (e: any) => {
      const nodeId = e.detail;
      setNodeToDelete(nodeId);
    };
    const handleResizeNode = (e: any) => {
      const { id, width, height } = e.detail;
      console.log(`[LoomCanvas] Resize request for ${id}: W=${width}, H=${height}`);
      
      // Step 1: Update React state (sets style, width, height, deletes measured)
      setNodes((nds) => nds.map((n) => {
        if (n.id === id) {
          const { measured, ...rest } = n as any;
          return { ...rest, width, height, style: { ...(n.style || {}), width, height } };
        }
        return n;
      }));
      
      // Step 2: NUCLEAR DOM OVERRIDE — force the wrapper element's dimensions
      // after React commit AND after ResizeObserver has a chance to fire/revert.
      const forceDOM = () => {
        const wrapper = document.querySelector(`[data-id="${id}"]`) as HTMLElement;
        if (wrapper) {
          wrapper.style.width = `${width}px`;
          wrapper.style.height = `${height}px`;
          wrapper.style.outline = '5px solid red';
          wrapper.style.outlineOffset = '-5px';
          console.log(`[LoomCanvas DOM FORCE] Set wrapper to ${width}x${height}. Tag: ${wrapper.tagName}, classes: ${wrapper.className.substring(0, 80)}`);
        }
      };
      // Fire at multiple points to survive any async revert
      requestAnimationFrame(forceDOM);
      setTimeout(forceDOM, 50);
      setTimeout(forceDOM, 150);
      setTimeout(forceDOM, 500);
    };
    window.addEventListener('delete-loom-node', handleDeleteNode);
    window.addEventListener('resize-loom-node', handleResizeNode);
    return () => {
      window.removeEventListener('delete-loom-node', handleDeleteNode);
      window.removeEventListener('resize-loom-node', handleResizeNode);
    };
  }, [setNodes]);

  const confirmDeleteNode = () => {
    if (!nodeToDelete) return;
    setNodes((nds) => nds.filter((n) => n.id !== nodeToDelete));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeToDelete && edge.target !== nodeToDelete));
    setNodeToDelete(null);
  };

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isConsoleOpen, setIsConsoleOpen] = useState(true);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  
  const [consoleWidth, setConsoleWidth] = useState(400);
  const [isDragging, setIsDragging] = useState(false);

  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      // The console is attached to the right edge.
      const newWidth = window.innerWidth - e.clientX;
      // Clamp between 300px and 800px so it doesn't get too narrow or take over the screen.
      if (newWidth > 300 && newWidth < 800) {
        setConsoleWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging]);
  React.useEffect(() => {
    if (!user) return;
    const loadWorkspace = async () => {
      try {
        const workspaceRef = doc(db, 'users', user.id, 'loom_workspaces', 'default');
        const snap = await getDoc(workspaceRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data.nodes && data.nodes.length > 0) {
            const mappedNodes = data.nodes.map((n: any) => {
              if (n.data?.imageUrl && typeof n.data.imageUrl === 'string' && n.data.imageUrl.includes('type=output')) {
                 if (n.data.imageUrl.includes('127.0.0.1:8188') || n.data.imageUrl.includes('/comfy-ui/view')) {
                    const match = n.data.imageUrl.match(/filename=([^&]+)/);
                    if (match && match[1]) {
                       n.data.imageUrl = `/api/comfy-output/${match[1]}`;
                    }
                 }
              }
              return n;
            });
            setNodes(mappedNodes);
          }
          if (data.edges) setEdges(data.edges);
        }
      } catch (err) {
        console.error("[LoomCanvas] Failed to load workspace from Sovereign DB:", err);
      } finally {
        setIsLoaded(true);
      }
    };
    loadWorkspace();
  }, [user]);

  React.useEffect(() => {
    if (!user || !isLoaded) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const workspaceRef = doc(db, 'users', user.id, 'loom_workspaces', 'default');
        await setDoc(workspaceRef, {
          nodes: JSON.parse(JSON.stringify(nodes)),
          edges: JSON.parse(JSON.stringify(edges)),
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.error("[LoomCanvas] Failed to save workspace to Sovereign DB:", err);
      }
    }, 1500);
  }, [nodes, edges, user, isLoaded]);

  const uploadReferenceImage = async (file: File) => {
    try {
      // Phase 1: Native Metadata Extraction (EXIF/tEXt chunks)
      let extractedPrompt = "Uploaded Reference Image";
      let hasEmbeddedPrompt = false;
      try {
        // Parse metadata, asking exifr to be greedy with PNG text chunks and EXIF
        const metadata = await exifr.parse(file);
        if (metadata) {
          // Check standard A1111/Midjourney 'parameters' or ComfyUI 'prompt' keys
          if (metadata.prompt) {
            extractedPrompt = typeof metadata.prompt === 'string' ? metadata.prompt : JSON.stringify(metadata.prompt);
            hasEmbeddedPrompt = true;
          } else if (metadata.parameters) {
            extractedPrompt = metadata.parameters;
            hasEmbeddedPrompt = true;
          } else if (metadata.Description) {
            extractedPrompt = metadata.Description;
            hasEmbeddedPrompt = true;
          }
        }
      } catch (parseErr) {
        console.warn("[LoomCanvas] exifr failed to parse metadata, proceeding as raw image.", parseErr);
      }

      const formData = new FormData();
      formData.append('image', file);
      formData.append('overwrite', '1');

      const res = await fetch('/comfy-ui/upload/image', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
      const data = await res.json();
      
      setNodes((currentNodes) => {
        const newNode: Node = {
          id: `ref_${Date.now()}`,
          type: 'generativeNode',
          position: { x: currentNodes.length * 400, y: 300 },
          style: { width: 256, height: 384 },
          data: {
            imageUrl: `/comfy-ui/view?filename=${data.name}&type=input`,
            metadata: { prompt: extractedPrompt }
          }
        };
        return [...currentNodes, newNode];
      });
      
      setNodeReferenceImage(data.name);
      
      if (hasEmbeddedPrompt) {
        setNodePromptForEdit(`[SYSTEM INJECTION: Reference Image Extracted Metadata]\nOriginal Prompt: ${extractedPrompt}`);
      } else {
        setNodePromptForEdit("Uploaded Reference Image");
      }
      
      if (!isConsoleOpen) setIsConsoleOpen(true);
      console.log(`[LoomCanvas] Uploaded reference image: ${data.name}`);
    } catch (e: any) {
      console.error('[LoomCanvas] Error uploading reference image:', e);
      alert(`Upload failed: ${e.message}`);
    }
  };

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        uploadReferenceImage(file);
      }
    }
  }, [isConsoleOpen]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadReferenceImage(e.target.files[0]);
    }
    // Clear value to allow selecting the same file again
    e.target.value = '';
  };

  // Frontend polling for ComfyUI status
  React.useEffect(() => {
    if (!activeJobId) return;

    let timeoutId: NodeJS.Timeout;
    const poll = async () => {
      try {
        const res = await fetch(`/comfy-ui/history/${activeJobId}`);
        if (res.ok) {
          const data = await res.json();
          if (data[activeJobId]) {
            // Job is done!
            const outputs = data[activeJobId].outputs;
            let imageObj = null;
            for (const nId in outputs) {
              if (outputs[nId].images && outputs[nId].images.length > 0) {
                imageObj = outputs[nId].images[0];
                break; // Grabbing the first output image
              }
            }
            if (imageObj) {
              console.log("[LoomCanvas] Polled successfully. Rendering:", imageObj.filename);
              const subfolder = imageObj.subfolder || '';
              const imageType = imageObj.type || 'output';
              
              // Use the Vite proxy to hit ComfyUI's native /view endpoint perfectly, bypassing backend server constraints
              const imageUrl = `/comfy-ui/view?filename=${encodeURIComponent(imageObj.filename)}&subfolder=${encodeURIComponent(subfolder)}&type=${encodeURIComponent(imageType)}&t=${Date.now()}`;
              setNodes(nds => {
                // Remove the placeholder if it's the only one and it hasn't been used yet
                const currentNodes = nds.length === 1 && nds[0].id === '1' && nds[0].data.imageUrl.includes('placeholder') 
                    ? [] 
                    : nds;
                    
                const lastNode = currentNodes[currentNodes.length - 1];
                const newX = lastNode ? lastNode.position.x + 400 : 250;
                const newY = lastNode ? lastNode.position.y : 100;
                
                const newNode = {
                  id: activeJobId,
                  type: 'generativeNode',
                  position: { x: newX, y: newY },
                  style: { width: 128, height: 192 },
                  data: {
                    label: `Render ${currentNodes.length + 1}`,
                    imageUrl,
                    metadata: {
                      prompt: activePlan?.prompt || 'Generated',
                      seed: 'Auto'
                    }
                  }
                };
                
                return [...currentNodes, newNode];
              });
              setActiveJobId(null); // Stop polling
              setActivePlan(null);
              return; // Exit poll loop
            }
          }
        }
      } catch (err) {
        console.warn("[LoomCanvas] Polling ComfyUI failed:", err);
      }
      // Re-poll after 1 second if not done
      timeoutId = setTimeout(poll, 1000);
    };

    poll();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [activeJobId, activePlan, setNodes]);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  return (
    <div className="flex h-full w-full bg-[#0a0a0a]">
      {/* 75% Canvas Area */}
      <div 
        className={`transition-all duration-300 ${isConsoleOpen ? 'w-3/4' : 'w-full'} h-full relative`}
        onDrop={handleFileDrop}
        onDragOver={handleDragOver}
        onDoubleClickCapture={(e) => {
          // Intercept double-click on the background pane before ReactFlow eats it
          if ((e.target as HTMLElement).classList.contains('react-flow__pane')) {
             fileInputRef.current?.click();
          }
        }}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept="image/*" 
          onChange={handleFileInput} 
        />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, node) => {
            if (node.data?.metadata?.prompt) {
              setNodePromptForEdit(node.data.metadata.prompt);
              const filenameMatch = node.data.imageUrl?.match(/filename=([^&]+)/);
              if (filenameMatch) {
                 setNodeReferenceImage(decodeURIComponent(filenameMatch[1]));
              }
              if (!isConsoleOpen) setIsConsoleOpen(true);
            }
          }}
          zoomOnDoubleClick={false}
          nodeTypes={nodeTypes}
          fitView
          className="bg-neutral-900"
          defaultEdgeOptions={{ animated: true }}
        >
          <Background color="#222" gap={16} />
          {/* <IronStatusWidget instances={activeInstances} /> removed from here */}
          {/* <Controls className="bg-neutral-800 border-neutral-700 fill-white" /> */}
          <LowVisionControls />
          <MiniMap className="bg-neutral-800 border-neutral-700" maskColor="rgba(0,0,0,0.5)" />
          
          <Panel position="top-right" className="flex gap-2 p-2 items-center">
             <IronStatusWidget instances={activeInstances} onTerminate={handleTerminateLease} />
             <button 
                onClick={() => setIsConsoleOpen(!isConsoleOpen)}
                className="px-4 py-2 bg-cyan-900/50 hover:bg-cyan-800/50 border border-cyan-500/30 text-cyan-200 rounded-md backdrop-blur-sm transition-all h-[42px] flex items-center"
             >
                {isConsoleOpen ? 'Hide Console' : 'Show Console'}
             </button>
             <button 
                onClick={() => setIsBakeryPrepOpen(true)}
                className="px-4 py-2 bg-purple-900/50 hover:bg-purple-800/50 border border-purple-500/30 text-purple-200 rounded-md backdrop-blur-sm transition-all font-bold tracking-widest flex items-center gap-2 h-[42px]"
             >
                <Archive className="w-4 h-4 text-purple-400" /> BAKERY PREP
             </button>
             <button 
                onClick={() => setIsIronMarketOpen(true)}
                className="px-4 py-2 bg-emerald-900/50 hover:bg-emerald-800/50 border border-emerald-500/30 text-emerald-200 rounded-md backdrop-blur-sm transition-all font-bold tracking-widest flex items-center gap-2 h-[42px]"
             >
                <Zap className="w-4 h-4 text-emerald-400" /> IRON MARKET
             </button>
          </Panel>
        </ReactFlow>
      </div>

      {/* Resizable Chat Area */}
      <div 
        className={`relative h-full border-l border-white/10 bg-[#0f1219] ${!isDragging ? 'transition-all duration-300' : ''} ${isConsoleOpen ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ width: isConsoleOpen ? `${consoleWidth}px` : '0px', flexShrink: 0 }}
      >
        {/* Drag Handle */}
        {isConsoleOpen && (
            <div 
                className="absolute left-0 top-0 bottom-0 w-3 -translate-x-[1.5px] cursor-col-resize z-50 hover:bg-cyan-500/50 active:bg-cyan-500 transition-colors"
                onMouseDown={() => setIsDragging(true)}
            />
        )}
        
        <div className="w-full h-full overflow-hidden pointer-events-auto">
            <DirectorConsole 
              externalInput={nodePromptForEdit}
              externalReferenceImage={nodeReferenceImage}
              onClearExternalInput={() => { setNodePromptForEdit(undefined); setNodeReferenceImage(undefined); }}
              onJobQueued={(jobId, plan) => {
                 setActiveJobId(jobId);
                 setActivePlan(plan);
              }} 
              onJobCompleted={(imageUrl, plan) => {
                 setNodes(currentNodes => {
                    const newX = currentNodes.length > 0 ? currentNodes[currentNodes.length - 1].position.x + 400 : 250;
                    const newY = currentNodes.length > 0 ? currentNodes[currentNodes.length - 1].position.y : 100;
                    const newNode: Node = {
                       id: `sov_${Date.now()}`,
                       type: 'generativeNode',
                       position: { x: newX, y: newY },
                       style: { width: 256, height: 384 },
                       data: {
                          label: `Sovereign Render ${currentNodes.length + 1}`,
                          imageUrl,
                          metadata: {
                             prompt: plan?.prompt || 'Generated by Sovereign Forge',
                             seed: 'Auto'
                          }
                       }
                    };
                    return [...currentNodes, newNode];
                 });
              }}
            />
        </div>
      </div>
      
      {/* Custom Confirm Delete Modal */}
      {nodeToDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-gray-900 rounded-xl shadow-2xl max-w-sm w-full p-6 border border-red-500/50 animate-in fade-in zoom-in duration-200">
                <div className="flex items-start gap-4">
                    <div className="p-3 rounded-full bg-red-950 text-red-500 border border-red-500/30">
                        <AlertTriangle size={28} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Delete Render?</h2>
                        <div className="mt-2 text-sm">
                            <p className="text-gray-300">
                                Are you sure you want to delete this render? This action will permanently remove it from the canvas.
                            </p>
                        </div>
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <button
                        onClick={() => setNodeToDelete(null)}
                        className="px-4 py-2 text-gray-400 hover:bg-gray-800 hover:text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={confirmDeleteNode}
                        className="flex items-center gap-2 px-6 py-2 bg-red-900/80 hover:bg-red-800 text-red-100 border border-red-700/50 rounded-lg text-sm font-bold shadow-lg transition-all transform hover:scale-105"
                    >
                        <Trash2 size={16} /> Delete
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Sovereign Ephemeral Compute Bridge */}
      <IronMarketModal 
        isOpen={isIronMarketOpen}
        onClose={() => setIsIronMarketOpen(false)}
        onDeploy={handleDeployLease}
        isDeploying={isDeploying}
      />
      <BakeryPrepModal 
        isOpen={isBakeryPrepOpen}
        onClose={() => setIsBakeryPrepOpen(false)}
      />
    </div>
  );
};

export default LoomCanvas;
