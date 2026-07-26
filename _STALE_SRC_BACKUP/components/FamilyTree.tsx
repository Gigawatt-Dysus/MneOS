import React, { useMemo } from 'react';
import type { Tag, PersonTag } from '@/types';

interface FamilyTreeProps {
    centerTag: PersonTag;
    allTags: Tag[];
    onNavigateToTag: (tag: Tag) => void;
}

interface TreeNode {
    id: string;
    name: string;
    avatarUrl?: string;
    role: string;
    tag?: Tag;
}

const NODE_RADIUS = 30;
const VERTICAL_SPACING = 100;
const HORIZONTAL_SPACING = 80;

const AvatarNode: React.FC<{ x: number; y: number; node: TreeNode; onClick: () => void; isCenter?: boolean }> = ({ x, y, node, onClick, isCenter }) => {
    const initials = node.name.slice(0, 2).toUpperCase();
    
    return (
        <g transform={`translate(${x}, ${y})`} onClick={onClick} className="cursor-pointer group">
            <circle 
                r={NODE_RADIUS} 
                fill={isCenter ? "#8b5cf6" : "#ffffff"} 
                stroke={isCenter ? "#ffffff" : "#cbd5e1"} 
                strokeWidth="3"
                className="transition-colors duration-200 group-hover:stroke-violet-400 dark:fill-gray-800 dark:stroke-gray-600"
            />
            <text textAnchor="middle" dy=".3em" fill={isCenter ? "white" : "#64748b"} fontSize="14" fontWeight="bold">{initials}</text>
            
            <text y={NODE_RADIUS + 15} textAnchor="middle" className="text-[10px] fill-gray-700 dark:fill-gray-300 font-semibold" fontSize="10">
                {node.name}
            </text>
            <text y={NODE_RADIUS + 25} textAnchor="middle" className="text-[8px] fill-gray-500 dark:fill-gray-400 italic" fontSize="8">
                {node.role}
            </text>
        </g>
    );
};

const FamilyTree: React.FC<FamilyTreeProps> = ({ centerTag, allTags, onNavigateToTag }) => {
    
    const { parents, children, partners, centerNode } = useMemo(() => {
        const rels = centerTag.metadata.relationships || [];
        const tagMap = new Map<string, Tag>();
        allTags.forEach(t => tagMap.set(t.id, t));

        const parents: TreeNode[] = [];
        const children: TreeNode[] = [];
        const partners: TreeNode[] = [];

        rels.forEach(rel => {
            const relatedTag = tagMap.get(rel.relatedPersonId);
            const name = relatedTag ? relatedTag.name : "Unknown";
            const type = rel.type.toLowerCase();
            
            const node: TreeNode = {
                id: rel.relatedPersonId,
                name,
                role: rel.type,
                tag: relatedTag
            };

            if (['mother', 'father', 'parent', 'step-mother', 'step-father'].some(k => type.includes(k))) {
                parents.push(node);
            } else if (['son', 'daughter', 'child'].some(k => type.includes(k))) {
                children.push(node);
            } else if (['wife', 'husband', 'spouse', 'partner', 'fiancé'].some(k => type.includes(k))) {
                partners.push(node);
            }
        });

        return {
            centerNode: { id: centerTag.id, name: centerTag.name, role: "Self", tag: centerTag },
            parents,
            children,
            partners
        };
    }, [centerTag, allTags]);

    const width = 600;
    const height = 400;
    const centerX = width / 2;
    const centerY = height / 2;

    const parentNodes = parents.map((p, i) => ({
        ...p,
        x: centerX + (i - (parents.length - 1) / 2) * HORIZONTAL_SPACING,
        y: centerY - VERTICAL_SPACING
    }));

    const partnerNodes = partners.map((p, i) => {
        const side = i % 2 === 0 ? 1 : -1; 
        const offset = Math.ceil((i + 1) / 2) * HORIZONTAL_SPACING * 1.2;
        return {
            ...p,
            x: centerX + (side * offset),
            y: centerY
        };
    });

    const childNodes = children.map((c, i) => ({
        ...c,
        x: centerX + (i - (children.length - 1) / 2) * HORIZONTAL_SPACING,
        y: centerY + VERTICAL_SPACING
    }));

    const drawConnection = (x1: number, y1: number, x2: number, y2: number) => (
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#cbd5e1" strokeWidth="2" />
    );

    if (parents.length === 0 && children.length === 0 && partners.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                <p>No family connections found.</p>
                <p className="text-sm">Add relationships in the 'Details' tab to build the tree.</p>
            </div>
        );
    }

    return (
        <div className="w-full overflow-x-auto bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <svg width={width} height={height} className="mx-auto block">
                {parentNodes.map((p, i) => <g key={`link-p-${i}`}>{drawConnection(p.x, p.y + NODE_RADIUS, centerX, centerY - NODE_RADIUS)}</g>)}
                {partnerNodes.map((p, i) => <g key={`link-part-${i}`}>{drawConnection(centerX, centerY, p.x, p.y)}</g>)}
                {childNodes.map((c, i) => <g key={`link-c-${i}`}>{drawConnection(centerX, centerY + NODE_RADIUS, c.x, c.y - NODE_RADIUS)}</g>)}

                {parentNodes.map((node, i) => (
                    <AvatarNode key={`p-${i}`} x={node.x} y={node.y} node={node} onClick={() => node.tag && onNavigateToTag(node.tag)} />
                ))}
                {partnerNodes.map((node, i) => (
                    <AvatarNode key={`part-${i}`} x={node.x} y={node.y} node={node} onClick={() => node.tag && onNavigateToTag(node.tag)} />
                ))}
                {childNodes.map((node, i) => (
                    <AvatarNode key={`c-${i}`} x={node.x} y={node.y} node={node} onClick={() => node.tag && onNavigateToTag(node.tag)} />
                ))}
                <AvatarNode x={centerX} y={centerY} node={centerNode} isCenter onClick={() => {}} />
            </svg>
        </div>
    );
};

export default FamilyTree;