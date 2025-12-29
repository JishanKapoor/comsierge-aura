import { useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  Phone,
  MoreHorizontal,
  Send,
  Paperclip,
  Smile,
  MessageSquare,
  Shield,
  AlertTriangle,
  Star,
  ArrowLeft,
  Sparkles,
  Languages,
  ArrowRightLeft,
  Pin,
  PinOff,
  BellOff,
  Bell,
  Ban,
  Trash2,
  Bot,
  Pencil,
  UserPlus,
  Camera,
  Wand2,
  Lightbulb,
  ChevronDown,
  X,
  Plus,
  Clock,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { mockMessages, languages, mockContacts } from "./mockData";
import type { Contact, Message } from "./types";
import { loadContacts, saveContacts } from "./contactsStore";
import { loadRules, saveRules, ActiveRule } from "./rulesStore";
import { isValidUsPhoneNumber } from "@/lib/validations";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";

type ChatBubble = {
  id: string;
  role: "incoming" | "outgoing" | "ai";
  content: string;
  timestamp: string;
};

type FilterType = "all" | "unread" | "priority" | "held" | "blocked";

type TransferPrefs = {
  to: string;
  type: TransferType;
  priorityFilter: PriorityFilter;
};

const STORAGE_KEYS = {
  messages: "comsierge.inbox.messages",
  pinned: "comsierge.inbox.pinned",
  muted: "comsierge.inbox.muted",
  transferPrefs: "comsierge.inbox.transferPrefs",
  languages: "comsierge.inbox.languages",
} as const;

const safeParseJson = <T,>(value: string | null): T | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

interface InboxViewProps {
  selectedContactPhone?: string | null;
  onClearSelection?: () => void;
}

type TransferMode = "calls" | "messages" | "both";
type TransferType = "all" | "high-priority";
type PriorityFilter = "all" | "emergency" | "meetings" | "deadlines" | "important";
type ScheduleMode = "always" | "duration" | "custom";

const InboxView = ({ selectedContactPhone, onClearSelection }: InboxViewProps) => {
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = safeParseJson<Message[]>(localStorage.getItem(STORAGE_KEYS.messages));
    return Array.isArray(saved) && saved.length > 0 ? saved : mockMessages;
  });
  const [contacts, setContacts] = useState<Contact[]>(() => loadContacts(mockContacts));
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [mobilePane, setMobilePane] = useState<"list" | "chat">("list");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  
  // Menu states
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showTranslateModal, setShowTranslateModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showAiChat, setShowAiChat] = useState(false);
  const [receiveLanguage, setReceiveLanguage] = useState(() => {
    const saved = safeParseJson<{ receiveLanguage?: string; sendLanguage?: string }>(
      localStorage.getItem(STORAGE_KEYS.languages)
    );
    return saved?.receiveLanguage || "en";
  });
  const [sendLanguage, setSendLanguage] = useState(() => {
    const saved = safeParseJson<{ receiveLanguage?: string; sendLanguage?: string }>(
      localStorage.getItem(STORAGE_KEYS.languages)
    );
    return saved?.sendLanguage || "en";
  });
  const moreMenuRef = useRef<HTMLDivElement>(null);

  type AiChatMessage = {
    id: string;
    isUser: boolean;
    content: string;
    timestamp: string;
  };

  const [aiChatsByConversationId, setAiChatsByConversationId] = useState<Record<string, AiChatMessage[]>>({});
  const [aiInput, setAiInput] = useState("");
  const aiChatEndRef = useRef<HTMLDivElement | null>(null);

  const [aiAssistOpen, setAiAssistOpen] = useState(false);
  const [aiAssistMode, setAiAssistMode] = useState<"rewrite" | "suggest" | null>(null);
  const [aiAssistRewrite, setAiAssistRewrite] = useState("");
  const [aiAssistSuggestions, setAiAssistSuggestions] = useState<string[]>([]);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messageInputRef = useRef<HTMLInputElement | null>(null);

  const [pendingAttachment, setPendingAttachment] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
  const isAllowedAttachment = (file: File) => {
    const type = (file.type || "").toLowerCase();
    const name = (file.name || "").toLowerCase();

    const byMime =
      type === "image/jpeg" ||
      type === "image/png" ||
      type === "image/gif" ||
      type === "application/pdf" ||
      type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    const byExt =
      name.endsWith(".jpg") ||
      name.endsWith(".jpeg") ||
      name.endsWith(".png") ||
      name.endsWith(".gif") ||
      name.endsWith(".pdf") ||
      name.endsWith(".docx");

    return byMime || byExt;
  };

  const insertEmoji = (emoji: string) => {
    const el = messageInputRef.current;
    if (!el) {
      setNewMessage((prev) => `${prev}${emoji}`);
      return;
    }

    const start = el.selectionStart ?? newMessage.length;
    const end = el.selectionEnd ?? newMessage.length;
    const next = `${newMessage.slice(0, start)}${emoji}${newMessage.slice(end)}`;
    setNewMessage(next);
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + emoji.length;
      el.setSelectionRange(caret, caret);
    });
  };

  const buildRewriteSuggestion = (text: string) => {
    const cleaned = text.replace(/\s+/g, " ").trim();
    if (!cleaned) return "";
    const capitalized = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    const withPunctuation = /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
    return withPunctuation;
  };

  const [showContactModal, setShowContactModal] = useState(false);
  const [contactEditForm, setContactEditForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    notes: "",
    isFavorite: false,
    tags: [] as string[],
  });

  const [contactCustomTagInput, setContactCustomTagInput] = useState("");
  const [contactCustomTags, setContactCustomTags] = useState<string[]>([]);
  const contactAvailableTags = useMemo(
    () => [
      ...new Set([
        "Family",
        "Work",
        "Friend",
        "VIP",
        "Business",
        "School",
        "Gym",
        "Medical",
        ...contactCustomTags,
      ]),
    ],
    [contactCustomTags]
  );
  
  // Pin/Mute state per conversation
  const [pinnedConversations, setPinnedConversations] = useState<Set<string>>(() => {
    const saved = safeParseJson<string[]>(localStorage.getItem(STORAGE_KEYS.pinned));
    return new Set(Array.isArray(saved) ? saved : []);
  });
  const [mutedConversations, setMutedConversations] = useState<Set<string>>(() => {
    const saved = safeParseJson<string[]>(localStorage.getItem(STORAGE_KEYS.muted));
    return new Set(Array.isArray(saved) ? saved : []);
  });

  const [transferPrefsByConversation, setTransferPrefsByConversation] = useState<Record<string, TransferPrefs>>(() => {
    const saved = safeParseJson<Record<string, TransferPrefs>>(localStorage.getItem(STORAGE_KEYS.transferPrefs));
    return saved && typeof saved === "object" ? saved : {};
  });
  
  // Transfer modal state
  const [transferMode, setTransferMode] = useState<TransferMode>("both");
  const [transferType, setTransferType] = useState<TransferType>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [transferTo, setTransferTo] = useState<string>("");
  const [transferContactSearch, setTransferContactSearch] = useState("");
  
  // Schedule state for transfer
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("always");
  const [scheduleDuration, setScheduleDuration] = useState<number>(2);
  const [scheduleStartTime, setScheduleStartTime] = useState<string>("");
  const [scheduleEndTime, setScheduleEndTime] = useState<string>("");

  // Persist across refresh
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.messages, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    saveContacts(contacts);
  }, [contacts]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.pinned, JSON.stringify(Array.from(pinnedConversations)));
  }, [pinnedConversations]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.muted, JSON.stringify(Array.from(mutedConversations)));
  }, [mutedConversations]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.transferPrefs, JSON.stringify(transferPrefsByConversation));
  }, [transferPrefsByConversation]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.languages,
      JSON.stringify({ receiveLanguage, sendLanguage })
    );
  }, [receiveLanguage, sendLanguage]);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  const filteredMessages = useMemo(() => {
    const filtered = messages.filter((msg) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        msg.contactName.toLowerCase().includes(q) ||
        msg.contactPhone.toLowerCase().includes(q) ||
        msg.content.toLowerCase().includes(q);
      
      // Filter by tab
      if (activeFilter === "all" && (msg.status === "blocked" || msg.status === "held")) return false; // All excludes blocked and held
      if (activeFilter === "unread" && (msg.isRead || msg.status === "blocked" || msg.status === "held")) return false;
      if (activeFilter === "priority" && msg.status !== "priority") return false;
      if (activeFilter === "held" && msg.status !== "held") return false;
      if (activeFilter === "blocked" && msg.status !== "blocked") return false;
      
      return matchesSearch;
    });

    // Pinned conversations float to top
    return [...filtered].sort((a, b) => {
      const aPinned = pinnedConversations.has(a.id) ? 1 : 0;
      const bPinned = pinnedConversations.has(b.id) ? 1 : 0;
      return bPinned - aPinned;
    });
  }, [messages, searchQuery, activeFilter, pinnedConversations]);

  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    filteredMessages[0]?.id ?? null
  );

  const normalizePhone = (value: string) => value.replace(/[^\d+]/g, "").toLowerCase();
  const looksLikePhoneNumber = (value: string) => {
    return isValidUsPhoneNumber(value);
  };

  const phonesInFilteredConversations = useMemo(() => {
    return new Set(filteredMessages.map((m) => normalizePhone(m.contactPhone)));
  }, [filteredMessages]);

  const matchingContacts = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return [] as Contact[];
    const qLower = q.toLowerCase();
    const qPhone = normalizePhone(q);

    return contacts
      .filter((c) => {
        if (phonesInFilteredConversations.has(normalizePhone(c.phone))) return false;
        const nameMatch = c.name.toLowerCase().includes(qLower);
        const phoneMatch = c.phone.toLowerCase().includes(qLower) || normalizePhone(c.phone).includes(qPhone);
        return nameMatch || phoneMatch;
      })
      .slice(0, 6);
  }, [contacts, phonesInFilteredConversations, searchQuery]);

  const canStartNewNumber = useMemo(() => {
    const q = searchQuery.trim();
    if (!q || !looksLikePhoneNumber(q)) return false;
    const qNorm = normalizePhone(q);
    const existsInContacts = contacts.some((c) => normalizePhone(c.phone) === qNorm);
    return !existsInContacts;
  }, [contacts, searchQuery]);

  const startConversationForContact = (contact: Contact) => {
    const existing = messages.find((m) => normalizePhone(m.contactPhone) === normalizePhone(contact.phone));
    if (existing) {
      setSelectedMessageId(existing.id);
      setSearchQuery("");
      if (isMobile) setMobilePane("chat");
      return;
    }

    const newConversation: Message = {
      id: `new-${Date.now()}`,
      contactId: contact.id,
      contactName: contact.name,
      contactPhone: contact.phone,
      content: "New conversation",
      timestamp: "Now",
      isIncoming: false,
      status: "allowed",
      rule: contact.tags?.[0] || "Contact",
      isRead: true,
    };

    setMessages((prev) => [newConversation, ...prev]);
    setSelectedMessageId(newConversation.id);
    setSearchQuery("");
    if (isMobile) setMobilePane("chat");
  };

  const startConversationForNumber = (rawPhone: string) => {
    const phone = rawPhone.trim();
    if (!phone) return;

    if (!isValidUsPhoneNumber(phone)) {
      toast.error("Enter a valid phone number (10 digits, optional +1)");
      return;
    }
    const existing = messages.find((m) => normalizePhone(m.contactPhone) === normalizePhone(phone));
    if (existing) {
      setSelectedMessageId(existing.id);
      setSearchQuery("");
      if (isMobile) setMobilePane("chat");
      return;
    }

    const newConversation: Message = {
      id: `new-${Date.now()}`,
      contactId: `phone:${normalizePhone(phone)}`,
      contactName: phone,
      contactPhone: phone,
      content: "New conversation",
      timestamp: "Now",
      isIncoming: false,
      status: "allowed",
      rule: "New Number",
      isRead: true,
    };

    setMessages((prev) => [newConversation, ...prev]);
    setSelectedMessageId(newConversation.id);
    setSearchQuery("");
    if (isMobile) setMobilePane("chat");
  };

  // Auto-select conversation when navigating from contacts
  useEffect(() => {
    if (selectedContactPhone) {
      // Try to find an existing conversation with this phone number
      const matchingMessage = messages.find(msg => msg.contactPhone === selectedContactPhone);
      if (matchingMessage) {
        setSelectedMessageId(matchingMessage.id);
        if (isMobile) setMobilePane("chat");
        toast.success(`Opened chat with ${matchingMessage.contactName}`);
      } else {
        // No existing conversation, show toast
        toast.info(`Starting new conversation with ${selectedContactPhone}`);
      }
      onClearSelection?.();
    }
  }, [selectedContactPhone]);

  const selectedMessage = useMemo(() => {
    const byId = selectedMessageId ? filteredMessages.find((m) => m.id === selectedMessageId) : undefined;
    return byId ?? filteredMessages[0] ?? null;
  }, [filteredMessages, selectedMessageId]);

  const selectedSavedContact = useMemo(() => {
    if (!selectedMessage) return null;
    const phone = normalizePhone(selectedMessage.contactPhone);
    return contacts.find((c) => normalizePhone(c.phone) === phone) ?? null;
  }, [contacts, selectedMessage]);

  const [threadsByContactId, setThreadsByContactId] = useState<Record<string, ChatBubble[]>>({});

  useEffect(() => {
    if (!selectedMessage) return;
    setThreadsByContactId((prev) => {
      if (prev[selectedMessage.contactId]) return prev;
      const seed: ChatBubble[] = [
        {
          id: `${selectedMessage.contactId}-seed-incoming`,
          role: "incoming",
          content: selectedMessage.content,
          timestamp: selectedMessage.timestamp,
        },
        {
          id: `${selectedMessage.contactId}-seed-ai`,
          role: "ai",
          content: "AI summary: Message received. Suggested reply drafted.",
          timestamp: "Now",
        },
      ];
      return { ...prev, [selectedMessage.contactId]: seed };
    });
  }, [selectedMessage]);

  useEffect(() => {
    if (!isMobile) {
      setMobilePane("chat");
      return;
    }
    setMobilePane(selectedMessage ? "chat" : "list");
  }, [isMobile, selectedMessage]);

  const activeThread = selectedMessage ? threadsByContactId[selectedMessage.contactId] ?? [] : [];

  useEffect(() => {
    if (!showAiChat || !selectedMessage) return;
    setAiChatsByConversationId((prev) => {
      if (prev[selectedMessage.id]?.length) return prev;
      const seed: AiChatMessage[] = [
        {
          id: `${selectedMessage.id}-seed`,
          isUser: false,
          content: `Ask me anything about your chat with ${selectedMessage.contactName}.`,
          timestamp: "Now",
        },
      ];
      return { ...prev, [selectedMessage.id]: seed };
    });
  }, [selectedMessage, showAiChat]);

  const handleSelectConversation = (id: string) => {
    setSelectedMessageId(id);
    if (isMobile) setMobilePane("chat");
  };

  const handleSend = () => {
    if (!selectedMessage) return;

    const trimmed = newMessage.trim();
    if (!trimmed && !pendingAttachment) return;

    const now = new Date();
    const timestamp = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase();
    const toAppend: ChatBubble[] = [];

    if (trimmed) {
      toAppend.push({
        id: `${selectedMessage.contactId}-${now.getTime()}`,
        role: "outgoing",
        content: trimmed,
        timestamp,
      });
    }

    if (pendingAttachment) {
      toAppend.push({
        id: `${selectedMessage.contactId}-${now.getTime()}-file`,
        role: "outgoing",
        content: `📎 ${pendingAttachment.name}`,
        timestamp,
      });
    }

    setThreadsByContactId((prev) => ({
      ...prev,
      [selectedMessage.contactId]: [...(prev[selectedMessage.contactId] ?? []), ...toAppend],
    }));

    setNewMessage("");
    setPendingAttachment(null);
    setShowEmojiPicker(false);
    setAiAssistOpen(false);
    setAiAssistMode(null);
    setAiAssistRewrite("");
    setAiAssistSuggestions([]);
    toast.success("Message sent");
  };

  // Status colors and labels
  const getStatusInfo = (status: Message["status"]) => {
    switch (status) {
      case "priority":
        return { color: "hsl(var(--chat-pink))", bg: "hsl(var(--chat-pink) / 0.12)", icon: Star, label: "Priority" };
      case "protected":
        return { color: "hsl(var(--chat-green))", bg: "hsl(var(--chat-green) / 0.12)", icon: Shield, label: "Protected" };
      case "blocked":
        return { color: "hsl(var(--chat-red))", bg: "hsl(var(--chat-red) / 0.12)", icon: AlertTriangle, label: "Blocked" };
      case "held":
        return { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.12)", icon: AlertTriangle, label: "Held" };
      default:
        return { color: "hsl(var(--chat-blue))", bg: "hsl(var(--chat-blue) / 0.12)", icon: MessageSquare, label: "Message" };
    }
  };

  // More menu actions
  const handleTranslate = () => {
    setShowTranslateModal(true);
    setShowMoreMenu(false);
  };

  const openAiChat = () => {
    if (!selectedMessage) return;
    setShowMoreMenu(false);
    setShowTranslateModal(false);
    setShowTransferModal(false);
    setShowAiChat(true);

    setAiChatsByConversationId((prev) => {
      if (prev[selectedMessage.id]?.length) return prev;
      const seed: AiChatMessage[] = [
        {
          id: `${selectedMessage.id}-seed`,
          isUser: false,
          content: `Ask me anything about your chat with ${selectedMessage.contactName}.`,
          timestamp: "Now",
        },
      ];
      return { ...prev, [selectedMessage.id]: seed };
    });
  };

  const closeAiChat = () => {
    setShowAiChat(false);
    setAiInput("");
  };

  const buildConversationContext = () => {
    if (!selectedMessage) return "";
    const recent = activeThread.slice(-12);
    const transcript = recent
      .map((b) => {
        const who = b.role === "incoming" ? selectedMessage.contactName : b.role === "outgoing" ? "Me" : "AI";
        return `${who}: ${b.content}`;
      })
      .join("\n");
    return `Conversation with ${selectedMessage.contactName} (${selectedMessage.contactPhone}):\n${transcript}`;
  };

  const respondAsAi = (userText: string) => {
    if (!selectedMessage) return "";
    const t = userText.toLowerCase();
    const incomingOnly = activeThread.filter((b) => b.role === "incoming").slice(-6);
    const lastIncoming = incomingOnly[incomingOnly.length - 1]?.content;

    if (t.includes("summarize") || t.includes("summary")) {
      const points = incomingOnly.length
        ? incomingOnly.map((b) => `- ${b.content}`).join("\n")
        : "- No incoming messages yet.";
      return `Here’s a quick summary of recent messages from ${selectedMessage.contactName}:\n\n${points}`;
    }

    if (t.includes("reply") || t.includes("respond") || t.includes("draft")) {
      const base = lastIncoming
        ? `Based on their last message (“${lastIncoming}”), here are 2 reply options:`
        : `Here are 2 reply options:`;
      return `${base}\n\n1) "Sounds good — I’ll take care of it today."\n2) "Thanks for the heads up. Can you share any more details?"`;
    }

    return `I can help summarize, draft replies, and spot urgency. What would you like to know about ${selectedMessage.contactName}?`;
  };

  const handleAiSend = () => {
    if (!selectedMessage) return;
    const text = aiInput.trim();
    if (!text) return;

    const now = new Date();
    const timestamp = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase();

    const userMsg: AiChatMessage = {
      id: `${selectedMessage.id}-user-${now.getTime()}`,
      isUser: true,
      content: text,
      timestamp,
    };

    const context = buildConversationContext();
    const aiText = respondAsAi(`${text}\n\n${context}`);

    const aiMsg: AiChatMessage = {
      id: `${selectedMessage.id}-ai-${now.getTime() + 1}`,
      isUser: false,
      content: aiText,
      timestamp,
    };

    setAiChatsByConversationId((prev) => ({
      ...prev,
      [selectedMessage.id]: [...(prev[selectedMessage.id] ?? []), userMsg, aiMsg],
    }));

    setAiInput("");
  };

  useEffect(() => {
    if (!showAiChat || !selectedMessage) return;
    aiChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [showAiChat, selectedMessage?.id, aiChatsByConversationId]);

  const openContactEditor = () => {
    if (!selectedMessage) return;
    setShowMoreMenu(false);

    const seedName = selectedSavedContact?.name || selectedMessage.contactName;
    const [firstName, ...lastNameParts] = seedName.split(" ");
    setContactEditForm({
      firstName: firstName || "",
      lastName: lastNameParts.join(" "),
      phone: selectedSavedContact?.phone || selectedMessage.contactPhone,
      notes: selectedSavedContact?.notes || "",
      isFavorite: !!selectedSavedContact?.isFavorite,
      tags: selectedSavedContact?.tags || [],
    });
    setContactCustomTagInput("");
    setShowContactModal(true);
  };

  const toggleContactTag = (tag: string) => {
    setContactEditForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
    }));
  };

  const saveContactFromInbox = () => {
    const first = contactEditForm.firstName.trim();
    const last = contactEditForm.lastName.trim();
    const fullName = `${first} ${last}`.trim();
    const phone = contactEditForm.phone.trim();

    if (!first || !phone) {
      toast.error("Name and phone are required");
      return;
    }

    if (!isValidUsPhoneNumber(phone)) {
      toast.error("Enter a valid phone number (10 digits, optional +1)");
      return;
    }

    const oldPhone = selectedSavedContact?.phone || selectedMessage?.contactPhone || phone;
    const oldPhoneNorm = normalizePhone(oldPhone);
    const newPhoneNorm = normalizePhone(phone);

    setContacts((prev) => {
      const collision = prev.find((c) => c.id !== selectedSavedContact?.id && normalizePhone(c.phone) === newPhoneNorm);
      if (collision) {
        toast.error("That phone number is already saved for another contact");
        return prev;
      }

      if (selectedSavedContact) {
        return prev.map((c) =>
          c.id === selectedSavedContact.id
            ? {
                ...c,
                name: fullName,
                phone,
                notes: contactEditForm.notes || undefined,
                isFavorite: contactEditForm.isFavorite,
                tags: contactEditForm.tags,
              }
            : c
        );
      }

      const newContact: Contact = {
        id: `inbox-${Date.now()}`,
        name: fullName,
        phone,
        notes: contactEditForm.notes || undefined,
        isFavorite: contactEditForm.isFavorite,
        tags: contactEditForm.tags,
      };
      return [...prev, newContact];
    });

    // Keep conversation display info in sync (name + optionally phone)
    setMessages((prev) =>
      prev.map((m) => {
        if (normalizePhone(m.contactPhone) !== oldPhoneNorm) return m;
        return {
          ...m,
          contactName: fullName,
          contactPhone: selectedSavedContact ? phone : m.contactPhone,
        };
      })
    );

    toast.success(selectedSavedContact ? "Contact updated" : "Contact saved");
    setShowContactModal(false);
  };

  const handleTransfer = () => {
    if (selectedMessage) {
      const prefs = transferPrefsByConversation[selectedMessage.id];
      if (prefs) {
        setTransferType(prefs.type);
        setPriorityFilter(prefs.priorityFilter);
        setTransferTo(prefs.to);
        if (prefs.to.startsWith("custom:")) {
          setTransferContactSearch(prefs.to.replace("custom:", ""));
        }
      }
    }
    setShowTransferModal(true);
    setShowMoreMenu(false);
  };

  const handlePin = () => {
    if (!selectedMessage) return;
    const isPinned = pinnedConversations.has(selectedMessage.id);
    setPinnedConversations(prev => {
      const next = new Set(prev);
      if (isPinned) {
        next.delete(selectedMessage.id);
      } else {
        next.add(selectedMessage.id);
      }
      return next;
    });
    toast.success(isPinned ? "Conversation unpinned" : "Conversation pinned");
    setShowMoreMenu(false);
  };

  const handleMute = () => {
    if (!selectedMessage) return;
    const isMuted = mutedConversations.has(selectedMessage.id);
    setMutedConversations(prev => {
      const next = new Set(prev);
      if (isMuted) {
        next.delete(selectedMessage.id);
      } else {
        next.add(selectedMessage.id);
      }
      return next;
    });
    toast.success(isMuted ? "Conversation unmuted" : "Conversation muted");
    setShowMoreMenu(false);
  };

  const handleTransferSubmit = () => {
    if (!transferTo) {
      toast.error("Please select a contact or enter a number to transfer to");
      return;
    }
    
    // Validate custom schedule
    if (scheduleMode === "custom") {
      if (!scheduleStartTime || !scheduleEndTime) {
        toast.error("Please set both start and end times");
        return;
      }
      if (new Date(scheduleStartTime) >= new Date(scheduleEndTime)) {
        toast.error("End time must be after start time");
        return;
      }
    }
    
    // Build description based on mode and type
    let transferDescription = "";
    if (transferMode === "calls") {
      transferDescription = "all calls";
    } else if (transferMode === "messages") {
      transferDescription = transferType === "all" ? "all messages" : "high priority messages";
    } else {
      // both
      const msgPart = transferType === "all" ? "all messages" : "high priority messages";
      transferDescription = `all calls and ${msgPart}`;
    }
    
    // Check if it's a custom number
    const isCustomNumber = transferTo.startsWith("custom:");
    const contactPhone = isCustomNumber 
      ? transferTo.replace("custom:", "") 
      : contacts.find(c => c.id === transferTo)?.phone || "";
    const contactName = isCustomNumber 
      ? transferTo.replace("custom:", "") 
      : contacts.find(c => c.id === transferTo)?.name || "selected contact";
    
    // Create the rule
    const newRule: ActiveRule = {
      id: `transfer-${Date.now()}`,
      rule: `Transfer ${transferDescription} to ${contactName} (${contactPhone})`,
      active: true,
      createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      type: "transfer",
      schedule: {
        mode: scheduleMode,
        durationHours: scheduleMode === "duration" ? scheduleDuration : undefined,
        startTime: scheduleMode === "custom" ? scheduleStartTime : undefined,
        endTime: scheduleMode === "custom" ? scheduleEndTime : undefined,
      },
      transferDetails: {
        mode: transferMode,
        priority: transferType,
        priorityFilter: priorityFilter !== "all" ? priorityFilter : undefined,
        contactName,
        contactPhone,
      },
    };
    
    // Save to rules store
    const existingRules = loadRules();
    saveRules([newRule, ...existingRules]);
    
    // Build schedule description
    let scheduleDesc = "";
    if (scheduleMode === "duration") {
      scheduleDesc = ` for ${scheduleDuration} hour${scheduleDuration > 1 ? "s" : ""}`;
    } else if (scheduleMode === "custom") {
      const start = new Date(scheduleStartTime);
      const end = new Date(scheduleEndTime);
      const formatDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      scheduleDesc = ` from ${formatDate(start)} to ${formatDate(end)}`;
    }
    
    toast.success(`Transfer rule created! ${transferDescription} → ${contactName}${scheduleDesc}`);

    // Remember last used transfer settings per conversation
    if (selectedMessage) {
      setTransferPrefsByConversation(prev => ({
        ...prev,
        [selectedMessage.id]: {
          to: transferTo,
          type: transferType,
          priorityFilter,
        },
      }));
    }

    // Reset schedule state
    setScheduleMode("always");
    setScheduleDuration(2);
    setScheduleStartTime("");
    setScheduleEndTime("");
    setShowTransferModal(false);
  };

  const filteredTransferContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(transferContactSearch.toLowerCase()) ||
    c.phone.toLowerCase().includes(transferContactSearch.toLowerCase())
  );

  const handleBlock = () => {
    if (!selectedMessage) return;
    setMessages(prev => prev.map(m => 
      m.id === selectedMessage.id ? { ...m, status: "blocked" as const } : m
    ));
    toast.success("Contact blocked");
    setShowMoreMenu(false);
  };

  const handleUnblock = () => {
    if (!selectedMessage) return;
    setMessages(prev => prev.map(m => 
      m.id === selectedMessage.id ? { ...m, status: "allowed" as const } : m
    ));
    toast.success("Contact unblocked");
    setShowMoreMenu(false);
  };

  const handleDelete = () => {
    if (!selectedMessage) return;
    const conversationId = selectedMessage.id;
    const contactId = selectedMessage.contactId;

    setMessages(prev => prev.filter(m => m.id !== conversationId));
    setThreadsByContactId(prev => {
      const next = { ...prev };
      delete next[contactId];
      return next;
    });
    setPinnedConversations(prev => {
      const next = new Set(prev);
      next.delete(conversationId);
      return next;
    });
    setMutedConversations(prev => {
      const next = new Set(prev);
      next.delete(conversationId);
      return next;
    });
    setTransferPrefsByConversation(prev => {
      const next = { ...prev };
      delete next[conversationId];
      return next;
    });
    setSelectedMessageId(null);
    toast.success("Conversation deleted");
    setShowMoreMenu(false);
  };

  // AI actions
  const handleAiRewrite = () => {
    if (!newMessage.trim()) {
      toast.error("Type a message first to rewrite");
      return;
    }
    const suggestion = buildRewriteSuggestion(newMessage);
    setAiAssistMode("rewrite");
    setAiAssistRewrite(suggestion);
    setAiAssistSuggestions([]);
    setAiAssistOpen(true);
  };

  const handleAiSuggestion = () => {
    const base = [
      "Thank you for reaching out! I'll look into this right away.",
      "I understand your concern. Let me help you with that.",
      "Got it — I can help. Can you share one more detail?",
      "Thanks — I’m on it. I’ll update you shortly.",
      "Understood. I’ll take care of this today.",
    ];

    const picks = base.slice().sort(() => Math.random() - 0.5).slice(0, 3);
    setAiAssistMode("suggest");
    setAiAssistSuggestions(picks);
    setAiAssistRewrite("");
    setAiAssistOpen(true);
  };

  return (
    <div className="h-full flex bg-white">
      {/* Conversation List */}
      <section
        className={cn(
          "w-full md:shrink-0 flex flex-col border-r border-gray-200 bg-white overflow-hidden transition-all duration-500",
          isMobile && mobilePane === "chat" ? "hidden" : "flex",
          !isMobile && showAiChat ? "md:w-0 md:opacity-0 md:pointer-events-none md:border-r-0" : "md:w-80 md:opacity-100"
        )}
      >
        {/* Header spacer */}
        <div className="h-3"></div>

        {/* Search */}
        <div className="p-3 border-b border-gray-200">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded text-sm bg-gray-50 text-gray-700 placeholder:text-gray-400 border border-gray-200 focus:outline-none focus:border-gray-300"
            />
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-200">
          {([
            { id: "all", label: "All" },
            { id: "unread", label: "Unread" },
            { id: "priority", label: "Priority" },
            { id: "held", label: "Held" },
            { id: "blocked", label: "Blocked" },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={cn(
                "px-2.5 py-1 text-xs rounded transition-colors",
                activeFilter === tab.id
                  ? "bg-gray-100 text-gray-800 font-medium"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {searchQuery.trim() && (matchingContacts.length > 0 || canStartNewNumber) && (
            <div className="border-b border-gray-100">
              {matchingContacts.map((contact) => (
                <button
                  key={`contact-${contact.id}`}
                  onClick={() => startConversationForContact(contact)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-medium bg-indigo-500">
                      {contact.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-gray-800 font-medium">{contact.name}</p>
                      <p className="truncate text-xs text-gray-500">{contact.phone}</p>
                    </div>
                    <MessageSquare className="w-4 h-4 text-gray-400 shrink-0" />
                  </div>
                </button>
              ))}

              {canStartNewNumber && (
                <button
                  onClick={() => startConversationForNumber(searchQuery)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-medium bg-emerald-500">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-gray-800 font-medium">Text {searchQuery.trim()}</p>
                      <p className="truncate text-xs text-gray-500">Start a new conversation</p>
                    </div>
                  </div>
                </button>
              )}
            </div>
          )}

          {filteredMessages.length === 0 ? (
            searchQuery.trim() && (matchingContacts.length > 0 || canStartNewNumber) ? null : (
              <div className="p-6 text-center">
                <p className="text-sm text-gray-500">No conversations found</p>
              </div>
            )
          ) : (
            filteredMessages.map((msg) => {
              const isSelected = selectedMessage?.id === msg.id;
              const isUnread = !msg.isRead;
              const isPinned = pinnedConversations.has(msg.id);
              const statusInfo = getStatusInfo(msg.status);

              const togglePinFromRow = (e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                setPinnedConversations(prev => {
                  const next = new Set(prev);
                  if (next.has(msg.id)) next.delete(msg.id);
                  else next.add(msg.id);
                  return next;
                });
              };

              return (
                <button
                  key={msg.id}
                  onClick={() => handleSelectConversation(msg.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-gray-100 transition-colors",
                    isSelected ? "bg-gray-100" : "hover:bg-gray-50"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div 
                    className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-white text-sm font-medium bg-indigo-500"
                  >
                    {msg.contactName.charAt(0)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className={cn("truncate text-sm text-gray-800", isUnread ? "font-semibold" : "font-medium")}>
                          {msg.contactName}
                        </p>
                        {isUnread && (
                          <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-emerald-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs text-gray-500">{msg.timestamp}</span>
                        <button
                          onClick={togglePinFromRow}
                          className={cn(
                            "p-1 rounded hover:bg-gray-100 transition-colors",
                            isPinned ? "text-amber-500" : "text-gray-300 hover:text-gray-500"
                          )}
                          aria-label={isPinned ? "Unpin" : "Pin"}
                          title={isPinned ? "Unpin" : "Pin"}
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Status tag */}
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span 
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                        style={{ 
                          background: statusInfo.bg,
                          color: statusInfo.color
                        }}
                      >
                        <statusInfo.icon className="w-3 h-3" />
                        {statusInfo.label}
                      </span>
                    </div>

                    <p className="truncate text-xs text-gray-500 mt-1">
                      {msg.content}
                    </p>
                  </div>
                </div>
              </button>
              );
            })
          )}
        </div>
      </section>

      {/* Chat View */}
      <section
        className={cn(
          "flex-1 flex flex-col bg-white",
          isMobile && mobilePane === "list" ? "hidden" : "flex"
        )}
      >
        {selectedMessage ? (
          <>
            {/* Chat header */}
            <div className="h-14 px-4 flex items-center justify-between border-b border-gray-200 shrink-0 bg-white">
              <div className="flex items-center gap-3">
                {isMobile && (
                  <button
                    className="-ml-2 p-2 rounded hover:bg-gray-100 transition-colors"
                    onClick={() => setMobilePane("list")}
                    aria-label="Back"
                  >
                    <ArrowLeft className="w-5 h-5 text-gray-500" />
                  </button>
                )}
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium bg-indigo-500">
                  {selectedMessage.contactName.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {selectedMessage.contactName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {selectedMessage.status === "blocked" ? "Blocked" : "Online"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  className={cn(
                    "p-2 rounded transition-colors",
                    showAiChat ? "bg-purple-50" : "hover:bg-gray-100"
                  )}
                  aria-label="AI"
                  onClick={() => {
                    if (showAiChat) {
                      closeAiChat();
                    } else {
                      openAiChat();
                    }
                  }}
                >
                  <Bot className="w-4 h-4 text-purple-600" />
                </button>

                <button
                  className="p-2 rounded hover:bg-teal-50 transition-colors"
                  aria-label="Transfer"
                  onClick={handleTransfer}
                >
                  <ArrowRightLeft className="w-4 h-4 text-teal-600" />
                </button>

                <button
                  className="p-2 rounded hover:bg-green-50 transition-colors"
                  aria-label="Call"
                  onClick={() => toast("Calling…", { description: selectedMessage.contactName })}
                >
                  <Phone className="w-4 h-4 text-green-600" />
                </button>
                
                {/* More menu */}
                <div className="relative" ref={moreMenuRef}>
                  <button
                    className="p-2 rounded hover:bg-gray-100 transition-colors"
                    aria-label="More"
                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                  >
                    <MoreHorizontal className="w-4 h-4 text-gray-500" />
                  </button>
                  
                  {showMoreMenu && (
                    <div className="absolute right-0 top-10 w-44 bg-[#F5F5F5] border border-gray-200 rounded-lg shadow-lg py-1 z-50">
                      <button
                        onClick={openContactEditor}
                        className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        {selectedSavedContact ? (
                          <>
                            <Pencil className="w-4 h-4 mr-2.5 text-blue-500" />
                            Edit contact
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4 mr-2.5 text-blue-500" />
                            Save contact
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleTranslate}
                        className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Languages className="w-4 h-4 mr-2.5 text-blue-500" />
                        Translate
                      </button>
                      <button
                        onClick={handlePin}
                        className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        {pinnedConversations.has(selectedMessage.id) ? (
                          <>
                            <PinOff className="w-4 h-4 mr-2.5 text-amber-500" />
                            Unpin
                          </>
                        ) : (
                          <>
                            <Pin className="w-4 h-4 mr-2.5 text-gray-500" />
                            Pin
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleMute}
                        className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        {mutedConversations.has(selectedMessage.id) ? (
                          <>
                            <Bell className="w-4 h-4 mr-2.5 text-green-500" />
                            Unmute
                          </>
                        ) : (
                          <>
                            <BellOff className="w-4 h-4 mr-2.5 text-orange-500" />
                            Mute
                          </>
                        )}
                      </button>
                      <div className="border-t border-gray-100 my-1" />
                      {selectedMessage?.status === "blocked" ? (
                        <button
                          onClick={handleUnblock}
                          className="flex items-center w-full px-3 py-2 text-sm text-green-600 hover:bg-green-50"
                        >
                          <Ban className="w-4 h-4 mr-2.5" />
                          Unblock
                        </button>
                      ) : (
                        <button
                          onClick={handleBlock}
                          className="flex items-center w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          <Ban className="w-4 h-4 mr-2.5" />
                          Block
                        </button>
                      )}
                      <button
                        onClick={handleDelete}
                        className="flex items-center w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 mr-2.5" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              <div className="w-full space-y-4">
                {/* Date separator */}
                <div className="flex items-center justify-center">
                  <span className="px-3 py-1 rounded-full bg-gray-200 text-[11px] font-medium text-gray-600">
                    Today
                  </span>
                </div>

                {activeThread.map((bubble) => {
                  const isOutgoing = bubble.role === "outgoing";
                  const isAi = bubble.role === "ai";
                  const isIncoming = bubble.role === "incoming";
                  const isLeftAligned = isIncoming;
                  return (
                    <div
                      key={bubble.id}
                      className={cn(
                        "flex items-end gap-2",
                        isLeftAligned ? "justify-start" : "justify-end"
                      )}
                    >
                      {isLeftAligned && (
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0 bg-indigo-500">
                          {selectedMessage.contactName.charAt(0)}
                        </div>
                      )}

                      <div className="max-w-[78%]">
                        <div
                          className={cn(
                            "rounded-lg px-3 py-2",
                            isOutgoing
                              ? "bg-indigo-500 text-white rounded-br-sm"
                              : isAi
                                ? "bg-purple-100 border border-purple-200 text-gray-700 rounded-bl-sm"
                                : "bg-white border border-gray-200 text-gray-700 rounded-bl-sm"
                          )}
                        >
                          {isAi && (
                            <div className="flex items-center gap-1.5 mb-1">
                              <Sparkles className="w-3 h-3 text-purple-500" />
                              <span className="text-[11px] font-medium text-purple-600">AI Assistant</span>
                            </div>
                          )}
                          <p className="text-sm">{bubble.content}</p>
                        </div>
                        <p className={cn("text-[11px] text-gray-500 mt-1", isLeftAligned ? "ml-1" : "text-right mr-1")}>
                          {bubble.timestamp}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Message input */}
            <div className="p-3 border-t border-gray-200 bg-white shrink-0">

              {pendingAttachment && (
                <div className="mb-2 flex items-center justify-between gap-2 px-3 py-2 rounded border border-gray-200 bg-gray-50">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-700 truncate">{pendingAttachment.name}</p>
                    <p className="text-[11px] text-gray-500">{Math.round(pendingAttachment.size / 1024)} KB</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingAttachment(null)}
                    className="p-1.5 rounded hover:bg-gray-200"
                    aria-label="Remove attachment"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              )}

              {/* AI assist output — subtle, above composer */}
              {aiAssistOpen &&
                aiAssistMode &&
                ((aiAssistMode === "rewrite" && aiAssistRewrite.trim().length > 0) ||
                  (aiAssistMode === "suggest" && aiAssistSuggestions.length > 0)) && (
                  <div className="mb-2 px-2 py-1.5 rounded bg-gray-50 border border-gray-200 text-xs">
                    {aiAssistMode === "rewrite" ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="text-gray-700 flex-1 text-left hover:text-indigo-600 transition-colors truncate"
                          onClick={() => {
                            if (aiAssistRewrite.trim()) setNewMessage(aiAssistRewrite);
                            setAiAssistOpen(false);
                            setAiAssistMode(null);
                            setAiAssistRewrite("");
                            messageInputRef.current?.focus();
                          }}
                          title={aiAssistRewrite}
                        >
                          {aiAssistRewrite}
                        </button>
                        <button
                          type="button"
                          className="text-gray-400 hover:text-gray-600 shrink-0"
                          onClick={() => {
                            setAiAssistOpen(false);
                            setAiAssistMode(null);
                            setAiAssistRewrite("");
                          }}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        {aiAssistSuggestions.map((s) => (
                          <button
                            key={s}
                            type="button"
                            className="px-2 py-0.5 rounded bg-white border border-gray-200 text-gray-700 hover:border-indigo-300 hover:text-indigo-600 transition-colors truncate max-w-[180px]"
                            onClick={() => {
                              setNewMessage(s);
                              setAiAssistOpen(false);
                              setAiAssistMode(null);
                              setAiAssistSuggestions([]);
                              messageInputRef.current?.focus();
                            }}
                            title={s}
                          >
                            {s.length > 30 ? s.slice(0, 30) + "…" : s}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="text-gray-400 hover:text-gray-600"
                          onClick={() => {
                            setAiAssistOpen(false);
                            setAiAssistMode(null);
                            setAiAssistSuggestions([]);
                          }}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/jpeg,image/png,image/gif,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.jpg,.jpeg,.png,.gif,.pdf,.docx"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    if (file.size > MAX_ATTACHMENT_BYTES) {
                      toast.error("File must be under 5 MB");
                      e.currentTarget.value = "";
                      return;
                    }

                    if (!isAllowedAttachment(file)) {
                      toast.error("Unsupported file type. Allowed: JPEG, PNG, GIF, PDF, DOCX.");
                      e.currentTarget.value = "";
                      return;
                    }

                    setPendingAttachment(file);
                    toast.success("Attachment added");
                  }}
                />
                <button
                  className="p-2 rounded hover:bg-gray-100 transition-colors shrink-0"
                  aria-label="Attach"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="w-4 h-4 text-gray-500" />
                </button>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSend();
                      if (e.key === "Escape") {
                        setShowEmojiPicker(false);
                        setAiAssistOpen(false);
                        setAiAssistMode(null);
                        setAiAssistRewrite("");
                        setAiAssistSuggestions([]);
                      }
                    }}
                    ref={messageInputRef}
                    className="w-full pl-4 pr-28 py-2 rounded text-sm bg-gray-50 text-gray-700 placeholder:text-gray-400 border border-gray-200 focus:outline-none focus:border-gray-300"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      onClick={handleAiRewrite}
                      title="Rewrite (suggestion)"
                      className={cn(
                        "inline-flex items-center justify-center w-8 h-8 rounded transition-colors",
                        aiAssistOpen && aiAssistMode === "rewrite" ? "bg-purple-100" : "hover:bg-gray-100"
                      )}
                      type="button"
                    >
                      <Wand2 className="w-4 h-4 text-purple-600" />
                    </button>
                    <button
                      onClick={handleAiSuggestion}
                      title="Reply ideas"
                      className={cn(
                        "inline-flex items-center justify-center w-8 h-8 rounded transition-colors",
                        aiAssistOpen && aiAssistMode === "suggest" ? "bg-purple-100" : "hover:bg-gray-100"
                      )}
                      type="button"
                    >
                      <Lightbulb className="w-4 h-4 text-purple-600" />
                    </button>
                    <button
                      className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-gray-100 transition-colors"
                      onClick={() => setShowEmojiPicker((v) => !v)}
                      aria-label="Emoji"
                      type="button"
                    >
                      <Smile className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>

                  {showEmojiPicker && (
                    <div className="absolute bottom-full left-0 mb-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-20">
                      <div className="grid grid-cols-8 gap-1">
                        {[
                          "😀",
                          "😁",
                          "😂",
                          "😊",
                          "😍",
                          "🥳",
                          "😎",
                          "😅",
                          "🙏",
                          "👍",
                          "👎",
                          "❤️",
                          "🔥",
                          "🎉",
                          "✅",
                          "❗",
                          "✨",
                          "🕒",
                          "📎",
                          "🚨",
                          "📝",
                          "📅",
                          "🏁",
                        ].map((em) => (
                          <button
                            key={em}
                            type="button"
                            className="h-7 w-7 rounded hover:bg-gray-100 text-base"
                            onClick={() => {
                              insertEmoji(em);
                              setShowEmojiPicker(false);
                            }}
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  className="p-2 rounded bg-indigo-500 text-white hover:bg-indigo-600 transition-colors shrink-0"
                  aria-label="Send"
                  onClick={handleSend}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm font-medium text-gray-600">Select a conversation</p>
              <p className="text-xs text-gray-500 mt-1">Choose from your existing conversations</p>
            </div>
          </div>
        )}
      </section>

      {/* AI Panel (desktop) */}
      {!isMobile && (
        <section
          className={cn(
            "shrink-0 bg-white flex flex-col overflow-hidden transition-all duration-500",
            showAiChat && selectedMessage ? "w-96 border-l border-gray-200" : "w-0 border-l-0"
          )}
        >
          {selectedMessage && (
            <>
              <div className="h-14 px-4 flex items-center justify-between border-b border-gray-200 shrink-0 bg-white">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800">AI</p>
                    <p className="text-xs text-gray-500 truncate">{selectedMessage.contactName}</p>
                  </div>
                </div>
                <button
                  className="p-2 rounded hover:bg-gray-100 transition-colors"
                  aria-label="Close AI"
                  onClick={closeAiChat}
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                <div className="space-y-3">
                  {(aiChatsByConversationId[selectedMessage.id] ?? []).map((m) => (
                    <div key={m.id} className={cn("flex", m.isUser ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[85%] rounded-lg px-3 py-2",
                          m.isUser
                            ? "bg-indigo-500 text-white rounded-br-sm"
                            : "bg-white border border-gray-200 text-gray-700 rounded-bl-sm"
                        )}
                      >
                        {!m.isUser && (
                          <div className="flex items-center gap-1.5 mb-1">
                            <Sparkles className="w-3 h-3 text-purple-500" />
                            <span className="text-[11px] font-medium text-purple-600">AI</span>
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-line">{m.content}</p>
                        <p className={cn("text-[11px] mt-1", m.isUser ? "text-indigo-100 text-right" : "text-gray-500")}>{m.timestamp}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={aiChatEndRef} />
                </div>
              </div>

              <div className="p-3 border-t border-gray-200 bg-white shrink-0">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder={`Ask AI about ${selectedMessage.contactName}...`}
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAiSend();
                      }}
                      className="w-full px-4 py-2 rounded text-sm bg-gray-50 text-gray-700 placeholder:text-gray-400 border border-gray-200 focus:outline-none focus:border-gray-300"
                    />
                  </div>
                  <button
                    className="p-2 rounded bg-indigo-500 text-white hover:bg-indigo-600 transition-colors shrink-0"
                    aria-label="Send to AI"
                    onClick={handleAiSend}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/40 z-50"
            onClick={() => setShowTransferModal(false)}
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
            <div
              className="bg-[#F5F5F5] rounded-lg shadow-lg w-full max-w-sm pointer-events-auto overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
                <h2 className="text-sm font-medium text-gray-800">Transfer Conversation</h2>
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div
                className="px-4 py-4 space-y-4 overflow-y-auto max-h-[60vh]"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {/* Transfer Mode: Calls, Messages, Both */}
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">What to transfer</p>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setTransferMode("calls");
                        setTransferType("all");
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded text-xs transition-colors",
                        transferMode === "calls" 
                          ? "bg-indigo-500 text-white" 
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      Calls
                    </button>
                    <button
                      type="button"
                      onClick={() => setTransferMode("messages")}
                      className={cn(
                        "px-3 py-1.5 rounded text-xs transition-colors",
                        transferMode === "messages" 
                          ? "bg-indigo-500 text-white" 
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      Messages
                    </button>
                    <button
                      type="button"
                      onClick={() => setTransferMode("both")}
                      className={cn(
                        "px-3 py-1.5 rounded text-xs transition-colors",
                        transferMode === "both" 
                          ? "bg-indigo-500 text-white" 
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      Both
                    </button>
                  </div>
                </div>

                {/* Priority filter - only for messages or both */}
                {(transferMode === "messages" || transferMode === "both") && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">Priority level</p>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setTransferType("all")}
                        className={cn(
                          "px-3 py-1.5 rounded text-xs transition-colors",
                          transferType === "all" 
                            ? "bg-indigo-500 text-white" 
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setTransferType("high-priority")}
                        className={cn(
                          "px-3 py-1.5 rounded text-xs transition-colors",
                          transferType === "high-priority"
                            ? "bg-indigo-500 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                      >
                        High Priority
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-400">Spam is always excluded</p>
                  </div>
                )}

                {/* Priority category filter - only when high priority is selected */}
                {(transferMode === "messages" || transferMode === "both") && transferType === "high-priority" && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">Category</p>
                    <div className="flex flex-wrap gap-1.5">
                      {([
                        { id: "all", label: "All" },
                        { id: "emergency", label: "Emergency" },
                        { id: "meetings", label: "Meetings" },
                        { id: "deadlines", label: "Deadlines" },
                        { id: "important", label: "Important" },
                      ] as const).map((filter) => (
                        <button
                          key={filter.id}
                          type="button"
                          onClick={() => setPriorityFilter(filter.id)}
                          className={cn(
                            "px-2 py-1 rounded text-xs transition-colors",
                            priorityFilter === filter.id
                              ? "bg-indigo-500 text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          )}
                        >
                          {filter.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Schedule / Duration */}
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">Schedule</p>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setScheduleMode("always")}
                      className={cn(
                        "px-3 py-1.5 rounded text-xs transition-colors",
                        scheduleMode === "always" 
                          ? "bg-indigo-500 text-white" 
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      Always
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleMode("duration")}
                      className={cn(
                        "px-3 py-1.5 rounded text-xs transition-colors",
                        scheduleMode === "duration" 
                          ? "bg-indigo-500 text-white" 
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      For duration
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleMode("custom")}
                      className={cn(
                        "px-3 py-1.5 rounded text-xs transition-colors",
                        scheduleMode === "custom" 
                          ? "bg-indigo-500 text-white" 
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      Custom
                    </button>
                  </div>
                  
                  {/* Duration selector */}
                  {scheduleMode === "duration" && (
                    <div className="flex items-center gap-2 mt-1">
                      <select
                        value={scheduleDuration}
                        onChange={(e) => setScheduleDuration(Number(e.target.value))}
                        className="px-2 py-1.5 rounded text-xs bg-white text-gray-700 border border-gray-200 focus:outline-none focus:border-gray-300"
                      >
                        <option value={1}>1 hour</option>
                        <option value={2}>2 hours</option>
                        <option value={4}>4 hours</option>
                        <option value={8}>8 hours</option>
                        <option value={12}>12 hours</option>
                        <option value={24}>24 hours</option>
                        <option value={48}>2 days</option>
                        <option value={168}>1 week</option>
                      </select>
                      <span className="text-[11px] text-gray-400">from now</span>
                    </div>
                  )}
                  
                  {/* Custom time range */}
                  {scheduleMode === "custom" && (
                    <div className="space-y-2 mt-1">
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-gray-500 w-10">Start</label>
                        <input
                          type="datetime-local"
                          value={scheduleStartTime}
                          onChange={(e) => setScheduleStartTime(e.target.value)}
                          className="flex-1 px-2 py-1.5 rounded text-xs bg-white text-gray-700 border border-gray-200 focus:outline-none focus:border-gray-300"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-gray-500 w-10">End</label>
                        <input
                          type="datetime-local"
                          value={scheduleEndTime}
                          onChange={(e) => setScheduleEndTime(e.target.value)}
                          className="flex-1 px-2 py-1.5 rounded text-xs bg-white text-gray-700 border border-gray-200 focus:outline-none focus:border-gray-300"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Contact Selection */}
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">Transfer to</p>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search or enter number..."
                      value={transferContactSearch}
                      onChange={(e) => setTransferContactSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && transferContactSearch.trim()) {
                          if (isValidUsPhoneNumber(transferContactSearch.trim()) && filteredTransferContacts.length === 0) {
                            setTransferTo(`custom:${transferContactSearch.trim()}`);
                          } else if (filteredTransferContacts.length === 1) {
                            setTransferTo(filteredTransferContacts[0].id);
                          }
                        }
                      }}
                      className="w-full pl-8 pr-3 py-1.5 rounded text-xs bg-white text-gray-700 placeholder:text-gray-400 border border-gray-200 focus:outline-none focus:border-gray-300"
                    />
                  </div>

                  {transferContactSearch.trim() && isValidUsPhoneNumber(transferContactSearch) && (
                    <button
                      type="button"
                      onClick={() => setTransferTo(`custom:${transferContactSearch.trim()}`)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2.5 py-2 text-left transition-colors border border-dashed rounded text-xs",
                        transferTo === `custom:${transferContactSearch.trim()}`
                          ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                          : "border-gray-300 text-gray-600 hover:bg-gray-50"
                      )}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span className="truncate">{transferContactSearch.trim()}</span>
                    </button>
                  )}

                  <div
                    className="max-h-32 overflow-y-auto border border-gray-200 rounded"
                    style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                  >
                    {filteredTransferContacts.map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => setTransferTo(contact.id)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2.5 py-2 text-left transition-colors text-xs",
                          transferTo === contact.id ? "bg-indigo-50" : "hover:bg-gray-50"
                        )}
                      >
                        <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white text-[10px] font-medium shrink-0">
                          {contact.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("truncate", transferTo === contact.id ? "text-indigo-700 font-medium" : "text-gray-700")}>
                            {contact.name}
                          </p>
                          <p className="text-[11px] text-gray-400 truncate">{contact.phone}</p>
                        </div>
                        {transferTo === contact.id && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />}
                      </button>
                    ))}
                    {filteredTransferContacts.length === 0 && (
                      <p className="text-[11px] text-gray-400 text-center py-3">No contacts</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-gray-200 flex gap-2 shrink-0">
                <Button
                  variant="outline"
                  onClick={() => setShowTransferModal(false)}
                  className="flex-1 h-8 text-xs border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleTransferSubmit}
                  className="flex-1 h-8 text-xs bg-indigo-500 hover:bg-indigo-600 text-white"
                >
                  Transfer
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Translate Modal */}
      {showTranslateModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setShowTranslateModal(false)}
          />
          <div className="fixed inset-0 flex items-start justify-center pt-20 z-50 pointer-events-none">
            <div
              className="bg-[#F5F5F5] rounded-xl shadow-2xl w-full max-w-md pointer-events-auto overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
                <h2 className="text-sm font-semibold text-gray-800">Translate</h2>
                <button
                  onClick={() => setShowTranslateModal(false)}
                  className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div>
                  <p className="text-xs font-medium text-gray-800 mb-2">Translate incoming to</p>
                  <select
                    value={receiveLanguage}
                    onChange={(e) => setReceiveLanguage(e.target.value)}
                    className="w-full px-2.5 py-2 text-sm bg-gray-50 border border-gray-200 rounded focus:outline-none focus:border-gray-300"
                  >
                    {languages.map((lang) => (
                      <option key={lang.code} value={lang.code}>{lang.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-800 mb-2">Send in</p>
                  <select
                    value={sendLanguage}
                    onChange={(e) => setSendLanguage(e.target.value)}
                    className="w-full px-2.5 py-2 text-sm bg-gray-50 border border-gray-200 rounded focus:outline-none focus:border-gray-300"
                  >
                    {languages.map((lang) => (
                      <option key={lang.code} value={lang.code}>{lang.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex gap-3 shrink-0">
                <Button
                  variant="outline"
                  onClick={() => setShowTranslateModal(false)}
                  className="flex-1 h-9 text-sm border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Save/Edit Contact Modal */}
      {showContactModal && (
        <>
          {createPortal(
            <div
              className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) setShowContactModal(false);
              }}
            >
              <div className="bg-[#F5F5F5] border border-gray-200 rounded-lg shadow-lg w-full max-w-sm max-h-[85vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
                  <span className="text-sm font-medium text-gray-800">
                    {selectedSavedContact ? "Edit Contact" : "New Contact"}
                  </span>
                  <button onClick={() => setShowContactModal(false)} className="p-1 hover:bg-gray-100 rounded">
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  <div className="p-4 space-y-3">
                    <div className="flex flex-col items-center">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                          <span className="text-lg text-gray-700">{contactEditForm.firstName.charAt(0) || "?"}</span>
                        </div>
                        <button className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gray-800 text-white flex items-center justify-center" type="button">
                          <Camera className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500">First Name *</label>
                        <input
                          type="text"
                          value={contactEditForm.firstName}
                          onChange={(e) => setContactEditForm({ ...contactEditForm, firstName: e.target.value })}
                          className="w-full mt-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-gray-700 text-xs focus:outline-none focus:border-indigo-300"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Last Name</label>
                        <input
                          type="text"
                          value={contactEditForm.lastName}
                          onChange={(e) => setContactEditForm({ ...contactEditForm, lastName: e.target.value })}
                          className="w-full mt-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-gray-700 text-xs focus:outline-none focus:border-indigo-300"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-gray-500">Phone *</label>
                      <input
                        type="tel"
                        value={contactEditForm.phone}
                        onChange={(e) => setContactEditForm({ ...contactEditForm, phone: e.target.value })}
                        placeholder="+1 (555) 123-4567"
                        className="w-full mt-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-gray-700 text-xs placeholder:text-gray-400 focus:outline-none focus:border-indigo-300"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-gray-500 mb-1.5 block">Tags (select multiple)</label>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {contactAvailableTags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleContactTag(tag)}
                            className={cn(
                              "px-2 py-0.5 rounded text-xs transition-colors",
                              contactEditForm.tags.includes(tag)
                                ? "bg-indigo-500 text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            )}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={contactCustomTagInput}
                          onChange={(e) => setContactCustomTagInput(e.target.value)}
                          placeholder="Add custom tag..."
                          className="flex-1 px-2 py-1 bg-gray-50 border border-gray-200 rounded text-gray-700 text-xs placeholder:text-gray-400 focus:outline-none focus:border-indigo-300"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && contactCustomTagInput.trim()) {
                              e.preventDefault();
                              const newTag = contactCustomTagInput.trim();
                              if (!contactAvailableTags.includes(newTag)) {
                                setContactCustomTags((prev) => [...prev, newTag]);
                              }
                              if (!contactEditForm.tags.includes(newTag)) {
                                setContactEditForm((prev) => ({ ...prev, tags: [...prev.tags, newTag] }));
                              }
                              setContactCustomTagInput("");
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (contactCustomTagInput.trim()) {
                              const newTag = contactCustomTagInput.trim();
                              if (!contactAvailableTags.includes(newTag)) {
                                setContactCustomTags((prev) => [...prev, newTag]);
                              }
                              if (!contactEditForm.tags.includes(newTag)) {
                                setContactEditForm((prev) => ({ ...prev, tags: [...prev.tags, newTag] }));
                              }
                              setContactCustomTagInput("");
                            }
                          }}
                          className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs text-gray-600"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-gray-500">Notes</label>
                      <textarea
                        value={contactEditForm.notes}
                        onChange={(e) => setContactEditForm({ ...contactEditForm, notes: e.target.value })}
                        placeholder="Add notes..."
                        className="w-full mt-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-gray-700 text-xs placeholder:text-gray-400 resize-none h-14 focus:outline-none focus:border-indigo-300"
                      />
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <Star className={cn("w-4 h-4", contactEditForm.isFavorite ? "text-indigo-500 fill-indigo-500" : "text-gray-400")} />
                      <span className="text-xs text-gray-700">Mark as favorite</span>
                      <input
                        type="checkbox"
                        checked={contactEditForm.isFavorite}
                        onChange={(e) => setContactEditForm({ ...contactEditForm, isFavorite: e.target.checked })}
                        className="sr-only"
                      />
                    </label>
                  </div>
                </div>

                <div className="px-4 py-3 border-t border-gray-100 shrink-0">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 h-8 text-xs border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                      onClick={() => setShowContactModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 h-8 text-xs bg-indigo-500 hover:bg-indigo-600 text-white"
                      onClick={saveContactFromInbox}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}
        </>
      )}
    </div>
  );
};

export default InboxView;
