import React from 'react';
import { 
  Desktop, 
  EnvelopeSimple, 
  ChatCircle, 
  ClockCounterClockwise, 
  Tag, 
  Images, 
  User, 
  BookOpen, 
  PaperPlaneRight, 
  Paperclip, 
  ArrowsClockwise, 
  Smiley, 
  Sun, 
  Moon, 
  ArrowsDownUp, 
  PencilSimple, 
  Trash, 
  Plus, 
  CloudArrowUp, 
  CloudArrowDown, 
  UploadSimple, 
  ArrowsLeftRight, 
  Faders, 
  Clipboard, 
  ClipboardText, 
  DotsThreeVertical, 
  SquaresFour, 
  PlusSquare, 
  Columns, 
  CheckCircle, 
  Printer, 
  FileText, 
  Brain, 
  Snowflake, 
  Crosshair, 
  Question, 
  Fingerprint, 
  Scroll, 
  Pulse, 
  X, 
  Tray, 
  Archive,
  ThumbsUp,
  ThumbsDown,
  Copy,           // NEW
  DownloadSimple  // NEW
} from '@phosphor-icons/react';

interface IconProps {
  className?: string;
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
}

export const GigiLogoIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="48" stroke="currentColor" strokeWidth="4"/>
    <path d="M35 35C40.6667 43 53.2 54.2 70 35" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
    <path d="M35 65C40.6667 57 53.2 45.8 70 65" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
  </svg>
);

export const GoogleIcon: React.FC<IconProps> = ({ className }) => (
    <svg className={className} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
        <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
        <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z" />
        <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.222 0-9.612-3.87-11.188-8.864l-6.655 5.163C9.562 38.221 16.227 44 24 44z" />
        <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.447-2.275 4.485-4.282 5.942l6.19 5.238C42.022 35.845 44 30.347 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
);

export const ConsoleRoomIcon: React.FC<IconProps> = (props) => <Desktop weight="duotone" {...props} />;
export const CommsCenterIcon: React.FC<IconProps> = (props) => <EnvelopeSimple weight="duotone" {...props} />;
export const ChatIcon: React.FC<IconProps> = (props) => <ChatCircle weight="duotone" {...props} />;
export const TimelineIcon: React.FC<IconProps> = (props) => <ClockCounterClockwise weight="duotone" {...props} />;
export const TagsIcon: React.FC<IconProps> = (props) => <Tag weight="duotone" {...props} />;
export const GalleryIcon: React.FC<IconProps> = (props) => <Images weight="duotone" {...props} />;
export const ProfileIcon: React.FC<IconProps> = (props) => <User weight="duotone" {...props} />;
export const JournalIcon: React.FC<IconProps> = (props) => <BookOpen weight="duotone" {...props} />;
export const SendIcon: React.FC<IconProps> = (props) => <PaperPlaneRight weight="duotone" {...props} />;
export const PaperclipIcon: React.FC<IconProps> = (props) => <Paperclip weight="duotone" {...props} />;
export const RefreshIcon: React.FC<IconProps> = (props) => <ArrowsClockwise weight="duotone" {...props} />;
export const EmojiIcon: React.FC<IconProps> = (props) => <Smiley weight="duotone" {...props} />;
export const SunIcon: React.FC<IconProps> = (props) => <Sun weight="duotone" {...props} />;
export const MoonIcon: React.FC<IconProps> = (props) => <Moon weight="duotone" {...props} />;
export const SortIcon: React.FC<IconProps> = (props) => <ArrowsDownUp weight="duotone" {...props} />;
export const PencilIcon: React.FC<IconProps> = (props) => <PencilSimple weight="duotone" {...props} />;
export const TrashIcon: React.FC<IconProps> = (props) => <Trash weight="duotone" {...props} />;
export const PlusIcon: React.FC<IconProps> = (props) => <Plus weight="duotone" {...props} />;
export const BackupIcon: React.FC<IconProps> = (props) => <CloudArrowUp weight="duotone" {...props} />;
export const RestoreIcon: React.FC<IconProps> = (props) => <CloudArrowDown weight="duotone" {...props} />;
export const UploadIcon: React.FC<IconProps> = (props) => <UploadSimple weight="duotone" {...props} />;
export const ReplaceIcon: React.FC<IconProps> = (props) => <ArrowsLeftRight weight="duotone" {...props} />;
export const SettingsIcon: React.FC<IconProps> = (props) => <Faders weight="duotone" {...props} />;
export const DisplaySettingsIcon: React.FC<IconProps> = (props) => <Faders weight="duotone" {...props} />;
export const ClipboardIcon: React.FC<IconProps> = (props) => <Clipboard weight="duotone" {...props} />;
export const ClipboardCheckIcon: React.FC<IconProps> = (props) => <ClipboardText weight="duotone" {...props} />;
export const EllipsisVerticalIcon: React.FC<IconProps> = (props) => <DotsThreeVertical weight="duotone" {...props} />;
export const Squares2X2Icon: React.FC<IconProps> = (props) => <SquaresFour weight="duotone" {...props} />;
export const SquaresPlusIcon: React.FC<IconProps> = (props) => <PlusSquare weight="duotone" {...props} />;
export const ViewColumnsIcon: React.FC<IconProps> = (props) => <Columns weight="duotone" {...props} />;
export const CheckCircleIcon: React.FC<IconProps> = (props) => <CheckCircle weight="duotone" {...props} />;
export const PrintIcon: React.FC<IconProps> = (props) => <Printer weight="duotone" {...props} />;
export const DocumentTextIcon: React.FC<IconProps> = (props) => <FileText weight="duotone" {...props} />;
export const BrainIcon: React.FC<IconProps> = (props) => <Brain weight="duotone" {...props} />;
export const SnowflakeIcon: React.FC<IconProps> = (props) => <Snowflake weight="duotone" {...props} />;
export const TargetIcon: React.FC<IconProps> = (props) => <Crosshair weight="duotone" {...props} />;
export const HelpCircleIcon: React.FC<IconProps> = (props) => <Question weight="duotone" {...props} />;
export const FingerprintIcon: React.FC<IconProps> = (props) => <Fingerprint weight="duotone" {...props} />;
export const ScrollIcon: React.FC<IconProps> = (props) => <Scroll weight="duotone" {...props} />;
export const ActivityIcon: React.FC<IconProps> = (props) => <Pulse weight="duotone" {...props} />;
export const XIcon: React.FC<IconProps> = (props) => <X weight="duotone" {...props} />;
export const InboxIcon: React.FC<IconProps> = (props) => <Tray weight="duotone" {...props} />;
export const ArchiveBoxIcon: React.FC<IconProps> = (props) => <Archive weight="duotone" {...props} />;
export const ThumbsUpIcon: React.FC<IconProps> = (props) => <ThumbsUp weight="duotone" {...props} />;
export const ThumbsDownIcon: React.FC<IconProps> = (props) => <ThumbsDown weight="duotone" {...props} />;
export const CopyIcon: React.FC<IconProps> = (props) => <Copy weight="duotone" {...props} />;
export const DownloadIcon: React.FC<IconProps> = (props) => <DownloadSimple weight="duotone" {...props} />;