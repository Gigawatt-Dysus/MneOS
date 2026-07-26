import React, { useEffect, useMemo } from 'react';
import type { View, User, LifeEvent, Media, Tag, Settings } from '@/types';
import { IdentityCard } from './dashboard/IdentityCard';
import { ComposerCard } from './dashboard/ComposerCard';
import { RecentArtifactsCard } from './dashboard/RecentArtifactsCard';

interface DashboardProps {
  user: User;
  onNavigate: (view: View, data?: any) => void;
  events: LifeEvent[];
  tags: Tag[];
  media: Media[];
  settings: Settings;
  streamStatus?: 'idle' | 'receiving';
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate, user, events, tags, media, settings, streamStatus = 'idle' }) => {
  const primaryCompanion = user.aiCompanions[0];
  const aiName = primaryCompanion?.name || 'Gigi';
  const aiAvatar = primaryCompanion?.avatarUrl || user.profilePictureUrl;

  useEffect(() => {
      if (settings.showMemoryPromptOnDashboard) {
          // Placeholder for future memory prompt fetch
      }
  }, [settings.showMemoryPromptOnDashboard]);

  const recentTags = useMemo(() => tags.slice(0, 6), [tags]);

  return (
    <div className="max-w-[1600px] mx-auto p-6 lg:p-10 flex flex-col justify-center min-h-[80vh]">
       {/* [ZEN FIX] Constrained Grid Height to prevent infinite expansion */}
       <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:h-[calc(100vh-140px)] min-h-[600px]">
           <div className="lg:col-span-3 h-full min-h-0">
               <IdentityCard user={user} mediaCount={media.length} tagCount={tags.length} eventCount={events.length} onNavigate={onNavigate} tags={tags} apiKey={settings?.googleMapsApiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY} />
           </div>
           <div className="lg:col-span-5 h-full min-h-0">
                <ComposerCard aiName={aiName} aiAvatar={aiAvatar} recentTags={recentTags} media={media} onNavigate={onNavigate} user={user} streamStatus={streamStatus} />
           </div>
           <div className="lg:col-span-4 h-full min-h-0">
               <RecentArtifactsCard media={media} onNavigate={onNavigate} />
           </div>
       </div>
    </div>
  );
};

export default Dashboard;