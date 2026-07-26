import React, { useState } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc, writeBatch } from '../../../services/sovereignDbAdapter';
import { db } from '../../../firebaseConfig';
import { extractDateFromFilename } from '../../../utils/dateSanitizer';
import { ChronoMedicProps, Patient } from './types';
import { ChronoHeader } from './ChronoHeader';
import { ChronoList } from './ChronoList';
import { ChronoViewer } from './ChronoViewer';
import { ChronoToolbar } from './ChronoToolbar';
import { Eye } from 'lucide-react';

export const ChronoMedic: React.FC<ChronoMedicProps> = ({ userId, onClose }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [fixedCount, setFixedCount] = useState(0);
    const [deletedCount, setDeletedCount] = useState(0);
    const [reviewIndex, setReviewIndex] = useState<number>(-1);
    const [dateInput, setDateInput] = useState<string>('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const safeDateStr = (val: any): string => {
        if (!val) return 'MISSING';
        if (typeof val === 'string') return val;
        if (val.toDate && typeof val.toDate === 'function') return val.toDate().toISOString(); 
        if (val instanceof Date) return val.toISOString();
        return String(val);
    };

    // 1. SCAN
    const scanForAnomalies = async () => {
        setIsLoading(true);
        setPatients([]);
        setFixedCount(0);
        setDeletedCount(0);
        setReviewIndex(-1);
        setSelectedIds(new Set());
        
        try {
            console.log("🏥 [ChronoMedic] Scanning for temporal anomalies...");
            const mediaRef = collection(db, 'users', userId, 'media');
            const snapshot = await getDocs(mediaRef);
            
            const sickList: Patient[] = [];

            snapshot.forEach((doc) => {
                const data = doc.data();
                if (data.dateVerified === true) return;

                const rawDate = data.logicalDate;
                let year = 9999;
                
                try {
                    if (typeof rawDate === 'string') year = new Date(rawDate).getFullYear();
                    else if (rawDate && rawDate.toDate) year = rawDate.toDate().getFullYear();
                    else if (data.year) year = data.year;
                } catch (e) { year = 0; }

                if (isNaN(year) || year < 1980 || year > 2030) {
                    const proposed = extractDateFromFilename(data.originalName || '');
                    sickList.push({
                        id: doc.id,
                        originalName: data.originalName || 'Unknown',
                        currentDate: rawDate,
                        proposedDate: proposed,
                        url: data.url || '', 
                        status: proposed ? 'pending' : 'unfixable'
                    });
                }
            });
            setPatients(sickList);
        } catch (error) {
            console.error("Scan failed:", error);
            alert("Scan failed. Check console.");
        } finally {
            setIsLoading(false);
        }
    };

    // 2. SELECTION
    const handleToggleSelect = (id: string, state: boolean) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (state) newSet.add(id); else newSet.delete(id);
            return newSet;
        });
    };

    const handleSelectAll = () => {
        if (selectedIds.size === patients.length && patients.length > 0) setSelectedIds(new Set());
        else setSelectedIds(new Set(patients.filter(p => p.status === 'pending' || p.status === 'unfixable').map(p => p.id)));
    };

    // 3. BATCH ACTIONS
    const executeBatchUpdate = async (actionName: string, updateFn: (batch: any, ref: any, patient: Patient) => void, localStatus: Patient['status']) => {
        if (!confirm(`Confirm: ${actionName} for ${selectedIds.size} items?`)) return;
        setIsLoading(true);
        const batch = writeBatch(db);
        const updatedPatients = [...patients];
        let count = 0;

        selectedIds.forEach(id => {
            const index = patients.findIndex(p => p.id === id);
            if (index === -1) return;
            updateFn(batch, doc(db, 'users', userId, 'media', id), patients[index]);
            updatedPatients[index] = { ...patients[index], status: localStatus };
            count++;
        });

        try {
            await batch.commit();
            setPatients(updatedPatients);
            if (localStatus === 'deleted') setDeletedCount(prev => prev + count);
            else setFixedCount(prev => prev + count);
            setSelectedIds(new Set()); 
        } catch (err) {
            console.error(err);
            alert(`Batch ${actionName} failed.`);
        } finally {
            setIsLoading(false);
        }
    };

    // 4. REVIEW
    const setReviewItem = (index: number) => {
        setReviewIndex(index);
        const p = patients[index];
        let targetDateStr = p.proposedDate;
        
        if (!targetDateStr) {
            const currentStr = safeDateStr(p.currentDate);
            if (currentStr && currentStr.length > 10 && currentStr !== 'MISSING') targetDateStr = currentStr;
            else targetDateStr = new Date().toISOString();
        }

        let finalVal = targetDateStr.substring(0, 16);
        if (finalVal.endsWith('T00:00')) finalVal = finalVal.replace('T00:00', 'T12:00');
        setDateInput(finalVal);
    };

    const startReview = () => {
        const firstIndex = patients.findIndex(p => p.status === 'pending');
        if (firstIndex !== -1) setReviewItem(firstIndex);
        else alert("No pending fixes found.");
    };

    const handleSingleApprove = async () => {
        const patient = patients[reviewIndex];
        if (!patient) return;
        const validDate = new Date(dateInput);
        if (isNaN(validDate.getTime())) { alert("Invalid Date!"); return; }

        try {
            const isoString = validDate.toISOString();
            await updateDoc(doc(db, 'users', userId, 'media', patient.id), { 
                logicalDate: isoString,
                year: validDate.getFullYear(),
                dateAdded: isoString,
                dateVerified: true
            });
            const updated = [...patients];
            updated[reviewIndex] = { ...patient, status: 'fixed', currentDate: isoString };
            setPatients(updated);
            setFixedCount(prev => prev + 1);
            
            let nextIdx = -1;
            for (let i = reviewIndex + 1; i < patients.length; i++) {
                if (patients[i].status === 'pending') { nextIdx = i; break; }
            }
            if (nextIdx !== -1) setReviewItem(nextIdx); else setReviewIndex(-1);
        } catch (error) { console.error("Fix failed:", error); }
    };

    const handleSingleDelete = async () => {
        const patient = patients[reviewIndex];
        if (!confirm(`Delete "${patient.originalName}"?`)) return;
        try {
            await deleteDoc(doc(db, 'users', userId, 'media', patient.id));
            const updated = [...patients];
            updated[reviewIndex] = { ...patient, status: 'deleted' };
            setPatients(updated);
            setDeletedCount(prev => prev + 1);
            setReviewIndex(-1);
        } catch (error) { console.error("Delete failed:", error); }
    };

    // [ZEN FIX] MODAL WRAPPER START
    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            {/* The Bento Modal Card */}
            <div className="relative w-[95vw] max-w-[1600px] h-[90vh] bg-[#0f1219] rounded-3xl border border-white/10 shadow-2xl flex flex-col overflow-hidden">
                
                <ChronoHeader 
                    isLoading={isLoading} 
                    scanForAnomalies={scanForAnomalies} 
                    startReview={startReview} 
                    hasPending={patients.filter(p => p.status === 'pending').length > 0}
                    isReviewing={reviewIndex !== -1}
                    onClose={onClose}
                />
                
                {/* SPLIT VIEW AREA */}
                <div className="flex-1 overflow-hidden relative flex">
                    
                    {/* LEFT COLUMN: LIST */}
                    <div className="w-[400px] shrink-0 border-r border-white/5 bg-slate-900/50 flex flex-col relative">
                        <ChronoList 
                            patients={patients}
                            selectedIds={selectedIds}
                            reviewIndex={reviewIndex}
                            fixedCount={fixedCount}
                            deletedCount={deletedCount}
                            onSelect={setReviewItem}
                            onToggleSelect={handleToggleSelect}
                            onSelectAll={handleSelectAll}
                            setSelectedIds={setSelectedIds}
                            safeDateStr={safeDateStr}
                        />
                        
                        <ChronoToolbar 
                            selectedCount={selectedIds.size}
                            onClearSelection={() => setSelectedIds(new Set())}
                            onBatchDelete={() => executeBatchUpdate("Delete", (batch, ref) => batch.delete(ref), 'deleted')}
                            onBatchWipe={() => executeBatchUpdate("Wipe Dates", (batch, ref) => batch.update(ref, { logicalDate: null, year: 0, dateVerified: true }), 'fixed')}
                            onBatchAccept={() => executeBatchUpdate("Accept Current", (batch, ref) => batch.update(ref, { dateVerified: true }), 'verified')}
                            onBatchFix={() => executeBatchUpdate("Apply Fixes", (batch, ref, p) => {
                                if (p.proposedDate) batch.update(ref, { logicalDate: p.proposedDate, year: new Date(p.proposedDate).getFullYear(), dateAdded: p.proposedDate, dateVerified: true });
                            }, 'fixed')}
                        />
                    </div>

                    {/* RIGHT COLUMN: STAGE */}
                    <div className="flex-1 bg-[#050505] flex flex-col relative overflow-hidden">
                        {reviewIndex !== -1 && patients[reviewIndex] ? (
                            <ChronoViewer 
                                patient={patients[reviewIndex]}
                                dateInput={dateInput}
                                setDateInput={setDateInput}
                                onResetDate={() => {
                                    const p = patients[reviewIndex];
                                    let val = (p.proposedDate || new Date().toISOString()).substring(0, 16);
                                    if (val.endsWith('T00:00')) val = val.replace('T00:00', 'T12:00');
                                    setDateInput(val);
                                }}
                                onSkip={() => {
                                    const updated = [...patients];
                                    updated[reviewIndex] = { ...patients[reviewIndex], status: 'skipped' };
                                    setPatients(updated);
                                    let nextIdx = -1;
                                    for (let i = reviewIndex + 1; i < patients.length; i++) {
                                        if (patients[i].status === 'pending') { nextIdx = i; break; }
                                    }
                                    if (nextIdx !== -1) setReviewItem(nextIdx); else setReviewIndex(-1);
                                }}
                                onDelete={handleSingleDelete}
                                onApprove={handleSingleApprove}
                                onClose={() => setReviewIndex(-1)}
                                hasPatients={patients.length > 0}
                                safeDateStr={safeDateStr}
                            />
                        ) : (
                            /* Bento Empty State */
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-600 bg-dots-pattern">
                                <div className="w-24 h-24 rounded-full bg-slate-900 border border-white/5 flex items-center justify-center mb-6 shadow-xl">
                                    <Eye size={48} className="opacity-40 text-cyan-500" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-400 mb-2">Surgeon's Console Ready</h3>
                                <p className="text-sm text-slate-500 max-w-md text-center">
                                    Select an artifact from the queue on the left to begin diagnosis and repair.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};