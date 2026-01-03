export interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  avatar?: string;
  company?: string;
  isFavorite: boolean;
  isBlocked?: boolean;
  tags: string[];
  notes?: string;
  lastMessage?: string;
  lastCall?: string;
}

export interface Message {
  id: string;
  contactId: string;
  contactName: string;
  contactPhone?: string;
  content: string;
  timestamp: string;
  isIncoming: boolean;
  status: "protected" | "allowed" | "blocked" | "priority" | "held" | "normal";
  rule?: string;
  isRead: boolean;
  unreadCount?: number;
  // Conversation controls - synced with API
  isPinned?: boolean;
  isMuted?: boolean;
  isPriority?: boolean;
  isBlocked?: boolean;
  isHeld?: boolean;
}

export type MailboxId =
  | "inbox"
  | "vips"
  | "remind-me"
  | "drafts"
  | "sent"
  | "trash"
  | "archive";

export interface ChatMessage {
  id: string;
  content: string;
  isIncoming: boolean;
  timestamp: string;
  translated?: string;
}

export interface Call {
  id: string;
  contactId: string;
  contactName: string;
  phone: string;
  timestamp: string;
  type: "incoming" | "outgoing" | "missed";
  duration?: string;
  isBlocked?: boolean;
}

export interface Reminder {
  id: string;
  type: "personal" | "call" | "message";
  title: string;
  datetime: string;
  contactId?: string;
  contactName?: string;
  isCompleted: boolean;
  repeat?: "never" | "daily" | "weekly" | "monthly";
}

export interface AIMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: string;
}

export interface UserSettings {
  phoneNumber: string;
  receiveLanguage: string;
  sendLanguage: string;
  autoTranslate: boolean;
  sendingMode: "all" | "high_medium" | "high_only" | "dnd";
  dndUntil?: string;
  priorityContacts: string[];
  priorityKeywords: string[];
  blockedNumbers: string[];
  spamKeywords: string[];
}