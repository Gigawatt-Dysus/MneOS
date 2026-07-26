import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AzNavigatorProps {
    availableLetters: string[];
    scrollContainerRef: React.RefObject<HTMLDivElement | null>;
    onJump?: (letter: string) => void;
}

export const AzNavigator: React.FC<AzNavigatorProps> = ({ availableLetters, scrollContainerRef, onJump }) => {
    const [activeLetter, setActiveLetter] = useState<string>('');
    const [hoveredLetter, setHoveredLetter] = useState<string | null>(null);
    const [tooltipPos, setTooltipPos] = useState<number>(0);

    // Scroll Spy: Use IntersectionObserver to track visible letters
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container || availableLetters.length === 0) return;

        const observer = new IntersectionObserver(
            (entries) => {
                // Find the first intersecting element that is near the top of the container
                const visible = entries.find(e => e.isIntersecting);
                if (visible) {
                    const letter = visible.target.id.replace('az-anchor-', '');
                    setActiveLetter(letter);
                }
            },
            {
                root: container,
                rootMargin: '-10% 0px -80% 0px', // Focus detection near the top of the viewport
                threshold: 0
            }
        );

        availableLetters.forEach(letter => {
            const el = document.getElementById(`az-anchor-${letter}`);
            if (el) observer.observe(el);
        });

        return () => observer.disconnect();
    }, [availableLetters, scrollContainerRef]);

    const handleJump = (letter: string) => {
        if (onJump) {
            onJump(letter);
        }

        // Defer scroll slightly to give virtualized/lazy DOM a chance to render the anchor
        setTimeout(() => {
            const el = document.getElementById(`az-anchor-${letter}`);
            if (el) {
                // Find the container to scroll
                const container = scrollContainerRef.current;
                if (container) {
                    const containerRect = container.getBoundingClientRect();
                    const elRect = el.getBoundingClientRect();
                    const scrollPos = elRect.top - containerRect.top + container.scrollTop - 20; // 20px padding
                    
                    container.scrollTo({
                        top: scrollPos,
                        behavior: 'smooth'
                    });
                }
            }
        }, 50);
    };

    if (availableLetters.length === 0) return null;

    return (
        <div className="fixed right-4 top-1/2 -translate-y-1/2 z-[100] flex items-center group/nav">
            {/* Holographic Tooltip (Balloon) */}
            <AnimatePresence>
                {hoveredLetter && (
                    <motion.div 
                        initial={{ opacity: 0, x: 20, scale: 0.8 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 20, scale: 0.8 }}
                        className="absolute right-14 bg-black/80 backdrop-blur-xl border border-cyan-500/30 rounded-2xl w-24 h-24 flex items-center justify-center shadow-[0_0_40px_rgba(6,182,212,0.3)] pointer-events-none"
                        style={{ top: tooltipPos - 48 }}
                    >
                        <span className="text-5xl font-black text-cyan-400 font-mono tracking-tighter">
                            {hoveredLetter}
                        </span>
                        {/* Connecting Triangle */}
                        <div className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-3 h-3 bg-black border-r border-t border-cyan-500/30 rotate-45" />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Data Spine */}
            <div className="flex flex-col items-center py-4 bg-black/40 backdrop-blur-md rounded-full border border-white/10 shadow-2xl relative">
                {/* Vertical Laser Line */}
                <div className="absolute inset-x-0 top-0 bottom-0 flex justify-center pointer-events-none">
                    <div className="w-[1px] h-full bg-gradient-to-b from-transparent via-cyan-500/20 to-transparent" />
                </div>
                
                <div className="flex flex-col max-h-[80vh] overflow-y-auto no-scrollbar py-2">
                    {availableLetters.map((letter) => (
                        <button
                            key={letter}
                            onMouseEnter={(e) => {
                                setHoveredLetter(letter);
                                const rect = e.currentTarget.getBoundingClientRect();
                                const parentRect = e.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
                                if (parentRect) setTooltipPos(rect.top - parentRect.top + 12);
                            }}
                            onMouseLeave={() => setHoveredLetter(null)}
                            onClick={() => handleJump(letter)}
                            className={`relative w-10 h-6 flex items-center justify-center transition-all duration-300 group/item ${activeLetter === letter ? 'text-cyan-400' : 'text-slate-500 hover:text-white'}`}
                        >
                            <span className={`text-[11px] font-mono uppercase transition-all ${activeLetter === letter ? 'scale-150 font-black' : 'group-hover/item:scale-110'}`}>
                                {letter}
                            </span>
                            
                            {activeLetter === letter && (
                                <motion.div 
                                    layoutId="active-reticle"
                                    className="absolute inset-0 border-y border-cyan-500/50 bg-cyan-500/5 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
