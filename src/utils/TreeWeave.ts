import * as d3Hierarchy from 'd3-hierarchy';
import * as d3Shape from 'd3-shape';

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

export interface TreeWeaveNode {
    id: string;
    label: string;
    meta?: Record<string, any>;
    children?: TreeWeaveNode[];
}

export interface TreeWeaveOptions {
    nodeWidth: number;
    nodeHeight: number;
    levelGap: number;
    siblingGap: number;
    direction?: 'vertical' | 'horizontal'; // V1: Vertical only
    centerRoot?: boolean;
    connectors?: 'curve' | 'step';
    onEdit?: (id: string) => void; // [ZEN] Callback for Edit Action
}

export interface TreeWeaveConfig {
    data: TreeWeaveNode;       // Descendants Tree
    ancestorData?: TreeWeaveNode; // Ancestors Tree (Optional, for Hourglass)
    options: TreeWeaveOptions;
}

// ----------------------------------------------------------------------
// TreeWeave Engine
// ----------------------------------------------------------------------

export class TreeWeave {
    private config: TreeWeaveConfig;

    constructor(config: TreeWeaveConfig) {
        const defaults = {
            nodeWidth: 320, // [ZEN] Increased to 320px for long names
            nodeHeight: 90,
            levelGap: 120,
            siblingGap: 100, // [ZEN] Increased to 100px to prevent overlap
            direction: 'vertical' as const,
            centerRoot: true,
            connectors: 'curve' as const
        };

        this.config = {
            ...config,
            options: {
                ...defaults,
                onEdit: (id: string) => {
                    const event = new CustomEvent('tree-node-edit', { detail: { id } });
                    window.dispatchEvent(event);
                },
                ...config.options
            }
        };
    }

