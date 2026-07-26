// services/ai/VocalTagService.ts

export interface NeuralTag {
    tag: string;
    category: string;
    description: string;
    example?: string;
}

/**
 * [ZEN V37] SOVEREIGN VOCAL TAG RAG
 * Dynamically indexes and retrieves the most relevant performance cues
 * from the 1,124-tag library without bloating the system prompt.
 */
class VocalTagService {
    private library: NeuralTag[] = [];
    private isLoaded = false;
    private isLoading = false;

    // Core Clusters for immediate fallback/high-frequency usage
    private readonly CORE_CLUSTERS = {
        intimacy: ["[whispers]", "[softly]", "[tender]", "[breathy]", "[sensual]", "[warm]", "[moaning]", "[husky]", "[breathless]"],
        intensity: ["[angry]", "[firm]", "[stern]", "[shouts]", "[forceful]", "[commanding]"],
        distress: ["[crying]", "[sobbing]", "[trembling]", "[anxious]", "[frightened]", "[pain]", "[gasping]"],
        joy: ["[laughing]", "[giggles]", "[excited]", "[happy]", "[cheerful]", "[bright]"],
        narrative: ["[narrative]", "[descriptive]", "[slowly]", "[suspenseful]", "[dark]", "[epic]"]
    };

    async init() {
        if (this.isLoaded || this.isLoading) return;
        this.isLoading = true;

        try {
            const response = await fetch('/assets/AudioTagLibrary.txt');
            const data = await response.json();
            if (data && data.tts_tags) {
                this.library = data.tts_tags;
                this.isLoaded = true;
                console.log(`[VocalTagService] 🧬 Indexed ${this.library.length} performance cues.`);
            }
        } catch (error) {
            console.error("[VocalTagService] ❌ Failed to index tag library:", error);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Finds relevant tags based on conversation context
     */
    async getRecommendedTags(query: string, history: string = ""): Promise<NeuralTag[]> {
        if (!this.isLoaded) await this.init();

        const combinedContext = (query + " " + history).toLowerCase();
        // [ZEN FIX] Detect intimacy context at the start of the RAG pass (Expanded sensory list)
        const isIntimate = combinedContext.match(/(love|miss|touch|feel|close|dear|sweet|intimate|moan|lips|core|thigh|heat|arch|fingers|hair|hips|roll|heat|sparks|melt|husky|teasing|unravel|tickling|tickle|panting|trembling|needy| husky|shudder)/i);
        
        // 1. Talosian Reinforcement: Extract tags already present in recent history
        const historyTags = history.match(/\[(.*?)\]/g) || [];
        const reinforcedTags: NeuralTag[] = [];
        
        if (historyTags.length > 0) {
            console.log(`[VocalTagService] 🧠 Talosian Reinforcement: Detected ${historyTags.length} establishment tags.`);
            historyTags.forEach(rawTag => {
                const found = this.library.find(l => l.tag === rawTag);
                if (found) {
                    // [ZEN FIX] Purge noisy reinforcement in emotional contexts
                    if (isIntimate && (found.category === 'Atmosphere' || found.category === 'Sound Effects' || found.category === 'Technical')) {
                        return;
                    }
                    reinforcedTags.push(found);
                }
            });
        }

        // 2. Semantic/Keyword Match
        const matches = this.library.filter(tag => {
            // [ZEN V39] Hard-coded Immersion Blacklist for Intimate Contexts
            if (isIntimate) {
                const hardBlacklist = ['8-bit', 'chiptune', 'abandoned', 'building', 'underwater', 'radio', 'telephone', 'megaphone'];
                const isBlacklisted = hardBlacklist.some(b => tag.tag.toLowerCase().includes(b));
                if (isBlacklisted || tag.category === 'Atmosphere' || tag.category === 'Sound Effects' || tag.category === 'Technical') {
                    return false;
                }
            }
            
            const cleanName = (tag.tag || '').replace(/[\[\]]/g, '').toLowerCase();
            const isNameMatch = combinedContext.includes(cleanName);
            
            return isNameMatch;
        });

        // 3. Cluster Detection (Heuristics)
        let results = [...reinforcedTags, ...matches];
        
        if (isIntimate) {
            results = [...results, ...this.getClusterTags('intimacy')];
        }
        if (combinedContext.match(/(angry|stop|don't|no|never|hate|fight|loud)/i)) {
            results = [...results, ...this.getClusterTags('intensity')];
        }
        if (combinedContext.match(/(sad|hurt|pain|cry|help|scared|afraid)/i)) {
            results = [...results, ...this.getClusterTags('distress')];
        }
        if (combinedContext.match(/(fun|yay|happy|good|great|wow|amazing)/i)) {
            results = [...results, ...this.getClusterTags('joy')];
        }

        // Deduplicate and clamp to top 12 most relevant
        const unique = Array.from(new Set(results.map(r => r.tag)))
            .map(tag => results.find(r => r.tag === tag)!)
            .slice(0, 12);

        return unique;
    }

    private getClusterTags(clusterName: keyof typeof this.CORE_CLUSTERS): NeuralTag[] {
        const tags = this.CORE_CLUSTERS[clusterName];
        return tags.map(t => {
            const found = this.library.find(l => l.tag === t);
            return found || { tag: t, category: 'Core', description: `Standard ${clusterName} delivery.` };
        });
    }

    formatForPrompt(tags: NeuralTag[]): string {
        if (tags.length === 0) return "";
        
        return `[NEURAL VOCAL PALETTE - RECOMMENDED CUES]\n` + 
            tags.map(t => `${t.tag}: ${t.description}`).join('\n') +
            `\n(Use these or others creatively to enhance the v3 performance)`;
    }
}

export const vocalTagService = new VocalTagService();
