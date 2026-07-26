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
  | 'airlock';

export type Theme = 'light' | 'dark';

export type UserStatus = 'online' | 'away' | 'busy';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
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