    /**
     * Renders the tree to an SVG Element
     */
    render(): SVGSVGElement {
        const { nodeWidth, nodeHeight, levelGap, siblingGap } = this.config.options;
        const opts = this.config.options;

        // ------------------------------------------------------------------
        // 1. Calculate Layouts
        // ------------------------------------------------------------------

        // Helper to layout a hierarchy
        const calculateLayout = (rootData: TreeWeaveNode, invert: boolean = false) => {
            const root = d3Hierarchy.hierarchy(rootData);
            const treeLayout = d3Hierarchy.tree()
                .nodeSize([nodeWidth + siblingGap, levelGap + nodeHeight]);

            treeLayout(root);


            // Adjust coordinates
            // D3 Tree centers root at (0,0).
            // x = horizontal, y = vertical (depth)

            let minX = Infinity, maxX = -Infinity;
            let minY = Infinity, maxY = -Infinity;

            root.each((node: any) => {
                // Invert Y for ancestors
                if (invert) node.y = -node.y;

                minX = Math.min(minX, node.x);
                maxX = Math.max(maxX, node.x);
                minY = Math.min(minY, node.y);
                maxY = Math.max(maxY, node.y);
            });

            return { root, bounds: { minX, maxX, minY, maxY } };
        };

        // Descendants Layout
        const descLayout = calculateLayout(this.config.data, false);

        // Ancestors Layout (Root = Parent)
        // We execute this as a NORMAL tree (Root -> Children), so invert=false.
        // The Alignment Logic below will shift it UP so the "Center" child aligns with (0,0).
        let ancLayout = null;
        if (this.config.ancestorData) {
            ancLayout = calculateLayout(this.config.ancestorData, false);

            // [ZEN] ALIGNMENT LOGIC
            // We need to shift the entire Ancestor Tree so that the "Center Person" node 
            // within it aligns exactly with the Descendant Tree's root (0,0).
            // This allows Siblings (who are children of the Ancestor Root) to sit at Depth 0 correctly.

            // 1. Find the Anchor Node in the Ancestor Layout
            let anchorNode: any = null;
            ancLayout.root.each((node: any) => {
                if (node.data.id === this.config.data.id) { // Match IDs
                    anchorNode = node;
                }
            });

            if (anchorNode) {
                // 2. Calculate Offset (Anchor should be at 0,0)
                const offsetX = -anchorNode.x;
                const offsetY = -anchorNode.y;

                // 3. Apply Offset to ALL nodes in Ancestor Tree
                ancLayout.root.each((node: any) => {
                    node.x += offsetX;
                    node.y += offsetY;
                });

                // Recalculate Bounds after shift
                let minX = Infinity, maxX = -Infinity;
                let minY = Infinity, maxY = -Infinity;
                ancLayout.root.each((node: any) => {
                    minX = Math.min(minX, node.x);
                    maxX = Math.max(maxX, node.x);
                    minY = Math.min(minY, node.y);
                    maxY = Math.max(maxY, node.y);
                });
                ancLayout.bounds = { minX, maxX, minY, maxY };
            }
        }

        // ------------------------------------------------------------------
        // 2. Combine & Center
        // ------------------------------------------------------------------

        // Calculate total bounding box including both trees
        let totalMinX = descLayout.bounds.minX;
        let totalMaxX = descLayout.bounds.maxX;
        let totalMinY = descLayout.bounds.minY;
        let totalMaxY = descLayout.bounds.maxY;

        if (ancLayout) {
            totalMinX = Math.min(totalMinX, ancLayout.bounds.minX);
            totalMaxX = Math.max(totalMaxX, ancLayout.bounds.maxX);
            totalMinY = Math.min(totalMinY, ancLayout.bounds.minY);
            totalMaxY = Math.max(totalMaxY, ancLayout.bounds.maxY);
        }

        // Add padding
        const PADDING = 100;
        const width = (totalMaxX - totalMinX) + nodeWidth + (PADDING * 2);
        const height = (totalMaxY - totalMinY) + nodeHeight + (PADDING * 2);

        // Center Offset: The Root is at (0,0). ViewBox handles the shift.
        // ViewBox = min_x min_y width height
        // We add padding to min values.
        const viewBox = `${totalMinX - PADDING - nodeWidth / 2} ${totalMinY - PADDING - nodeHeight / 2} ${width} ${height}`;


        // ------------------------------------------------------------------
        // 3. Render SVG
        // ------------------------------------------------------------------

        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100%");
        svg.setAttribute("viewBox", viewBox);
        svg.style.fontFamily = "system-ui, sans-serif";
        svg.style.overflow = "visible";

        const gContainer = document.createElementNS(svgNS, "g");
        svg.appendChild(gContainer);

        const defs = document.createElementNS(svgNS, "defs");

        // [ZEN] Drop Shadow Filter
        const filter = document.createElementNS(svgNS, "filter");
        filter.setAttribute("id", "nodeShadow");
        filter.setAttribute("x", "-50%");
        filter.setAttribute("y", "-50%");
        filter.setAttribute("width", "200%");
        filter.setAttribute("height", "200%");

        const feDropShadow = document.createElementNS(svgNS, "feDropShadow");
        feDropShadow.setAttribute("dx", "4");
        feDropShadow.setAttribute("dy", "4");
        feDropShadow.setAttribute("stdDeviation", "6");
        feDropShadow.setAttribute("flood-color", "#000");
        feDropShadow.setAttribute("flood-opacity", "0.4");

        filter.appendChild(feDropShadow);
        defs.appendChild(filter);
        svg.appendChild(defs);

        // --- GRANDCHILDREN (Lineal Descendants 2-3) ---

        // Common Render Function
        const renderTree = (layout: any, isAncestor: boolean) => {
            const links = layout.root.links();
            const nodes = layout.root.descendants();

            const nodesToRender = isAncestor
                ? nodes.filter((n: any) => n.data.id !== this.config.data.id)
                : nodes;

            const linksToRender = links;

            // -- Links --
            linksToRender.forEach((link: any) => {
                const path = document.createElementNS(svgNS, "path");

                // [ZEN] Electric Link Logic
                // If BOTH source and target are ALIVE (no DOD), connection is electric.
                const sDod = link.source.data.meta?.dod;
                const tDod = link.target.data.meta?.dod;
                const isAlive = !sDod && !tDod;

                path.setAttribute("class", isAlive ? "tw-connector tw-link-electric" : "tw-connector");

                const sx = link.source.x;
                const sy = link.source.y;
                const tx = link.target.x;
                const ty = link.target.y;

                let d = "";
                if (opts.connectors === 'step') {
                    d = `M${sx},${sy} V${(sy + ty) / 2} H${tx} V${ty}`;
                } else {
                    const cy = (sy + ty) / 2;
                    d = `M${sx},${sy} C${sx},${cy} ${tx},${cy} ${tx},${ty}`;
                }

                path.setAttribute("d", d);
                gContainer.appendChild(path);
            });

            // -- Nodes --
            nodesToRender.forEach((node: any) => {
                const g = document.createElementNS(svgNS, "g");
                g.setAttribute("class", "tw-node-group");
                g.setAttribute("transform", `translate(${node.x}, ${node.y - nodeHeight / 2})`);
                g.setAttribute("data-id", node.data.id);
                g.style.cursor = "pointer";

                const spouse = node.data.meta?.spouse;
                const isCouple = !!spouse;
                const totalW = isCouple ? nodeWidth * 1.8 : nodeWidth;
                const renderX = -totalW / 2;

                // Card Rect (Glassmorphism)
                const rect = document.createElementNS(svgNS, "rect");
                rect.setAttribute("class", "tw-node glass-card"); // [ZEN] Added glass class
                rect.setAttribute("x", renderX.toString());
                rect.setAttribute("y", "0");
                rect.setAttribute("width", totalW.toString());
                rect.setAttribute("height", nodeHeight.toString());
                rect.setAttribute("rx", "12");
                rect.style.filter = "url(#nodeShadow)"; // [ZEN] Apply shadow
                g.appendChild(rect);

                const pBaseX = renderX;

                // --- Primary Person ---
                const avatarSize = nodeHeight - 16;
                const avGroup = document.createElementNS(svgNS, "g");
                avGroup.setAttribute("transform", `translate(${pBaseX + 8}, 8)`);

                const clipId = `clip-${Math.random().toString(36).substr(2, 9)}`;
                const clipPath = document.createElementNS(svgNS, "clipPath");
                clipPath.setAttribute("id", clipId);
                const clipCircle = document.createElementNS(svgNS, "circle");
                clipCircle.setAttribute("cx", (avatarSize / 2).toString());
                clipCircle.setAttribute("cy", (avatarSize / 2).toString());
                clipCircle.setAttribute("r", (avatarSize / 2).toString());
                clipPath.appendChild(clipCircle);
                defs.appendChild(clipPath);

                if (node.data.meta?.photo) {
                    const img = document.createElementNS(svgNS, "image");
                    img.setAttribute("href", node.data.meta.photo);
                    img.setAttribute("width", avatarSize.toString());
                    img.setAttribute("height", avatarSize.toString());
                    img.setAttribute("clip-path", `url(#${clipId})`);
                    img.setAttribute("preserveAspectRatio", "xMidYMid slice");
                    avGroup.appendChild(img);
                } else {
                    const circle = document.createElementNS(svgNS, "circle");
                    circle.setAttribute("cx", (avatarSize / 2).toString());
                    circle.setAttribute("cy", (avatarSize / 2).toString());
                    circle.setAttribute("r", (avatarSize / 2).toString());
                    circle.setAttribute("fill", "#334155");
                    avGroup.appendChild(circle);

                    const txt = document.createElementNS(svgNS, "text");
                    txt.textContent = (node.data.label || "?").charAt(0).toUpperCase();
                    txt.setAttribute("x", (avatarSize / 2).toString());
                    txt.setAttribute("y", (avatarSize / 2 + 5).toString());
                    txt.setAttribute("text-anchor", "middle");
                    txt.setAttribute("fill", "white");
                    txt.style.fontSize = "16px";
                    txt.style.fontWeight = "bold";
                    avGroup.appendChild(txt);
                }
                g.appendChild(avGroup);

                // [ZEN] Primary Label (Wrapper)
                const parts = (node.data.label || "Unknown").split(' ');
                let line1 = parts[0], line2 = '';
                if (parts.length > 1) {
                    line2 = parts.pop() || '';
                    line1 = parts.join(' ');
                } else {
                    line1 = node.data.label || "Unknown";
                }

                const labelGroup = document.createElementNS(svgNS, "text");
                labelGroup.setAttribute("class", "tw-text");
                labelGroup.setAttribute("x", (pBaseX + avatarSize + 20).toString());
                labelGroup.setAttribute("y", (nodeHeight / 2 - 12).toString());

                const tspan1 = document.createElementNS(svgNS, "tspan");
                tspan1.textContent = line1;
                tspan1.setAttribute("x", (pBaseX + avatarSize + 20).toString());
                tspan1.style.fontWeight = "bold";
                tspan1.style.fontSize = "14px";
                tspan1.style.fill = "white"; // Ensure white
                labelGroup.appendChild(tspan1);

                if (line2) {
                    const tspan2 = document.createElementNS(svgNS, "tspan");
                    tspan2.textContent = line2;
                    tspan2.setAttribute("x", (pBaseX + avatarSize + 20).toString());
                    tspan2.setAttribute("dy", "1.2em");
                    tspan2.style.fontWeight = "bold";
                    tspan2.style.fontSize = "14px";
                    tspan2.style.fill = "white";
                    labelGroup.appendChild(tspan2);
                }
                g.appendChild(labelGroup);

                // [ZEN] Date & Relationship
                const metaGroup = document.createElementNS(svgNS, "text");
                metaGroup.setAttribute("x", (pBaseX + avatarSize + 20).toString());
                // Calculate Y based on whether we had 2 lines of text
                const metaBaseY = line2 ? (nodeHeight / 2 + 24) : (nodeHeight / 2 + 10);
                metaGroup.setAttribute("y", metaBaseY.toString());
                metaGroup.setAttribute("class", "tw-text-sub");

                // Date Range
                let dateStr = "";
                const getYear = (d: any) => {
                    if (!d) return null;
                    if (typeof d === 'object' && d.seconds) return new Date(d.seconds * 1000).getFullYear();
                    return new Date(d).getFullYear();
                };
                const bYear = getYear(node.data.meta?.dob);
                const dYear = getYear(node.data.meta?.dod);

                if (bYear) {
                    dateStr = `${bYear} - ${dYear || 'Present'}`; // User requested "Present"
                }

                if (dateStr) {
                    const tspanDate = document.createElementNS(svgNS, "tspan");
                    tspanDate.textContent = dateStr;
                    tspanDate.setAttribute("x", (pBaseX + avatarSize + 20).toString());
                    tspanDate.style.fill = "#94a3b8"; // Slate-400
                    tspanDate.style.fontSize = "10px";
                    tspanDate.style.fontWeight = "bold"; // User screenshot looks boldish
                    tspanDate.style.letterSpacing = "0.5px";
                    metaGroup.appendChild(tspanDate);
                }

                // Relationship (Next Line)
                if (node.data.meta?.relationshipToUser) {
                    const tspanRel = document.createElementNS(svgNS, "tspan");
                    tspanRel.textContent = node.data.meta.relationshipToUser.toUpperCase();
                    tspanRel.setAttribute("x", (pBaseX + avatarSize + 20).toString());
                    tspanRel.setAttribute("dy", dateStr ? "1.4em" : "0");
                    tspanRel.style.fill = "#a78bfa"; // Violet-400
                    tspanRel.style.fontSize = "9px";
                    tspanRel.style.fontWeight = "bold";
                    tspanRel.style.letterSpacing = "1px";
                    metaGroup.appendChild(tspanRel);
                }
                g.appendChild(metaGroup);

                // Edit Button (Top Right Absolute)
                const editGroup = document.createElementNS(svgNS, "g");
                editGroup.setAttribute("class", "tw-edit-btn");
                editGroup.setAttribute("transform", `translate(${pBaseX + totalW - 40}, 14)`); // [ZEN] Moved further inward (40px)
                editGroup.style.opacity = "0";
                editGroup.style.transition = "opacity 0.2s";
                editGroup.addEventListener("click", (e) => {
                    e.stopPropagation();
                    if (this.config.options.onEdit) this.config.options.onEdit(node.data.id);
                });
                const editCircle = document.createElementNS(svgNS, "circle");
                editCircle.setAttribute("r", "10");
                editCircle.setAttribute("cx", "10");
                editCircle.setAttribute("cy", "10");
                editCircle.setAttribute("fill", "rgba(255,255,255,0.1)");
                editCircle.setAttribute("stroke", "rgba(255,255,255,0.3)");
                editGroup.appendChild(editCircle);
                const editIcon = document.createElementNS(svgNS, "text");
                editIcon.textContent = "✎";
                editIcon.setAttribute("x", "10");
                editIcon.setAttribute("y", "14");
                editIcon.setAttribute("text-anchor", "middle");
                editIcon.setAttribute("fill", "white");
                editIcon.style.fontSize = "10px";
                editGroup.appendChild(editIcon);
                g.appendChild(editGroup);

                // --- Spouse ---
                if (isCouple) {
                    const line = document.createElementNS(svgNS, "line");
                    line.setAttribute("x1", (renderX + totalW / 2).toString());
                    line.setAttribute("y1", "10");
                    line.setAttribute("x2", (renderX + totalW / 2).toString());
                    line.setAttribute("y2", (nodeHeight - 10).toString());
                    line.setAttribute("stroke", "rgba(255,255,255,0.1)"); // [ZEN] Subtle divider
                    g.appendChild(line);

                    const amp = document.createElementNS(svgNS, "circle");
                    amp.setAttribute("cx", (renderX + totalW / 2).toString());
                    amp.setAttribute("cy", (nodeHeight / 2).toString());
                    amp.setAttribute("r", "12");
                    amp.setAttribute("fill", "#0f172a");
                    amp.setAttribute("stroke", "#334155");
                    g.appendChild(amp);

                    const ampTxt = document.createElementNS(svgNS, "text");
                    ampTxt.textContent = "&";
                    ampTxt.setAttribute("x", (renderX + totalW / 2).toString());
                    ampTxt.setAttribute("y", (nodeHeight / 2 + 4).toString());
                    ampTxt.setAttribute("text-anchor", "middle");
                    ampTxt.setAttribute("fill", "#94a3b8");
                    ampTxt.style.fontSize = "14px";
                    g.appendChild(ampTxt);

                    const sBaseX = renderX + totalW / 2;
                    const sAvGroup = document.createElementNS(svgNS, "g");
                    sAvGroup.setAttribute("transform", `translate(${sBaseX + 8}, 8)`);

                    const sClipId = `clip-s-${Math.random().toString(36).substr(2, 9)}`;
                    const sClipPath = document.createElementNS(svgNS, "clipPath");
                    sClipPath.setAttribute("id", sClipId);
                    const sClipCircle = document.createElementNS(svgNS, "circle");
                    sClipCircle.setAttribute("cx", (avatarSize / 2).toString());
                    sClipCircle.setAttribute("cy", (avatarSize / 2).toString());
                    sClipCircle.setAttribute("r", (avatarSize / 2).toString());
                    sClipPath.appendChild(sClipCircle);
                    defs.appendChild(sClipPath);

                    if (spouse.photo) {
                        const img = document.createElementNS(svgNS, "image");
                        img.setAttribute("href", spouse.photo);
                        img.setAttribute("width", avatarSize.toString());
                        img.setAttribute("height", avatarSize.toString());
                        img.setAttribute("clip-path", `url(#${sClipId})`);
                        img.setAttribute("preserveAspectRatio", "xMidYMid slice");
                        sAvGroup.appendChild(img);
                    } else {
                        const circle = document.createElementNS(svgNS, "circle");
                        circle.setAttribute("cx", (avatarSize / 2).toString());
                        circle.setAttribute("cy", (avatarSize / 2).toString());
                        circle.setAttribute("r", (avatarSize / 2).toString());
                        circle.setAttribute("fill", "#334155");
                        sAvGroup.appendChild(circle);

                        const txt = document.createElementNS(svgNS, "text");
                        txt.textContent = (spouse.name || "?").charAt(0).toUpperCase();
                        txt.setAttribute("x", (avatarSize / 2).toString());
                        txt.setAttribute("y", (avatarSize / 2 + 5).toString());
                        txt.setAttribute("text-anchor", "middle");
                        txt.setAttribute("fill", "white");
                        txt.style.fontSize = "16px";
                        txt.style.fontWeight = "bold";
                        sAvGroup.appendChild(txt);
                    }
                    g.appendChild(sAvGroup);

                    // Spouse Text Logic (Simplified Wrapper)
                    const sParts = (spouse.name || "Unknown").split(' ');
                    let sLine1 = sParts[0], sLine2 = '';
                    if (sParts.length > 1) {
                        sLine2 = sParts.pop() || '';
                        sLine1 = sParts.join(' ');
                    } else {
                        sLine1 = spouse.name || "Unknown";
                    }

                    const sLabelGroup = document.createElementNS(svgNS, "text");
                    sLabelGroup.setAttribute("class", "tw-text");
                    sLabelGroup.setAttribute("x", (sBaseX + avatarSize + 20).toString());
                    sLabelGroup.setAttribute("y", (nodeHeight / 2 - 12).toString());

                    const stspan1 = document.createElementNS(svgNS, "tspan");
                    stspan1.textContent = sLine1;
                    stspan1.setAttribute("x", (sBaseX + avatarSize + 20).toString());
                    stspan1.style.fontWeight = "bold";
                    stspan1.style.fontSize = "14px";
                    stspan1.style.fill = "white";
                    sLabelGroup.appendChild(stspan1);

                    if (sLine2) {
                        const stspan2 = document.createElementNS(svgNS, "tspan");
                        stspan2.textContent = sLine2;
                        stspan2.setAttribute("x", (sBaseX + avatarSize + 20).toString());
                        stspan2.setAttribute("dy", "1.2em");
                        stspan2.style.fontWeight = "bold";
                        stspan2.style.fontSize = "14px";
                        stspan2.style.fill = "white";
                        sLabelGroup.appendChild(stspan2);
                    }
                    g.appendChild(sLabelGroup);

                    // Spouse Dates
                    const sMetaGroup = document.createElementNS(svgNS, "text");
                    sMetaGroup.setAttribute("x", (sBaseX + avatarSize + 20).toString());
                    const sMetaBaseY = sLine2 ? (nodeHeight / 2 + 24) : (nodeHeight / 2 + 10);
                    sMetaGroup.setAttribute("y", sMetaBaseY.toString());
                    sMetaGroup.setAttribute("class", "tw-text-sub");

                    const getSYear = (d: any) => {
                        if (!d) return null;
                        if (typeof d === 'object' && d.seconds) return new Date(d.seconds * 1000).getFullYear();
                        return new Date(d).getFullYear();
                    };
                    const sBYear = getSYear(spouse.dob);
                    const sDYear = getSYear(spouse.dod);

                    if (sBYear) {
                        const sTspanDate = document.createElementNS(svgNS, "tspan");
                        sTspanDate.textContent = `${sBYear} - ${sDYear || 'Present'}`;
                        sTspanDate.setAttribute("x", (sBaseX + avatarSize + 20).toString());
                        sTspanDate.style.fill = "#94a3b8";
                        sTspanDate.style.fontSize = "10px";
                        sTspanDate.style.fontWeight = "bold";
                        sMetaGroup.appendChild(sTspanDate);
                    }
                    g.appendChild(sMetaGroup);
                }

                gContainer.appendChild(g);
            });
        };

        renderTree(descLayout, false);
        if (ancLayout) {
            renderTree(ancLayout, true);
        }

        return svg;
    }
}
