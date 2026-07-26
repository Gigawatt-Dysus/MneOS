import React, { useEffect, useMemo, useState } from 'react';
import type { View, User, LifeEvent, Media, Tag, Settings, AiCompanion, ChassisBiometrics } from '../types';
import { DEFAULT_CHASSIS_BIOMETRICS } from '../types';
import { IdentityCard } from './dashboard/IdentityCard';
import { ComposerCard } from './dashboard/ComposerCard';
import { ActiveHolodeckSessions } from './dashboard/ActiveHolodeckSessions';
import { ThreeDChassisScanner } from './ThreeDChassisScanner';
import { TEMPORAL_SHOEBOX_YEAR } from '../types/constants';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, Cpu, Image as ImageIcon, Settings as SettingsIcon, Compass, Eye, 
  RefreshCw, Play, Sliders, Check, ExternalLink, EyeOff, User as UserIcon, 
  FolderPlus, Dices, Layers, HelpCircle, ChevronDown, ChevronUp, Activity
} from 'lucide-react';
import { appDataService } from '../services/serviceManager';
import { SecretsManager } from '../utils/SecretsManager';
import { debugConfig } from '../debugConfig';
import { getPolishFilter } from '../utils/mediaUtils';

interface DashboardProps {
  user: User;
  onNavigate: (view: View, data?: any) => void;
  events: LifeEvent[];
  tags: Tag[];
  media: Media[];
  verts: any[];
  settings: Settings;
  streamStatus?: 'idle' | 'receiving';
  stagedFiles: any[];
  pendingAccessionsCount: number;
  messengerCount: number;
  chatHistory?: any[];
  godModeSettings?: any;
  onSaveGodModeSettings?: (settings: any) => void;
  onUserUpdate?: (user: User) => Promise<void>;
  onManualEdit?: (sourceId: string, sourceCollection: string, anomalyId: string) => void;
  onAnomalyCountChange?: (count: number) => void;
}

import { PendingTriageCarousel } from './dashboard/PendingTriageCarousel';

// -------------------------------------------------------------
// EXPORTED MAIN DASHBOARD WRAPPER
// -------------------------------------------------------------
const Dashboard: React.FC<DashboardProps> = ({ 
  onNavigate, user, events, tags, media, verts, settings, 
  streamStatus = 'idle', stagedFiles, pendingAccessionsCount, messengerCount, 
  chatHistory = [], godModeSettings = {}, onSaveGodModeSettings = () => {}, 
  onUserUpdate = async () => {}, onManualEdit, onAnomalyCountChange 
}) => {
  const primaryCompanion = user?.aiCompanions?.[0];
  const aiName = primaryCompanion?.name || 'AI';
  const aiAvatar = primaryCompanion?.avatarUrl || user?.profilePictureUrl;

  useEffect(() => {
    if (settings.showMemoryPromptOnDashboard) {
      // Placeholder
    }
  }, [settings.showMemoryPromptOnDashboard]);

  const recentTags = useMemo(() => tags.slice(0, 6), [tags]);
  const shoeboxCount = useMemo(() => {
    return media.filter(m => {
      const dateStr = typeof m.logicalDate === 'string' ? m.logicalDate : '';
      return m.year === TEMPORAL_SHOEBOX_YEAR || dateStr.startsWith(TEMPORAL_SHOEBOX_YEAR.toString());
    }).length;
  }, [media]);

  const ragPulse = useMemo(() => {
    let connections = 0;
    let wordCount = 0;

    const getWords = (str?: string) => str ? str.split(/\s+/).length : 0;
    const getInlineMentions = (str?: string) => {
        const matches = str?.match(/\[.*?\]\(tag:\/\/.*?\)/g);
        return matches ? matches.length : 0;
    };

    events.forEach(e => {
        connections += (e.tagIds?.length || 0);
        wordCount += getWords(e.details);
        connections += getInlineMentions(e.details);
    });

    tags.forEach(t => {
        connections += (t.tagIds?.length || 0);
        wordCount += getWords(t.description);
        connections += getInlineMentions(t.description);
        
        const meta = t.metadata as any;
        if (meta?.significance) {
            wordCount += getWords(meta.significance);
            connections += getInlineMentions(meta.significance);
        }
        if (meta?.transformationHistory) {
            wordCount += getWords(meta.transformationHistory);
            connections += getInlineMentions(meta.transformationHistory);
        }
    });

    (chatHistory || []).forEach(c => {
        wordCount += getWords(c.content);
    });

    const tokens = Math.floor(wordCount * 1.3);
    return { connections, tokens };
  }, [events, tags, chatHistory]);

  return (
    <div className="max-w-[1600px] mx-auto p-4 lg:p-6 flex flex-col justify-center min-h-[80vh] bg-transparent rounded-3xl">
      {/* Two-Column focus layout without dead space scrolling */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:h-[calc(100vh-175px)] min-h-[600px]">
        
        {/* Left Column: Compact HUD + Iconian Timeslide/Dream Stargate Portal */}
        <div className="lg:col-span-4 h-full flex flex-col gap-6 min-h-0">
          <IdentityCard 
            user={user} 
            media={media} 
            tagCount={tags.length} 
            eventCount={events.length} 
            vertCount={verts.length} 
            stagedCount={stagedFiles?.length || 0}
            airlockCount={pendingAccessionsCount}
            shoeboxCount={shoeboxCount}
            messengerCount={messengerCount}
            chatCount={chatHistory?.length || 0}
            neuralTemperature={user?.sovereignMemex?.neuralTemperature || 0}
            onNavigate={onNavigate} 
            tags={tags} 
            apiKey={settings?.googleMapsApiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY} 
            ragConnections={ragPulse.connections}
            ragTokens={ragPulse.tokens}
          />
          <PendingTriageCarousel userId={user.id} pendingCount={pendingAccessionsCount} onNavigate={onNavigate} />
        </div>
        
        {/* Right Column: Widescreen Creative Writing Workspace */}
        <div className="lg:col-span-8 h-full min-h-0">
          <ActiveHolodeckSessions user={user} tags={tags} onNavigate={onNavigate} />
          <ComposerCard 
            aiName={aiName} 
            aiAvatar={aiAvatar} 
            recentTags={recentTags} 
            media={media} 
            verts={verts} 
            tags={tags} 
            eventCount={events.length} 
            onNavigate={onNavigate} 
            user={user} 
            streamStatus={streamStatus} 
            stagedCount={pendingAccessionsCount} 
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;