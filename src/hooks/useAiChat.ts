/**
 * [ZEN] useAiChat Hook Bridge (Legacy Entry Point)
 * This file now serves as a thin bridge to the modularized useAiChat suite.
 * All logic has been decomposed into specialized hooks within '@hooks/useAiChat/'.
 */

export { useAiChat } from './useAiChat/index';
export type { UseAiChatProps } from './useAiChat/types';