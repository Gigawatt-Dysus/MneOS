import React, { useEffect, useMemo, useState } from 'react';
import TheMatrix from '../matrix';
import { useWindowManager } from '../../context/WindowManagerContext';
import { Window } from './Window';
import { ComposerCard } from '../dashboard/ComposerCard';
import { PendingTriageCarousel } from '../dashboard/PendingTriageCarousel';
import { IdentityCard } from '../dashboard/IdentityCard';
import { ActiveHolodeckSessions } from '../dashboard/ActiveHolodeckSessions';
import type { View, User, LifeEvent, Media, Tag, Settings } from '../../types';
import { TEMPORAL_SHOEBOX_YEAR } from '../../types/constants';

interface DesktopProps {
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
}

export const Desktop: React.FC<DesktopProps> = (props) => {
  const { windows, openWindow, focusWindow } = useWindowManager();
  const [hasInitialized, setHasInitialized] = useState(false);

  const shoeboxCount = useMemo(() => {
    return props.media.filter(m => {
      const dateStr = typeof m.logicalDate === 'string' ? m.logicalDate : '';
      return m.year === TEMPORAL_SHOEBOX_YEAR || dateStr.startsWith(TEMPORAL_SHOEBOX_YEAR.toString());
    }).length;
  }, [props.media]);

  const primaryCompanion = props.user?.aiCompanions?.[0];
  const aiName = primaryCompanion?.name || 'AI';
  const aiAvatar = primaryCompanion?.avatarUrl || props.user?.profilePictureUrl;
  const recentTags = useMemo(() => props.tags.slice(0, 6), [props.tags]);

  useEffect(() => {
    if (!hasInitialized) {
      // Open default OS Windows on boot
      openWindow(
        'composer',
        'Calliope / Composer',
        <ComposerCard 
          aiName={aiName} 
          aiAvatar={aiAvatar} 
          recentTags={recentTags} 
          media={props.media} 
          verts={props.verts} 
          tags={props.tags} 
          eventCount={props.events.length} 
          onNavigate={props.onNavigate} 
          user={props.user} 
          streamStatus={props.streamStatus} 
          stagedCount={props.pendingAccessionsCount} 
        />,
        { x: window.innerWidth - 650, y: 50, width: 600, height: window.innerHeight - 150 }
      );

      openWindow(
        'identity',
        'Identity / Holodeck',
        <div className="flex flex-col gap-4 p-4">
          <IdentityCard 
            user={props.user} 
            media={props.media} 
            tagCount={props.tags.length} 
            eventCount={props.events.length} 
            vertCount={props.verts.length} 
            stagedCount={props.stagedFiles?.length || 0}
            airlockCount={props.pendingAccessionsCount}
            shoeboxCount={shoeboxCount}
            messengerCount={props.messengerCount}
            chatCount={props.chatHistory?.length || 0}
            neuralTemperature={props.user?.sovereignMemex?.neuralTemperature || 0}
            onNavigate={props.onNavigate} 
            tags={props.tags} 
            apiKey={props.settings?.googleMapsApiKey || ''} 
            ragConnections={0}
            ragTokens={0}
          />
          <ActiveHolodeckSessions user={props.user} tags={props.tags} onNavigate={props.onNavigate} />
        </div>,
        { x: 50, y: 50, width: 400, height: 600 }
      );

      if (props.pendingAccessionsCount > 0) {
        openWindow(
          'triage',
          'Media Triage',
          <PendingTriageCarousel userId={props.user.id} pendingCount={props.pendingAccessionsCount} onNavigate={props.onNavigate} />,
          { x: 50, y: 670, width: 400, height: 250 }
        );
      }

      setHasInitialized(true);
    }
  }, [hasInitialized, openWindow, props, aiName, aiAvatar, recentTags, shoeboxCount]);

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-gray-950 text-white">
      {/* Desktop Background Layer */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-950 via-gray-900 to-black mix-blend-screen opacity-50"></div>
        {props.settings.wallpaper?.type === 'matrix' && (
          <div className="absolute inset-0 z-0 opacity-30 mix-blend-screen">
            <TheMatrix
              user={props.user}
              tags={props.tags}
              onNavigate={props.onNavigate}
              onDeleteMedia={async () => {}}
              onStageFiles={() => {}}
              isWallpaperMode={true}
            />
          </div>
        )}
      </div>

      {/* Window Management Layer */}
      <div className="absolute inset-0 z-10 pointer-events-none mb-20">
        
        {windows.map(window => (
          <div key={window.id} className="pointer-events-auto">
            <Window windowState={window} />
          </div>
        ))}
      </div>
    </div>
  );
};
