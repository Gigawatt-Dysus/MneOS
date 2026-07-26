import React from 'react';
import { Wand2, Type, Users, MapPin, Clock, Move, Trash2 } from 'lucide-react';
import { UniversalMedia } from '../MediaStudioModal';

interface StudioSidebarProps {
    asset: UniversalMedia;
    activeTab: 'polish' | 'meta' | 'entities' | 'geo' | 'temporal' | null;
    setActiveTab: (tab: 'polish' | 'meta' | 'entities' | 'geo' | 'temporal' | null) => void;
    setIsCropping: (val: boolean) => void;
    onRemove?: (id: string) => void;
    onClose: () => void;
}

const StudioSidebar = ({ 
    asset, 
    activeTab, 
    setActiveTab, 
    setIsCropping, 
    onRemove, 
    onClose 
}: StudioSidebarProps) => {
    return (
        <div className="w-16 border-r border-white/5 bg-black/60 flex flex-col items-center py-8 gap-8 z-50">
            {(['polish', 'meta', 'entities', 'geo', 'temporal'] as const).filter(tab => {
                if (tab === 'polish') {
                    return (asset as any).type !== 'messenger_log' && (asset as any).type !== 'journal';
                }
                return true;
            }).map(tab => (
                <button 
                    key={tab}
                    onClick={() => setActiveTab(activeTab === tab ? null : tab)}
                    title={tab.toUpperCase()}
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${activeTab === tab ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]' : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                >
                    {tab === 'polish' && <Wand2 size={20} />}
                    {tab === 'meta' && <Type size={20} />}
                    {tab === 'entities' && <Users size={20} />}
                    {tab === 'geo' && <MapPin size={20} />}
                    {tab === 'temporal' && <Clock size={20} />}
                </button>
            ))}
            
            <div className="mt-auto flex flex-col gap-8">
                {/* Crop is also photo-specific */}
                {((asset as any).type !== 'messenger_log' && (asset as any).type !== 'journal') && (
                    <button 
                        onClick={() => setIsCropping(true)} 
                        title="CROP"
                        className="w-10 h-10 rounded-xl text-slate-500 hover:text-cyan-400 hover:bg-white/5 transition-all flex items-center justify-center"
                    >
                        <Move size={20} />
                    </button>
                )}
                {onRemove && (
                    <button 
                        onClick={() => { if(confirm("Discard artifact permanently?")) { onRemove(asset.id); onClose(); } }} 
                        className="w-10 h-10 rounded-xl text-slate-600 hover:text-red-500 hover:bg-red-500/10 transition-all flex items-center justify-center"
                    >
                        <Trash2 size={20} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default StudioSidebar;
