import { useEffect, useRef } from 'react';
import { TreeWeave, TreeWeaveNode } from '../../../utils/TreeWeave';
import { treeStyles } from './treeStyles';
import type { Tag } from '../../../types';

export const useTreeRenderer = (
    descData: TreeWeaveNode | undefined,
    ancData: TreeWeaveNode | undefined,
    allTags: Tag[],
    onNodeClick: (tag: Tag) => void
) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (containerRef.current && descData) {
            containerRef.current.innerHTML = ''; // Clear previous

            if (typeof TreeWeave === 'undefined') {
                console.error("TreeWeave not loaded");
                return;
            }

            const tree = new TreeWeave({
                data: descData,      // Bottom Tree
                ancestorData: ancData, // Top Tree
                options: {
                    nodeWidth: 320,
                    nodeHeight: 120,
                    levelGap: 100,
                    siblingGap: 120, // [ZEN] FIXED: 120px to prevent overlap
                    direction: 'vertical',
                    centerRoot: true,
                    connectors: 'curve',
                }
            });

            const svg = tree.render();
            if (svg) {
                containerRef.current.appendChild(svg);

                // Interaction Bindings
                const nodes = containerRef.current.querySelectorAll('.tw-node-group');
                nodes.forEach((node) => {
                    node.addEventListener('click', (e) => {
                        const id = node.getAttribute('data-id');
                        if (id) {
                            const tag = allTags.find(t => t.id === id);
                            if (tag) onNodeClick(tag);
                        }
                    });
                });
            }

            // Inject Styles
            const style = document.createElement('style');
            style.textContent = treeStyles;
            containerRef.current.appendChild(style);
        }
    }, [descData, ancData, allTags, onNodeClick]);

    return containerRef;
};
