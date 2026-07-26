import { Tag, PersonTag } from '../types';

type RelationType = 'parent' | 'child' | 'spouse' | 'sibling' | 'step-parent' | 'step-child';

interface GraphEdge {
    to: string;
    type: RelationType;
    rawType: string;
}

interface GraphPathStep {
    from: string;
    to: string;
    type: RelationType;
}

/**
 * Builds a Directed Graph from the Tag Database.
 */
const buildGraph = (tags: PersonTag[]): Map<string, GraphEdge[]> => {
    const adj = new Map<string, GraphEdge[]>();

    tags.forEach(p => {
        if (!adj.has(p.id)) adj.set(p.id, []);
        const rels = p.metadata.relationships || [];

        rels.forEach(r => {
            const type = r.type.toLowerCase();
            let normType: RelationType | null = null;

            // Normalize Edges
            if (type.includes('mother') || type.includes('father') || type.includes('parent')) normType = 'parent';
            else if (type.includes('son') || type.includes('daughter') || type.includes('child')) normType = 'child';
            else if (type.includes('wife') || type.includes('husband') || type.includes('spouse') || type.includes('partner')) normType = 'spouse';
            else if (type.includes('brother') || type.includes('sister') || type.includes('sibling')) normType = 'sibling';

            // Explicit Step/Adopted handling could be added here

            if (normType) {
                adj.get(p.id)?.push({ to: r.relatedPersonId, type: normType, rawType: r.type });
            }
        });
    });

    return adj;
};

/**
 * PATHFINDER (BFS)
 * Finds the shortest path of relationships between Source and Target.
 */
export const findRelationshipPath = (allTags: Tag[], sourceId: string, targetId: string): string | null => {
    const personTags = allTags.filter(t => t.type === 'person') as PersonTag[];
    const graph = buildGraph(personTags);

    // BFS Queue: [CurrentNode, PathSoFar[]]
    const queue: { id: string, path: RelationType[] }[] = [{ id: sourceId, path: [] }];
    const visited = new Set<string>([sourceId]);

    // Safety Limit for Depth (don't go deeper than 6 degrees)
    const MAX_DEPTH = 6;

    while (queue.length > 0) {
        const { id, path } = queue.shift()!;

        if (id === targetId) {
            return classifyPath(path);
        }

        if (path.length >= MAX_DEPTH) continue;

        const edges = graph.get(id) || [];
        for (const edge of edges) {
            if (!visited.has(edge.to)) {
                visited.add(edge.to);
                queue.push({ id: edge.to, path: [...path, edge.type] });
            }
        }
    }

    return null; // No path found
};

/**
 * CLASSIFIER
 * Translates a sequence of steps into a Relationship Term.
 */
const classifyPath = (path: RelationType[]): string | null => {
    const p = path.join('->');

    // --- DIRECT LINEAGE ---
    if (p === 'child') return 'Child'; // Son/Daughter
    if (p === 'parent') return 'Parent'; // Father/Mother

    if (p === 'child->child') return 'Grandchild';
    if (p === 'parent->parent') return 'Grandparent';

    if (p === 'child->child->child') return 'Great-Grandchild';
    if (p === 'parent->parent->parent') return 'Great-Grandparent';

    // --- SIBLINGS / AVUNCULAR (LCA Logic) ---
    // Sibling = Parent -> Child (Technically 'Up -> Down')
    // But usually explicitly tagged 'sibling'. if inferred:
    if (p === 'parent->child') return 'Sibling'; // Shared Parent

    // Uncle/Aunt = Parent -> Sibling
    if (p === 'parent->sibling') return 'Avuncular'; // Uncle/Aunt

    // Niece/Nephew = Sibling -> Child
    if (p === 'sibling->child') return 'Niece/Nephew';

    // Cousin = Parent -> Sibling -> Child
    if (p === 'parent->sibling->child') return 'Cousin';

    // --- IN-LAWS ---
    if (p === 'spouse') return 'Spouse';

    // Spouse's Family
    if (p === 'spouse->parent') return 'Parent-in-law';
    if (p === 'spouse->sibling') return 'Sibling-in-law';

    // Family's Spouses
    if (p === 'child->spouse') return 'Child-in-law';
    if (p === 'sibling->spouse') return 'Sibling-in-law'; // Brother-in-law

    // --- COMPLEX IN-LAWS (The "Wheel" Solver) ---

    // "Granddaughter's Husband" -> Child -> Child -> Spouse
    if (p === 'child->child->spouse') return 'Grandchild-in-law';

    // "Grandson-in-law's Mother" -> Child -> Child -> Spouse -> Parent
    if (p === 'child->child->spouse->parent') return "Grandchild-in-law's Parent";

    // "Co-In-Law" (Consuegro) -> Child -> Spouse -> Parent
    // My Child -> Their Spouse -> Those Parents
    if (p === 'child->spouse->parent') return 'Co-Parent-in-law';

    return null; // Too complex or unknown path
};
