import React from 'react';
import MneOSLogo from './MneOSLogo';
import { GlassAvatar } from './GlassAvatar';

const LoginHeader: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center w-full gap-4 md:gap-8">
            <GlassAvatar size="w-24 h-24 md:w-48 md:h-48" className="planet shadow-[0_0_30px_rgba(34,211,238,0.3)] transition-all duration-500" hideFallback>
                <MneOSLogo variant="icon" className="w-[60%] h-[60%] absolute inset-0 m-auto drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
            </GlassAvatar>
            <div className="text-center">
                <h1 className="text-2xl md:text-5xl font-['Orbitron',_sans-serif] font-bold text-white tracking-[0.3em] drop-shadow-md transition-all duration-500">
                    Mne<span className="text-cyan-400">OS</span>
                </h1>
                <p className="mt-2 text-cyan-400/50 text-[10px] md:text-xs font-mono uppercase tracking-widest">Sovereign Architecture</p>
            </div>
        </div>
    );
};

export default LoginHeader;
