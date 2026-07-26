import React from 'react';
import type { User, AiCompanion } from '@/types';
import { GlassAvatar } from '../GlassAvatar';

interface AgentSidebarProps {
    user: User;
    thinkingAgentId: string | null;
}

const AgentSidebar: React.FC<AgentSidebarProps> = ({ user, thinkingAgentId }) => {
    return (
        <div className="w-20 bg-gray-100/50 dark:bg-gray-900/50 p-2 border-r border-gray-200 dark:border-gray-700/50 flex flex-col items-center space-y-4 overflow-y-auto custom-scrollbar h-full">
            {user.aiCompanions.map((companion) => (
                <div key={companion.id} className="relative group">
                    <GlassAvatar
                        imageUrl={companion.avatarUrl}
                        altText={companion.name}
                        fallbackChar={companion.name}
                        size="w-12 h-12"
                        className={`transition-all duration-300 ${thinkingAgentId === companion.id
                                ? 'ring-4 ring-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.6)] scale-110 z-10'
                                : 'grayscale-[0.3] group-hover:grayscale-0'
                            }`}
                    />
                    {thinkingAgentId === companion.id && (
                        <div className="absolute -top-1 -right-1 flex h-3 w-3 z-20">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-violet-500"></span>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default AgentSidebar;