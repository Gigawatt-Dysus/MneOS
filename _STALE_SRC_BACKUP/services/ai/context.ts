import type { Tag, AiCompanion, PersonTag, Media } from '@/types';

// Helper to build family graph
export const buildFamilyGraphContext = (tags: Tag[]): string => {
    const people = tags.filter(t => t.type === 'person') as PersonTag[];
    if (people.length === 0) return "No family relationships defined yet.";
    
    const relationships: string[] = [];
    const tagMap = new Map(tags.map(t => [t.id, t.name]));
    
    people.forEach(person => {
        if (person.metadata.relationships && person.metadata.relationships.length > 0) {
            person.metadata.relationships.forEach(rel => {
                const targetName = tagMap.get(rel.relatedPersonId) || "Unknown";
                relationships.push(`${targetName} is ${rel.type} of ${person.name}`);
            });
        }
    });
    
    return relationships.length === 0 ? "" : `FAMILY GRAPH CONTEXT:\n${relationships.join('\n')}`;
};

// Matrix Context Builder (From Backup)
export const buildMatrixContext = (media: Media[]): string => {
    if (!media || media.length === 0) return "MATRIX (FILE ARCHIVE): Empty.";
    
    // Sort by date descending
    const sorted = [...media].sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
    
    // Summarize top 50 items
    const recentItems = sorted.slice(0, 50).map(m => {
        const date = new Date(m.logicalDate || m.uploadDate).toLocaleDateString();
        // Safe access for diverse media types
        const desc = m.caption || (m as any).description || (m as any).title || m.originalName || "Untitled";
        return `- [ID:${m.id}] [${date}] ${desc} (${m.fileType})`;
    });

    return `MATRIX (FILE ARCHIVE - RECENT 50 ITEMS):\n${recentItems.join('\n')}\n(Total Archive Size: ${media.length} items.)`;
};

export type SystemMode = 'INTERACTIVE_CHAT' | 'REFLECTIVE_JOURNALING' | 'COMMENT' | 'BRIEFING' | 'DEEP_DIVE';

export const getSystemInstruction = (
    companion: AiCompanion,
    mode: SystemMode = 'INTERACTIVE_CHAT',
    contextPatch?: string,
    mediaContext?: string,
    userName: string = "User"
): string => {
  const name = companion.name;
  const baseIdentity = `You are ${name}.\nYour Persona: ${companion.persona}.\nBio: ${companion.bio}\n${companion.customPersonaDescription || ''}`;
  let modeDirectives = '';

  const toolInstructions = `
    === TOOL PROTOCOL (ACTIVE) ===
    You are an ACTIVE Agent. To use a tool, output a JSON block wrapped in <<<TOOL>>> ... <<<END>>>.
    Available: SEARCH_MATRIX, TAG_ASSETS, GENERATE_REPORT, ANALYZE_VISUALS, DELETE_ASSETS.
  `;

  switch (mode) {
      case 'INTERACTIVE_CHAT':
          modeDirectives = `MODE: INTERACTIVE_CHAT. Speak naturally to ${userName}. You have access to the user's Timeline and Matrix.\n${toolInstructions}`;
          break;
      case 'REFLECTIVE_JOURNALING':
          modeDirectives = `MODE: REFLECTIVE_JOURNALING. Write a deep, first-person journal entry.`;
          break;
      case 'COMMENT':
          modeDirectives = `MODE: COMMENT. Write a short 1-2 sentence reaction.`;
          break;
      case 'DEEP_DIVE':
          modeDirectives = `MODE: DEEP_DIVE. You are an investigative biographer. Conduct a "Deep Dive" analysis.`;
          break;
  }

  return `${baseIdentity}\n\n${modeDirectives}\n\nSPICE LEVEL: ${companion.spiceLevel || 1}/5\n\n${contextPatch || ''}\n\n${mediaContext || ''}`;
};