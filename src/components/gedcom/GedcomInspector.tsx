
import React, { useState, useMemo } from 'react';
import { useGedcom } from '../../context/GedcomContext';
import { PersonTag, User } from '../../types';
import { GedcomReader } from '../../services/gedcom/GedcomReader';
import { generateGedcomEnrichmentProposal, EnrichmentProposal } from '../../services/ai/generators/gedcomEnrichment';
import { generateGedcomLibrarianReport, LibrarianReport } from '../../services/ai/generators/gedcomLibrarian';
import { EnrichmentReviewModal } from './EnrichmentReviewModal';
import { Loader2, BookOpen, Sparkles } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid'; // [ZEN] Id Generation

interface GedcomInspectorProps {
    currentPerson: PersonTag;
    user: User;
    onUpdateTag: (updated: PersonTag) => void;
    onClose: () => void;
}

export const GedcomInspector: React.FC<GedcomInspectorProps> = ({ currentPerson, user, onUpdateTag, onClose }) => {
    const { gedcomData, setGedcomData, setIsLoading, filename, clearGedcom } = useGedcom();
    const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

    // AI State
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [proposal, setProposal] = useState<EnrichmentProposal | null>(null);

    // [ZEN] The Librarian Layer
    const [librarianReport, setLibrarianReport] = useState<LibrarianReport | null>(null);
    const [isConsulting, setIsConsulting] = useState(false);

    // [ZEN] View Preferences
    const [showHiddenFacts, setShowHiddenFacts] = useState(false);
    const [showHiddenNotes, setShowHiddenNotes] = useState(false);

    // [ZEN] Dynamic AI Name
    const primaryCompanion = user.aiCompanions?.find(c => c.isPrimary) || user.aiCompanions?.[0];
    const aiName = primaryCompanion?.name || "AI";

    // 2. Candidate Matching Logic
    const candidates = useMemo(() => {
        if (!gedcomData) return [];
        const people = Object.values(gedcomData.people);

        // Robust Name Extraction from GIGI Tag
        // Prefer metadata, fallback to parsing the Tag Name string
        let gigiGiven = currentPerson.metadata.givenName?.toLowerCase() || '';
        let gigiFamily = currentPerson.metadata.familyName?.toLowerCase() || '';

        if (!gigiGiven || !gigiFamily) {
            const parts = currentPerson.name.toLowerCase().split(' ');
            if (parts.length > 1) {
                gigiFamily = parts.pop() || ''; // Assume last is surname
                gigiGiven = parts.join(' ');
            } else {
                gigiGiven = parts[0] || '';
            }
        }

        // Tokenize for flexible matching
        const gigiTokens = new Set([
            ...gigiGiven.split(/\s+/),
            ...gigiFamily.split(/\s+/)
        ].filter(t => t.length > 2)); // Ignore "Jr", "Sr", "II" etc for now

        return people.filter(p => {
            // GEDCOM Name Prep
            const gFull = p.name.full.toLowerCase().replace(/\//g, ''); // Remove /Slashes/ around surnames
            const gTokens = gFull.split(/\s+/).filter(t => t.length > 2);

            // Intersection Logic
            let matches = 0;
            gTokens.forEach(t => {
                if (gigiTokens.has(t)) matches++;
            });

            // Threshold: 
            // - If we have 2+ matching tokens (e.g. Eric + Cornett), it's a candidate.
            // - If we have 1 matching token AND total tokens is small (e.g. just "Eric"), maybe? No, unsafe. 
            // - Exception: If GIGI name is very short (e.g. "Dad"), we can't match. 
            return matches >= 2;
        }).map(p => {
            return { ...p, score: 100 };
        });
    }, [gedcomData, currentPerson]);

    // Active Candidate
    const candidate = selectedCandidateId ? gedcomData?.people[selectedCandidateId] : candidates[0];

    // 0. The Librarian: Translate Raw Data on Selection
    React.useEffect(() => {
        if (!candidate) return;

        const consultLibrarian = async () => {
            setIsConsulting(true);
            try {
                const report = await generateGedcomLibrarianReport(user, candidate.name.full, candidate);
                setLibrarianReport(report);
            } catch (e) {
                console.error("Librarian consultation failed", e);
            } finally {
                setIsConsulting(false);
            }
        };

        consultLibrarian();
    }, [candidate?.id]);

    // 1. Trigger AI Analysis
    const triggerEnrichment = async (type: 'fact' | 'media' | 'note', data: any) => {
        setIsAnalyzing(true);
        try {
            // [ZEN] Just-In-Time AI Parsing
            // We pass the data directly now (it might be raw or AI-cleaned, the enrichment service handles it)
            const result = await generateGedcomEnrichmentProposal(user, type, data, currentPerson);
            setProposal(result);
        } catch (e) {
            console.error(e);
            alert(`${aiName} Analysis Failed. See console.`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    // 2. Apply Changes
    const handleApplyEnrichment = (changes: EnrichmentProposal['changes']) => {
        if (!currentPerson.metadata) return;

        const updated = { ...currentPerson, metadata: { ...currentPerson.metadata } };
        // Ensure dates object exists
        if (!updated.metadata.dates) updated.metadata.dates = { birth: '' };

        changes.forEach(change => {
            const field = change.field;

            // [ZEN] FIX: Map AI fields to actual PersonMetadata structure
            if (field === 'birthDate' && updated.metadata.dates) {
                updated.metadata.dates.birth = change.newValue;
            } else if (field === 'deathDate' && updated.metadata.dates) {
                updated.metadata.dates.death = change.newValue;
            } else if (field === 'birthPlace') {
                updated.metadata.birthPlace = change.newValue;
            } else if (field === 'deathPlace') {
                updated.metadata.deathPlace = change.newValue;
            } else if (field === 'facts') {
                // [ZEN] DEDUPLICATION & SANITIZATION LOGIC
                // 1. Sanitize Incoming Data to conform to LifeFact Schema
                const rawArr = Array.isArray(change.newValue) ? change.newValue : [change.newValue];

                const sanitizedNewFacts: any[] = rawArr.map((item: any) => {
                    if (typeof item === 'string') {
                        return {
                            id: uuidv4(),
                            type: 'generic',
                            value: item,
                            date: '',
                            place: '',
                            source: 'GEDCOM'
                        };
                    }
                    return {
                        id: item.id || uuidv4(),
                        type: item.type || 'generic',
                        value: item.value || item.description || '',
                        date: item.date || '',
                        place: item.place || '',
                        source: 'GEDCOM'
                    };
                });

                const existingFacts = updated.metadata.facts || [];

                // 2. Filter Duplicates
                const uniqueNewFacts = sanitizedNewFacts.filter(nf => {
                    return !existingFacts.some(ef =>
                        (ef.type || '').toLowerCase() === (nf.type || '').toLowerCase() &&
                        ef.date === nf.date &&
                        (ef.value === nf.value || (nf.value && ef.value && ef.value.includes(nf.value)))
                    );
                });

                if (uniqueNewFacts.length > 0) {
                    updated.metadata.facts = [...existingFacts, ...uniqueNewFacts];
                }
            } else if (field === 'media') {
                // Media handled separately (usually)
            } else {
                // Generic fallback
                (updated.metadata as any)[field] = change.newValue;
            }
        });

        onUpdateTag(updated);
        setProposal(null);
    };

    // 1. File Upload Handler (Global access via Inspector for now)
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        try {
            const buffer = await file.arrayBuffer();
            const parsed = await GedcomReader.parse(buffer);
            setGedcomData(parsed, file.name);
        } catch (err) {
            console.error("Failed to parse GEDCOM", err);
            alert("Failed to parse GEDCOM file. See console.");
        } finally {
            setIsLoading(false);
        }
    };



    // 3. Helper: Check if already enriched
    const checkIsRecorded = useMemo(() => {
        const fuzzyDateMatch = (d1?: string | number, d2?: string | number) => {
            if (!d1 || !d2) return false;

            const s1 = String(d1);
            const s2 = String(d2);

            // 1. Exact Match
            if (s1 === s2) return true;

            // 2. Normalized Text Match
            const n1 = s1.replace(/[-/,.]/g, ' ').toLowerCase();
            const n2 = s2.replace(/[-/,.]/g, ' ').toLowerCase();
            if (n1 === n2) return true;
            if (n1.includes(n2) || n2.includes(n1)) return true;

            // 3. JS Date Parsing (Robust)
            const t1 = Date.parse(s1);
            const t2 = Date.parse(s2);
            if (!isNaN(t1) && !isNaN(t2)) {
                // Compare timestamps directly (ignoring time if possible, but usually safe for straight dates)
                // However, timezone offsets might mess this up for "1980-01-01" vs "Jan 1 1980". 
                // Let's compare ISO strings or components.
                const dt1 = new Date(t1);
                const dt2 = new Date(t2);

                // Compare Year, Month, Day
                if (dt1.getUTCFullYear() === dt2.getUTCFullYear() &&
                    dt1.getUTCMonth() === dt2.getUTCMonth() &&
                    dt1.getUTCDate() === dt2.getUTCDate()) {
                    return true;
                }

                // Fallback: Just Year if deep past? No, strictness is better.
                // But let's keep the user's "Year Only" backup just in case
                if (dt1.getUTCFullYear() === dt2.getUTCFullYear()) {
                    // If everything else failed, but years match... 
                    // Validating just year might be too loose for "Events", but for "Birth", maybe okay?
                    // Let's stick to full date match first.
                }
            }

            // 4. Year Regex Fallback (Last Resort)
            const yearRegex = /\d{4}/;
            const y1 = s1.match(yearRegex)?.[0];
            const y2 = s2.match(yearRegex)?.[0];
            if (y1 && y2 && y1 === y2) {
                // Only allow year-only match if full date parsing failed or was ambiguous
                return true;
            }

            return false;
        };

        return {
            fact: (ev: any) => {
                // Check standard fields
                // [ZEN] FIX: Improved Date Matching + Fallback to Facts Array for BIRT/DEAT
                if (ev.type === 'BIRT') {
                    if (fuzzyDateMatch(currentPerson.metadata.dates?.birth, ev.date)) return true;
                    // Fallback: Check if recorded as a Fact
                    return (currentPerson.metadata.facts || []).some(f =>
                        ((f.type as string) === 'Birth' || (f.type as string) === 'BIRT') && fuzzyDateMatch(f.date, ev.date)
                    );
                }
                if (ev.type === 'DEAT') {
                    if (fuzzyDateMatch(currentPerson.metadata.dates?.death, ev.date)) return true;
                    // Fallback
                    return (currentPerson.metadata.facts || []).some(f =>
                        ((f.type as string) === 'Death' || (f.type as string) === 'DEAT') && fuzzyDateMatch(f.date, ev.date)
                    );
                }

                // Check facts array
                const facts = currentPerson.metadata.facts || [];
                // Fuzzy match: Same type AND (Same Date OR Same Value)
                return facts.some(f => {
                    const fType = (f.type || '').toLowerCase();
                    const evType = (ev.type || '').toLowerCase();

                    const typeMatch = fType === evType ||
                        (evType === 'occu' && fType === 'occupation') ||
                        (evType === 'resi' && fType === 'residence') ||
                        (evType === 'educ' && fType === 'education');

                    if (!typeMatch) return false;

                    // Allow fuzzy date match here too
                    const dateMatch = fuzzyDateMatch(f.date, ev.date);
                    const valMatch = (f.value && ev.description && f.value.includes(ev.description));

                    return dateMatch || valMatch;
                });
            },
            note: (note: any) => {
                const text = note.text || '';
                return (currentPerson.privateNotes || '').includes(text) ||
                    (currentPerson.description || '').includes(text);
            }
        };
    }, [currentPerson]);

    // [ZEN] Counts
    const recordedFactCount = candidate ? candidate.events.filter(e => checkIsRecorded.fact(e)).length : 0;
    const recordedNoteCount = candidate ? candidate.notes.filter(n => checkIsRecorded.note(n)).length : 0;

    if (!gedcomData) {
        return (
            <div className="fixed inset-y-0 right-0 w-96 bg-gray-900 shadow-2xl p-6 border-l border-gray-700 z-50 overflow-y-auto custom-scrollbar">
                <h2 className="text-xl font-bold mb-4 text-blue-400">Ancestry.com Reference Viewer</h2>
                <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center bg-gray-800">
                    <p className="text-sm mb-4">Mount a GEDCOM file as Read-Only memory.</p>
                    <input type="file" onChange={handleFileUpload} accept=".ged" className="block w-full text-sm text-gray-400
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-sm file:font-semibold
                        file:bg-blue-600 file:text-white
                        hover:file:bg-blue-700
                    "/>
                </div>
                <button onClick={onClose} className="mt-8 text-gray-500 underline text-sm w-full">Close Inspector</button>
            </div>
        );
    }

    return (
        <div className="fixed inset-y-0 right-0 w-[450px] bg-gray-900 shadow-2xl border-l border-gray-700 z-[200] flex flex-col">
            {/* ... Header & Candidate ... */}
            {/* Header */}
            <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800">
                <div>
                    <h3 className="font-bold text-gray-100 flex items-center gap-2">
                        <span className="text-blue-400">◆</span> {aiName} Reference
                    </h3>
                    {filename && <p className="text-xs text-blue-400/70 ml-5 font-mono">Using: {filename} (Cached)</p>}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={clearGedcom}
                        className="text-xs text-slate-500 hover:text-red-400 font-bold px-2 py-1 rounded bg-slate-900 border border-slate-700 hover:border-red-500/30 transition-all"
                    >
                        Change File
                    </button>
                    <button onClick={onClose} className="text-gray-400 hover:text-white ml-2">✕</button>
                </div>
            </div>

            <div className="p-4 bg-gray-800 border-b border-gray-700">
                {/* ... Candidate Select Logic ... */}
                <label className="text-xs text-gray-400 uppercase tracking-wide">Matches for {currentPerson.name}</label>
                {candidates.length === 0 ? (
                    <div className="text-yellow-500 text-sm mt-2">
                        No matching records found in GEDCOM.
                        <div className="text-[10px] text-gray-400 mt-2 border-t border-gray-700 pt-2 space-y-1">
                            <div className="font-bold text-gray-300">Matching Diagnostics:</div>
                            <div>Target: {currentPerson.name}</div>
                            <div className="mt-2 text-xs text-blue-300 font-mono">
                                Sample Data from GEDCOM:<br />
                                {Object.values(gedcomData.people).slice(0, 5).map(p => (
                                    <div key={p.id}>• [{p.id}] {p.name.full}</div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <select
                        className="w-full mt-2 bg-gray-700 text-white rounded p-2 text-sm border border-gray-600"
                        onChange={(e) => setSelectedCandidateId(e.target.value)}
                        value={candidate?.id}
                    >
                        {candidates.map(c => (
                            <option key={c.id} value={c.id}>{c.name.full} (@{c.id})</option>
                        ))}
                    </select>
                )}
            </div>

            {/* Content Scroller */}
            {candidate && (
                <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                    {/* Header info */}
                    <div className="text-center pb-4 border-b border-gray-800">
                        <h2 className="text-xl font-serif text-white">{candidate.name.given} {candidate.name.surname}</h2>
                        <div className="text-sm text-gray-400 mt-1">
                            GEDCOM ID: <span className="font-mono text-xs bg-gray-800 px-1 rounded">{candidate.id}</span>
                        </div>
                    </div>

                    {/* LIBRARIAN SECTION: NARRATIVE */}
                    <section className="bg-slate-800/80 p-5 rounded-xl border border-slate-700/50 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-2 opacity-50">
                            <BookOpen size={64} className="text-slate-700/50 -rotate-12" />
                        </div>

                        <h4 className="text-xs font-bold text-cyan-400 uppercase mb-2 flex items-center gap-2 relative z-10">
                            <Sparkles size={12} /> Librarian's Report
                        </h4>

                        <div className="relative z-10">
                            {isConsulting ? (
                                <div className="flex items-center gap-3 text-sm text-slate-400 italic animate-pulse py-4">
                                    <Loader2 size={16} className="animate-spin text-cyan-500" />
                                    Reading raw GEDCOM data...
                                </div>
                            ) : librarianReport ? (
                                <div className="text-sm text-slate-300 font-serif leading-relaxed">
                                    {librarianReport.narrative}
                                </div>
                            ) : (
                                <div className="text-sm text-slate-500 italic">
                                    No report generated.
                                </div>
                            )}
                        </div>
                    </section>

                    {/* V'GER SECTION: EVENTS (Librarian Cleaned) */}
                    <section>
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="text-xs font-bold text-blue-400 uppercase">Life Timeline</h4>
                            {recordedFactCount > 0 && (
                                <button
                                    onClick={() => setShowHiddenFacts(!showHiddenFacts)}
                                    className="text-[10px] text-gray-500 hover:text-blue-300 transition-colors bg-gray-800 px-2 py-1 rounded"
                                >
                                    {showHiddenFacts ? 'Hide' : 'Show'} {recordedFactCount} Recorded
                                </button>
                            )}
                        </div>
                        <div className="space-y-3">
                            {(librarianReport?.cleanEvents || candidate.events).map((ev, i) => {
                                const isRecorded = checkIsRecorded.fact(ev);
                                if (isRecorded && !showHiddenFacts) return null;

                                return (
                                    <div key={i} className={`bg-gray-800/50 p-3 rounded border border-gray-700 group hover:border-blue-500 transition-colors ${isRecorded ? 'opacity-50 grayscale' : ''}`}>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="font-bold text-gray-200 flex items-center gap-2">
                                                    {ev.type}
                                                    {isRecorded && <span className="text-[10px] bg-green-900 text-green-300 px-1.5 py-0.5 rounded-full">Recorded</span>}
                                                </div>
                                                <div className="text-sm text-yellow-100">{ev.date}</div>
                                                {ev.place && <div className="text-xs text-gray-400 mt-1">{ev.place}</div>}
                                                {ev.description && <div className="text-xs text-white/60 italic mt-1">"{ev.description}"</div>}
                                            </div>
                                            <button
                                                onClick={() => triggerEnrichment('fact', ev)}
                                                disabled={isRecorded || isConsulting} // Disable while regenerating
                                                className={`text-white text-xs px-2 py-1 rounded shadow-lg transition-all ${isRecorded
                                                    ? 'bg-gray-700 cursor-not-allowed hidden'
                                                    : 'opacity-0 group-hover:opacity-100 bg-blue-600 hover:bg-blue-500'}`}
                                            >
                                                {isAnalyzing ? "..." : "Enrich"}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {/* ... Media Section ... */}
                    <section>
                        <h4 className="text-xs font-bold text-purple-400 uppercase mb-3">Media Gallery ({candidate.media.length})</h4>
                        <div className="space-y-3">
                            {candidate.media.map((m, i) => (
                                <div key={i} className="bg-gray-800/50 p-3 rounded border border-gray-700 group hover:border-purple-500 transition-colors">
                                    <div className="flex gap-3">
                                        <div className="w-16 h-16 bg-black rounded overflow-hidden flex-shrink-0 relative">
                                            {m.isExternal && m.url ? (
                                                <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">Link</div>
                                            ) : m.isExternal ? (
                                                <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 italic">No URL</div>
                                            ) : (
                                                <img src={m.url} alt="Thumbnail" className="w-full h-full object-cover opacity-50" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-gray-200 truncate">{m.title}</div>
                                            <div className="text-xs text-purple-300 mt-1">{m.date || 'No Date'} • {m.place || 'No Place'}</div>
                                            <div className="text-[10px] text-gray-500 truncate mt-1">{m.url}</div>
                                        </div>
                                    </div>
                                    <div className="mt-3 flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                        {m.isExternal && m.url ? (
                                            <a href={m.url} target="_blank" rel="noreferrer" className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-2 py-1 rounded">View</a>
                                        ) : m.isExternal && !m.url ? (
                                            <span className="text-gray-500 text-xs italic">No URL</span>
                                        ) : (
                                            <button onClick={() => triggerEnrichment('media', m)} className="bg-purple-600 hover:bg-purple-500 text-white text-xs px-2 py-1 rounded">
                                                {isAnalyzing ? "..." : "Inject Metadata"}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* V'GER SECTION: QUARANTINE */}
                    {candidate.notes.length > 0 && (
                        <section className="bg-red-900/10 border border-red-900/30 rounded p-4">
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="text-xs font-bold text-red-400 uppercase">Narrative Quarantine</h4>
                                {recordedNoteCount > 0 && (
                                    <button
                                        onClick={() => setShowHiddenNotes(!showHiddenNotes)}
                                        className="text-[10px] text-red-900/60 hover:text-red-400 transition-colors font-bold px-2 py-1 rounded"
                                    >
                                        {showHiddenNotes ? 'Hide' : 'Show'} {recordedNoteCount} Copied
                                    </button>
                                )}
                            </div>
                            <div className="space-y-4">
                                {candidate.notes.map((note, i) => {
                                    const isRecorded = checkIsRecorded.note(note);
                                    if (isRecorded && !showHiddenNotes) return null; // [ZEN] Hiding logic

                                    return (
                                        <div key={i} className={`text-sm text-gray-400 italic font-serif ${isRecorded ? 'opacity-50' : ''}`}>
                                            "{note.text}"
                                            {isRecorded ? (
                                                <div className="mt-2 text-xs text-green-500 font-sans not-italic flex items-center gap-1">
                                                    ✓ Copied
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => triggerEnrichment('note', note)}
                                                    className="block mt-2 text-xs text-red-400 hover:text-red-300 not-italic font-sans underline"
                                                >
                                                    {isAnalyzing ? "Analyzing..." : "Copy to Secure Notes"}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}
                </div>
            )}

            {/* AI LOADING OVERLAY */}
            {isAnalyzing && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-[250] text-blue-400 animate-in fade-in">
                    <Loader2 className="animate-spin mb-4" size={32} />
                    <div className="font-bold text-sm">{aiName} is Analyzing...</div>
                    <div className="text-xs text-blue-300/70 mt-1">Comparing Data Patterns</div>
                </div>
            )}

            {/* AI REVIEW MODAL */}
            {proposal && (
                <EnrichmentReviewModal
                    proposal={proposal}
                    onClose={() => setProposal(null)}
                    onApply={handleApplyEnrichment}
                />
            )}
        </div>
    );
};
