import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps, NodeResizer, useReactFlow } from '@xyflow/react';
import { Scissors, Camera, Film, ArrowUpRight, Download, Share, Trash2, Maximize, X, ChevronDown, Crown, Activity, Eye, AlertCircle } from 'lucide-react';
import BorderGlow from '../shared/BorderGlow';

const GenerativeNode = ({ id, data, isConnectable, selected, width, height }: NodeProps) => {
  const { setNodes, getNode, updateNode } = useReactFlow();
  const [showResizer, setShowResizer] = useState(false);
  const [isToolbarOpen, setIsToolbarOpen] = useState(false);
  const [customScale, setCustomScale] = useState('');
  
  // Read ADR-013 specific data properties
  const status = (data.status as string) || 'completed';
  const role = (data.role as string) || 'scene';
  const facs = data.facs as any;
  const isCanon = role === 'canon_master';

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('delete-loom-node', { detail: id }));
  };

  const handlePromoteToCanon = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('promote-loom-node-canon', { detail: id }));
    // Update the local node state
    updateNode(id, { data: { ...data, role: 'canon_master' } });
  };

  const applyScale = (percent: number) => {
    if (percent < 10) percent = 10;
    const newW = 1024 * (percent / 100);
    let aspect = 256 / 384;
    const imgElement = document.querySelector(`[data-id="${id}"] img`) as HTMLImageElement;
    if (imgElement && imgElement.naturalWidth && imgElement.naturalHeight) {
      aspect = imgElement.naturalWidth / imgElement.naturalHeight;
    }
    const newH = newW / aspect;
    window.dispatchEvent(new CustomEvent('resize-loom-node', { 
      detail: { id, width: newW, height: newH } 
    }));
  };

  const handleCustomScaleSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = parseInt(customScale);
      if (!isNaN(val)) applyScale(val);
      setShowResizer(false);
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.imageUrl) {
      const link = document.createElement('a');
      link.href = data.imageUrl as string;
      link.download = `loom_render_${id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const getStatusColor = () => {
    switch(status) {
      case 'queued': return 'text-yellow-500 bg-yellow-500/20 border-yellow-500/50';
      case 'forging': return 'text-blue-500 bg-blue-500/20 border-blue-500/50 animate-pulse';
      case 'failed': return 'text-red-500 bg-red-500/20 border-red-500/50';
      case 'needs_review': return 'text-orange-500 bg-orange-500/20 border-orange-500/50';
      default: return 'text-emerald-500 bg-emerald-500/20 border-emerald-500/50';
    }
  };

  return (
    <div style={{ width: width || 256, height: height || 384 }} className="relative">
      <NodeResizer 
        color={isCanon ? "#eab308" : "#06b6d4"} 
        isVisible={selected} 
        minWidth={200} 
        minHeight={200} 
        handleClassName={`w-4 h-4 ${isCanon ? 'bg-yellow-500' : 'bg-cyan-500'} border-2 border-neutral-900 rounded`}
      />
      <BorderGlow
        className={`relative w-full h-full group transition-all duration-300 ${selected ? 'z-50' : 'z-10'}`}
        backgroundColor="#171717"
        glowColor={isCanon ? '45 100 50' : (selected ? '190 100 50' : '40 80 80')}
        colors={isCanon ? ['#eab308', '#f59e0b', '#d97706'] : (selected ? ['#06b6d4', '#3b82f6', '#8b5cf6'] : ['#52525b', '#3f3f46', '#27272a'])}
        animated={selected || status === 'forging'}
        glowRadius={selected ? 25 : 10}
        glowIntensity={selected ? 1.5 : 0.5}
        borderRadius={12}
        fillOpacity={0}
      >
        <div className={`
          relative rounded-xl overflow-hidden bg-neutral-900 shadow-xl
          border ${isCanon ? 'border-yellow-500/50' : (selected ? 'border-cyan-500/50' : 'border-neutral-800')}
          w-full h-full flex flex-col min-w-0 min-h-0
        `}>
          <Handle
            type="target"
            position={Position.Top}
            isConnectable={isConnectable}
            className={`w-4 h-4 ${isCanon ? 'bg-yellow-500' : 'bg-cyan-500'} border-2 border-neutral-900`}
          />
        
          {/* Node Image / Status Container */}
          <div className="w-full h-full bg-neutral-800 relative">
            {data.imageUrl ? (
              <img 
                src={data.imageUrl as string} 
                alt={(data.label as string) || "Rendered Asset"} 
                className={`absolute inset-0 w-full h-full object-cover block transition-opacity ${status === 'forging' ? 'opacity-50 blur-sm' : 'opacity-100'}`}
              />
            ) : (
              <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center text-neutral-500">
                <Activity size={32} className={status === 'forging' ? 'animate-spin text-blue-500 mb-2' : 'mb-2'} />
                <span className="text-sm font-bold uppercase tracking-wider">{status}</span>
              </div>
            )}

            {/* Status Badge (ADR-013 Telemetry) */}
            <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider backdrop-blur-md flex items-center gap-1 ${getStatusColor()}`}>
              {status === 'failed' && <AlertCircle size={10} />}
              {status}
            </div>

            {/* Canon Badge */}
            {isCanon && (
              <div className="absolute top-2 left-2 bg-yellow-500/20 border border-yellow-500 text-yellow-400 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 backdrop-blur-md">
                <Crown size={12} />
                Canon Master
              </div>
            )}

            {/* Shade Handle (Persistent Trigger) */}
            <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50">
              <button 
                onClick={(e) => { e.stopPropagation(); setIsToolbarOpen(!isToolbarOpen); setShowResizer(false); }}
                className={`bg-black/60 backdrop-blur-md border border-white/20 hover:bg-white/10 rounded-full px-6 py-1 flex items-center justify-center transition-all shadow-[0_4px_20px_rgba(0,0,0,0.5)] ${isToolbarOpen ? 'text-cyan-400 border-cyan-500/50' : 'text-slate-400 hover:text-white'}`}
                title={isToolbarOpen ? "Collapse Director Toolbar" : "Expand Director Toolbar (Access generation and structural tools)"}
              >
                <div className="w-8 h-1 bg-current rounded-full opacity-50 mb-1 absolute top-1" />
                <ChevronDown size={14} className={`transition-transform duration-300 mt-1 ${isToolbarOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Action Overlay Toolbar (MatrixGrid Pattern) */}
            <div className={`
              absolute top-16 left-1/2 -translate-x-1/2 transition-all duration-300 ease-out z-40 flex flex-col items-center gap-2
              ${isToolbarOpen ? 'opacity-100 translate-y-0 pointer-events-auto scale-100' : 'opacity-0 -translate-y-2 pointer-events-none scale-95'}
            `}>
              <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.7)] flex items-center gap-1.5 w-max">
                
                <button 
                  onClick={handlePromoteToCanon}
                  className={`p-2 backdrop-blur text-white rounded-xl transition-all ${isCanon ? 'bg-yellow-600' : 'bg-white/10 hover:bg-yellow-600 hover:scale-110 shadow-lg'}`} 
                  title="Promote to Canon Master (Sets role: canon_master and explicitly marks all sibling variant nodes as superseded in the lineage graph)">
                  <Crown size={18} />
                </button>

                <div className="w-px h-6 bg-white/20 mx-0.5"></div>

                <button 
                  onClick={(e) => { e.stopPropagation(); setShowResizer(!showResizer); }}
                  className={`p-2 backdrop-blur text-white rounded-xl transition-all ${showResizer ? 'bg-cyan-600' : 'bg-white/10 hover:bg-cyan-900/90 hover:scale-110 shadow-lg'}`} 
                  title="Resize Frame (Adjust internal aspect ratio and scale for layout)">
                  <Maximize size={18} />
                </button>
                <button className="p-2 bg-white/10 hover:bg-cyan-900/90 shadow-lg backdrop-blur text-white rounded-xl transition-all hover:scale-110 cursor-not-allowed opacity-50" title="Edit/Inpaint (✂️) - Opens the region masking tool to fix structural drift">
                  <Scissors size={18} />
                </button>
                <button className="p-2 bg-white/10 hover:bg-cyan-900/90 shadow-lg backdrop-blur text-white rounded-xl transition-all hover:scale-110 cursor-not-allowed opacity-50" title="Extract Frame (📷) - Pulls a single high-fidelity still from a video asset">
                  <Camera size={18} />
                </button>
                <button className="p-2 bg-white/10 hover:bg-cyan-900/90 shadow-lg backdrop-blur text-white rounded-xl transition-all hover:scale-110 cursor-not-allowed opacity-50" title="Render Video (🎞️) - Dispatches current still to the I2V rendering queue">
                  <Film size={18} />
                </button>
                
                <div className="w-px h-6 bg-white/20 mx-0.5"></div>
                
                <button 
                  onClick={handleDownload}
                  className="p-2 bg-white/10 hover:bg-cyan-900/90 shadow-lg backdrop-blur text-white rounded-xl transition-all hover:scale-110" 
                  title="Download Asset (Saves full resolution render locally)">
                  <Download size={18} />
                </button>
                
                <div className="w-px h-6 bg-white/20 mx-0.5"></div>
                
                <button 
                  onClick={handleDelete}
                  className="p-2 bg-red-900/40 hover:bg-red-900/90 shadow-lg backdrop-blur text-red-300 hover:text-white border border-red-500/30 rounded-xl transition-all hover:scale-110" 
                  title="Delete Node (⚠️ Destroys this render instance permanently from the canvas and lineage graph)">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            {/* Resizer Widget Popover */}
            {showResizer && (
              <div 
                className="absolute top-28 left-1/2 -translate-x-1/2 bg-black/95 backdrop-blur-xl border-2 border-cyan-500/50 rounded-2xl p-4 flex items-center gap-4 shadow-2xl z-50 cursor-default"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <div className="flex gap-3">
                  {[25, 50, 75, 100].map(pct => (
                    <button 
                      key={pct}
                      onClick={() => applyScale(pct)}
                      className="px-5 py-3 text-lg font-black bg-neutral-800 hover:bg-cyan-600 text-neutral-100 rounded-xl transition-colors border border-neutral-700"
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
                <div className="w-px h-6 bg-neutral-700 mx-1"></div>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    value={customScale}
                    onChange={(e) => setCustomScale(e.target.value)}
                    onKeyDown={handleCustomScaleSubmit}
                    placeholder="%"
                    className="w-16 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <button onClick={() => setShowResizer(false)} className="ml-2 text-neutral-400 hover:text-white p-1 bg-neutral-800 hover:bg-red-500/80 rounded-lg transition-colors">
                  <X size={18} />
                </button>
              </div>
            )}
          </div>

          {/* Node Footer - Metadata Plate */}
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-neutral-900/95 to-neutral-900/80 backdrop-blur-md border-t border-white/10 z-20">
            <div className="flex justify-between items-end mb-1">
              <div className="text-xs font-semibold text-neutral-200 truncate pr-2">{data.label as string || 'Untitled Render'}</div>
              <div className="text-[9px] text-neutral-500 font-mono tracking-tighter opacity-50 shrink-0" title="Asset UUID">{id.split('-')[0]}</div>
            </div>
            
            {/* VLM Description / Prompt */}
            <div className="text-[10px] text-neutral-400 line-clamp-2 leading-tight mb-2" title="Prompt / Description injected into Visual Director context">
              {data.description ? (data.description as string) : ((data.metadata as any)?.prompt || 'No description available.')}
            </div>

            {/* Technical Chips */}
            <div className="flex flex-wrap gap-1">
              <div className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-neutral-400 flex items-center gap-1" title="Asset Role within the Lineage Graph">
                {role}
              </div>
              {facs && (facs.baseline || facs.apex) && (
                <div className="text-[9px] px-1.5 py-0.5 rounded bg-blue-900/30 border border-blue-500/30 text-blue-300 flex items-center gap-1" title={`FACS Data - Baseline: ${facs.baseline || 'N/A'}, Apex: ${facs.apex || 'N/A'}`}>
                  <Eye size={10} />
                  FACS Lock
                </div>
              )}
              {data.backend && (
                <div className="text-[9px] px-1.5 py-0.5 rounded bg-purple-900/30 border border-purple-500/30 text-purple-300" title={`Generative Engine Backend: ${data.backend}`}>
                  {data.backend as string}
                </div>
              )}
            </div>
          </div>

          <Handle
            type="source"
            position={Position.Bottom}
            isConnectable={isConnectable}
            className={`w-3 h-3 ${isCanon ? 'bg-yellow-500' : 'bg-cyan-500'} border-2 border-neutral-900`}
          />
        </div>
      </BorderGlow>
    </div>
  );
};

export default memo(GenerativeNode);
