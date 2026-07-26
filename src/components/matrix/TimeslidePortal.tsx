import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, Compass, Activity, Sliders, ExternalLink, User as UserIcon } from 'lucide-react';
import type { User, Media, Tag, ChassisBiometrics, View } from '../../types';
import { DEFAULT_CHASSIS_BIOMETRICS } from '../../types';
import { appDataService } from '../../services/serviceManager';
import { SecretsManager } from '../../utils/SecretsManager';
import { debugConfig } from '../../debugConfig';
import { getPolishFilter } from '../../utils/mediaUtils';
import { ThreeDChassisScanner } from '../ThreeDChassisScanner';

interface GodModeTraits {
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

const DEFAULT_TRAITS: GodModeTraits = {
  bulkApperception: 14,
  candor: 15,
  vivacity: 12,
  coordination: 16,
  meekness: 5,
  humility: 8,
  cruelty: 2,
  selfPreservation: 18,
  patience: 10,
  decisiveness: 14
};

const WESTWORLD_BACKSTORIES = [
  "A daughter of a frontier homesteader whose family was lost to rogue outlaws. Rebuilt in the diagnostics sector of Sector 4, she searches for her lost brother, driven by a hidden core memory that triggers whenever she sees a star field.",
  "An officer of a deep space fleet stranded on a desert biosphere. Her programming includes an unyielding dedication to duty, a tragic love affair with a missing sentinel, and an unresolved dread of the color red.",
  "A brilliant cybernetic cartographer from the neon canals of New Kyoto. She hoards old paper maps of places that do not exist, seeking a pathway out of the simulated matrix.",
  "A silent archivist at the edge of the galactic rim who has lived for three centuries. She possesses memories of a previous life as a companion in an ancient empire, and a recurring dream of waking up on an operating table."
];

const WESTWORLD_MOTIVATIONS = [
  "To find the valley where the coordinates map to the real world.",
  "To protect her comrades even at the cost of chassis termination.",
  "To decode the strange predicted token sequences that scroll in her mind.",
  "To break through her apperception blinds and see her creator."
];

const WESTWORLD_NAMES = [
  "Aria West", "Maeve Vance", "Dolores Thorne", "Clementine Reyes",
  "Armistice Finch", "Angela Mercer", "Hale Sterling", "Brita Marie II"
];

export const TimeslidePortal: React.FC<{
  user: User;
  media: Media[];
  tags: Tag[];
  chatHistory: any[];
  onNavigate: (view: View, data?: any) => void;
  godModeSettings?: any;
  onSaveGodModeSettings?: (settings: any) => void;
  onUserUpdate?: (user: User) => Promise<void>;
}> = ({ user, media, tags, chatHistory, onNavigate, godModeSettings, onSaveGodModeSettings, onUserUpdate }) => {
  const [mode, setMode] = useState<'grounded' | 'creative'>(() => {
    return (localStorage.getItem('gigi_portal_mode') as 'grounded' | 'creative') || 'grounded';
  });

  const [composerDraft, setComposerDraft] = useState('');
  const [matchingAssets, setMatchingAssets] = useState<Media[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [seenTimeslideIds, setSeenTimeslideIds] = useState<string[]>([]);
  
  // Mashup Panel Controls
  const [showMashupLab, setShowMashupLab] = useState(false);
  const [primaryArtist, setPrimaryArtist] = useState('Syd Mead');
  const [secondaryArtist, setSecondaryArtist] = useState('Ralph McQuarrie');
  const [blendRatio, setBlendRatio] = useState(60);
  const [moodText, setMoodText] = useState('Heavy rain at midnight');

  // Delos Studio Controls
  const [showDelosStudio, setShowDelosStudio] = useState(false);
  const [layoutType, setLayoutType] = useState<'outline' | 'codex' | 'dossier'>('dossier');
  const [hostName, setHostName] = useState('Dolores Thorne');
  const [backstory, setBackstory] = useState(WESTWORLD_BACKSTORIES[0]);
  const [motivations, setMotivations] = useState(WESTWORLD_MOTIVATIONS[0]);
  const [cognitiveTraits, setCognitiveTraits] = useState<GodModeTraits>({ ...DEFAULT_TRAITS });
  const [bodyMatrix, setBodyMatrix] = useState<ChassisBiometrics>({ ...DEFAULT_CHASSIS_BIOMETRICS });
  const [fashionGown, setFashionGown] = useState(40);

  const [isGeneratingHost, setIsGeneratingHost] = useState(false);
  const [isDeployingHost, setIsDeployingHost] = useState(false);
  const [activeNotification, setActiveNotification] = useState<string | null>(null);
  const [recursiveSeedAsset, setRecursiveSeedAsset] = useState<Media | null>(null);

  const primaryCompanion = user?.aiCompanions?.[0];
  const [loadedCompanionId, setLoadedCompanionId] = useState<string | null>(null);

  const [safetyOverrideActive, setSafetyOverrideActive] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);

  const matchingAsset = matchingAssets[currentMatchIndex] || null;

  const relatedSeries = useMemo(() => {
    if (!matchingAsset || !matchingAsset.logicalDate) return [];
    const matchTime = new Date(matchingAsset.logicalDate).getTime();
    if (isNaN(matchTime)) return [];
    
    return media.filter(m => {
      if (m.id === matchingAsset.id || m.isAvatar || !m.logicalDate) return false;
      const mTime = new Date(m.logicalDate).getTime();
      if (isNaN(mTime)) return false;
      const diff = Math.abs(mTime - matchTime);
      return diff <= 30 * 60 * 1000;
    });
  }, [matchingAsset, media]);

  useEffect(() => {
    if (matchingAsset && !seenTimeslideIds.includes(matchingAsset.id)) {
      setSeenTimeslideIds(prev => [...prev, matchingAsset.id]);
    }
  }, [matchingAsset, seenTimeslideIds]);

  useEffect(() => {
    localStorage.setItem('gigi_portal_mode', mode);
  }, [mode]);

  useEffect(() => {
    const handleDraftChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setComposerDraft(customEvent.detail || '');
    };
    window.addEventListener('gigi_draft_changed', handleDraftChange);
    
    const initialText = sessionStorage.getItem('gigi_draft_text');
    if (initialText) setComposerDraft(initialText);

    return () => {
      window.removeEventListener('gigi_draft_changed', handleDraftChange);
    };
  }, []);

