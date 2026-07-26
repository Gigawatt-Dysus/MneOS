import { Tag, PersonTag, PersonRelationship } from '../types';
import { getInverseRelationship } from './relationshipHeuristics';
import { normalizeRole as normalize, isRoleCompatible } from './gedcomRoles';

export interface RelationshipFix {
    id: string; // ID of the person who needs the fix (The "Subject")
    targetName: string; // Name of the person they are related to (The "Object")
    targetId: string;
    missingType: string; // The relationship type that is MISSING on the Subject
    reasoning: string;
    confidence: number; // 0-1
}

/**
 * Analyzes the entire tag database to find missing reciprocal relationships.
 * Returns a list of proposed fixes.
 */
export const findMissingRelationships = (allTags: Tag[]): RelationshipFix[] => {
    const personTags = allTags.filter(t => t.type === 'person') as PersonTag[];
    const tagMap = new Map(personTags.map(t => [t.id, t]));
    const fixes: RelationshipFix[] = [];

    personTags.forEach(subject => {
        const subRels = subject.metadata.relationships || [];

        // 1. Check My Explicit Relationships -> Do they link back?
        subRels.forEach(rel => {
            const target = tagMap.get(rel.relatedPersonId);
            if (!target) return; // Target deleted?

            // [ZEN] Validation: Does the connection imply the wrong gender for the target?
            const targetGender = target.metadata?.gender?.toLowerCase() || 'unknown';
            const typeImpliesFemale = ['mother', 'sister', 'aunt', 'wife', 'grandmother', 'niece', 'daughter', 'girlfriend'].some(k => rel.type.toLowerCase().includes(k));
            const typeImpliesMale = ['father', 'brother', 'uncle', 'husband', 'grandfather', 'nephew', 'son', 'boyfriend'].some(k => rel.type.toLowerCase().includes(k));

            if (targetGender === 'male' && typeImpliesFemale) return; // Skip Illogical Link
            if (targetGender === 'female' && typeImpliesMale) return; // Skip Illogical Link

            // What *should* the target say about me?
            const inverseType = getInverseRelationship(rel.type, subject.metadata.gender || 'unknown');
            if (!inverseType) return; // Unknown inverse

            // Does target have it?
            const targetRels = target.metadata.relationships || [];
            const hasInverse = targetRels.some(r =>
                r.relatedPersonId === subject.id &&
                (
                    normalize(r.type) === normalize(inverseType) ||
                    isRoleCompatible(inverseType, r.type) ||
                    isRoleCompatible(r.type, inverseType)
                )
            );

            if (!hasInverse) {
                // SUGGEST FIX FOR TARGET
                fixes.push({
                    id: target.id,
                    targetName: subject.name,
                    targetId: subject.id,
                    missingType: inverseType,
                    reasoning: `${subject.name} lists ${target.name} as "${rel.type}". reciprocity requires ${target.name} list ${subject.name} as "${inverseType}".`,
                    confidence: 0.95
                });
            }
        });
    });

    // Deduplicate Fixes (by unique key of SubjectID + TargetID + Type)
    const uniqueFixes = new Map<string, RelationshipFix>();
    fixes.forEach(f => {
        const key = `${f.id}-${f.targetId}-${f.missingType}`;
        if (!uniqueFixes.has(key)) {
            uniqueFixes.set(key, f);
        }
    });

    return Array.from(uniqueFixes.values());
};


