import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarDays, X } from 'lucide-react';
import type { Media } from '../../types';

export const QuickDateEditor = ({ assets, userId, targetCollection, onClose, updateAsset, setMedia }: { assets: Media[], userId: string, targetCollection?: string, onClose: () => void, updateAsset?: any, setMedia?: any }) => {
    const queryClient = useQueryClient();
    const asset = assets[0]; // Reference for initial values
    const getSafeDate = (val: any): Date => {
        if (!val) return new Date();
        if (val instanceof Date) return val;
        if (typeof val.toDate === 'function') return val.toDate();
        if (typeof val === 'string') {
             const d = new Date(val);
             return isNaN(d.getTime()) ? new Date() : d;
        }
        return new Date();
    };

    const getInputValue = (date: Date, precision: string): string => {
        const pad = (num: number) => num.toString().padStart(2, '0');
        const year = date.getFullYear().toString().padStart(4, '0');
        const month = pad(date.getMonth() + 1);
        const day = pad(date.getDate());
        const hours = pad(date.getHours());
        const minutes = pad(date.getMinutes());
        
        if (['year', 'circa', 'decade'].includes(precision)) return year;
        if (precision === 'month') return `${year}-${month}`;
        if (precision === 'day') return `${year}-${month}-${day}`;
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    const [datePrecision, setDatePrecision] = React.useState<'exact' | 'day' | 'month' | 'year' | 'unknown' | 'circa' | 'decade'>(asset.datePrecision || 'exact');
    const [dateInput, setDateInput] = React.useState(getInputValue(getSafeDate(asset.logicalDate), asset.datePrecision || 'exact'));
    const [isSaving, setIsSaving] = React.useState(false);

    const getFullIsoStr = (input: string, precision: string) => {
        if (!input) return new Date().toISOString();
        if (['year', 'circa', 'decade'].includes(precision)) {
            return `${String(input).padStart(4, '0')}-01-01T00:00:00.000Z`;
        } else if (precision === 'month') {
            const parts = input.split('-');
            return `${(parts[0]||'0000').padStart(4, '0')}-${parts[1]||'01'}-01T00:00:00.000Z`;
        } else if (precision === 'day') {
            const parts = input.split('-');
            return `${(parts[0]||'0000').padStart(4, '0')}-${parts[1]||'01'}-${parts[2]||'01'}T00:00:00.000Z`;
        } else {
            // datetime-local
            const parts = input.split('T');
            const dateParts = (parts[0]||'').split('-');
            return `${(dateParts[0]||'0000').padStart(4, '0')}-${dateParts[1]||'01'}-${dateParts[2]||'01'}T${parts[1]||'00:00'}:00.000Z`;
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const finalDate = new Date(getFullIsoStr(dateInput, datePrecision));
            let finalLogicalDate = asset.logicalDate;
            let finalYear = asset.year;
            
            if (!isNaN(finalDate.getTime())) {
                finalLogicalDate = finalDate.toISOString();
                finalYear = finalDate.getFullYear();
            }

            const updatedAssets = assets.map(a => ({ 
                ...a, 
                logicalDate: datePrecision === 'unknown' ? a.logicalDate : finalLogicalDate, 
                year: datePrecision === 'unknown' ? a.year : finalYear,
                datePrecision 
            } as Media));

            if (updateAsset) {
                updatedAssets.forEach(a => updateAsset(a));
            } else if (setMedia) {
                setMedia((prev: Media[]) => {
                    const updatedIds = new Set(updatedAssets.map(a => a.id));
                    return prev.map(m => {
                        const newM = updatedAssets.find(a => a.id === m.id);
                        return newM ? newM : m;
                    });
                });
            }

            const { appDataService } = await import('../../services/serviceManager');
            if (userId) {
                await Promise.all(updatedAssets.map(a => appDataService.saveMedia(userId, a, targetCollection || 'media')));
                queryClient.invalidateQueries({ queryKey: ['matrix', 'media', userId, targetCollection || 'media'] });
            }
            onClose();
        } catch(err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div 
            className="fixed inset-0 z-[999] bg-black/80 flex items-center justify-center p-4 backdrop-blur-md" 
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                        <CalendarDays size={16} className="text-cyan-400" /> Temporal Shift
                    </h3>
                    <button onClick={onClose} title="Cancel and close temporal editor" className="text-slate-500 hover:text-white transition-colors">
                        <X size={16} />
                    </button>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Precision Level</label>
                        <select 
                            id="temporal-precision-level"
                            name="temporalPrecisionLevel"
                            value={datePrecision} 
                            onChange={(e) => {
                                const newPrecision = e.target.value as any;
                                setDatePrecision(newPrecision);
                                const d = new Date(getFullIsoStr(dateInput, datePrecision));
                                if (!isNaN(d.getTime())) {
                                    setDateInput(getInputValue(d, newPrecision));
                                }
                            }}
                            title="Select the precision level of the date (e.g., if you only know the year)"
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-cyan-500 outline-none uppercase tracking-wider text-[10px] font-bold"
                        >
                            <option value="exact">Exact Time</option>
                            <option value="day">Date Only</option>
                            <option value="month">Month & Year</option>
                            <option value="year">Year Only</option>
                            <option value="circa">Circa (Approx Year)</option>
                            <option value="decade">Decade / Epoch</option>
                            <option value="unknown">Unknown (Shoebox)</option>
                        </select>
                    </div>

                    {datePrecision !== 'unknown' && (
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Temporal Coordinate</label>
                            <input 
                                id="temporal-coordinate-input"
                                name="temporalCoordinateInput"
                                type={['year', 'circa', 'decade'].includes(datePrecision) ? 'number' : datePrecision === 'month' ? 'month' : datePrecision === 'day' ? 'date' : 'datetime-local'}
                                value={dateInput}
                                onChange={e => setDateInput(e.target.value)}
                                title="Enter the fuzzy or exact temporal coordinate"
                                className="w-full bg-[#1a1d26] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-cyan-500 outline-none font-mono shadow-inner uppercase tracking-wider [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]"
                            />
                        </div>
                    )}
                    
                    <button 
                        type="button"
                        onClick={handleSave} 
                        disabled={isSaving}
                        title="Commit the updated temporal coordinates to the Sovereign Matrix database"
                        className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] disabled:opacity-50 mt-4"
                    >
                        {isSaving ? 'Syncing...' : `Lock Coordinates for ${assets.length} Item${assets.length !== 1 ? 's' : ''}`}
                    </button>
                </div>
            </div>
        </div>
    );
};
