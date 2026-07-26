import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, Activity, CheckCircle, AlertTriangle, X } from 'lucide-react';

interface TelemetryData {
    total_jobs: number;
    done_jobs: number;
    error_jobs: number;
    pending_jobs: number;
    processed_this_session: number;
    current_file: string;
    last_updated: string;
}

interface AirlockViewerProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AirlockViewer: React.FC<AirlockViewerProps> = ({ isOpen, onClose }) => {
    const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
    const [isLive, setIsLive] = useState(false);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isOpen) {
            const fetchTelemetry = async () => {
                try {
                    const response = await fetch('/airlock_telemetry.json?t=' + Date.now());
                    if (response.ok) {
                        const data = await response.json();
                        setTelemetry(data);
                        setIsLive(true);
                    } else {
                        setIsLive(false);
                    }
                } catch (e) {
                    setIsLive(false);
                }
            };
            
            fetchTelemetry();
            interval = setInterval(fetchTelemetry, 2000);
        }
        
        return () => clearInterval(interval);
    }, [isOpen]);

    if (!isOpen) return null;

    const progress = telemetry ? (telemetry.done_jobs / Math.max(1, telemetry.total_jobs)) * 100 : 0;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    className="fixed bottom-6 right-6 w-96 bg-[#111] border border-[#66FCF1]/30 rounded-2xl shadow-2xl shadow-[#66FCF1]/10 overflow-hidden z-[100] backdrop-blur-xl"
                >
                    <div className="bg-gradient-to-r from-[#1F2833] to-[#0b0c10] px-5 py-4 border-b border-[#66FCF1]/20 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Cpu className={`w-5 h-5 ${isLive ? 'text-[#66FCF1] animate-pulse' : 'text-gray-500'}`} />
                            <h3 className="text-white font-mono tracking-wider font-semibold">AIRLOCK TELEMETRY</h3>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-5 space-y-6">
                        {telemetry ? (
                            <>
                                {/* Progress Bar */}
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-mono text-gray-400">
                                        <span>VISION PROCESSING</span>
                                        <span className="text-[#66FCF1]">{progress.toFixed(1)}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                                        <motion.div 
                                            className="h-full bg-gradient-to-r from-[#45A29E] to-[#66FCF1]"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${progress}%` }}
                                            transition={{ duration: 0.5 }}
                                        />
                                    </div>
                                </div>

                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Activity className="w-4 h-4 text-[#45A29E]" />
                                            <span className="text-xs font-mono text-gray-400">PENDING</span>
                                        </div>
                                        <div className="text-2xl font-light text-white">{telemetry.pending_jobs.toLocaleString()}</div>
                                    </div>
                                    <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                                        <div className="flex items-center gap-2 mb-1">
                                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                                            <span className="text-xs font-mono text-gray-400">COMPLETED</span>
                                        </div>
                                        <div className="text-2xl font-light text-white">{telemetry.done_jobs.toLocaleString()}</div>
                                    </div>
                                </div>

                                {/* Current File & Errors */}
                                <div className="space-y-3">
                                    <div className="bg-white/5 rounded-lg p-3 border border-[#66FCF1]/10">
                                        <span className="text-[10px] font-mono text-[#45A29E] uppercase block mb-1">Current Artifact</span>
                                        <span className="text-sm text-gray-200 truncate block font-mono">
                                            {telemetry.current_file || 'AWAITING DISPATCH...'}
                                        </span>
                                    </div>
                                    
                                    {telemetry.error_jobs > 0 && (
                                        <div className="flex items-center gap-2 text-rose-400 bg-rose-400/10 px-3 py-2 rounded-lg border border-rose-400/20">
                                            <AlertTriangle className="w-4 h-4" />
                                            <span className="text-xs font-mono font-bold">{telemetry.error_jobs} ERRORS DETECTED</span>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                                <div className="w-8 h-8 border-2 border-[#66FCF1]/30 border-t-[#66FCF1] rounded-full animate-spin" />
                                <span className="text-sm font-mono text-gray-400">Waiting for Vision Worker...</span>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
