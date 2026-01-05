// API-based store for messages and conversations (replaces localStorage)
import { API_BASE_URL } from "@/config";

export type FilterType = "all" | "unread" | "priority" | "held" | "blocked";
export type SentimentType = "positive" | "neutral" | "negative";
export type UrgencyType = "low" | "medium" | "high" | "emergency";
export type CategoryType = "personal" | "business" | "finance" | "meeting" | "promo" | "scam" | "other";

export interface Conversation {
  id: string;
  contactPhone: string;
  contactName: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  isPinned: boolean;
  isMuted: boolean;
  isArchived: boolean;
  isHeld: boolean;
  isBlocked: boolean;
  isPriority: boolean;
  priority: "normal" | "high" | "urgent";
  transferPrefs?: {
    to: string;
    type: "all" | "high-priority";
    priorityFilter: string;
  };
  language?: {
    receive: string;
    send: string;
  };
}

export interface Message {
  id: string;
  contactPhone: string;
  contactName: string;
  direction: "incoming" | "outgoing";
  body: string;
  status: string;
  twilioSid?: string;
  fromNumber: string;
  toNumber: string;
  isRead: boolean;
  isHeld?: boolean;
  isSpam?: boolean;
  wasForwarded?: boolean;
  forwardedTo?: string;
  forwardedAt?: string;
  sentiment?: {
    score: SentimentType | null;
    confidence: number | null;
  };
  urgency?: {
    level: UrgencyType | null;
    confidence: number | null;
  };
  category?: CategoryType | null;
  labels?: string[];
  attachments?: Array<{
    url: string;
    contentType: string;
    filename: string;
    size: number;
  }>;
  createdAt: string;
}

export interface SearchParams {
  q?: string;
  contact?: string;
  sentiment?: SentimentType;
  urgency?: UrgencyType;
  category?: CategoryType;
  labels?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  skip?: number;
}

export interface SearchResult {
  messages: Message[];
  total: number;
}

const getAuthHeaders = () => {
  const token = localStorage.getItem("comsierge_token");
  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };
};

// Search messages with filters
export const searchMessages = async (params: SearchParams): Promise<SearchResult> => {
  const queryParams = new URLSearchParams();
  if (params.q) queryParams.set("q", params.q);
  if (params.contact) queryParams.set("contact", params.contact);
  if (params.sentiment) queryParams.set("sentiment", params.sentiment);
  if (params.urgency) queryParams.set("urgency", params.urgency);
  if (params.category) queryParams.set("category", params.category);
  if (params.labels) queryParams.set("labels", params.labels);
  if (params.startDate) queryParams.set("startDate", params.startDate);
  if (params.endDate) queryParams.set("endDate", params.endDate);
  if (params.limit) queryParams.set("limit", params.limit.toString());
  if (params.skip) queryParams.set("skip", params.skip.toString());

  const response = await fetch(`${API_BASE_URL}/api/messages/search?${queryParams.toString()}`, {
    headers: getAuthHeaders(),
  });

  let data: any;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || `Search failed (${response.status})`);
  }

  return {
    messages: (data.data ?? []).map((m: any) => ({
      id: m._id,
      contactPhone: m.contactPhone,
      contactName: m.contactName,
      direction: m.direction,
      body: m.body,
      status: m.status,
      twilioSid: m.twilioSid,
      fromNumber: m.fromNumber,
      toNumber: m.toNumber,
      isRead: m.isRead,
      isHeld: m.isHeld,
      isSpam: m.isSpam,
      sentiment: m.sentiment,
      urgency: m.urgency,
      category: m.category,
      labels: m.labels,
      attachments: m.attachments,
      createdAt: m.createdAt,
    })),
    total: data.total || 0,
  };
};

