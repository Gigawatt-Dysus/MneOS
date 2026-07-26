import { Tag, Media } from '../types';
import { callXAI } from './aiOrchestrator';

export interface CompilationResult {
    compiledContext: string;
    tokenCountEst: number;
}

/**
 * The Context Compiler: Mints semantic memory blocks from raw media assets.
 * 
 * Supports two modes:
 * 1. Deterministic (Free): Creates the Anchor-Based Interval Timeline (t=X).
 * 2. LLM-Enhanced (Cost): Uses Grok to extract true Semantic Dependency Triples / DAG JSON.
 */
export const compileTagContext = async (
    tag: Tag, 
    assets: Media[], 
    useLLM: boolean = false
): Promise<CompilationResult> => {

    // 1. Compile the Deduped Entity Cloud (Metadata deduplication)
    const uniqueEntities = new Set<string>();
    
    // 2. Separate Anchored vs Floating (Shoebox) Assets
    const anchoredAssets: Media[] = [];
    const floatingAssets: Media[] = [];

    for (const asset of assets) {
        if (!asset.dateTaken) {
            floatingAssets.push(asset);
            continue;
        }
        
        const dateObj = new Date(asset.dateTaken);
        const year = dateObj.getFullYear();
        
        // Year 5000 is our official Shoebox marker. Anything > 2100 is floating.
        if (year > 2100 || isNaN(year)) {
            floatingAssets.push(asset);
        } else {
            anchoredAssets.push(asset);
        }
    }

    // Sort anchored assets chronologically
    anchoredAssets.sort((a, b) => new Date(a.dateTaken!).getTime() - new Date(b.dateTaken!).getTime());

    let rawTimelineLog = '';

    const processAsset = (asset: Media, isFloating: boolean) => {
        // Build Entity Cloud
        if (asset.metadata?.detectedObjects) {
            asset.metadata.detectedObjects.forEach((obj: any) => uniqueEntities.add(obj.name.toLowerCase()));
        }
        if (asset.metadata?.tags) {
            asset.metadata.tags.forEach((t: string) => uniqueEntities.add(t.toLowerCase()));
        }
        if (asset.metadata?.extractedText) {
            const words = asset.metadata.extractedText.split(/\s+/).filter((w: string) => w.length > 4);
            words.forEach((w: string) => uniqueEntities.add(w.toLowerCase()));
        }

        // Build Raw Timeline Log
        const ts = isFloating ? 'FLOATING/SHOEBOX' : new Date(asset.dateTaken!).toISOString().replace('T', ' ').substring(0, 16);
        const narrative = asset.narrative || asset.description || asset.metadata?.extractedText || 'No narrative description available.';
        rawTimelineLog += `[t=${ts}]: ${narrative}\n`;
    };

    anchoredAssets.forEach(a => processAsset(a, false));
    floatingAssets.forEach(a => processAsset(a, true));

    const entityCloudStr = Array.from(uniqueEntities).join(', ');
    const directiveStr = tag.aiDirective ? `\n[AXIOM/DIRECTIVE]\n${tag.aiDirective}\n` : '';

    // Deterministic Path (Cost: $0.00)
    let finalPayload = `${directiveStr}\n[UNIQUE ENTITY CLOUD]\n${entityCloudStr}\n\n[CAUSAL TIMELINE LOG]\n${rawTimelineLog}`;

    // LLM-Enhanced Path (Cost: 1 API Call via Grok-4.3)
    if (useLLM && rawTimelineLog.trim().length > 0) {
        try {
            const systemPrompt = `You are a Semantic Compiler for Project GIGI: Mnemosyne.
Your job is to compress human narratives into absolute, un-invertible Causal Sequence Triples.
Strip all fluff. Output ONLY a highly structured State-Transition JSON or DAG edge list mapping Time -> Actor -> Action -> Target.
Some events are marked [t=FLOATING/SHOEBOX]. Do your best to logically infer where they belong in the timeline based on context, but flag them as fuzzy.
Do NOT output conversational text.`;

            const userPrompt = `Compress this timeline log into strict Semantic Dependency Triples:\n\n${rawTimelineLog}`;

            const response = await callXAI('grok-4.3', [{ role: 'user', parts: [{ text: userPrompt }] }], systemPrompt, { temperature: 0.1 });
            
            if (response && response.text && response.text.trim()) {
                finalPayload = `${directiveStr}\n[UNIQUE ENTITY CLOUD]\n${entityCloudStr}\n\n[SEMANTIC CAUSAL GRAPH (GROK-COMPILED)]\n${response.text.trim()}`;
            }
        } catch (error) {
            console.error('[ContextCompiler] Grok compilation failed, falling back to deterministic timeline:', error);
        }
    }

    return {
        compiledContext: finalPayload.trim(),
        tokenCountEst: Math.ceil(finalPayload.length / 4) // Rough token heuristic
    };
};
