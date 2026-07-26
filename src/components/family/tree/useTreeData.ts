import { useMemo } from 'react';
import type { Tag, PersonTag, Media } from '../../../types';
import { TreeWeaveNode } from '../../../utils/TreeWeave';

// Helper to resolve avatar
const getAvatarUrl = (tag: Tag | undefined, media: Media[]): string | undefined => {
    if (!tag || !media) return undefined;
    if (tag.mainImageId) {
        const found = media.find(m => m.id === tag.mainImageId);
        if (found) return found.thumbnailUrl || found.url;
    }
    const related = media.find(m => m.tagIds && m.tagIds.includes(tag.id) && m.fileType.startsWith('image/'));
    return related?.thumbnailUrl || related?.url;
};

export const useTreeData = (centerTag: PersonTag, allTags: Tag[], allMedia: Media[], userPersonTagId?: string) => {
    return useMemo(() => {
        const tagMap = new Map<string, PersonTag>();
        allTags.forEach(t => {
            if (t.type === 'person') tagMap.set(t.id, t as PersonTag);
        });

        // [ZEN] Helper for Relationship Labels
        const getRelationshipToUser = (p: PersonTag) => {
            if (!userPersonTagId) return undefined;
            if (p.id === userPersonTagId) return "You";
            const rel = p.metadata.relationships?.find(r => r.relatedPersonId === userPersonTagId);
            return rel ? rel.type : undefined;
        };

        const visitedDesc = new Set<string>();
        const visitedAnc = new Set<string>();

        // [ZEN] Helper to find spouse (Bidirectional)
        const getSpouse = (p: PersonTag): PersonTag | undefined => {
            // 1. Check if P lists a spouse
            const partnerRel = (p.metadata.relationships || [])
                .find(r => ['husband', 'wife', 'spouse', 'partner'].includes(r.type.toLowerCase()));
            if (partnerRel) return tagMap.get(partnerRel.relatedPersonId);

            // 2. Check if ANYONE lists P as spouse
            for (const other of Array.from(tagMap.values())) {
                const incomingRel = (other.metadata.relationships || [])
                    .find(r =>
                        ['husband', 'wife', 'spouse', 'partner'].includes(r.type.toLowerCase()) &&
                        r.relatedPersonId === p.id
                    );
                if (incomingRel) return other;
            }

            return undefined;
        };

        // 1. Descendant Builder (Children)
        const buildDescendants = (personId: string, depth: number = 0): TreeWeaveNode | undefined => {
            if (visitedDesc.has(personId) || depth > 8) return undefined;
            visitedDesc.add(personId);

            const person = tagMap.get(personId);
            if (!person) return undefined;

            // [ZEN] Robust Child Finder
            const explicitChildren = (person.metadata.relationships || [])
                .filter(r => ['son', 'daughter', 'child'].includes(r.type.toLowerCase()))
                .map(r => r.relatedPersonId);

            const implicitChildren: string[] = [];
            allTags.forEach(t => {
                if (t.type === 'person' && t.id !== personId) {
                    const pt = t as PersonTag;
                    const parents = (pt.metadata.relationships || []).filter(r =>
                        ['father', 'mother', 'parent', 'dad', 'mom'].includes(r.type.toLowerCase()) &&
                        r.relatedPersonId === personId
                    );
                    if (parents.length > 0) {
                        implicitChildren.push(t.id);
                    }
                }
            });

            const allChildIds = Array.from(new Set([...explicitChildren, ...implicitChildren]));

            const childrenNodes: TreeWeaveNode[] = [];
            allChildIds.forEach(childId => {
                if (!visitedAnc.has(childId)) {
                    const childNode = buildDescendants(childId, depth + 1);
                    if (childNode) childrenNodes.push(childNode);
                }
            });

            // Sort by birth year
            childrenNodes.sort((a, b) => {
                const dA = a.meta?.dob ? new Date((a.meta.dob as any).seconds ? (a.meta.dob as any).seconds * 1000 : a.meta.dob).getTime() : 0;
                const dB = b.meta?.dob ? new Date((b.meta.dob as any).seconds ? (b.meta.dob as any).seconds * 1000 : b.meta.dob).getTime() : 0;
                return dA - dB;
            });

            const spouse = getSpouse(person);

            return {
                id: person.id,
                label: person.name,
                meta: {
                    gender: person.metadata.gender || 'unknown',
                    photo: getAvatarUrl(person, allMedia),
                    dob: person.metadata.dates?.birth || (person.metadata as any).birthYear, // [ZEN] Fallback
                    dod: person.metadata.dates?.death,
                    relationshipToUser: getRelationshipToUser(person),
                    tag: person,
                    spouse: spouse ? {
                        name: spouse.name,
                        photo: getAvatarUrl(spouse, allMedia),
                        dob: spouse.metadata.dates?.birth,
                        dod: spouse.metadata.dates?.death
                    } : undefined
                },
                children: childrenNodes.length > 0 ? childrenNodes : undefined
            };
        };

        // 2. Ancestor Builder
        const buildAncestors = (): TreeWeaveNode | undefined => {
            const center = tagMap.get(centerTag.id);
            if (!center) return undefined;

            const getParents = (t: PersonTag) => (t.metadata.relationships || [])
                .filter(r => ['father', 'mother', 'parent'].includes(r.type.toLowerCase()))
                .map(r => tagMap.get(r.relatedPersonId))
                .filter(Boolean) as PersonTag[];

            let root = center;
            let levelsUp = 0;
            while (levelsUp < 2) {
                const parents = getParents(root);
                if (parents.length === 0) break;
                root = parents[0];
                levelsUp++;
            }

            const buildDown = (p: PersonTag, depth: number): TreeWeaveNode => {
                let childrenNodes: TreeWeaveNode[] = [];

                if (p.id !== centerTag.id && depth < 5) {
                    const children = (p.metadata.relationships || [])
                        .filter(r => ['son', 'daughter', 'child'].includes(r.type.toLowerCase()))
                        .map(r => tagMap.get(r.relatedPersonId))
                        .filter(Boolean) as PersonTag[];

                    childrenNodes = children.map(c => buildDown(c, depth + 1));
                }

                const spouse = getSpouse(p);

                return {
                    id: p.id,
                    label: p.name,
                    meta: {
                        photo: getAvatarUrl(p, allMedia),
                        dob: p.metadata.dates?.birth,
                        dod: p.metadata.dates?.death,
                        relationshipToUser: getRelationshipToUser(p),
                        tag: p,
                        spouse: spouse ? {
                            name: spouse.name,
                            photo: getAvatarUrl(spouse, allMedia),
                            dob: spouse.metadata.dates?.birth,
                            dod: spouse.metadata.dates?.death
                        } : undefined
                    },
                    children: childrenNodes.length > 0 ? childrenNodes : undefined
                };
            };

            if (root.id === center.id) return undefined;
            return buildDown(root, 0);
        };

        return {
            descData: buildDescendants(centerTag.id),
            ancData: buildAncestors()
        };
    }, [centerTag, allTags, allMedia, userPersonTagId]);
};
