import React, { useState } from 'react';
import { Plus, X, ChevronDown } from 'lucide-react';

// --- Constants ---
export const RELATIONSHIP_PRIORITY: Record<string, number> = {
    'spouse': 10, 'partner': 10, 'husband': 10, 'wife': 10, 'ex-wife': 15, 'ex-husband': 15,
    'child': 20, 'son': 20, 'daughter': 20, 'step-child': 22,
    'parent': 25, 'mother': 25, 'father': 25, 'mom': 25, 'dad': 25, 'step-father': 27, 'step-mother': 27,
    'sibling': 30, 'brother': 30, 'sister': 30, 'half-brother': 32, 'half-sister': 32,
    'grandparent': 40, 'grandmother': 40, 'grandfather': 40,
    'great-grandparent': 41, 'great-grandmother': 41, 'great-grandfather': 41,
    'grandchild': 45, 'grandson': 45, 'granddaughter': 45,
    'great-grandchild': 46,
    'aunt': 50, 'uncle': 50, 'great-aunt': 51, 'great-uncle': 51,
    'niece': 55, 'nephew': 55,
    'cousin': 60,
    'relative': 65, 'in-law': 65,
    'friend': 70, 'best friend': 70, 'childhood friend': 72,
    'colleague': 80, 'manager': 82, 
    'owner': 100, 'resident': 100, 'creator': 100
};

export const COMMON_MAJORS = ["Computer Science", "Psychology", "Business", "Engineering", "Nursing", "Biology", "Communications", "Art", "English", "History", "Political Science", "Economics"];
export const COMMON_DEGREES = ["High School Diploma", "Associate's (AA/AS)", "Bachelor's (BA/BS)", "Master's (MA/MS/MBA)", "Doctorate (PhD/MD/JD)", "Certificate"];

export const getRelationshipSortKey = (type: string): number => {
    const normalized = type.toLowerCase().trim();
    return RELATIONSHIP_PRIORITY[normalized] || 999;
};

// --- Shared Components ---

interface ArrayInputProps {
    label: string;
    placeholder: string;
    icon: any;
    formatter?: (val: string) => string;
    items: string[];
    onAdd: (val: string) => void;
    onRemove: (index: number) => void;
}

export const ArrayInput: React.FC<ArrayInputProps> = ({ label, items, placeholder, icon: Icon, formatter, onAdd, onRemove }) => {
    const [tempVal, setTempVal] = useState('');

    const handleAdd = () => {
        if (!tempVal.trim()) return;
        const val = formatter ? formatter(tempVal) : tempVal;
        onAdd(val);
        setTempVal('');
    };

    return (
        <div className="mb-4">
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">{label}</label>
            <div className="flex gap-2 mb-2">
                <div className="relative flex-1">
                    <Icon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input 
                        type="text" 
                        value={tempVal} 
                        onChange={e => setTempVal(e.target.value)} 
                        onBlur={() => { if(formatter && tempVal) setTempVal(formatter(tempVal)); }} 
                        onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
                        placeholder={placeholder} 
                        className="w-full bg-slate-800 border border-slate-700 rounded pl-10 pr-3 py-2 text-white text-sm placeholder-slate-600 focus:border-violet-500 outline-none transition-colors" 
                    />
                </div>
                <button onClick={handleAdd} className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded transition-colors"><Plus size={16}/></button>
            </div>
            <div className="flex flex-wrap gap-2">
                {items.map((item, i) => (
                    <span key={i} className="bg-slate-800 border border-slate-700 text-slate-300 text-xs px-2 py-1 rounded flex items-center gap-1">
                        {item} 
                        <button onClick={() => onRemove(i)} className="hover:text-red-400 transition-colors"><X size={12}/></button>
                    </span>
                ))}
            </div>
        </div>
    );
};

interface GenderSelectProps {
    value: string;
    onChange: (val: string) => void;
}

export const GenderSelect: React.FC<GenderSelectProps> = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const options = ["Female", "Male", "Non-binary", "Prefer not to say"];
    
    return (
        <div className="relative">
             <input 
                type="text" 
                value={value || ''} 
                onChange={e => onChange(e.target.value)} 
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm placeholder-slate-600 pr-8 focus:border-violet-500 outline-none transition-colors"
                placeholder="Select or Type..."
                onFocus={() => setIsOpen(true)}
                onBlur={() => setTimeout(() => setIsOpen(false), 200)} 
             />
             <button onClick={() => setIsOpen(!isOpen)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                  <ChevronDown size={14} />
             </button>
             {isOpen && (
                 <div className="absolute top-full left-0 w-full bg-slate-800 border border-slate-700 rounded mt-1 z-50 shadow-xl max-h-40 overflow-y-auto">
                     {options.map(opt => (
                         <div 
                            key={opt} 
                            className="px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white cursor-pointer transition-colors"
                            onClick={() => { onChange(opt); setIsOpen(false); }}
                         >
                            {opt}
                         </div>
                     ))}
                 </div>
             )}
        </div>
    );
};

// Helper: Get Safe Date String
export const getSafeDate = (val: any): string => {
    if (!val) return '';
    try {
        if (typeof val === 'object' && 'seconds' in val) return new Date(val.seconds * 1000).toISOString().split('T')[0];
        if (val instanceof Date) return val.toISOString().split('T')[0];
        if (typeof val === 'string') return val.split('T')[0];
    } catch (e) { return ''; }
    return '';
};