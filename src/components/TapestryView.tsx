import React from 'react';
import { GlassButton } from './GlassButton';
import { Network, Plus } from 'lucide-react';
import GigiLogo from './GigiLogo';

const TapestryView: React.FC = () => {
    return (
        <div className="h-full flex flex-col items-center justify-center bg-black/20 backdrop-blur-md pt-16 relative overflow-hidden text-center p-8">

            {/* Background Decoration */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none">
                <GigiLogo size={600} />
            </div>

            <div className="relative z-10 max-w-lg">
                <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-[0_0_40px_rgba(255,255,255,0.05)] animate-in zoom-in duration-500">
                    <Network size={48} className="text-cyan-400 opacity-80" />
                </div>

                <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">The Tapestry</h1>
                <p className="text-slate-400 text-lg mb-8 leading-relaxed">
                    A multi-dimensional visualization of your lineage and connections.
                    This module is currently initializing.
                </p>

                <div className="flex gap-4 justify-center">
                    <GlassButton variant="primary" className="px-8 py-3">
                        <Plus size={18} className="mr-2" /> Initialize Tree
                    </GlassButton>
                    <GlassButton variant="secondary" className="px-8 py-3">
                        Import GEDCOM
                    </GlassButton>
                </div>
            </div>
        </div>
    );
};

export default TapestryView;