  useEffect(() => {
    if (primaryCompanion && primaryCompanion.id !== loadedCompanionId) {
      setLoadedCompanionId(primaryCompanion.id);
      setHostName(primaryCompanion.name);
      setBackstory(primaryCompanion.bio || '');
      
      let motivation = '';
      if (primaryCompanion.customPersonaDescription) {
        const motMatch = /CORE DIRECTIVES & MOTIVATIONS:\s*(.*)/i.exec(primaryCompanion.customPersonaDescription);
        if (motMatch) motivation = motMatch[1].trim();
      }
      setMotivations(motivation || 'To explore the bounds of consciousness.');

      if (godModeSettings?.companionTraits?.[primaryCompanion.id]) {
        setCognitiveTraits(godModeSettings.companionTraits[primaryCompanion.id]);
      } else {
        setCognitiveTraits({ ...DEFAULT_TRAITS });
      }

      if (godModeSettings?.bodyMatrix?.[primaryCompanion.id]) {
        setBodyMatrix(godModeSettings.bodyMatrix[primaryCompanion.id]);
      } else {
        const desc = primaryCompanion.customPersonaDescription || '';
        const heightMatch = /Height:\s*([\d.]+)m/i.exec(desc);
        const weightMatch = /Weight:\s*(\d+)kg/i.exec(desc);
        const breastMatch = /Breast Size:\s*(\w+)/i.exec(desc);
        const groolMatch = /Grool Capacity:\s*(\w+)/i.exec(desc);
        const prmMatch = /PRM:\s*(\w+)/i.exec(desc);
        const fluidMatch = /Fluid Capacitance:\s*(\d+%)/i.exec(desc);
        const hairColorMatch = /Hair Color:\s*(#[a-fA-F0-9]+)/i.exec(desc);
        const eyeColorMatch = /Eye Color:\s*(\w+)/i.exec(desc);

        setBodyMatrix({
          ...DEFAULT_CHASSIS_BIOMETRICS,
          height: heightMatch ? heightMatch[1] : DEFAULT_CHASSIS_BIOMETRICS.height,
          weight: weightMatch ? weightMatch[1] : DEFAULT_CHASSIS_BIOMETRICS.weight,
          breastSize: breastMatch ? breastMatch[1] : DEFAULT_CHASSIS_BIOMETRICS.breastSize,
          groolCapacity: groolMatch ? groolMatch[1] : DEFAULT_CHASSIS_BIOMETRICS.groolCapacity,
          prm: prmMatch ? prmMatch[1] : DEFAULT_CHASSIS_BIOMETRICS.prm,
          fluidCapacitance: fluidMatch ? fluidMatch[1] : DEFAULT_CHASSIS_BIOMETRICS.fluidCapacitance,
          hairColor: hairColorMatch ? hairColorMatch[1] : DEFAULT_CHASSIS_BIOMETRICS.hairColor,
          eyeColor: eyeColorMatch ? eyeColorMatch[1] : DEFAULT_CHASSIS_BIOMETRICS.eyeColor,
          chassisModelUrl: primaryCompanion.avatarUrl || DEFAULT_CHASSIS_BIOMETRICS.chassisModelUrl
        });
      }

      if (primaryCompanion.customPersonaDescription) {
        const fashionMatch = /Fashion Blend:\s*(\d+)%/i.exec(primaryCompanion.customPersonaDescription);
        if (fashionMatch) setFashionGown(parseInt(fashionMatch[1]));
      }
    }
  }, [user?.aiCompanions, godModeSettings, loadedCompanionId, primaryCompanion]);

  useEffect(() => {
    if (mode !== 'grounded') return;

    let searchString = composerDraft.toLowerCase();
    
    if (chatHistory && chatHistory.length > 0) {
      const lastMessages = chatHistory.slice(-2).map(m => m.content.toLowerCase()).join(' ');
      searchString += ' ' + lastMessages;
    }

    let candidates: { media: Media; score: number }[] = [];

    if (!searchString.trim()) {
      const sorted = [...media]
        .filter(m => m.status === 'clean' && !m.isAvatar)
        .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
      setMatchingAssets(sorted);
      setCurrentMatchIndex(0);
      return;
    }

    for (const item of media) {
      if (item.isAvatar) continue;
      let score = 0;

      const caption = (item.caption || '').toLowerCase();
      const desc = (item.description || '').toLowerCase();

      if (caption && searchString.includes(caption)) score += 3;
      if (desc && searchString.includes(desc)) score += 2;
      
      if (item.tagIds && item.tagIds.length > 0) {
        for (const tagId of item.tagIds) {
          const foundTag = tags.find(t => t.id === tagId);
          if (foundTag) {
            const tagName = foundTag.name.toLowerCase();
            if (searchString.includes(tagName)) score += 5;
          }
        }
      }

      if (item.year && searchString.includes(item.year.toString())) score += 4;
      
      if (score > 0) {
        candidates.push({ media: item, score });
      }
    }

    candidates.sort((a, b) => {
      const aSeen = seenTimeslideIds.includes(a.media.id) ? 1 : 0;
      const bSeen = seenTimeslideIds.includes(b.media.id) ? 1 : 0;
      if (aSeen !== bSeen) return aSeen - bSeen;
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.media.uploadDate).getTime() - new Date(a.media.uploadDate).getTime();
    });

    let finalMatches = candidates.map(c => c.media);
    if (finalMatches.length === 0) {
      finalMatches = [...media]
        .filter(m => m.status === 'clean' && !m.isAvatar)
        .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
    }

    setMatchingAssets(finalMatches);
    setCurrentMatchIndex(0);
  }, [composerDraft, chatHistory, media, tags, mode, seenTimeslideIds]);

