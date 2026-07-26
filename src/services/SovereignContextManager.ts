/**
 * [SOVEREIGN CONTEXT MANAGER] — Narrative Velocity & Agility
 *
 * This service manages conversational "saliency." It prevents Brita from
 * getting stuck in loops (anchors) and detects when the user has "pivoted"
 * (OBE - Overcome By Events).
 *
 * Logic:
 * 1. Narrative Odometer: Tracks how many times an entity has been mentioned.
 * 2. Context Pruning: Moves dead/repetitive topics to passive memory.
 * 3. Pivot Detection: Identifies sharp topic changes to force a conversational "dime-turn."
 */

export interface ContextAnchor {
    id: string;
    label: string;
    type: 'topic' | 'entity' | 'sentiment';
    mentionCount: number;
    lastMentionedTurn: number;
    saliencyScore: number; // 0 to 1.0
}

export interface ConversationalState {
    activeAnchors: ContextAnchor[];
    currentTurn: number;
    lastPivotTurn: number;
}

const DECAY_RATE = 0.3; // Saliency decay per turn without mention
const BURNOUT_THRESHOLD = 3; // Mentions before an anchor is "Burned Out"

export class SovereignContextManager {
    private state: ConversationalState = {
        activeAnchors: [],
        currentTurn: 0,
        lastPivotTurn: 0
    };

    /**
     * Tracks mentions of an entity and calculates its new saliency.
     */
    trackMention(label: string, type: ContextAnchor['type'] = 'topic') {
        this.state.currentTurn++;
        
        let anchor = this.state.activeAnchors.find(a => a.label === label);
        if (anchor) {
            anchor.mentionCount++;
            anchor.lastMentionedTurn = this.state.currentTurn;
            anchor.saliencyScore = 1.0; // Reset saliency to max on mention
        } else {
            this.state.activeAnchors.push({
                id: `anchor-${Date.now()}-${label}`,
                label,
                type,
                mentionCount: 1,
                lastMentionedTurn: this.state.currentTurn,
                saliencyScore: 1.0
            });
        }

        this.decaySaliency();
    }

    /**
     * Decays the saliency of all active anchors that weren't mentioned this turn.
     */
    private decaySaliency() {
        this.state.activeAnchors.forEach(anchor => {
            if (anchor.lastMentionedTurn < this.state.currentTurn) {
                anchor.saliencyScore *= (1 - DECAY_RATE);
            }
        });

        // Prune dead anchors
        this.state.activeAnchors = this.state.activeAnchors.filter(a => a.saliencyScore > 0.1);
    }

    /**
     * Detects if the conversation has shifted "Overcome By Events."
     * Logic: If a new high-magnitude topic is introduced, prune the old ones.
     */
    detectPivot(newTurnText: string): boolean {
        // Simple heuristic for now: If text is long and contains no existing anchors
        if (newTurnText.length > 50) {
            const hasExistingAnchor = this.state.activeAnchors.some(a => 
                newTurnText.toLowerCase().includes(a.label.toLowerCase())
            );
            
            if (!hasExistingAnchor && this.state.activeAnchors.length > 0) {
                console.log('[SovereignContext] 🔄 Pivot detected (OBE). Pruning old anchors.');
                this.state.activeAnchors = []; // Clear active anchors on hard pivot
                this.state.lastPivotTurn = this.state.currentTurn;
                return true;
            }
        }
        return false;
    }

    /**
     * [PRIMARY EXPORT] Generates "Negative Constraints" for the LLM prompt.
     * Prevents shoehorning of "Burned Out" topics.
     */
    getNegativeConstraints(): string[] {
        const constraints: string[] = [];
        
        this.state.activeAnchors.forEach(anchor => {
            if (anchor.mentionCount >= BURNOUT_THRESHOLD) {
                constraints.push(`DO NOT mention "${anchor.label}" again in this turn. It has been overused.`);
            }
        });

        return constraints;
    }

    /**
     * [PRIMARY EXPORT] Generates "Narrative Focus" instructions.
     */
    getNarrativeInstructions(): string {
        if (this.state.activeAnchors.length === 0) return "User has pivoted. Do not bridge back to previous topics. Follow the new tangent.";
        
        const topAnchors = this.state.activeAnchors
            .sort((a, b) => b.saliencyScore - a.saliencyScore)
            .slice(0, 2)
            .map(a => a.label);

        return `Focus the conversation on: ${topAnchors.join(', ')}. Avoid repetitive looping.`;
    }
}

// Global instance for the session
export const contextManager = new SovereignContextManager();
