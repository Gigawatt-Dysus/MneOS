export const treeStyles = `
    .tw-node {
        transition: all 0.3s ease;
    }
    .tw-node:hover {
        stroke: rgba(139, 92, 246, 0.5);
        stroke-width: 2px;
    }
    .glass-card {
        fill: rgba(30, 41, 59, 0.95); /* [ZEN] Increased opacity */
        stroke: rgba(255, 255, 255, 0.1);
        stroke-width: 1px;
    }
    .tw-connector {
        fill: none;
        stroke: #475569;
        stroke-width: 2px;
        transition: all 0.5s ease;
    }
    .tw-link-electric {
        stroke: #a855f7; /* Violet */
        stroke-width: 2px;
        filter: drop-shadow(0 0 3px rgba(168, 85, 247, 0.6));
        animation: pulse-line 3s infinite alternate;
    }
    @keyframes pulse-line {
        0% { stroke-opacity: 0.6; stroke: #a855f7; }
        100% { stroke-opacity: 1; stroke: #d8b4fe; }
    }
    .tw-text {
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        fill: #e2e8f0;
        font-weight: 500;
    }
    .tw-text-sub { font-family: monospace; }
    .tw-edit-btn:hover circle { fill: rgba(139, 92, 246, 0.8); stroke: rgba(255,255,255,0.8); cursor: pointer; }
    .tw-node-group:hover .tw-edit-btn { opacity: 1 !important; }
`;