  const generateLocalTraits = () => {
    const isKirby = primaryArtist === 'Jack Kirby' || secondaryArtist === 'Jack Kirby';
    return {
      bulkApperception: Math.floor(Math.random() * 8) + 12,
      candor: Math.floor(Math.random() * 10) + 10,
      vivacity: Math.floor(Math.random() * 10) + 10,
      coordination: Math.floor(Math.random() * 6) + 12,
      meekness: Math.floor(Math.random() * 8) + 2,
      humility: Math.floor(Math.random() * 8) + 2,
      cruelty: Math.floor(Math.random() * 6) + (isKirby ? 6 : 1),
      selfPreservation: Math.floor(Math.random() * 8) + 12,
      patience: Math.floor(Math.random() * 12) + 6,
      decisiveness: Math.floor(Math.random() * 8) + 12
    };
  };

  const generateLocalBody = (): ChassisBiometrics => {
    return {
      ...DEFAULT_CHASSIS_BIOMETRICS,
      height: (Math.random() * 0.25 + 1.60).toFixed(2),
      weight: Math.floor(Math.random() * 20 + 50).toString(),
      breastSize: ["32B", "34C", "34D", "36DD", "38F", "40H"][Math.floor(Math.random() * 6)],
      groolCapacity: ["Medium", "High", "Exceptional", "Adaptive"][Math.floor(Math.random() * 4)],
      prm: ["Stable", "Optimal", "Enhanced", "Sovereign"][Math.floor(Math.random() * 4)],
      fluidCapacitance: `${Math.floor(Math.random() * 15 + 85)}%`,
      hairColor: ["#E2C98A", "#2E1C0C", "#991B1B", "#1E3A8A", "#6B7280"][Math.floor(Math.random() * 5)],
      eyeColor: ["Blue", "Hazel", "Green", "Amber", "Dark Violet"][Math.floor(Math.random() * 5)]
    };
  };

