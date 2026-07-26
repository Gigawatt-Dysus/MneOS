import React, { useState } from 'react';

interface TimeCircuitsProps {
    onSearch: (query: string, isExact: boolean) => void;
}

const TimeCircuits: React.FC<TimeCircuitsProps> = ({ onSearch }) => {
    const [query, setQuery] = useState('');
    const [isExact, setIsExact] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);

    const handleEngage = (e: React.FormEvent) => {
        e.preventDefault();
        onSearch(query, isExact);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            onSearch(query, isExact);
        }
    }

    const toggleExact = () => {
        const newState = !isExact;
        setIsExact(newState);
        if (query) {
            onSearch(query, newState);
        }
    };

    return (
        <div className="max-w-4xl mx-auto bg-[#0c191f]/95 backdrop-blur-md rounded-md shadow-[0_0_20px_rgba(0,231,255,0.15)] text-center font-mono border border-[#00e7ff]/30 overflow-visible relative z-30">
            <div className="bg-[#081115] border-b border-[#00e7ff]/20 py-1 px-4 flex justify-between items-center">
                <span className="text-[10px] text-[#00e7ff] font-bold tracking-[0.3em] animate-pulse">CHRONO-NAVIGATION SYSTEM</span>
                <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#00e7ff] animate-pulse"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-[#00e7ff]/50"></div>
                </div>
            </div>

            <form onSubmit={handleEngage} className="p-3 flex flex-col md:flex-row items-center gap-3 relative">
                
                <div className="flex gap-2 flex-shrink-0">
                    <div className="flex flex-col">
                        <span className="text-[8px] text-[#00e7ff]/70 tracking-widest mb-0.5">MONTH</span>
                        <div className="bg-[#16242a] border border-[#00e7ff]/20 text-white w-12 py-1 rounded-sm text-sm font-bold shadow-[inset_0_0_5px_rgba(0,0,0,0.5)]">--</div>
                    </div>
                     <div className="flex flex-col">
                        <span className="text-[8px] text-[#00e7ff]/70 tracking-widest mb-0.5">DAY</span>
                        <div className="bg-[#16242a] border border-[#00e7ff]/20 text-white w-12 py-1 rounded-sm text-sm font-bold shadow-[inset_0_0_5px_rgba(0,0,0,0.5)]">--</div>
                    </div>
                     <div className="flex flex-col">
                        <span className="text-[8px] text-[#00e7ff]/70 tracking-widest mb-0.5">YEAR</span>
                        <div className="bg-[#16242a] border border-[#00e7ff]/20 text-white w-16 py-1 rounded-sm text-sm font-bold shadow-[inset_0_0_5px_rgba(0,0,0,0.5)]">----</div>
                    </div>
                </div>

                <div 
                    className="flex-grow w-full md:w-auto relative group"
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                >
                    <div className="absolute inset-0 border border-[#00e7ff]/30 rounded-sm pointer-events-none shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]"></div>
                    <input 
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="TEMPORAL COORDS OR KEYWORD"
                        className="w-full bg-[#081115] text-[#00e7ff] text-base py-2 px-4 tracking-[0.1em] text-center focus:outline-none placeholder-[#00e7ff]/40 uppercase font-bold placeholder:animate-pulse rounded-sm"
                        style={{ textShadow: '0 0 5px rgba(0, 231, 255, 0.4)' }}
                    />
                    
                    {showTooltip && (
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-black/90 text-[#00e7ff] text-[10px] p-2 border border-[#00e7ff]/50 rounded shadow-[0_0_10px_rgba(0,231,255,0.2)] z-50 pointer-events-none text-left leading-relaxed backdrop-blur-sm">
                            Performs a search for your keyword or words similar in spelling. Click the [EXACT] button to search specifically for your search string or use Boolean operators to perform Boolean searches.
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-[#00e7ff]/50"></div>
                        </div>
                    )}
                </div>
                
                <button
                    type="button"
                    onClick={toggleExact}
                    className={`flex-shrink-0 px-3 py-2 border text-[10px] font-bold tracking-wider uppercase transition-all duration-300 rounded-sm flex items-center gap-1 ${
                        isExact 
                        ? 'bg-[#00e7ff] text-[#0c191f] border-[#00e7ff] shadow-[0_0_10px_rgba(0,231,255,0.4)]' 
                        : 'bg-transparent text-[#00e7ff]/50 border-[#00e7ff]/30 hover:text-[#00e7ff] hover:border-[#00e7ff]'
                    }`}
                    title="Toggle Exact Match"
                >
                    <div className={`w-2 h-2 rounded-full ${isExact ? 'bg-[#0c191f]' : 'bg-[#00e7ff]/50'}`}></div>
                    EXACT
                </button>

                <button 
                    type="submit"
                    className="flex-shrink-0 relative px-6 py-2 bg-[#00e7ff]/10 border border-[#00e7ff] text-[#00e7ff] text-xs font-black tracking-[0.2em] uppercase hover:bg-[#00e7ff] hover:text-[#0c191f] transition-all duration-300 shadow-[0_0_10px_rgba(0,231,255,0.2)] group overflow-hidden rounded-sm w-full md:w-auto"
                >
                    <span className="relative z-10">ENGAGE</span>
                    <div className="absolute inset-0 bg-[#00e7ff] transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300 ease-out -z-0"></div>
                </button>
            </form>
        </div>
    );
};

export default TimeCircuits;