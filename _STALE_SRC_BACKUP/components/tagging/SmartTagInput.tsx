import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, 
  User, 
  MapPin, 
  Hash, 
  AlertCircle, 
  Cat, 
  Box, 
  Calendar, 
  X
} from 'lucide-react';
import type { Tag } from '@/types'; 

interface SmartTagInputProps {
  availableTags: Tag[];
  onSelectTag: (tag: Tag) => void;
  onCreateTag: (name: string, type: Tag['type']) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

// --- UTILITY: Levenshtein Distance for Fuzzy Matching ---
const getLevenshteinDistance = (a: string, b: string): number => {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return matrix[a.length][b.length];
};

const FUZZY_THRESHOLD = 3; 

export const SmartTagInput: React.FC<SmartTagInputProps> = ({
  availableTags,
  onSelectTag,
  onCreateTag,
  placeholder = "Tag people, places, or add context...",
  autoFocus = false
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [creationMode, setCreationMode] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // --- FILTERING & SEARCH LOGIC (IMPROVED: Token-Based) ---
  const filteredTags = useMemo(() => {
    if (!inputValue.trim()) return [];
    
    const lowerInput = inputValue.toLowerCase();
    // Split input by spaces to handle partials like "liz c" -> "liz" + "c"
    const searchTerms = lowerInput.split(/\s+/).filter(Boolean);
    
    // Check if ALL terms match the tag name
    const matches = availableTags.filter(tag => {
      const lowerTag = tag.name.toLowerCase();
      return searchTerms.every(term => lowerTag.includes(term));
    });

    // Sort: Entities First (Person > Pet > Place > Event), then Context.
    return matches.sort((a, b) => {
      const typeScore = (type: string) => {
        if (type === 'person') return 5;
        if (type === 'pet') return 4;
        if (type === 'place') return 3;
        if (type === 'event') return 2;
        if (type === 'thing') return 1.5;
        return 1; // Context
      };
      return typeScore(b.type) - typeScore(a.type);
    });
  }, [availableTags, inputValue]);

  // --- FUZZY DETECTION ---
  const similarExistingTags = useMemo(() => {
    if (!creationMode || !inputValue.trim()) return [];
    
    return availableTags.filter(tag => {
      const dist = getLevenshteinDistance(tag.name.toLowerCase(), inputValue.toLowerCase());
      // Return true if distance is small AND it's not an exact match 
      return dist <= FUZZY_THRESHOLD && dist > 0 && tag.name.toLowerCase() !== inputValue.toLowerCase();
    }).slice(0, 3);
  }, [availableTags, inputValue, creationMode]);

  // --- HANDLERS ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setIsOpen(true);
    setCreationMode(false); 
    setActiveIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < filteredTags.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      
      if (creationMode) return; 

      if (filteredTags.length > 0 && isOpen) {
        onSelectTag(filteredTags[activeIndex]);
        reset();
      } 
      else if (inputValue.trim()) {
        const exactMatch = availableTags.find(t => t.name.toLowerCase() === inputValue.trim().toLowerCase());
        if (exactMatch) {
            onSelectTag(exactMatch);
            reset();
        } else {
            setCreationMode(true);
            setIsOpen(false); 
        }
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setCreationMode(false);
    }
  };

  const reset = () => {
    setInputValue('');
    setIsOpen(false);
    setCreationMode(false);
    setActiveIndex(0);
    inputRef.current?.focus();
  };

  const executeCreate = (type: Tag['type']) => {
    onCreateTag(inputValue.trim(), type);
    reset();
  };

  // --- RENDER HELPERS ---
  const getIconForType = (type: Tag['type']) => {
    switch (type) {
      case 'person': return <User size={14} className="text-violet-400" />;
      case 'pet': return <Cat size={14} className="text-amber-400" />;
      case 'place': return <MapPin size={14} className="text-emerald-400" />;
      case 'thing': return <Box size={14} className="text-blue-400" />;
      case 'event': return <Calendar size={14} className="text-rose-400" />;
      case 'context': return <Hash size={14} className="text-slate-400" />;
      default: return <Hash size={14} />;
    }
  };

  // --- OUTSIDE CLICK HANDLER ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) && 
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (!creationMode) setCreationMode(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [creationMode]);

  return (
    <div className="relative w-full z-50">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" size={16} />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          className="w-full bg-[#0a0c10] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-all"
          placeholder={placeholder}
          autoFocus={autoFocus}
        />
        {inputValue && (
             <button onClick={() => { setInputValue(''); setCreationMode(false); setIsOpen(true); inputRef.current?.focus(); }} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-white">
                <X size={14} />
             </button>
        )}
      </div>

      {/* --- SUGGESTIONS DROPDOWN --- */}
      {isOpen && filteredTags.length > 0 && (
        <div ref={dropdownRef} className="absolute w-full mt-1 bg-[#1a1d26] border border-white/10 rounded-xl shadow-2xl max-h-60 overflow-y-auto custom-scrollbar z-[100]">
          <div className="px-3 py-1.5 text-[10px] text-slate-500 uppercase font-bold tracking-wider bg-[#1a1d26] sticky top-0 border-b border-white/5">
            Existing Matches
          </div>
          {filteredTags.map((tag, index) => (
            <div
              key={tag.id}
              onClick={() => { onSelectTag(tag); reset(); }}
              className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                index === activeIndex ? 'bg-cyan-900/30 text-cyan-100' : 'text-slate-300 hover:bg-white/5'
              } border-b border-white/5 last:border-0`}
            >
              {getIconForType(tag.type)}
              <span className="flex-1 truncate text-sm">{tag.name}</span>
              <span className="text-[10px] uppercase text-slate-600 ml-auto bg-black/20 px-1.5 py-0.5 rounded border border-white/10">
                {tag.type}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* --- CREATION MODE ("THE GUARDRAIL" POPUP) --- */}
      {creationMode && (
        <div ref={dropdownRef} className="absolute w-full mt-1 bg-[#1a1d26] border border-cyan-500/50 rounded-xl shadow-2xl overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2">
          <div className="p-3 border-b border-white/10 bg-cyan-900/10">
            <div className="flex items-center gap-2 text-cyan-400 mb-1">
              <AlertCircle size={16} />
              <span className="font-bold text-sm">New Tag Detected</span>
            </div>
            <p className="text-xs text-slate-400">
              "{inputValue}" is a new concept. **Please classify it before creating.**
            </p>
          </div>

          {/* FUZZY MATCH WARNING (The "Lizzie C" fix) */}
          {similarExistingTags.length > 0 && (
            <div className="p-3 bg-red-900/20 border-b border-red-500/20">
              <p className="text-xs text-red-500 font-semibold mb-2">FUZZY MATCH WARNING: Did you mean one of these existing tags?</p>
              <div className="space-y-1">
                {similarExistingTags.map(tag => (
                   <button 
                     key={tag.id}
                     onClick={() => { onSelectTag(tag); reset(); }}
                     className="w-full text-left flex items-center gap-2 text-xs text-slate-300 hover:text-white hover:bg-white/5 p-1 rounded"
                   >
                     {getIconForType(tag.type)}
                     <span className="flex-1 truncate">{tag.name}</span>
                     <span className="text-[10px] uppercase text-slate-600 ml-auto bg-black/20 px-1.5 py-0.5 rounded border border-white/10">{tag.type}</span>
                   </button>
                ))}
              </div>
            </div>
          )}

          <div className="p-3">
            <div className="text-[10px] text-slate-500 px-1 py-1 mb-2 font-bold uppercase tracking-wider">CREATE AS ENTITY:</div>
            
            {/* GRID FOR ENTITIES ONLY */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button onClick={() => executeCreate('person')} className="flex items-center gap-2 p-2 bg-white/5 hover:bg-violet-500/20 border border-white/10 rounded-lg transition-colors group text-left">
                  {getIconForType('person')}
                  <span className="text-[11px] text-slate-300 group-hover:text-violet-200">Person</span>
              </button>
              <button onClick={() => executeCreate('pet')} className="flex items-center gap-2 p-2 bg-white/5 hover:bg-amber-500/20 border border-white/10 rounded-lg transition-colors group text-left">
                  {getIconForType('pet')}
                  <span className="text-[11px] text-slate-300 group-hover:text-amber-200">Pet</span>
              </button>
              <button onClick={() => executeCreate('place')} className="flex items-center gap-2 p-2 bg-white/5 hover:bg-emerald-500/20 border border-white/10 rounded-lg transition-colors group text-left">
                  {getIconForType('place')}
                  <span className="text-[11px] text-slate-300 group-hover:text-emerald-200">Place</span>
              </button>
              <button onClick={() => executeCreate('thing')} className="flex items-center gap-2 p-2 bg-white/5 hover:bg-blue-500/20 border border-white/10 rounded-lg transition-colors group text-left">
                  {getIconForType('thing')}
                  <span className="text-[11px] text-slate-300 group-hover:text-blue-200">Thing</span>
              </button>
              <button onClick={() => executeCreate('event')} className="flex items-center gap-2 p-2 bg-white/5 hover:bg-rose-500/20 border border-white/10 rounded-lg transition-colors group text-left col-span-2">
                  {getIconForType('event')}
                  <span className="text-[11px] text-slate-300 group-hover:text-rose-200">Event</span>
              </button>
            </div>

            {/* SEPARATE CONTEXT BUTTON (Step 3 Fix) */}
            <div className="pt-2 border-t border-white/10">
               <button 
                onClick={() => executeCreate('context')} 
                className="w-full flex items-center justify-center gap-2 p-2 bg-white/5 hover:bg-slate-500/20 border border-white/10 rounded-lg transition-colors group"
               >
                  {getIconForType('context')}
                  <span className="text-[11px] text-slate-400 group-hover:text-white">Just a Keyword / Context</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};