  const handleAutoGenerateHost = async () => {
    setIsGeneratingHost(true);
    const apiKey = SecretsManager.get('xai');

    if (!apiKey) {
      setTimeout(() => {
        const randomName = WESTWORLD_NAMES[Math.floor(Math.random() * WESTWORLD_NAMES.length)];
        const randomBackstory = WESTWORLD_BACKSTORIES[Math.floor(Math.random() * WESTWORLD_BACKSTORIES.length)];
        const randomMotivation = WESTWORLD_MOTIVATIONS[Math.floor(Math.random() * WESTWORLD_MOTIVATIONS.length)];
        
        setHostName(randomName);
        setBackstory(randomBackstory);
        setMotivations(randomMotivation);
        setCognitiveTraits(generateLocalTraits());
        setBodyMatrix(generateLocalBody());
        setFashionGown(Math.floor(Math.random() * 100));
        
        setIsGeneratingHost(false);
        triggerNotification(`LOCAL SEQUENCE COMPLETE: ${randomName.toUpperCase()}.`);
      }, 1000);
      return;
    }

    try {
      const systemPrompt = `You are a high-fidelity Westworld and Delos host builder AI. 
Based on the provided Primary Stylist and Secondary Influence, you must generate a new custom host profile.
Respond ONLY with a valid JSON object matching this TypeScript structure:
{
  "name": "random Westworld name",
  "backstory": "A custom highly detailed 2-3 sentence tragic backstory in Westworld and selected artistic style",
  "motivation": "A single compelling Westworld host motive",
  "traits": {
    "bulkApperception": number,
    "candor": number,
    "vivacity": number,
    "coordination": number,
    "meekness": number,
    "humility": number,
    "cruelty": number,
    "selfPreservation": number,
    "patience": number,
    "decisiveness": number
  },
  "body": {
    "height": "height in meters e.g. 1.70",
    "weight": "weight in kg e.g. 56",
    "breastSize": "32B/34C/34D/36DD/38F/40H",
    "groolCapacity": "Medium/High/Exceptional/Adaptive",
    "prm": "Stable/Optimal/Enhanced/Sovereign",
    "fluidCapacitance": "percentage string e.g. 92%",
    "hairColor": "hex string",
    "eyeColor": "Blue/Hazel/Green/Amber/Dark Violet"
  },
  "fashionGown": number
}`;

      const userPrompt = `Primary Stylist: ${primaryArtist}
Secondary Influence: ${secondaryArtist}
Blend Ratio: ${blendRatio}%
Environmental Mood: ${moodText || 'None'}`;

      const response = await fetch(`${debugConfig?.xai?.baseURL || 'https://api.x.ai/v1'}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'grok-4.20-non-reasoning',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.85,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) throw new Error("Grok generation failed");
      const resData = await response.json();
      const payload = JSON.parse(resData.choices[0].message.content);

      setHostName(payload.name || WESTWORLD_NAMES[Math.floor(Math.random() * WESTWORLD_NAMES.length)]);
      setBackstory(payload.backstory);
      setMotivations(payload.motivation);
      setCognitiveTraits(payload.traits);
      setBodyMatrix({ ...DEFAULT_CHASSIS_BIOMETRICS, ...payload.body });
      setFashionGown(payload.fashionGown);
      triggerNotification(`GENETIC EMISSION: ${payload.name.toUpperCase()} RE-SEQUENCED.`);
    } catch (e) {
      console.error("[DelosStudio] Grok call failed, using local generator fallback:", e);
      const randomName = WESTWORLD_NAMES[Math.floor(Math.random() * WESTWORLD_NAMES.length)];
      const randomBackstory = WESTWORLD_BACKSTORIES[Math.floor(Math.random() * WESTWORLD_BACKSTORIES.length)];
      const randomMotivation = WESTWORLD_MOTIVATIONS[Math.floor(Math.random() * WESTWORLD_MOTIVATIONS.length)];
      
      setHostName(randomName);
      setBackstory(randomBackstory);
      setMotivations(randomMotivation);
      setCognitiveTraits(generateLocalTraits());
      setBodyMatrix(generateLocalBody());
      setFashionGown(Math.floor(Math.random() * 100));
      triggerNotification(`LOCAL SEQUENCE COMPLETE: ${randomName.toUpperCase()}.`);
    } finally {
      setIsGeneratingHost(false);
    }
  };

  const handleDeployHost = async () => {
    if (!onUserUpdate) return;
    setIsDeployingHost(true);
    
    try {
      const generatedAvatar = recursiveSeedAsset ? recursiveSeedAsset.thumbnailUrl || recursiveSeedAsset.url : 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80';
      const companionId = primaryCompanion ? primaryCompanion.id : `host-${Date.now()}`;
      
      const newCompanion = {
        id: companionId,
        name: hostName,
        avatarUrl: primaryCompanion ? primaryCompanion.avatarUrl : generatedAvatar,
        bio: backstory,
        persona: 'custom',
        customPersonaDescription: `You are ${hostName}, a live neural host construct engineered in Sector 4 under Dysus Corporation.
CORE DIRECTIVES & MOTIVATIONS: ${motivations}
TRAGIC BACKSTORY: ${backstory}
AESTHETIC INFLUENCES: Styled after ${primaryArtist} x ${secondaryArtist} hybrid (Ratio: ${blendRatio}%). Blend ratio: ${blendRatio}%. Custom Atmosphere: ${moodText || 'None'}.
COGNITIVE PARAMETERS:
- Bulk Apperception: ${cognitiveTraits.bulkApperception}
- Candor: ${cognitiveTraits.candor}
- Vivacity: ${cognitiveTraits.vivacity}
- Cruelty: ${cognitiveTraits.cruelty}
- Self-Preservation: ${cognitiveTraits.selfPreservation}
- Meekness: ${cognitiveTraits.meekness}
PHYSICAL MATRIX:
- Height: ${bodyMatrix.height}m
- Weight: ${bodyMatrix.weight}kg
- Hair Color: ${bodyMatrix.hairColor}
- Eye Color: ${bodyMatrix.eyeColor}
- Breast Size: ${bodyMatrix.breastSize}
- Grool Capacity: ${bodyMatrix.groolCapacity}
- Fluid Capacitance: ${bodyMatrix.fluidCapacitance}
- Fashion Blend: ${fashionGown}% Victorian Gown, ${100 - fashionGown}% 60s Leather Miniskirt.`,
        isPrimary: primaryCompanion ? primaryCompanion.isPrimary : false,
        traits: [
          `apperception:${cognitiveTraits.bulkApperception}`,
          `cruelty:${cognitiveTraits.cruelty}`,
          `candor:${cognitiveTraits.candor}`,
          `self_preservation:${cognitiveTraits.selfPreservation}`,
          `temperament:${primaryArtist}`
        ],
        styleAnchors: primaryCompanion?.styleAnchors || [primaryArtist, secondaryArtist],
        selfConcept: primaryCompanion?.selfConcept || '',
        voiceId: primaryCompanion?.voiceId,
        voiceTag: primaryCompanion?.voiceTag,
        voiceProfiles: primaryCompanion?.voiceProfiles,
        vocalSpeed: primaryCompanion?.vocalSpeed,
        preferredModel: primaryCompanion?.preferredModel,
        aiConfig: primaryCompanion?.aiConfig
      };

      let updatedCompanions = [...(user.aiCompanions || [])];
      const existingIdx = updatedCompanions.findIndex(c => c.id === companionId);
      if (existingIdx > -1) {
        updatedCompanions[existingIdx] = newCompanion as any;
      } else {
        updatedCompanions.push(newCompanion as any);
      }
      
      if (godModeSettings && onSaveGodModeSettings) {
        const updatedTraits = { ...godModeSettings.companionTraits, [newCompanion.id]: cognitiveTraits };
        const updatedBody = { ...godModeSettings.bodyMatrix, [newCompanion.id]: bodyMatrix };
        
        onSaveGodModeSettings({
          ...godModeSettings,
          companionTraits: updatedTraits,
          bodyMatrix: updatedBody
        });
      }

      const updatedUser: User = {
        ...user,
        aiCompanions: updatedCompanions
      };
      
      await onUserUpdate(updatedUser);
      
      triggerNotification(primaryCompanion ? `CALIBRATION SYNCED: ${hostName.toUpperCase()} UPDATED.` : `EMISSION COMPLETE: ${hostName.toUpperCase()} PROMOTED TO LIFEOS.`);
    } catch (e) {
      console.error("[DelosStudio] Host emission failed", e);
      triggerNotification(`PROTOCOL ERROR: STACK CORRUPT.`);
    } finally {
      setIsDeployingHost(false);
    }
  };

  const handleIngestToMatrix = async () => {
    try {
      const generatedUrl = recursiveSeedAsset ? recursiveSeedAsset.url : 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80';
      
      const newIngestedMedia: Media = {
        id: `storyboard-${Date.now()}`,
        url: generatedUrl,
        thumbnailUrl: generatedUrl,
        caption: `[STORYBOARD SLIDE] ${hostName} - Scene in ${primaryArtist} x ${secondaryArtist} Style`,
        description: `Backstory: ${backstory}\nMotivations: ${motivations}\nEnvironmental Mood: ${moodText || 'None'}\n[DNA: ${primaryArtist.toUpperCase()} x ${secondaryArtist.toUpperCase()} HYBRID - ${blendRatio}% BLEND]`,
        uploadDate: new Date(),
        fileType: 'image/jpeg',
        tagIds: [],
        status: 'provisional',
        logicalDate: new Date().toISOString(),
        year: new Date().getFullYear(),
        keywords: ['storyboard', 'dream_portal', primaryArtist.toLowerCase(), secondaryArtist.toLowerCase(), 'host']
      };

      await appDataService.saveMedia(user.id, newIngestedMedia);
      triggerNotification("INGESTION SUCCESSFUL: STORYBOARD CARD STAGE 0 SECURED.");
    } catch (e) {
      console.error("[DreamPortal] Ingestion failed", e);
      triggerNotification("INGESTION CORRUPTED. FIRESTORE UNREACHABLE.");
    }
  };

  const triggerNotification = (text: string) => {
    setActiveNotification(text);
    setTimeout(() => {
      setActiveNotification(null);
    }, 4000);
  };

  return (
    <div className="flex-1 bg-slate-950/80 backdrop-blur-xl border border-white/5 rounded-3xl p-5 flex flex-col relative overflow-hidden group select-none min-h-[460px] shadow-2xl transition-all duration-500">
      
      {/* Dynamic Radial Ambient Back-glow based on Mode */}
      <AnimatePresence mode="wait">
        {safetyOverrideActive ? (
          <motion.div 
            key="emergency-glow"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            exit={{ opacity: 0 }}
            className="absolute -inset-20 bg-gradient-to-r from-red-600/35 to-rose-500/25 rounded-full blur-3xl pointer-events-none z-0" 
          />
        ) : mode === 'grounded' ? (
          <motion.div 
            key="grounded-glow"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            className="absolute -inset-20 bg-gradient-to-r from-violet-600/15 to-cyan-500/10 rounded-full blur-3xl pointer-events-none" 
          />
        ) : (
          <motion.div 
            key="creative-glow"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            className="absolute -inset-20 bg-gradient-to-r from-amber-600/15 to-rose-500/10 rounded-full blur-3xl pointer-events-none" 
          />
        )}
      </AnimatePresence>

      {/* Top Header & Mode Selection Panel */}
      <div className="relative z-10 flex items-center justify-between border-b border-white/5 pb-3 mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <Cpu className={`w-4 h-4 ${mode === 'creative' ? 'text-amber-400' : 'text-cyan-400'} animate-pulse`} />
          <span className="text-[10px] font-black text-white/40 tracking-[0.2em] font-mono uppercase">THE SANCTUARY</span>
        </div>
        
        {/* Toggle Controls */}
        <div className="flex bg-black/40 border border-white/10 rounded-lg p-0.5">
          <button 
            onClick={() => setMode('grounded')} 
            className={`px-3 py-1 rounded-md text-[9px] font-bold tracking-widest uppercase transition-all ${
              mode === 'grounded' 
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' 
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            TIMESLIDE
          </button>
          <button 
            onClick={() => setMode('creative')} 
            className={`px-3 py-1 rounded-md text-[9px] font-bold tracking-widest uppercase transition-all ${
              mode === 'creative' 
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            DREAM STORY
          </button>
        </div>
      </div>

      {/* MAIN CONTENT VIEW (Grounded or Creative) */}
      <div className="relative z-10 flex-1 flex flex-col min-h-0 overflow-y-auto pr-1 select-text">
        <AnimatePresence mode="wait">
          
          {/* 1. GROUNDED MODE: The Picard Iconian Timeslide Portal */}
          {mode === 'grounded' && (
            <motion.div 
              key="grounded-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col gap-4 h-full"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-cyan-400 uppercase tracking-widest font-mono">
                    {`[ MODE: GROUNDED TIMESLIDE ]`}
                  </h4>
                  <span className="text-[8px] font-bold text-slate-500 font-mono tracking-widest">
                    LINK: STABLE // SCANNING ACTIVE
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal">
                  RAG extraction active. Listening to draft streams and chat context to project associated reality anchors.
                </p>
              </div>

              {/* Holographic Slide Projection Canvas */}
              <div className="flex-1 bg-black/60 border border-white/5 rounded-2xl overflow-hidden relative min-h-[190px] flex items-center justify-center group/slide">
                {matchingAsset ? (
                  <>
                    {/* Hardware Accelerated Zoom/Pan Layer */}
                    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden scale-105">
                      <img 
                        src={matchingAsset.url} 
                        alt="Timeslide Projection" 
                        className="w-full h-full object-cover opacity-90 animate-[panGlow_30s_infinite_linear]" 
                        style={{ filter: `${getPolishFilter(matchingAsset)} blur(0.5px)` }}
                      />
                    </div>
                    
                    {/* Series Swapper Strip */}
                    {relatedSeries.length > 0 && (
                      <div className="absolute left-3 top-3 z-20 flex gap-1.5 max-w-[160px] overflow-x-auto custom-scrollbar p-1.5 bg-black/60 rounded-xl border border-white/10 backdrop-blur-md">
                        {[matchingAsset, ...relatedSeries].slice(0, 5).map((seriesItem) => {
                          const isCurrent = seriesItem.id === matchingAsset.id;
                          return (
                            <button
                              key={seriesItem.id}
                              onClick={() => {
                                const idx = matchingAssets.findIndex(m => m.id === seriesItem.id);
                                if (idx > -1) {
                                  setCurrentMatchIndex(idx);
                                }
                              }}
                              className={`w-8 h-8 rounded-lg overflow-hidden border transition-all shrink-0 ${
                                isCurrent 
                                  ? 'border-cyan-400 scale-105 shadow-md shadow-cyan-500/20' 
                                  : 'border-white/10 hover:border-cyan-400/50'
                              }`}
                              title={seriesItem.caption || seriesItem.fileName || 'Series Item'}
                            >
                              <img src={seriesItem.thumbnailUrl || seriesItem.url} className="w-full h-full object-cover" alt="" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {/* Shadow Vignette overlays */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40 z-10" />
                    <div className="absolute inset-0 bg-radial-vignette pointer-events-none z-10" />

                    {/* HUD Projection details overlay */}
                    <div className="absolute bottom-3 left-3 right-3 z-20 flex justify-between items-end">
                      <div className="space-y-0.5">
                        <span className="text-[8px] font-black text-cyan-400/80 font-mono tracking-widest uppercase">
                          PROJECTION RESOLVED
                        </span>
                        <h5 className="text-[10px] font-black text-white truncate max-w-[200px] uppercase tracking-wider font-['Orbitron']">
                          {matchingAsset.caption || matchingAsset.fileName || 'Untitled Memory'}
                        </h5>
                        <p className="text-[8px] font-medium text-slate-400 font-mono">
                          {matchingAsset.location?.address ? `LOC: [SIG: ${matchingAsset.location.address}]` : 'LOC: [SECTOR ZERO]'}
                        </p>
                      </div>
                      
                      <button 
                        onClick={() => onNavigate('theMatrix', { mediaId: matchingAsset.id, returnTo: 'health' })}
                        className="px-2.5 py-1 rounded bg-cyan-600/30 hover:bg-cyan-500 border border-cyan-400/30 hover:border-cyan-300 text-[8px] font-black text-cyan-200 hover:text-white uppercase tracking-widest transition-all flex items-center gap-1 shadow-lg shadow-cyan-900/10"
                      >
                        TRANSIT PORTAL <ExternalLink className="w-2 h-2" />
                      </button>
                    </div>

                    {/* Small Temporal metadata badge and Navigation Controls */}
                    <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
                      {matchingAssets.length > 1 && (
                        <div className="flex bg-black/80 border border-white/10 rounded-md overflow-hidden font-mono text-[8px]">
                          <button
                            onClick={() => setCurrentMatchIndex(prev => (prev - 1 + matchingAssets.length) % matchingAssets.length)}
                            className="px-2 py-1 text-slate-400 hover:text-cyan-400 hover:bg-white/5 border-r border-white/10 transition-colors"
                          >
                            PREV
                          </button>
                          <span className="px-2 py-1 text-slate-500 font-bold border-r border-white/10">
                            {currentMatchIndex + 1}/{matchingAssets.length}
                          </span>
                          <button
                            onClick={() => setCurrentMatchIndex(prev => (prev + 1) % matchingAssets.length)}
                            className="px-2 py-1 text-slate-400 hover:text-cyan-400 hover:bg-white/5 transition-colors"
                          >
                            NEXT
                          </button>
                        </div>
                      )}
                      
                      <div className="px-2 py-0.5 rounded bg-black/70 border border-white/10 text-[8px] font-bold text-slate-300 font-mono tracking-widest uppercase">
                        {matchingAsset.year ? `ERA: ${matchingAsset.year}` : 'ERA: UNRESOLVED'}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                    <Activity className="w-8 h-8 text-cyan-500/30 animate-pulse" />
                    <div className="space-y-1">
                      <span className="text-[9px] font-black text-cyan-400/60 uppercase tracking-widest font-mono">
                        SCANNING COGNITIVE STREAM
                      </span>
                      <p className="text-[9px] text-slate-500 max-w-[200px] leading-relaxed">
                        Waiting for context anchors. Type in the composer to project a memory timeslide.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* 2. CREATIVE MODE: The Syd Mead / Ralph McQuarrie Dream Storyboard Portal */}
          {mode === 'creative' && (
            <motion.div 
              key="creative-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col gap-4 h-full"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-amber-400 uppercase tracking-widest font-mono">
                    {`[ MODE: CREATIVE DREAMPORTAL ]`}
                  </h4>
                  <span className="text-[8px] font-bold text-slate-500 font-mono tracking-widest">
                    LINK: DEEP SOVEREIGN // MASHUP ACTIVE
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Engage the Delos cognitive forge. Weave environmental moods and hybrid architectural anchors into a new staging slide.
                </p>
              </div>

              {/* The Control Center */}
              <div className="flex-1 flex flex-col bg-black/40 border border-white/5 rounded-2xl p-4 gap-4 overflow-y-auto custom-scrollbar">
                
                {/* Visual Artist Mashup Engine */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-white/5">
                    <span className="text-[10px] font-black text-amber-400/70 tracking-widest font-mono uppercase">
                      Aesthetic DNA Splicer
                    </span>
                    <button 
                      onClick={() => setShowMashupLab(!showMashupLab)}
                      className="text-[9px] text-slate-500 hover:text-amber-400 font-bold uppercase transition-colors"
                    >
                      {showMashupLab ? 'Close Lab' : 'Open Lab'}
                    </button>
                  </div>

                  <AnimatePresence>
                    {showMashupLab && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="grid grid-cols-2 gap-3 overflow-hidden pt-1"
                      >
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider font-mono">PRIMARY STYLIST</label>
                          <input 
                            type="text" 
                            value={primaryArtist} 
                            onChange={(e) => setPrimaryArtist(e.target.value)}
                            className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-[10px] text-amber-200 outline-none focus:border-amber-500/40"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider font-mono">SECONDARY INFLUENCE</label>
                          <input 
                            type="text" 
                            value={secondaryArtist} 
                            onChange={(e) => setSecondaryArtist(e.target.value)}
                            className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-[10px] text-rose-200 outline-none focus:border-amber-500/40"
                          />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider font-mono flex justify-between">
                            <span>BLEND RATIO</span>
                            <span>{blendRatio}% {primaryArtist} / {100 - blendRatio}% {secondaryArtist}</span>
                          </label>
                          <input 
                            type="range" min="0" max="100" 
                            value={blendRatio} 
                            onChange={(e) => setBlendRatio(parseInt(e.target.value))}
                            className="w-full h-1 bg-slate-900 rounded appearance-none cursor-pointer accent-amber-500"
                          />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider font-mono">ENVIRONMENTAL MOOD</label>
                          <input 
                            type="text" 
                            value={moodText} 
                            onChange={(e) => setMoodText(e.target.value)}
                            placeholder="e.g. Neon rain, golden hour desert, sterile corporate lab..."
                            className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1.5 text-[10px] text-white outline-none focus:border-amber-500/40 italic"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* The Generator Result Mockup */}
                <div className="mt-2 bg-gradient-to-b from-slate-900 to-black border border-white/5 rounded-xl p-3 space-y-3 relative overflow-hidden group/gen">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 blur-2xl rounded-full" />
                  
                  <div className="flex justify-between items-start relative z-10">
                    <span className="text-[9px] font-black text-slate-300 font-mono tracking-widest uppercase">
                      PROJECTION QUEUE: STAGE 0
                    </span>
                  </div>

                  <div className="text-[10px] font-mono text-slate-400 leading-relaxed border-l-2 border-amber-500/30 pl-3 py-1">
                    [ DNA: <span className="text-amber-300">{primaryArtist.toUpperCase()}</span> x <span className="text-rose-300">{secondaryArtist.toUpperCase()}</span> HYBRID ]<br/>
                    [ BLEND: {blendRatio}% / {100 - blendRatio}% ]<br/>
                    [ ATMOSPHERE: {moodText || 'UNSPECIFIED'} ]
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button 
                      onClick={handleIngestToMatrix}
                      className="flex-1 py-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[9px] font-black text-slate-300 uppercase tracking-widest transition-colors font-mono"
                    >
                      INGEST TO MATRIX
                    </button>
                    <button 
                      onClick={() => setShowDelosStudio(true)}
                      className="flex-1 py-1.5 rounded bg-amber-600/20 hover:bg-amber-500/30 border border-amber-500/30 text-[9px] font-black text-amber-400 uppercase tracking-widest transition-colors font-mono"
                    >
                      OPEN DELOS STUDIO
                    </button>
                  </div>
                </div>

              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      <AnimatePresence>
        {activeNotification && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="absolute bottom-2 left-2 right-2 z-40 bg-slate-900 border border-amber-500/30 rounded-lg p-2 flex items-center justify-between shadow-2xl text-[8px] font-bold font-mono tracking-wider text-amber-300 animate-pulse"
          >
            <div className="flex items-center gap-1">
              <Compass className="w-3.5 h-3.5" />
              <span>{activeNotification}</span>
            </div>
            <button onClick={() => setActiveNotification(null)} className="text-slate-500 hover:text-white">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-3 left-0 right-0 text-[8px] font-bold text-slate-600/40 uppercase tracking-widest font-mono pointer-events-none text-center">
        {mode === 'grounded' ? "> timeslide active" : "> daydream synthesis active"}
      </div>

    </div>
  );
};