// Fetch all conversations with optional filter
export const fetchConversations = async (filter: FilterType = "all"): Promise<Conversation[]> => {
  const response = await fetch(`${API_BASE_URL}/api/messages/conversations?filter=${filter}&_t=${Date.now()}`, {
    headers: getAuthHeaders(),
  });

  let data: any;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok || !data?.success) {
    const message = data?.message || `Failed to fetch conversations (${response.status})`;
    throw new Error(message);
  }

  return (data.data ?? []).map((c: any) => ({
    id: c._id,
    contactPhone: c.contactPhone,
    contactName: c.contactName,
    lastMessage: c.lastMessage || "",
    lastMessageAt: c.lastMessageAt,
    unreadCount: c.unreadCount || 0,
    isPinned: c.isPinned || false,
    isMuted: c.isMuted || false,
    isArchived: c.isArchived || false,
    isHeld: c.isHeld || false,
    isBlocked: c.isBlocked || false,
    isPriority: c.isPriority || false,
    priority: c.priority || "normal",
    transferPrefs: c.transferPrefs,
    language: c.language,
  }));
};

// Fetch message thread
export const fetchThread = async (contactPhone: string, limit = 50): Promise<Message[]> => {
  const response = await fetch(`${API_BASE_URL}/api/messages/thread/${encodeURIComponent(contactPhone)}?limit=${limit}&_t=${Date.now()}`, {
    headers: getAuthHeaders(),
  });

  let data: any;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok || !data?.success) {
    const message = data?.message || `Failed to fetch thread (${response.status})`;
    throw new Error(message);
  }

  return (data.data ?? []).map((m: any) => ({
    id: m._id,
    contactPhone: m.contactPhone,
    contactName: m.contactName,
    direction: m.direction,
    body: m.body,
    status: m.status,
    twilioSid: m.twilioSid,
    fromNumber: m.fromNumber,
    toNumber: m.toNumber,
    isRead: m.isRead,
    createdAt: m.createdAt,
  }));
};

// Save a message (after Twilio send)
export const saveMessage = async (message: {
  contactPhone: string;
  contactName?: string;
  direction: "incoming" | "outgoing";
  body: string;
  status?: string;
  twilioSid?: string;
  fromNumber?: string;
  toNumber?: string;
}): Promise<Message | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/messages`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(message),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) {
      return null;
    }
    if (data.success) {
      return {
        id: data.data._id,
        contactPhone: data.data.contactPhone,
        contactName: data.data.contactName,
        direction: data.data.direction,
        body: data.data.body,
        status: data.data.status,
        twilioSid: data.data.twilioSid,
        fromNumber: data.data.fromNumber,
        toNumber: data.data.toNumber,
        isRead: data.data.isRead,
        createdAt: data.data.createdAt,
      };
    }
    return null;
  } catch (error) {
    console.error("Save message error:", error);
    return null;
  }
};

// Update conversation settings
export const updateConversation = async (
  contactPhone: string,
  updates: Partial<Pick<Conversation, "isPinned" | "isMuted" | "isArchived" | "isHeld" | "isBlocked" | "isPriority" | "priority" | "transferPrefs" | "language">>
): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/messages/conversation/${encodeURIComponent(contactPhone)}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error("Update conversation error:", error);
    return false;
  }
};

// Delete conversation
export const deleteConversation = async (contactPhone: string): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/messages/conversation/${encodeURIComponent(contactPhone)}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error("Delete conversation error:", error);
    return false;
  }
};

// Update a single message
export const updateMessage = async (
  messageId: string,
  updates: { isRead?: boolean; isHeld?: boolean; isSpam?: boolean; labels?: string[] }
): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/messages/${messageId}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error("Update message error:", error);
    return false;
  }
};

// Delete a single message
export const deleteMessage = async (messageId: string): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/messages/${messageId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error("Delete message error:", error);
    return false;
  }
};

// Bulk action on messages
export type BulkAction = 
  | "markRead" 
  | "markUnread" 
  | "hold" 
  | "unhold" 
  | "spam" 
  | "notSpam" 
  | "delete" 
  | "addLabel" 
  | "removeLabel";

export const bulkMessageAction = async (
  messageIds: string[],
  action: BulkAction,
  value?: string
): Promise<{ success: boolean; count: number }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/messages/bulk-action`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ messageIds, action, value }),
    });
    const data = await response.json();
    return { success: data.success, count: data.count || 0 };
  } catch (error) {
    console.error("Bulk action error:", error);
    return { success: false, count: 0 };
  }
};
