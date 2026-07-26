export type View =
  | 'dashboard'
  | 'interviews'
  | 'timeVortex'
  | 'tags'
  | 'theMatrix'
  | 'profile'
  | 'aiCompanionEditor'
  | 'eventEditor'
  | 'tagEditor'
  | 'gigiJournal'
  | 'commsCenter'
  | 'staging'
  | 'deepDiveReporter'
  | 'settings'
  | 'archivists'
  | 'airlock'
  | 'alexaLink'
  | 'daydream'
  | 'loom';

export type SettingsTab = 'fonts' | 'companions' | 'interface' | 'utils' | 'verts';

export type Theme = 'light' | 'dark';

export type UserStatus = 'online' | 'away' | 'busy';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ApiLogEntry {
  id: string;
  timestamp: Date;
  type: 'success' | 'error' | 'warning' | 'safety_block';
  model: string;
  endpoint: string;
  message: string;
  details?: any;
}