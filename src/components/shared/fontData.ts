export interface FontDef {
    name: string;
    category: 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace';
}

export const SYSTEM_FONTS: FontDef[] = [
    { name: 'Inter', category: 'sans-serif' },
    { name: 'Arial', category: 'sans-serif' },
    { name: 'Georgia', category: 'serif' },
    { name: 'Courier New', category: 'monospace' },
    { name: 'Trebuchet MS', category: 'sans-serif' },
];

export const GOOGLE_FONTS_LIBRARY: FontDef[] = [
    // Sans Serif
    { name: 'Roboto', category: 'sans-serif' },
    { name: 'Open Sans', category: 'sans-serif' },
    { name: 'Lato', category: 'sans-serif' },
    { name: 'Montserrat', category: 'sans-serif' },
    { name: 'Poppins', category: 'sans-serif' },
    { name: 'Raleway', category: 'sans-serif' },
    { name: 'Ubuntu', category: 'sans-serif' },
    { name: 'Nunito', category: 'sans-serif' },
    { name: 'Quicksand', category: 'sans-serif' },
    
    // Serif
    { name: 'Playfair Display', category: 'serif' },
    { name: 'Merriweather', category: 'serif' },
    { name: 'Lora', category: 'serif' },
    { name: 'Roboto Slab', category: 'serif' },
    { name: 'PT Serif', category: 'serif' },
    { name: 'Cinzel', category: 'serif' },
    
    // Display / Futurism (Good for Scifi UI)
    { name: 'Orbitron', category: 'display' },
    { name: 'Rajdhani', category: 'display' },
    { name: 'Exo 2', category: 'display' },
    { name: 'Audiowide', category: 'display' },
    { name: 'Syncopate', category: 'display' },
    { name: 'Michroma', category: 'display' },
    { name: 'Krona One', category: 'display' },
    
    // Handwriting
    { name: 'Dancing Script', category: 'handwriting' },
    { name: 'Pacifico', category: 'handwriting' },
    { name: 'Shadows Into Light', category: 'handwriting' },
    { name: 'Indie Flower', category: 'handwriting' },
    { name: 'Permanent Marker', category: 'handwriting' },
    { name: 'Caveat', category: 'handwriting' },
    
    // Monospace (Coding/Terminal)
    { name: 'Fira Code', category: 'monospace' },
    { name: 'JetBrains Mono', category: 'monospace' },
    { name: 'Source Code Pro', category: 'monospace' },
    { name: 'Inconsolata', category: 'monospace' },
    { name: 'Press Start 2P', category: 'display' }, // Retro gaming
    { name: 'VT323', category: 'monospace' }
];