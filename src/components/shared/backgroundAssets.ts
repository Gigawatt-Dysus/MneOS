export interface BackgroundPreset {
    id: string;
    name: string;
    type: 'preset' | 'matrix';
    value: string; // The CSS background property or identifier
    description: string;
}

export const WALLPAPER_PRESETS: BackgroundPreset[] = [
    {
        id: 'the-matrix',
        name: 'The Matrix',
        type: 'matrix',
        value: 'matrix',
        description: 'Live interactive media artifact matrix'
    },
    {
        id: 'midnight-void',
        name: 'Midnight Void',
        type: 'preset',
        value: 'linear-gradient(to bottom, #000000, #0f172a)',
        description: 'Deep space darkness'
    },
    {
        id: 'neuromancer-grid',
        name: 'Neuromancer',
        type: 'preset',
        value: `
            linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px),
            radial-gradient(circle at center, #0f172a 0%, #000000 100%)
        `,
        description: 'Retro-futurist neon grid'
    },
    {
        id: 'blueprint-tech',
        name: 'Blueprint',
        type: 'preset',
        value: `
            radial-gradient(#3b82f6 1px, transparent 1px),
            radial-gradient(#3b82f6 1px, transparent 1px),
            linear-gradient(#0f172a, #0f172a)
        `,
        description: 'Technical schematic dots'
    },
    {
        id: 'carbon-fiber',
        name: 'Carbon Fiber',
        type: 'preset',
        value: `
            radial-gradient(black 15%, transparent 16%) 0 0,
            radial-gradient(black 15%, transparent 16%) 8px 8px,
            radial-gradient(rgba(255,255,255,.1) 15%, transparent 20%) 0 1px,
            radial-gradient(rgba(255,255,255,.1) 15%, transparent 20%) 8px 9px;
            background-color: #111;
            background-size: 16px 16px;
        `,
        description: 'Tactile woven texture'
    },
    {
        id: 'cyber-rain',
        name: 'Digital Rain',
        type: 'preset',
        value: `
            linear-gradient(0deg, rgba(0,0,0,1) 0%, rgba(0,20,0,1) 100%),
            repeating-linear-gradient(0deg, transparent 0, transparent 1px, #00ff00 1px, #00ff00 2px)
        `,
        description: 'The Matrix aesthetic'
    },
    {
        id: 'deep-nebula',
        name: 'Nebula',
        type: 'preset',
        value: `
            radial-gradient(circle at 50% 50%, #4c1d95 0%, transparent 50%),
            radial-gradient(circle at 80% 0%, #0e7490 0%, transparent 30%),
            linear-gradient(to bottom, #000000, #1e1b4b)
        `,
        description: 'Ambient cosmic gas'
    }
];