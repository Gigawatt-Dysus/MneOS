import React, { useState, useRef } from 'react';
import { Play, Pause, RefreshCw, Wrench, ScanFace, CheckSquare, Square, User } from 'lucide-react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { FaceRecognitionService } from '../../services/ai/faceRecognition';
import { analyzeVisuals } from '../../services/ai/vision'; 
import { callXAI } from '../../services/ai/providers'; 
import { appDataService } from '../../services/serviceManager';
import type { Media, Tag, ContextTag } from '@/types';

interface MediaScannerProps {
    allTags: Tag[];
    userId: string;
}

export const MediaScanner: React.FC<MediaScannerProps> = ({ allTags: initialTags, userId }) => {
    const [queue, setQueue] = useState<Media[]>([]);
    const [mode, setMode] = useState<'vision' | 'repair' | 'faces'>('vision');
    const [isScanning, setIsScanning] = useState(false);
    const [progress, setProgress] = useState({ processed: 0, total: 0, current: '' });
    const [logs, setLogs] = useState<string[]>([]);
    const [forceRescan, setForceRescan] = useState(false);
    const abortRef = useRef(false);

    const addLog = (msg: string) => setLogs(p => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...p].slice(0, 100));

    // Helper: Create Context Tag if missing
    const ensureContextTag = async (tagName: string, currentTags: Tag[]): Promise<string> => {
        const existing = currentTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
        if (existing) return existing.id;

        const newTag: ContextTag = {
            id: `tag-context-${Date.now()}-${Math.random().toString(36).substr(2,5)}`,
            name: tagName,
            type: 'context',
            description: 'AI Generated Context',
            mediaGallery: [],
            privateNotes: '',
            isPrivate: false,
            tagIds: [],
            mediaIds: [],
            metadata: { isSystem: true, usageCount: 1 }
        };
        
        await appDataService.saveTag(userId, newTag);
        currentTags.push(newTag); 
        return newTag.id;
    };

    const loadQueue = async (targetMode: 'vision' | 'repair' | 'faces') => {
        setIsScanning(true);
        setMode(targetMode);
        setQueue([]); 
        addLog(`🔎 Loading ${targetMode} candidates...`);
        
        try {
            // [ZEN FIX] Fetch Media directly to ensure we have fileType
            const mediaRef = collection(db, 'users', userId, 'media');
            const snapshot = await getDocs(mediaRef);
            const allDocs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Media));
            
            let candidates: Media[] = [];

            if (targetMode === 'faces') {
                candidates = allDocs.filter(m => m.fileType && m.fileType.startsWith('image/'));
                addLog(`Found ${candidates.length} images for Face Scan.`);
            } else if (forceRescan) {
                candidates = allDocs;
            } else if (targetMode === 'vision') {
                candidates = allDocs.filter(m => !m.description || !m.aiProcessed);
            } else {
                candidates = allDocs.filter(m => !m.tagIds || m.tagIds.length === 0 || !m.aiProcessed);
            }

            if (candidates.length === 0) {
                addLog("✅ No candidates found.");
                setIsScanning(false);
                return;
            }

            setQueue(candidates);
            setProgress({ processed: 0, total: candidates.length, current: 'Ready' });
            addLog(`✅ Queue loaded: ${candidates.length} items.`);
        } catch (e) {
            console.error(e);
            addLog("❌ Error loading queue.");
        } finally {
            setIsScanning(false);
        }
    };

    const processRepairItem = async (item: Media, currentTags: Tag[]): Promise<any> => {
        const updates: any = { aiProcessed: true };
        if (item.description) {
            const prompt = `Analyze: "${item.description}". Return JSON: { "caption": "Summary", "tags": ["tag1", "tag2"] }`;
            try {
                const res = await callXAI('grok-4-1-fast', [{ role: 'user', content: prompt }], "Output JSON only.");
                const rawText = res.text || ""; 
                if (!rawText) return updates;
                const jsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
                const data = JSON.parse(jsonStr);
                if (data.caption) updates.caption = data.caption;
                if (data.tags && Array.isArray(data.tags)) {
                    const tagIds = [];
                    for (const tagText of data.tags) {
                        const id = await ensureContextTag(tagText, currentTags);
                        tagIds.push(id);
                    }
                    updates.tagIds = [...new Set([...(item.tagIds || []), ...tagIds])];
                }
            } catch (e) { /* Ignore text failures */ }
        }
        return updates;
    };

    const processVisionItem = async (item: Media, currentTags: Tag[]): Promise<any> => {
        const updates: any = { aiProcessed: true };
        const prompt = "Analyze image. JSON: { \"description\": \"...\", \"caption\": \"...\", \"tags\": [...] }";
        try {
            const jsonText = await analyzeVisuals([item], prompt);
            const cleanJson = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(cleanJson);
            if (data.description) updates.description = data.description;
            if (data.caption) updates.caption = data.caption;
            if (data.tags && Array.isArray(data.tags)) {
                const tagIds = [];
                for (const tagText of data.tags) {
                    const id = await ensureContextTag(tagText, currentTags);
                    tagIds.push(id);
                }
                updates.tagIds = [...new Set([...(item.tagIds || []), ...tagIds])];
            }
            addLog(`👁️ Vision analyzed ${item.originalName}`);
        } catch (e) {
            addLog(`⚠️ Vision failed for ${item.originalName}`);
        }
        return updates;
    };

    const startProcessing = async () => {
        if (queue.length === 0) return;
        setIsScanning(true);
        abortRef.current = false;
        
        addLog("🧠 Loading Neural Networks...");
        try {
            await FaceRecognitionService.loadModels();
            addLog("🧠 Models Loaded.");
        } catch(e) {
             addLog("❌ Model load failed.");
             setIsScanning(false);
             return;
        }

        // [ZEN FIX] NUCLEAR OPTION: Direct Firestore Fetch for Tags
        addLog("🔄 Fetching RAW Tag Data from DB...");
        let freshTags: Tag[] = [];
        try {
            const tagsRef = collection(db, 'users', userId, 'tags');
            const snap = await getDocs(tagsRef);
            freshTags = snap.docs.map(d => ({ id: d.id, ...d.data() } as Tag));
            addLog(`✅ Retrieved ${freshTags.length} tags directly.`);
        } catch (e) {
            console.error("Direct fetch failed", e);
            addLog("❌ Direct DB Fetch Failed.");
            setIsScanning(false);
            return;
        }

        // [ZEN FIX] Convert Objects to Arrays (The Lazarus Patch)
        freshTags = freshTags.map(t => {
            const rawDesc = (t.metadata as any)?.faceDescriptor;
            if (rawDesc && typeof rawDesc === 'object' && !Array.isArray(rawDesc)) {
                // {0:0.1, 1:0.2} -> [0.1, 0.2]
                const fixedArr = Object.keys(rawDesc).map(Number).sort((a,b)=>a-b).map(k => rawDesc[k]);
                // @ts-ignore
                t.metadata.faceDescriptor = fixedArr;
            }
            return t;
        });

        const personTags = freshTags.filter(t => t.type === 'person');
        const enrolledCount = personTags.filter(t => (t.metadata as any)?.faceDescriptor).length;
        
        if (enrolledCount === 0) {
            addLog("⚠️ Warning: No enrolled faces found. Running in DETECTION ONLY mode.");
        } else {
            addLog(`✅ Scanner Active. Loaded ${enrolledCount} valid face IDs.`);
        }

        // [ZEN OPTIMIZATION] Build Matcher ONCE
        const faceMatcher = await FaceRecognitionService.createFaceMatcher(personTags);

        let processedCount = 0;

        for (const item of queue) {
            if (abortRef.current) {
                addLog("🛑 Aborted.");
                break;
            }
            
            setProgress(prev => ({ ...prev, current: `Scanning: ${item.originalName || item.id}` }));

            try {
                let contentUpdates: any = {};

                if (mode !== 'faces') {
                    contentUpdates = mode === 'vision' 
                        ? await processVisionItem(item, freshTags) 
                        : await processRepairItem(item, freshTags);
                }

                // Face Recognition Logic
                if (faceMatcher) {
                    const ids = await FaceRecognitionService.scanWithMatcher(item, faceMatcher);
                    if (ids.length > 0) {
                        const currentTags = contentUpdates.tagIds || item.tagIds || [];
                        contentUpdates.tagIds = [...new Set([...currentTags, ...ids])];
                        
                        const names = personTags.filter(t => ids.includes(t.id)).map(t => t.name).join(', ');
                        addLog(`👤 FOUND: ${names} in ${item.originalName}`);
                    }
                }

                if (Object.keys(contentUpdates).length > 0) {
                    const docRef = doc(db, 'users', userId, 'media', item.id);
                    await updateDoc(docRef, contentUpdates);
                }

            } catch (e) {
                console.warn(e);
            }

            processedCount++;
            setProgress(prev => ({ ...prev, processed: processedCount }));
            await new Promise(r => setTimeout(r, 10)); 
        }

        setIsScanning(false);
        addLog("🏁 Batch Complete.");
    };

    return (
        <div className="bg-slate-900 border border-cyan-500/30 rounded-xl p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <RefreshCw className={isScanning ? "animate-spin text-cyan-400" : "text-slate-400"} /> 
                Archive Intelligence Scanner
            </h2>
            
            <div className="mb-6 bg-black/40 rounded-lg p-4 font-mono text-xs h-48 overflow-y-auto border border-white/10 custom-scrollbar">
                {logs.length === 0 ? <span className="text-slate-600">System Ready. Select a mode.</span> : logs.map((l, i) => <div key={i} className="text-cyan-200/80 mb-1 border-b border-white/5 pb-1">{l}</div>)}
            </div>

            <div className="flex items-center gap-2 mb-4 justify-end">
                <button 
                    onClick={() => setForceRescan(!forceRescan)}
                    className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
                >
                    {forceRescan ? <CheckSquare size={14} className="text-cyan-400"/> : <Square size={14}/>}
                    Force Re-process
                </button>
            </div>

            {queue.length > 0 && (
                <div className="mb-6">
                    <div className="flex justify-between text-xs text-slate-400 mb-1 uppercase tracking-widest">
                        <span>Queue: {mode.toUpperCase()}</span>
                        <span>{progress.processed} / {progress.total}</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2">
                        <div 
                            className="bg-cyan-500 h-2 rounded-full transition-all duration-300" 
                            style={{ width: `${(progress.processed / Math.max(progress.total, 1)) * 100}%` }}
                        ></div>
                    </div>
                    <p className="text-center text-xs text-cyan-400 mt-2 animate-pulse truncate">{progress.current}</p>
                </div>
            )}

            <div className="flex gap-4 justify-end flex-wrap">
                {!isScanning && queue.length === 0 && (
                    <>
                        <button onClick={() => loadQueue('faces')} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-900/20">
                            <User size={16} /> Scan Faces (Fast)
                        </button>
                        <button onClick={() => loadQueue('vision')} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold flex items-center gap-2 transition-all">
                            <ScanFace size={16} /> Scan Vision
                        </button>
                        <button onClick={() => loadQueue('repair')} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold flex items-center gap-2 transition-all">
                            <Wrench size={16} /> Repair Text
                        </button>
                    </>
                )}
                
                {queue.length > 0 && !isScanning && (
                    <button onClick={startProcessing} className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-cyan-900/20 transition-all">
                        <Play size={18} /> Execute Scan
                    </button>
                )}

                {isScanning && (
                    <button onClick={() => { abortRef.current = true; }} className="px-6 py-2 bg-red-900/50 hover:bg-red-900 text-red-200 border border-red-500/50 rounded-lg font-bold flex items-center gap-2 transition-all">
                        <Pause size={18} /> Stop
                    </button>
                )}
            </div>
        </div>
    );
};