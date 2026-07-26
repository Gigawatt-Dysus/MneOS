import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Tag, User } from '../../../types';
import { UniversalMedia, StudioTab, PolishTab, ViewMode } from './types';
import { AddressData } from '../../AddressAutocomplete';
import { formatDateForInput, extractDateFromFilename } from '../../../utils/dateSanitizer';

export const useStudioState = (asset: UniversalMedia, tags: Tag[]) => {
    const [isDirty, setIsDirty] = useState(false);
    const [datePrecision, setDatePrecision] = useState<'exact'|'day'|'month'|'year'|'unknown'>(asset.datePrecision || 'exact');
    const [dateStr, setDateStr] = useState('');
    const [tagIds, setTagIds] = useState<string[]>(asset.tagIds || []);
    const [tagSearch, setTagSearch] = useState('');
    const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
    const [sparkleString, setSparkleString] = useState("");
    const [isPurist, setIsPurist] = useState(asset.isPurist || false);
    const [status, setStatus] = useState<string>('');
    const [migrationStatus, setMigrationStatus] = useState<string>('');
    
    // UI State
    const [activeTab, setActiveTab] = useState<StudioTab>(
        ((asset as any).type === 'event' || (asset as any).type === 'messenger_log' || (asset as any).type === 'journal') ? 'meta' : 'polish'
    );
    const [polishTab, setPolishTab] = useState<PolishTab>('light');
    const [viewMode, setViewMode] = useState<ViewMode>('polished');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isCropping, setIsCropping] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [displayUrl, setDisplayUrl] = useState(asset.url || asset.preview || "");
    const [sliderPos, setSliderPos] = useState(50);
    const [isDragging, setIsDragging] = useState(false);
    
    // Darkroom State
    const [preset, setPreset] = useState<string>(asset.preset || 'original');
    const [layers, setLayers] = useState<string[]>(asset.polishLayers || []);
    const [adjustments, setAdjustments] = useState<Record<string, number>>(asset.adjustmentStack || {});
    const [editHistory, setEditHistory] = useState<any[]>(asset.editHistory || []);
    const [aiDirective, setAiDirective] = useState("");
    
    // Address State
    const [addressData, setAddressData] = useState<AddressData>(() => {
        if (asset.location && typeof asset.location === 'object' && 'streetAddress' in asset.location) {
            return asset.location as AddressData;
        }
        return {
            streetAddress: (asset.location as any)?.address || '',
            addressLocality: '',
            addressRegion: '',
            postalCode: '',
            coordinates: { 
                lat: parseFloat((asset.location as any)?.lat?.toString() || '0'), 
                lng: parseFloat((asset.location as any)?.lng?.toString() || '0') 
            }
        };
    });

    // Neural Scan State
    const [isNeuralScanning, setIsNeuralScanning] = useState(false);
    const [discoveredEntities, setDiscoveredEntities] = useState<string[]>([]);
    const [narrative, setNarrative] = useState<string>(asset.narrative || asset.description || '');

    // Master Values Ref (Single Source of Truth for Handlers)
    const valuesRef = useRef({ 
        id: asset.id,
        title: asset.title || '', 
        caption: asset.caption || '', 
        description: asset.description || '', 
        narrative: asset.narrative || '',
        privateDetails: asset.privateDetails || '',
        datePrecision, dateStr, tagIds,
        url: asset.url || asset.preview || "",
        location: addressData,
        isInboxDismissed: asset.isInboxDismissed,
        isPurist: asset.isPurist || false,
        polishLayers: layers,
        mediaIds: asset.mediaIds || [],
        isFiction: asset.isFiction || false,
        skipAI: asset.skipAI || false
    });

    // Date & Asset Transition Logic
    useEffect(() => {
        if (valuesRef.current.id !== asset.id) {
            const p = asset.datePrecision || 'exact';
            setDatePrecision(p);
            setTagIds(asset.tagIds || []);
            setLayers(asset.polishLayers || []);
            setPreset(asset.preset || 'original');
            setAdjustments(asset.adjustmentStack || {});
            setEditHistory(asset.editHistory || []);
            setNarrative(asset.narrative || asset.description || '');
            valuesRef.current.id = asset.id;
 
            let lDate = asset.logicalDate;
            if (!lDate) {
                const sources = [asset.originalName, asset.title, asset.caption, asset.description];
                for (const source of sources) {
                    if (source) {
                        const recovered = extractDateFromFilename(source);
                        if (recovered) { lDate = new Date(recovered); break; }
                    }
                }
            }
            
            const resolveDate = (val: any): Date => {
                if (!val) return new Date();
                if (val instanceof Date) return val;
                if (typeof val.toDate === 'function') return val.toDate();
                if (val.seconds !== undefined) return new Date(val.seconds * 1000);
                const parsed = new Date(val);
                return isNaN(parsed.getTime()) ? new Date() : parsed;
            };
 
            const d = resolveDate(lDate);
            if (!isNaN(d.getTime())) {
                const formatted = (p === 'year') ? String(d.getFullYear()).padStart(4, '0') :
                                  (p === 'month') ? `${String(d.getFullYear()).padStart(4, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}` :
                                  (p === 'day') ? `${String(d.getFullYear()).padStart(4, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` :
                                  formatDateForInput(d);
                setDateStr(formatted);
                valuesRef.current.dateStr = formatted;
            }
        }
    }, [asset.id, asset]);

    // [ZEN] Live synchronization of parent asset updates to valuesRef (prevents stale state resets)
    useEffect(() => {
        if (!isDirty || valuesRef.current.id !== asset.id) {
            valuesRef.current.id = asset.id;
            valuesRef.current.title = asset.title || '';
            valuesRef.current.caption = asset.caption || '';
            valuesRef.current.description = asset.description || '';
            valuesRef.current.narrative = asset.narrative || '';
            valuesRef.current.privateDetails = asset.privateDetails || '';
            valuesRef.current.url = asset.url || asset.preview || "";
            valuesRef.current.isInboxDismissed = asset.isInboxDismissed;
            valuesRef.current.isPurist = asset.isPurist || false;
            valuesRef.current.mediaIds = asset.mediaIds || [];
            valuesRef.current.isFiction = asset.isFiction || false;
            valuesRef.current.skipAI = asset.skipAI || false;
        }
    }, [asset, isDirty]);

    // Live sync deconstructed Darkroom adjustments back into the master valuesRef.current reference
    useEffect(() => {
        valuesRef.current.polishLayers = layers;
        (valuesRef.current as any).preset = preset;
        (valuesRef.current as any).adjustmentStack = adjustments;
        (valuesRef.current as any).editHistory = editHistory;
    }, [layers, preset, adjustments, editHistory]);

    const tagMap = useMemo(() => {
        const map = new Map<string, Tag>();
        tags.forEach(t => map.set(t.id, t));
        return map;
    }, [tags]);

    return {
        isDirty, setIsDirty,
        datePrecision, setDatePrecision,
        dateStr, setDateStr,
        tagIds, setTagIds,
        tagSearch, setTagSearch,
        isTagDropdownOpen, setIsTagDropdownOpen,
        sparkleString, setSparkleString,
        isPurist, setIsPurist,
        status, setStatus,
        migrationStatus, setMigrationStatus,
        activeTab, setActiveTab,
        polishTab, setPolishTab,
        viewMode, setViewMode,
        isAnalyzing, setIsAnalyzing,
        isCropping, setIsCropping,
        isSaving, setIsSaving,
        displayUrl, setDisplayUrl,
        sliderPos, setSliderPos,
        isDragging, setIsDragging,
        preset, setPreset,
        layers, setLayers,
        adjustments, setAdjustments,
        editHistory, setEditHistory,
        aiDirective, setAiDirective,
        addressData, setAddressData,
        isNeuralScanning, setIsNeuralScanning,
        discoveredEntities, setDiscoveredEntities,
        narrative, setNarrative,
        valuesRef,
        tagMap
    };
};
