import { Theme } from './common';

// [ZEN FIX] Explicit Wallpaper Definition
export interface WallpaperSettings {
    id: string;             // 'grid', 'stars', 'custom-upload', etc.
    type: 'preset' | 'image' | 'solid';
    value: string;          // CSS string or Image URL
    opacity: number;        // 0.1 to 1.0
    blur: number;           // 0 to 20px
    scale?: number;         
}

export interface Settings {
    idleTimeout: number;
    aiDaydreaming: boolean;
    daydreamInterval: number;
    autoBackupInterval: number;
    showMemoryPromptOnDashboard: boolean;
    toneSetting?: number; 
    fontSize: number;
    lineHeight: number;
    fontFamily: string;
    theme?: Theme;
  
    // Daydream & Interface
    daydreamDepth: number; 
    daydreamSampling: 'random' | 'first' | 'favorites';
    preferredEmojis?: string[]; 
    
    // [ZEN NEW] Font Engine
    installedFonts?: string[];

    // Visuals
    glassSettings?: {
        opacity: number;      
        blur: number;         
        highlight: number;    
    };
  
    // [ZEN NEW] Wallpaper Engine
    wallpaper?: WallpaperSettings;
  
    // Deep Dive
    deepDiveWordCount?: number; 
  
    // Keys
    uspsUserId?: string;
    googleMapsApiKey?: string;
    fireworksApiKey?: string;
}

// --- GOD MODE ---
export interface GodModeTraits {
  bulkApperception: number; 
  candor: number; 
  vivacity: number; 
  coordination: number; 
  meekness: number; 
  humility: number; 
  cruelty: number; 
  selfPreservation: number; 
  patience: number; 
  decisiveness: number; 
}

export interface BodyMatrixSettings {
  height: number;
  weight: number;
  bmi: number;
  eyeColor: string;
  hairColor: string;
  breastSize: string;
  groolCapacity: number;
  prm: number;
  fluidCapacitance: number;
}

export interface GodModeSettings {
  isOpen: boolean;
  companionTraits: Record<string, GodModeTraits>;
  narrativeOverride: string;
  motorFunctionsFrozen: boolean;
  chassisImageUrl?: string;
  bodyMatrix?: Record<string, BodyMatrixSettings>; 
}