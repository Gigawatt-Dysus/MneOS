/**
 * [ZEN] AiChat Module Bridge
 * This file now serves as a thin bridge to the modularized AiChat suite.
 */

import React from 'react';
import { AiChatLayout } from './AiChatLayout';
import { AiChatProps } from './types';

export const AiChat: React.FC<AiChatProps> = (props) => {
    return <AiChatLayout {...props} />;
};

export default AiChat;
export { BridgeLockedBoundary } from './BridgeLockedBoundary';
export type { AiChatProps } from './types';