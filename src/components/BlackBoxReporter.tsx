import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import * as htmlToImage from 'html-to-image';

export function BlackBoxReporter() {
    const [isOpen, setIsOpen] = useState(false);
    const [isVisible, setIsVisible] = useState(false); // [ZEN] Konami code toggle
    const [screenshot, setScreenshot] = useState<string | null>(null);
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [isCapturing, setIsCapturing] = useState(false);

    // Listen for Alt+X to toggle visibility
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.altKey && e.key.toLowerCase() === 'x') {
                e.preventDefault();
                setIsVisible(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const captureReport = async () => {
        setIsCapturing(true);
        try {
            // Find the root element, but exclude the reporter itself if possible
            const element = document.getElementById('root') || document.body;
            const dataUrl = await htmlToImage.toPng(element, { 
                pixelRatio: 1.5,
            });
            setScreenshot(dataUrl);
            setIsOpen(true);
        } catch (e) {
            console.error("Failed to capture screenshot:", e);
            alert("Failed to capture screen. See console.");
        } finally {
            setIsCapturing(false);
        }
    };

    const downloadReport = () => {
        if (!screenshot) return;

        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const moduleName = window.location.pathname.split('/').filter(Boolean).pop() || 'dashboard';
        const shortSummary = description.length > 40 ? description.substring(0, 37) + '...' : description || 'anomaly';
        
        // Clean filename of bad characters
        const safeSummary = shortSummary.replace(/[^a-z0-9 ]/gi, '').trim() || 'report';
        const fileBaseName = `[ANOMALY] ${timestamp} - ${moduleName} - ${safeSummary}`;

        // 1. Generate Markdown
        const report = `# 🚨 Flight Anomaly Report

**Report ID**: ${timestamp}-${moduleName}
**Generated**: ${now.toLocaleString()}
**URL**: ${window.location.href}
**Module / View**: ${moduleName}

---

## Category
${category || 'Uncategorized'}

## Description
${description || 'No description provided.'}

---

## Black Box Data
\`\`\`json
{
  "timestamp": "${now.toISOString()}",
  "url": "${window.location.href}",
  "module": "${moduleName}",
  "userAgent": "${navigator.userAgent.substring(0, 120)}...",
  "screenSize": "${window.innerWidth}x${window.innerHeight}"
}
\`\`\`

---
*Note: Screenshot saved separately as ${fileBaseName}.png*
`;

        // 2. Download Markdown
        const mdBlob = new Blob([report], { type: 'text/markdown' });
        const mdUrl = URL.createObjectURL(mdBlob);
        const mdLink = document.createElement('a');
        mdLink.href = mdUrl;
        mdLink.download = `${fileBaseName}.md`;
        document.body.appendChild(mdLink);
        mdLink.click();
        document.body.removeChild(mdLink);

        // 3. Download Screenshot
        const imgLink = document.createElement('a');
        imgLink.href = screenshot;
        imgLink.download = `${fileBaseName}.png`;
        document.body.appendChild(imgLink);
        
        // Small delay to prevent browser blocking multiple concurrent downloads
        setTimeout(() => {
            imgLink.click();
            document.body.removeChild(imgLink);
            setIsOpen(false);
            setDescription('');
            setCategory('');
            setScreenshot(null);
        }, 500);
    };

    return createPortal(
        <>
            {/* Floating Trigger Button */}
            {isVisible && (
                <button
                    onClick={captureReport}
                    disabled={isCapturing}
                    className="fixed bottom-6 right-6 bg-red-600 hover:bg-red-500 text-white p-3 rounded-full shadow-[0_0_15px_rgba(220,38,38,0.6)] z-[9990] transition-all hover:scale-110 active:scale-95 disabled:opacity-50 flex items-center justify-center w-14 h-14"
                    title="Black Box Recorder"
                >
                    {isCapturing ? <span className="animate-spin">⚙️</span> : <span className="text-2xl">✈️</span>}
                </button>
            )}

            {/* Portal Modal */}
            {isOpen && (
                <div className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-[#111] border border-red-500/30 rounded-xl p-6 w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                        <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-4 shrink-0">
                            <h2 className="text-xl font-bold text-red-500 flex items-center gap-2">
                                🚨 Flight Anomaly Recorder
                            </h2>
                            <button 
                                onClick={() => setIsOpen(false)}
                                className="text-gray-400 hover:text-white"
                            >
                                ✕ Cancel
                            </button>
                        </div>

                        <div className="flex flex-col md:flex-row gap-6 overflow-hidden flex-1">
                            {/* Left: Form */}
                            <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Anomaly Category</label>
                                    <select 
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        className="w-full bg-[#222] border border-white/10 rounded-md p-2 text-sm text-white"
                                    >
                                        <option value="">Select Category...</option>
                                        <option value="UI/Styling">UI / Styling Ghost</option>
                                        <option value="Database/Sync">Database / Sync Issue</option>
                                        <option value="Logic/Crash">Logic Error / Crash</option>
                                        <option value="AI/Agent">AI Companion Issue</option>
                                    </select>
                                </div>

                                <div className="flex-1 flex flex-col min-h-[150px]">
                                    <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Situation Report</label>
                                    <textarea 
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="What just happened? What did you expect to happen?"
                                        className="w-full flex-1 bg-[#222] border border-white/10 rounded-md p-3 text-sm text-white resize-none"
                                    />
                                </div>
                            </div>

                            {/* Right: Preview */}
                            <div className="flex-1 flex flex-col border border-white/10 rounded-lg overflow-hidden bg-black relative min-h-[200px]">
                                <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-2 text-xs text-white/50 z-10 font-mono">
                                    VIEWPORT_SNAPSHOT.PNG
                                </div>
                                {screenshot && (
                                    <img 
                                        src={screenshot} 
                                        alt="Viewport Capture" 
                                        className="w-full h-full object-contain"
                                    />
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="mt-6 pt-4 border-t border-white/10 flex justify-between items-center shrink-0">
                            <div className="text-xs text-gray-500 font-mono">
                                Generates MD Report + PNG Export
                            </div>
                            <button
                                onClick={downloadReport}
                                className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-md font-bold transition-colors shadow-[0_0_15px_rgba(220,38,38,0.3)]"
                            >
                                💾 Export Black Box
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>,
        document.body
    );
}
