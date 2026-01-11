import { useEffect, useMemo, useState, useRef, useCallback, useTransition } from "react";
import { createPortal } from "react-dom";
import { API_BASE_URL } from "@/config";
import {
  Search,
  Phone,
  PhoneCall,
  MoreHorizontal,
  Send,
  Mic,
  StopCircle,
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
  ArrowDownToLine,
  ArrowUpFromLine,
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
  Loader2,
  Filter,
  SlidersHorizontal,
  MailCheck,
  ShieldCheck,
  Forward,
  Play,
  Pause,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { languages } from "./mockData";
import type { Contact, Message } from "./types";
import { fetchContacts, onContactsChange } from "./contactsApi";
import { createRule, ActiveRule } from "./rulesApi";
import { loadTwilioAccounts } from "./adminStore";
import { 
  fetchConversations, 
  fetchThread, 
  updateConversation,
  deleteConversation,
  deleteConversationById,
  searchMessages,
  type FilterType as ApiFilterType,
  type SentimentType,
  type UrgencyType,
  type CategoryType,
  type SearchParams,
} from "./messagesApi";
import { isValidUsPhoneNumber } from "@/lib/validations";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { ConversationSkeleton, ChatLoadingSkeleton } from "./LoadingSkeletons";
import { Device } from "@twilio/voice-sdk";

type MessageAttachment = {
  url: string;
  contentType: string;
  filename?: string;
};

type ChatBubble = {
  id: string;
  role: "incoming" | "outgoing" | "ai";
  content: string;
  timestamp: string;
  status?: string;
  twilioErrorCode?: string | number | null;
  translatedContent?: string; // For storing translated text
  wasForwarded?: boolean;
  forwardedTo?: string;
  wasTransferred?: boolean;
  transferredTo?: string;
  attachments?: MessageAttachment[]; // MMS image attachments
};

type FilterType = "all" | "unread" | "priority" | "held" | "blocked";

type TransferPrefs = {
  to: string;
  mode: TransferMode;
  type: TransferType;
  priorityFilter: PriorityFilter;
};

const STORAGE_KEYS = {
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

// Translation via backend (more reliable) with Google Translate fallback
const translateText = async (text: string, targetLang: string, sourceLang: string = "auto"): Promise<string> => {
  if (!text.trim()) return text;
  if (!targetLang || targetLang === sourceLang) return text;
  if (targetLang === "en" && sourceLang === "en") return text;

  // Prefer backend proxy to avoid client-side CORS/rate-limit issues
  try {
    const token = localStorage.getItem("comsierge_token");
    const resp = await fetch(`${API_BASE_URL}/api/translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text, sourceLang, targetLang }),
    });
    if (resp.ok) {
      const data = await resp.json();
      const translated = data?.translatedText;
      if (typeof translated === "string" && translated.trim()) return translated;
    }
  } catch (error) {
    console.error("Backend translation failed:", error);
  }

  // Fallback: Google Translate free endpoint
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    if (!response.ok) return text;

    const data = await response.json();
    if (data && data[0] && Array.isArray(data[0])) {
      const translated = data[0].map((item: any) => item?.[0]).join("");
      return translated || text;
    }
    return text;
  } catch (error) {
    console.error("Google translation failed:", error);
    return text;
  }
};

// Compress image to reduce size before storing as base64
const compressImage = (file: File, maxWidth = 200, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        
        // Scale down if needed
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(compressedDataUrl);
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
};

// Voice note player component with custom UI
const VoiceNotePlayer = ({ url, isOutgoing }: { url: string; isOutgoing: boolean }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      setIsLoaded(true);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !isLoaded) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = percent * duration;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={cn(
      "flex items-center gap-3 p-2 rounded-lg min-w-[200px]",
      isOutgoing ? "bg-indigo-400/30" : "bg-gray-100"
    )}>
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
      />
      
      {/* Play/Pause button */}
      <button
        onClick={togglePlay}
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors",
          isOutgoing 
            ? "bg-white/90 text-indigo-600 hover:bg-white" 
            : "bg-indigo-500 text-white hover:bg-indigo-600"
        )}
      >
        {isPlaying ? (
          <Pause className="w-5 h-5" />
        ) : (
          <Play className="w-5 h-5 ml-0.5" />
        )}
      </button>

      {/* Waveform-like progress bar */}
      <div className="flex-1 flex flex-col gap-1">
        <div 
          className="h-8 relative cursor-pointer flex items-center gap-[2px]"
          onClick={handleSeek}
        >
          {/* Simulated waveform bars */}
          {Array.from({ length: 30 }).map((_, i) => {
            const barProgress = (i / 30) * 100;
            const isActive = barProgress <= progress;
            const height = 8 + Math.sin(i * 0.5) * 6 + Math.random() * 4;
            return (
              <div
                key={i}
                className={cn(
                  "w-[3px] rounded-full transition-colors",
                  isActive
                    ? isOutgoing ? "bg-white" : "bg-indigo-500"
                    : isOutgoing ? "bg-white/40" : "bg-gray-300"
                )}
                style={{ height: `${height}px` }}
              />
            );
          })}
        </div>
        
        {/* Duration */}
        <div className={cn(
          "text-xs tabular-nums",
          isOutgoing ? "text-white/80" : "text-gray-500"
        )}>
          {isLoaded ? (
            <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
          ) : (
            <span className="flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading...
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

const InboxView = ({ selectedContactPhone, onClearSelection }: InboxViewProps) => {
  // Mobile debugging
  useEffect(() => {
    console.log("InboxView mounted/updated - version [Mobile-Fix-3]");
  }, []);

  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [mobilePane, setMobilePane] = useState<"list" | "chat">("list");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [isPending, startTransition] = useTransition();
  const [isSending, setIsSending] = useState(false);

  // Call mode dialog state
  const [showCallModeDialog, setShowCallModeDialog] = useState(false);
  const [pendingCall, setPendingCall] = useState<{ number: string; name?: string } | null>(null);
  const [showBridgeDialog, setShowBridgeDialog] = useState(false);
  const [bridgeNumber, setBridgeNumber] = useState("");
  const [isCallingLoading, setIsCallingLoading] = useState(false);
  const [twilioNumber, setTwilioNumber] = useState<string | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  
  // Active browser call state
  const [activeCall, setActiveCall] = useState<any>(null);
  const [callStatus, setCallStatus] = useState<"connecting" | "ringing" | "connected" | "ended" | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const callDurationRef = useRef(0); // Track actual duration for saving
  const [callingContact, setCallingContact] = useState<{ number: string; name?: string } | null>(null);
  const callingContactRef = useRef<{ number: string; name?: string } | null>(null); // Ref for closure access
  const [browserCallSid, setBrowserCallSid] = useState<string | null>(null);

  // Track recently deleted phone numbers to prevent them from reappearing during polling
  const recentlyDeletedPhones = useRef<Set<string>>(new Set());

  // Fetch user's Twilio number on mount
  useEffect(() => {
    const loadTwilioNumber = async () => {
      if (user?.phoneNumber) {
        setTwilioNumber(user.phoneNumber);
      }
    };
    loadTwilioNumber();
  }, [user]);

  // Warn if user has no phone number assigned
  useEffect(() => {
    if (user && !user.phoneNumber) {
      toast.error("You have no phone number assigned! You cannot receive messages.", {
        duration: 10000,
        action: {
          label: "Contact Admin",
          onClick: () => console.log("Contact admin clicked"),
        },
      });
    }
  }, [user]);

  // Helper to normalize phone numbers for comparison - defined outside useCallback for stability
  const normalizePhone = useCallback((value: string | undefined | null) => {
    if (!value) return "";
    return value.replace(/[^\d+]/g, "").toLowerCase();
  }, []);

  const refreshContacts = useCallback(async () => {
    const data = await fetchContacts();
    setContacts(data);
  }, []);

  // Prevent stale conversation fetches (e.g., rapid filter switching) from flashing old data
  const conversationsRequestId = useRef(0);

  // Reusable function to load conversations from API
  const loadConversations = useCallback(
    async (opts?: { showLoading?: boolean; replace?: boolean }) => {
      const showLoading = Boolean(opts?.showLoading);
      const replace = Boolean(opts?.replace);

      const requestId = ++conversationsRequestId.current;
      if (showLoading) setIsLoadingMessages(true);

      try {
        const conversations = await fetchConversations(activeFilter as ApiFilterType);

        // Ignore stale responses (older filter / older request)
        if (requestId !== conversationsRequestId.current) return;
      // Convert API conversations to Message format for UI compatibility
      // Look up contact names from saved contacts
      const msgs: Message[] = conversations
        // Filter out recently deleted conversations to prevent flicker
        .filter(conv => {
          const normalized = normalizePhone(conv.contactPhone);
          // Check multiple formats to ensure we catch deleted conversations
          const isDeleted = recentlyDeletedPhones.current.has(normalized) ||
                           recentlyDeletedPhones.current.has(normalized.replace(/^\+1/, "")) ||
                           recentlyDeletedPhones.current.has(`+1${normalized.replace(/^\+1/, "")}`);
          return !isDeleted;
        })
        .map((conv): Message => {
        // Try to find a saved contact matching this phone
        const savedContact = contacts.find(c => normalizePhone(c.phone) === normalizePhone(conv.contactPhone));
        const serverName = (conv.contactName && conv.contactName !== "Unknown") ? conv.contactName : "";
        const displayName = serverName || savedContact?.name || conv.contactPhone;
        
        const status: Message["status"] = conv.isBlocked ? "blocked" : conv.isHeld ? "held" : conv.isPriority ? "priority" : "normal";
        
        return {
          id: conv.id,
          contactId: conv.id,
          contactName: displayName,
          contactPhone: conv.contactPhone,
          content: conv.lastMessage || "",
          timestamp: conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
          isRead: conv.unreadCount === 0,
          isIncoming: true, // Conversations list shows incoming-style entries
          status,
          unreadCount: conv.unreadCount,
          // Include conversation control states from API
          isPinned: conv.isPinned || false,
          isMuted: conv.isMuted || false,
          isPriority: conv.isPriority || false,
          isBlocked: conv.isBlocked || false,
          isHeld: conv.isHeld || false,
        };
      });

      // Dedupe conversations by phone number (server can have historical formatting variants)
      const dedupedMsgs: Message[] = [];
      const phonesInApi = new Set<string>();
      for (const m of msgs) {
        const key = normalizePhone(m.contactPhone);
        if (!key || phonesInApi.has(key)) continue;
        phonesInApi.add(key);
        dedupedMsgs.push(m);
      }

        if (replace) {
          // Atomic update (used for initial load and filter changes) to avoid flicker
          setMessages(dedupedMsgs);
        } else {
          setMessages((prev) => {
            // Preserve any local "new" conversations that haven't been saved to DB yet
            const localNewConversations = prev
              .filter((m) => m.id.startsWith("new-"))
              // If API has the conversation now, don't show the local placeholder too
              .filter((m) => !phonesInApi.has(normalizePhone(m.contactPhone)));

            const localDeduped: Message[] = [];
            const localPhones = new Set<string>();
            for (const m of localNewConversations) {
              const key = normalizePhone(m.contactPhone);
              if (!key || localPhones.has(key)) continue;
              localPhones.add(key);
              localDeduped.push(m);
            }

            return [...localDeduped, ...dedupedMsgs];
          });
        }
      } catch (error) {
        // Ignore stale errors; otherwise keep last known state.
        if (requestId !== conversationsRequestId.current) return;
        console.error("Failed to load conversations:", error);
      } finally {
        // Only resolve loading for the latest request
        if (showLoading && requestId === conversationsRequestId.current) {
          setIsLoadingMessages(false);
        }
      }
    },
    [activeFilter, contacts, normalizePhone]
  );

  // Track if this is the initial load and current filter for transition handling
  const hasInitiallyLoaded = useRef(false);
  const previousFilter = useRef<FilterType>(activeFilter);
  const isFilterTransition = useRef(false);

  // Fetch conversations from MongoDB API on filter change
  useEffect(() => {
    const isFilterChange = hasInitiallyLoaded.current && previousFilter.current !== activeFilter;
    previousFilter.current = activeFilter;

    if (isFilterChange) {
      // Make filter changes atomic: clear list + selection and show skeleton until new data arrives.
      setSelectedMessageId(null);
      setMessages([]);
      setIsLoadingMessages(true);
    }

    const shouldShowLoading = !hasInitiallyLoaded.current || isFilterChange;
    loadConversations({ showLoading: shouldShowLoading, replace: shouldShowLoading });
    hasInitiallyLoaded.current = true;
    isFilterTransition.current = false;
  }, [activeFilter, loadConversations]);

  // Poll for new messages every 5 seconds
  useEffect(() => {
    const pollInterval = setInterval(() => {
      loadConversations({ showLoading: false, replace: false }); // Silently refresh
    }, 5000);
    return () => clearInterval(pollInterval);
  }, [loadConversations]);

  // Listen for contact changes (create/update/delete) and refresh
  useEffect(() => {
    const unsubscribe = onContactsChange(() => {
      refreshContacts();
      loadConversations({ showLoading: false, replace: false }); // Refresh to update contact names
    });
    return unsubscribe;
  }, [refreshContacts, loadConversations]);
  
  // Menu states
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showTranslateModal, setShowTranslateModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showAiChat, setShowAiChat] = useState(false);
  
  // Advanced Search states
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{
    id: string;
    contactPhone: string;
    contactName: string;
    body: string;
    direction: "incoming" | "outgoing";
    createdAt: string;
    sentiment?: { score: SentimentType | null };
    urgency?: { level: UrgencyType | null };
    category?: CategoryType | null;
  }>>([]);
  const [advancedSearchParams, setAdvancedSearchParams] = useState<SearchParams>({
    q: "",
    contact: "",
    sentiment: undefined,
    urgency: undefined,
    category: undefined,
    labels: "",
    startDate: "",
    endDate: "",
  });
  
  // Translation settings - initialize from user's server-side settings, fallback to localStorage
  const [receiveLanguage, setReceiveLanguage] = useState(() => {
    // Prefer server-side settings from user object
    if (user?.translationSettings?.receiveLanguage) {
      return user.translationSettings.receiveLanguage;
    }
    const saved = safeParseJson<{ receiveLanguage?: string }>( localStorage.getItem(STORAGE_KEYS.languages));
    return saved?.receiveLanguage || "en";
  });
  const [sendLanguage, setSendLanguage] = useState(() => {
    if (user?.translationSettings?.sendLanguage) {
      return user.translationSettings.sendLanguage;
    }
    const saved = safeParseJson<{ sendLanguage?: string }>(localStorage.getItem(STORAGE_KEYS.languages));
    return saved?.sendLanguage || "en";
  });
  const [autoTranslateIncoming, setAutoTranslateIncoming] = useState(() => {
    if (user?.translationSettings?.autoTranslateIncoming !== undefined) {
      return user.translationSettings.autoTranslateIncoming;
    }
    const saved = safeParseJson<{ autoTranslateIncoming?: boolean }>(localStorage.getItem(STORAGE_KEYS.languages));
    return Boolean(saved?.autoTranslateIncoming);
  });
  const [translateOutgoing, setTranslateOutgoing] = useState(() => {
    if (user?.translationSettings?.translateOutgoing !== undefined) {
      return user.translationSettings.translateOutgoing;
    }
    const saved = safeParseJson<{ translateOutgoing?: boolean }>(localStorage.getItem(STORAGE_KEYS.languages));
    return Boolean(saved?.translateOutgoing);
  });
  
  // Track previous receiveLanguage to detect changes
  const prevReceiveLanguageRef = useRef(receiveLanguage);
  
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Track which message bubbles are currently being translated
  const [translatingBubbles, setTranslatingBubbles] = useState<Set<string>>(new Set());
  
  // Track which bubbles are showing original vs translated (for "View original" toggle)
  const [showingOriginal, setShowingOriginal] = useState<Set<string>>(new Set());
  
  const toggleShowOriginal = (bubbleId: string) => {
    setShowingOriginal(prev => {
      const next = new Set(prev);
      if (next.has(bubbleId)) {
        next.delete(bubbleId);
      } else {
        next.add(bubbleId);
      }
      return next;
    });
  };

  const autoTranslateInFlight = useRef(false);
  const autoTranslatePending = useRef(false);
  
  // Translate a specific message bubble
  const translateBubble = async (
    bubbleId: string,
    content: string,
    opts?: { silent?: boolean; targetLang?: string }
  ) => {
    const targetLang = opts?.targetLang ?? receiveLanguage;
    if (translatingBubbles.has(bubbleId)) return;
    
    setTranslatingBubbles(prev => new Set(prev).add(bubbleId));
    
    try {
      // Translate to user's receive language
      const translated = await translateText(content, targetLang, "auto");
      
      // Update the bubble with translation
      setThreadsByContactId(prev => {
        const contactId = selectedMessage?.contactId;
        if (!contactId || !prev[contactId]) return prev;
        
        return {
          ...prev,
          [contactId]: prev[contactId].map(b => 
            b.id === bubbleId 
              ? { ...b, translatedContent: translated }
              : b
          ),
        };
      });

    } catch (error) {
      console.error("Translation failed:", error);
    } finally {
      setTranslatingBubbles(prev => {
        const next = new Set(prev);
        next.delete(bubbleId);
        return next;
      });
    }
  };
  
  // Translate all incoming messages in the current thread
  const translateAllIncoming = async (opts?: { showToasts?: boolean; silentBubbles?: boolean }) => {
    const silentBubbles = opts?.silentBubbles !== false;
    if (!selectedMessage) return;
    const thread = threadsByContactId[selectedMessage.contactId];
    if (!thread) return;
    
    const incomingBubbles = thread.filter(
      b =>
        b.role === "incoming" &&
        Boolean(b.content) &&
        b.content !== "[Image]" &&
        b.content !== "[Voice Note]" &&
        b.content !== "[Audio]" &&
        !b.translatedContent
    );
    if (incomingBubbles.length === 0) {
      return;
    }

    for (const bubble of incomingBubbles) {
      await translateBubble(bubble.id, bubble.content, { silent: silentBubbles, targetLang: receiveLanguage });
    }
  };

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

  // Image attachment state (images only)
  const [pendingImage, setPendingImage] = useState<{
    base64: string;
    mimeType: string;
    filename: string;
  } | null>(null);
  const messageAttachmentInputRef = useRef<HTMLInputElement | null>(null);
  
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const processedMessageIds = useRef<Set<string>>(new Set());

  const cancelImageAttachment = () => {
    setPendingImage(null);
    if (messageAttachmentInputRef.current) messageAttachmentInputRef.current.value = "";
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

  const [showContactModal, setShowContactModal] = useState(false);
  const [contactEditForm, setContactEditForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    notes: "",
    isFavorite: false,
    tags: [] as string[],
    avatar: "",
  });
  const contactPhotoInputRef = useRef<HTMLInputElement>(null);

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

  // Fetch contacts from API on mount
  useEffect(() => {
    refreshContacts();
  }, [refreshContacts]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.transferPrefs, JSON.stringify(transferPrefsByConversation));
  }, [transferPrefsByConversation]);

  // Sync translation settings to server and localStorage
  const syncTranslationSettingsRef = useRef(false);
  useEffect(() => {
    // Save to localStorage immediately
    localStorage.setItem(
      STORAGE_KEYS.languages,
      JSON.stringify({ receiveLanguage, sendLanguage, autoTranslateIncoming, translateOutgoing })
    );
    
    // Sync to server (debounced, skip initial mount)
    if (!syncTranslationSettingsRef.current) {
      syncTranslationSettingsRef.current = true;
      return;
    }
    
    const token = localStorage.getItem("comsierge_token");
    if (!token) return;
    
    const syncToServer = async () => {
      try {
        await fetch(`${API_BASE_URL}/api/auth/me/translation-settings`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ receiveLanguage, sendLanguage, autoTranslateIncoming, translateOutgoing }),
        });
      } catch (err) {
        console.error("Failed to sync translation settings:", err);
      }
    };
    
    const timeoutId = setTimeout(syncToServer, 500); // Debounce
    return () => clearTimeout(timeoutId);
  }, [receiveLanguage, sendLanguage, autoTranslateIncoming, translateOutgoing]);
  
  // When receiveLanguage changes, clear existing translations
  useEffect(() => {
    if (prevReceiveLanguageRef.current !== receiveLanguage) {
      prevReceiveLanguageRef.current = receiveLanguage;
      
      // Clear all existing translations when language changes
      setThreadsByContactId(prev => {
        const updated: typeof prev = {};
        for (const [contactId, bubbles] of Object.entries(prev)) {
          updated[contactId] = bubbles.map(b => ({ ...b, translatedContent: undefined }));
        }
        return updated;
      });
    }
  }, [receiveLanguage]);

  // Close menus on outside click
  useEffect(() => {
    // On mobile the More menu is rendered via a portal + backdrop; an "outside click"
    // listener here will treat taps inside the sheet as outside and close it before
    // button handlers fire.
    if (isMobile) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isMobile]);
  
  // API already filters by activeFilter, we just do local search filtering here
  const filteredMessages = useMemo(() => {
    const filtered = messages.filter((msg) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        msg.contactName.toLowerCase().includes(q) ||
        msg.contactPhone.toLowerCase().includes(q) ||
        msg.content.toLowerCase().includes(q)
      );
    });

    // Pinned conversations float to top (using API state)
    return [...filtered].sort((a, b) => {
      const aPinned = a.isPinned ? 1 : 0;
      const bPinned = b.isPinned ? 1 : 0;
      return bPinned - aPinned;
    });
  }, [messages, searchQuery]);

  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    filteredMessages[0]?.id ?? null
  );

  const looksLikePhoneNumber = (value: string) => {
    return isValidUsPhoneNumber(value);
  };

  const phonesInFilteredConversations = useMemo(() => {
    return new Set(filteredMessages.map((m) => normalizePhone(m.contactPhone)));
  }, [filteredMessages, normalizePhone]);

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
    if (!selectedContactPhone) return;
    
    // Wait for initial load to complete so we don't create duplicates or get overwritten
    if (isLoadingMessages) {
      console.log("[InboxView] Waiting for messages to load before handling selection...");
      return;
    }
    
    console.log("[InboxView] selectedContactPhone changed:", selectedContactPhone);
    
    // Try to find an existing conversation with this phone number (use normalized comparison)
    const matchingMessage = messages.find(msg => 
      normalizePhone(msg.contactPhone) === normalizePhone(selectedContactPhone)
    );
    
    if (matchingMessage) {
      console.log("[InboxView] Found existing conversation:", matchingMessage.id);
      setSelectedMessageId(matchingMessage.id);
      if (isMobile) setMobilePane("chat");
      toast.success(`Opened chat with ${matchingMessage.contactName}`);
    } else {
      // No existing conversation - create a new one
      console.log("[InboxView] Creating new conversation for:", selectedContactPhone);
      // Check if there's a contact for this phone
      const contact = contacts.find(c => 
        normalizePhone(c.phone) === normalizePhone(selectedContactPhone)
      );
      
      const newConversation: Message = {
        id: `new-${Date.now()}`,
        contactId: contact?.id || `phone:${normalizePhone(selectedContactPhone)}`,
        contactName: contact?.name || selectedContactPhone,
        contactPhone: selectedContactPhone,
        content: "New conversation",
        timestamp: "Now",
        isIncoming: false,
        status: "allowed",
        rule: contact?.tags?.[0] || "New Number",
        isRead: true,
      };

      setMessages((prev) => [newConversation, ...prev]);
      setSelectedMessageId(newConversation.id);
      if (isMobile) setMobilePane("chat");
      toast.success(`Started new conversation with ${contact?.name || selectedContactPhone}`);
    }
    
    // Clear after handling
    onClearSelection?.();
  }, [selectedContactPhone, isLoadingMessages]);

  const selectedMessage = useMemo(() => {
    // Only return a selected message if explicitly selected by ID - don't auto-select first
    if (!selectedMessageId) return null;
    return filteredMessages.find((m) => m.id === selectedMessageId) ?? null;
  }, [filteredMessages, selectedMessageId]);

  const selectedSavedContact = useMemo(() => {
    if (!selectedMessage) return null;
    const phone = normalizePhone(selectedMessage.contactPhone);
    return contacts.find((c) => normalizePhone(c.phone) === phone) ?? null;
  }, [contacts, selectedMessage]);

  const [threadsByContactId, setThreadsByContactId] = useState<Record<string, ChatBubble[]>>({});

  // Fetch real thread from API when conversation is selected, with polling
  useEffect(() => {
    if (!selectedMessage) return;
    
    const loadThread = async (forceRefresh = false) => {
      // Check if we already have real messages (not seed) - skip initial load if we have them
      const existing = threadsByContactId[selectedMessage.contactId];
      const hasRealMessages = existing && existing.length > 0 && !existing[0]?.id?.includes('-seed-');
      if (hasRealMessages && !forceRefresh) return;
      
      try {
        const messages = await fetchThread(selectedMessage.contactPhone);

        const seen = new Set<string>();
        const dedupedMessages = messages.filter((m) => {
          const key = m.twilioSid || m.id;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        
        if (dedupedMessages.length > 0) {
          // Convert API messages to ChatBubble format
          const bubbles: ChatBubble[] = dedupedMessages.map((m) => ({
            id: m.id,
            role: m.direction === 'incoming' ? 'incoming' as const : 'outgoing' as const,
            content: m.body,
            timestamp: new Date(m.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase(),
            status: m.status,
            twilioErrorCode: m.metadata?.twilioErrorCode ?? null,
            wasForwarded: m.wasForwarded || false,
            forwardedTo: m.forwardedTo || undefined,
            wasTransferred: m.wasTransferred || false,
            transferredTo: m.transferredTo || undefined,
            attachments: m.attachments || [],
          }));
          
          // Only update if messages have changed
          const currentBubbles = threadsByContactId[selectedMessage.contactId];
          // Always update to ensure we have the latest, but preserve optimistic messages and translations
          setThreadsByContactId((prev) => {
            const current = prev[selectedMessage.contactId] ?? [];
            let optimistic = current.filter((b) => String(b.id).includes("-local-"));
            
            // Build a map of existing translations to preserve them
            const translationMap = new Map<string, string>();
            for (const b of current) {
              if (b.translatedContent) {
                translationMap.set(b.id, b.translatedContent);
              }
            }
            
            // Apply preserved translations to new bubbles
            const bubblesWithTranslations = bubbles.map(b => ({
              ...b,
              translatedContent: translationMap.get(b.id) || b.translatedContent,
            }));
            
            // Filter out optimistic messages that are now present in the real list (deduplication)
            // We check the last few messages for a match to avoid scanning the whole history
            const recentReal = bubblesWithTranslations.slice(-5); 
            optimistic = optimistic.filter(opt => {
              const isSynced = recentReal.some(real => 
                real.role === opt.role && 
                real.content === opt.content
              );
              return !isSynced;
            });

            // Sort all messages by timestamp to ensure correct order
            const allMessages = [...bubblesWithTranslations, ...optimistic].sort((a, b) => {
               // Convert timestamps to comparable values if possible, or rely on order
               // Since optimistic messages are "now", they should generally be last
               // But if we have real timestamps, use them.
               // Note: ChatBubble timestamp is a string "hh:mm am/pm", which is hard to sort.
               // Ideally we should store raw Date objects.
               // For now, we assume bubbles (from DB) are sorted, and optimistic are newer.
               
               // If both are optimistic, sort by ID (which has timestamp)
               if (String(a.id).includes("-local-") && String(b.id).includes("-local-")) {
                  return a.id.localeCompare(b.id);
               }
               // If one is optimistic, it goes last (usually)
               if (String(a.id).includes("-local-")) return 1;
               if (String(b.id).includes("-local-")) return -1;
               
               // Both are real messages - they are already sorted by the API
               return 0;
            });

            // Check if we really need to update to avoid unnecessary renders
            const currentReal = current.filter(b => !String(b.id).includes("-local-"));
            if (JSON.stringify(currentReal) === JSON.stringify(bubblesWithTranslations) && 
                optimistic.length === current.filter(b => String(b.id).includes("-local-")).length) {
               return prev;
            }

            return {
              ...prev,
              [selectedMessage.contactId]: allMessages,
            };
          });
        } else {
          // No messages in DB - show placeholder with last message from conversation list
          setThreadsByContactId((prev) => {
            if (prev[selectedMessage.contactId]) return prev;
            
            // Don't show seed message for new conversations
            if (selectedMessage.id.startsWith("new-") || selectedMessage.content === "New conversation") {
                return { ...prev, [selectedMessage.contactId]: [] };
            }

            const seed: ChatBubble[] = [
              {
                id: `${selectedMessage.contactId}-seed-incoming`,
                role: 'incoming',
                content: selectedMessage.content || 'No messages yet',
                timestamp: selectedMessage.timestamp,
              },
            ];
            return { ...prev, [selectedMessage.contactId]: seed };
          });
        }
      } catch (error) {
        console.error('Failed to load thread:', error);
        // Keep any existing thread; otherwise seed from the conversation preview.
        setThreadsByContactId((prev) => {
          if (prev[selectedMessage.contactId]) return prev;
          
          // Don't show seed message for new conversations
          if (selectedMessage.id.startsWith("new-") || selectedMessage.content === "New conversation") {
              return { ...prev, [selectedMessage.contactId]: [] };
          }

          const seed: ChatBubble[] = [
            {
              id: `${selectedMessage.contactId}-seed-incoming`,
              role: 'incoming',
              content: selectedMessage.content || 'No messages yet',
              timestamp: selectedMessage.timestamp,
            },
          ];
          return { ...prev, [selectedMessage.contactId]: seed };
        });
      }
    };
    
    loadThread(); // Initial load
    
    // Poll for new messages every 3 seconds
    const pollInterval = setInterval(() => loadThread(true), 3000);
    return () => clearInterval(pollInterval);
  }, [selectedMessage?.contactId, selectedMessage?.contactPhone]);

  useEffect(() => {
    if (!isMobile) {
      setMobilePane("chat");
      return;
    }
    setMobilePane(selectedMessage ? "chat" : "list");
  }, [isMobile, selectedMessage]);

  const activeThread = selectedMessage ? threadsByContactId[selectedMessage.contactId] ?? [] : [];

  // If enabled, automatically translate incoming messages and show both original + translated.
  useEffect(() => {
    if (!selectedMessage) return;
    if (!autoTranslateIncoming) return;
    if (!receiveLanguage || receiveLanguage === "en") return;
    if (!activeThread || activeThread.length === 0) return;

    const hasPending = activeThread.some(
      b =>
        b.role === "incoming" &&
        Boolean(b.content) &&
        b.content !== "[Image]" &&
        b.content !== "[Voice Note]" &&
        b.content !== "[Audio]" &&
        !b.translatedContent
    );

    if (!hasPending) return;

    if (autoTranslateInFlight.current) {
      autoTranslatePending.current = true;
      return;
    }

    autoTranslateInFlight.current = true;
    (async () => {
      try {
        await translateAllIncoming({ showToasts: false, silentBubbles: true });
      } finally {
        autoTranslateInFlight.current = false;
        if (autoTranslatePending.current) {
          autoTranslatePending.current = false;
          // Re-run once to catch any messages that arrived mid-translation.
          await translateAllIncoming({ showToasts: false, silentBubbles: true });
        }
      }
    })();
  }, [selectedMessage?.contactId, activeThread, autoTranslateIncoming, receiveLanguage]);

  // Track if user has scrolled up
  const userScrolledUp = useRef(false);
  const lastThreadLength = useRef(0);

  // Auto-scroll to bottom only when NEW messages arrive (not on initial load)
  useEffect(() => {
    if (chatScrollRef.current && activeThread.length > 0) {
      const isNewMessage = activeThread.length > lastThreadLength.current;
      const isInitialLoad = lastThreadLength.current === 0;
      
      // Only auto-scroll if:
      // 1. Initial load of conversation, OR
      // 2. New message AND user hasn't scrolled up
      if (isInitialLoad || (isNewMessage && !userScrolledUp.current)) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
      
      lastThreadLength.current = activeThread.length;
    }
  }, [activeThread.length]);

  // Reset scroll tracking when conversation changes
  useEffect(() => {
    userScrolledUp.current = false;
    lastThreadLength.current = 0;
  }, [selectedMessage?.contactId]);

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
    // Mark message as read
    setMessages(prev => prev.map(m => 
      m.id === id ? { ...m, isRead: true } : m
    ));
    if (isMobile) setMobilePane("chat");
  };

  // Convert blob/file to base64 for sending
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleSend = async () => {
    if (!selectedMessage) return;

    const trimmed = newMessage.trim();
    const imageToSend = pendingImage;
    if (!trimmed && !imageToSend) return;
    if (isSending) return;

    // Clear UI immediately for instant feel
    setNewMessage("");
    setPendingImage(null);
    setShowEmojiPicker(false);
    setAiAssistOpen(false);
    setAiAssistMode(null);
    setAiAssistRewrite("");
    setAiAssistSuggestions([]);

    const now = new Date();
    const timestamp = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase();
    
    // User's assigned phone number (from database via auth)
    const userPhone = user?.phoneNumber;
    
    // Get recipient phone - clean it up
    const recipientPhone = selectedMessage.contactPhone?.replace(/[^\d+]/g, "") || "";
    
    // Optimistically add message to UI immediately (so it never "disappears" between polls)
    const optimisticId = `${selectedMessage.contactId}-local-${now.getTime()}`;
    // Note: We use 'trimmed' here. If translation happens later, the real message will replace this.
    const optimisticContent = trimmed;
    
    const optimisticBubbles: ChatBubble[] = [];
    if (optimisticContent) {
      optimisticBubbles.push({
        id: optimisticId,
        role: "outgoing",
        content: optimisticContent,
        timestamp,
      });
    }
    if (imageToSend) {
      optimisticBubbles.push({
        id: `${optimisticId}-image`,
        role: "outgoing",
        content: `[Image]`,
        timestamp,
        // Show image preview immediately using the base64 data
        attachments: [{
          url: imageToSend.base64,
          contentType: imageToSend.mimeType,
          filename: imageToSend.filename,
        }],
      });
    }

    if (optimisticBubbles.length) {
      setThreadsByContactId((prev) => ({
        ...prev,
        [selectedMessage.contactId]: [...(prev[selectedMessage.contactId] ?? []), ...optimisticBubbles],
      }));
    }

    // Translate outgoing message if enabled and sendLanguage differs from English
    let messageToSend = trimmed;
    let originalOutgoing = trimmed; // Keep original for "View original" on sent messages
    let translatedOutgoing = false;
    if (trimmed && translateOutgoing && sendLanguage !== "en") {
      setIsSending(true);
      try {
        const translated = await translateText(trimmed, sendLanguage, "en");
        if (translated && translated !== trimmed) {
          messageToSend = translated;
          translatedOutgoing = true;
        }
      } catch (e) {
        console.error("Translation failed, sending original:", e);
      }
    }
    
    // Send via Twilio using user's assigned phone number
    if ((messageToSend || imageToSend) && recipientPhone) {
      // Must have an assigned phone number to send
      if (!userPhone) {
        toast.error("No phone number assigned to your account. Contact admin to assign a Twilio number.");
        // Remove optimistic bubbles if we can't send
        setThreadsByContactId((prev) => {
          const current = prev[selectedMessage.contactId] ?? [];
          return {
            ...prev,
            [selectedMessage.contactId]: current.filter((b) => !String(b.id).startsWith(optimisticId)),
          };
        });
        return;
      }
      
      setIsSending(true);
      try {
        // Convert image attachment to base64 if present
        let mediaBase64: string | undefined;
        let mediaType: string | undefined;
        if (imageToSend) {
          mediaBase64 = imageToSend.base64;
          mediaType = imageToSend.mimeType;
        }

        // Send with user's assigned phone - backend will use env creds + validate the number
        const requestBody: {
          toNumber: string;
          body: string;
          fromNumber: string;
          contactName: string;
          mediaBase64?: string;
          mediaType?: string;
        } = {
          toNumber: recipientPhone,
          body: messageToSend || (imageToSend ? "[Image]" : ""),
          fromNumber: userPhone,
          contactName: selectedMessage.contactName,
        };

        if (mediaBase64) {
          requestBody.mediaBase64 = mediaBase64;
          requestBody.mediaType = mediaType || "image/jpeg";
          console.log("📎 Sending media, media type:", requestBody.mediaType);
        }
        
        console.log("📤 Sending message request:", {
          toNumber: requestBody.toNumber,
          fromNumber: requestBody.fromNumber,
          hasMedia: !!requestBody.mediaBase64,
          bodyLength: requestBody.body?.length || 0,
        });
        
        const token = localStorage.getItem("comsierge_token");
        if (!token) {
          toast.error("Not authenticated - please log in again");
          setIsSending(false);
          setThreadsByContactId((prev) => {
            const current = prev[selectedMessage.contactId] ?? [];
            return {
              ...prev,
              [selectedMessage.contactId]: current.filter((b) => !String(b.id).startsWith(optimisticId)),
            };
          });
          return;
        }
        
        const response = await fetch(`${API_BASE_URL}/api/twilio/send-sms`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
        });
        
        let data;
        try {
          data = await response.json();
        } catch (parseError) {
          console.error("Failed to parse response:", parseError);
          toast.error("Server returned invalid response");
          setIsSending(false);
          setThreadsByContactId((prev) => {
            const current = prev[selectedMessage.contactId] ?? [];
            return {
              ...prev,
              [selectedMessage.contactId]: current.filter((b) => !String(b.id).startsWith(optimisticId)),
            };
          });
          return;
        }
        
        if (!response.ok || !data.success) {
          const errorMsg = data?.message || `Server error (${response.status})`;
          console.error("Send SMS failed:", errorMsg, data);
          toast.error(errorMsg);
          setIsSending(false);
          // Remove optimistic bubbles on failure
          setThreadsByContactId((prev) => {
            const current = prev[selectedMessage.contactId] ?? [];
            return {
              ...prev,
              [selectedMessage.contactId]: current.filter((b) => !String(b.id).startsWith(optimisticId)),
            };
          });
          return;
        }
        
        // SMS sent successfully

        // Refresh thread immediately from API (replaces optimistic local id with real Mongo _id)
        try {
          const latest = await fetchThread(selectedMessage.contactPhone);
          const seen = new Set<string>();
          const dedupedLatest = latest.filter((m) => {
            const key = m.twilioSid || m.id;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          const bubbles: ChatBubble[] = dedupedLatest.map((m) => ({
            id: m.id,
            role: m.direction === "incoming" ? ("incoming" as const) : ("outgoing" as const),
            content: m.body,
            timestamp: new Date(m.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase(),
            status: m.status,
            twilioErrorCode: m.metadata?.twilioErrorCode ?? null,
            wasForwarded: m.wasForwarded || false,
            forwardedTo: m.forwardedTo || undefined,
            wasTransferred: m.wasTransferred || false,
            transferredTo: m.transferredTo || undefined,
            attachments: m.attachments || [],
          }));
          setThreadsByContactId((prev) => {
            const current = prev[selectedMessage.contactId] ?? [];
            
            // Keep optimistic messages unless we find them in the new list
            let optimistic = current.filter((b) => String(b.id).includes("-local-"));
            
            // Check if the message we just sent is in the new list
            const recentReal = bubbles.slice(-5);
            const isSynced = recentReal.some(real => 
               real.role === "outgoing" && 
               real.content === messageToSend // Use the actual content we sent
            );

            if (isSynced) {
               // If synced, remove the specific optimistic ID we created
               optimistic = optimistic.filter(b => !String(b.id).startsWith(optimisticId));
            }
            
            return {
              ...prev,
              [selectedMessage.contactId]: [...bubbles, ...optimistic],
            };
          });
        } catch (e) {
          // If refresh fails, keep optimistic bubble; polling will reconcile later.
          console.error("Failed to refresh thread after send:", e);
        }

        // Update conversation preview locally for snappy UI
        if (trimmed) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === selectedMessage.id
                ? {
                    ...m,
                    content: trimmed,
                    timestamp,
                    isRead: true,
                    isIncoming: false,
                    unreadCount: 0,
                  }
                : m
            )
          );
        }
      } catch (error) {
        console.error("Send SMS network error:", error);
        toast.error(`Failed to send: ${error instanceof Error ? error.message : "Network error"}`);
        setIsSending(false);
        // Remove optimistic bubbles on failure
        setThreadsByContactId((prev) => {
          const current = prev[selectedMessage.contactId] ?? [];
          return {
            ...prev,
            [selectedMessage.contactId]: current.filter((b) => !String(b.id).startsWith(optimisticId)),
          };
        });
        return;
      }
      setIsSending(false);
    } else if (trimmed && !recipientPhone) {
      // No recipient phone number
      toast.warning("No recipient phone number - message saved locally only");
    }

  };

  // Status colors and labels
  const getStatusInfo = (status: Message["status"]) => {
    switch (status) {
      case "priority":
        return { color: "hsl(var(--chat-pink))", bg: "hsl(var(--chat-pink) / 0.12)", icon: Sparkles, label: "Priority" };
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
    
    // Include recent SMS thread
    const recent = activeThread.slice(-12);
    const smsTranscript = recent
      .map((b) => {
        const who = b.role === "incoming" ? selectedMessage.contactName : b.role === "outgoing" ? "Me" : "AI";
        return `${who}: ${b.content}`;
      })
      .join("\n");
    
    // Include AI chat history for context continuity
    const aiChatHistory = aiChatsByConversationId[selectedMessage.id] || [];
    const recentAiChat = aiChatHistory.slice(-10); // Last 10 AI chat messages
    const aiChatTranscript = recentAiChat
      .map((msg) => `${msg.isUser ? "User" : "AI Assistant"}: ${msg.content}`)
      .join("\n");
    
    let context = `SMS Conversation with ${selectedMessage.contactName} (${selectedMessage.contactPhone}):\n${smsTranscript}`;
    
    if (aiChatTranscript) {
      context += `\n\n=== Recent AI Chat History (IMPORTANT - use this for context) ===\n${aiChatTranscript}`;
    }
    
    return context;
  };

  const [aiLoading, setAiLoading] = useState(false);

  const handleAiSend = async () => {
    if (!selectedMessage || aiLoading) return;
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

    // Add user message immediately
    setAiChatsByConversationId((prev) => ({
      ...prev,
      [selectedMessage.id]: [...(prev[selectedMessage.id] ?? []), userMsg],
    }));
    setAiInput("");
    setAiLoading(true);

    try {
      const context = buildConversationContext();
      const token = localStorage.getItem("comsierge_token");
      
      const response = await fetch(`${API_BASE_URL}/api/ai/conversation-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          message: text,
          conversationContext: context,
          contactName: selectedMessage.contactName,
          contactPhone: selectedMessage.contactPhone,
        }),
      });

      const data = await response.json();
      const aiText = data.data?.response || data.response || "I'm sorry, I couldn't process that request.";

      const shouldRefreshNames =
        /(save\s+contact\s+as|rename\s+contact)/i.test(text) ||
        /contact\s+renamed/i.test(aiText);

      if (shouldRefreshNames) {
        await refreshContacts();
        await loadConversations({ showLoading: false, replace: false });
      }

      const aiMsg: AiChatMessage = {
        id: `${selectedMessage.id}-ai-${Date.now()}`,
        isUser: false,
        content: aiText,
        timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase(),
      };

      setAiChatsByConversationId((prev) => ({
        ...prev,
        [selectedMessage.id]: [...(prev[selectedMessage.id] ?? []), aiMsg],
      }));
    } catch (error) {
      console.error("AI Chat error:", error);
      const errorMsg: AiChatMessage = {
        id: `${selectedMessage.id}-ai-${Date.now()}`,
        isUser: false,
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase(),
      };
      setAiChatsByConversationId((prev) => ({
        ...prev,
        [selectedMessage.id]: [...(prev[selectedMessage.id] ?? []), errorMsg],
      }));
    } finally {
      setAiLoading(false);
    }
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
      avatar: selectedSavedContact?.avatar || "",
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

  const saveContactFromInbox = async () => {
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

    // Check for collision locally first
    const collision = contacts.find((c) => c.id !== selectedSavedContact?.id && normalizePhone(c.phone) === newPhoneNorm);
    if (collision) {
      toast.error("That phone number is already saved for another contact");
      return;
    }

    // Save to API
    try {
      if (selectedSavedContact) {
        // Update existing contact via API
        const { updateContact } = await import("./contactsApi");
        const { success, error } = await updateContact(selectedSavedContact.id, {
          name: fullName,
          phone,
          notes: contactEditForm.notes || undefined,
          isFavorite: contactEditForm.isFavorite,
          tags: contactEditForm.tags,
          // Important: allow clearing avatar by sending empty string
          avatar: contactEditForm.avatar,
        });
        if (!success) {
          toast.error(error || "Failed to update contact");
          return;
        }
        // Update local state
        setContacts((prev) =>
          prev.map((c) =>
            c.id === selectedSavedContact.id
              ? {
                  ...c,
                  name: fullName,
                  phone,
                  notes: contactEditForm.notes || undefined,
                  isFavorite: contactEditForm.isFavorite,
                  tags: contactEditForm.tags,
                  avatar: contactEditForm.avatar,
                }
              : c
          )
        );
      } else {
        // Create new contact via API
        const { createContact } = await import("./contactsApi");
        const { contact: newContact, error } = await createContact({
          name: fullName,
          phone,
          notes: contactEditForm.notes || undefined,
          isFavorite: contactEditForm.isFavorite,
          tags: contactEditForm.tags,
          avatar: contactEditForm.avatar,
        });
        if (!newContact) {
          toast.error(error || "Failed to create contact");
          return;
        }
        // Update local state
        setContacts((prev) => [...prev, newContact]);
      }

      // Also update the conversation's contactName in the database
      if (selectedMessage?.contactPhone) {
        try {
          const token = localStorage.getItem("comsierge_token");
          await fetch(`/api/messages/conversation/${encodeURIComponent(selectedMessage.contactPhone)}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: token ? `Bearer ${token}` : "",
            },
            body: JSON.stringify({ contactName: fullName }),
          });
        } catch (e) {
          console.error("Failed to update conversation name:", e);
        }
      }

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

      // Messages list IS the conversations list - no separate setConversations needed

      toast.success(selectedSavedContact ? "Contact updated" : "Contact saved");
      setShowContactModal(false);
    } catch (error) {
      console.error("Save contact error:", error);
      toast.error("Failed to save contact");
    }
  };

  const handleTransfer = () => {
    if (selectedMessage) {
      const prefs = transferPrefsByConversation[selectedMessage.id];
      if (prefs) {
        setTransferType(prefs.type);
        setPriorityFilter(prefs.priorityFilter);
        setTransferTo(prefs.to);
        setTransferMode(prefs.mode || "both");
        if (prefs.to.startsWith("custom:")) {
          setTransferContactSearch(prefs.to.replace("custom:", ""));
        } else {
          setTransferContactSearch("");
        }
      } else {
        // Reset to defaults when no prefs for this conversation
        // Default to "calls" since that's simpler (no priority section)
        setTransferType("all");
        setPriorityFilter("all");
        setTransferTo("");
        setTransferContactSearch("");
        setTransferMode("calls");
      }
    } else {
      // No selected message - reset everything
      setTransferType("all");
      setPriorityFilter("all");
      setTransferTo("");
      setTransferContactSearch("");
      setTransferMode("calls");
    }
    setShowTransferModal(true);
    setShowMoreMenu(false);
  };

  // Call handling functions
  const handleCallClick = () => {
    if (!selectedMessage) return;
    
    let toNumber = selectedMessage.contactPhone.replace(/[^\d+]/g, "");
    if (!toNumber.startsWith("+")) {
      toNumber = "+1" + toNumber;
    }
    
    setPendingCall({ 
      number: toNumber, 
      name: selectedMessage.contactName 
    });
    setShowCallModeDialog(true);
  };

  const handleBrowserCall = async () => {
    if (!pendingCall) return;
    const { number, name } = pendingCall;
    setShowCallModeDialog(false);
    setIsCallingLoading(true);

    try {
      const token = localStorage.getItem("comsierge_token");
      if (!token) {
        toast.error("Not logged in. Please refresh the page.");
        setIsCallingLoading(false);
        return;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/twilio/token`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      
      const data = await response.json();
      console.log("🔵 Token response:", {
        success: data.success,
        identity: data.identity,
        twimlAppSid: data.twimlAppSid,
        voiceWebhookUrl: data.voiceWebhookUrl,
        accountSid: data.accountSid,
      });
      
      if (!data.success) {
        throw new Error(data.message);
      }

      const newDevice = new Device(data.token);

      newDevice.on("error", (error) => {
        console.error("Twilio Device Error:", error);
        toast.error("Call error: " + error.message);
        setIsCallingLoading(false);
        setCallStatus(null);
        setActiveCall(null);
      });

      await newDevice.register();
      setDevice(newDevice);

      const fromNumber = twilioNumber;
      console.log("🔵 Browser call - twilioNumber:", twilioNumber, "fromNumber:", fromNumber);
      if (!fromNumber) {
        toast.error("No Twilio number found. Contact admin to assign a number.");
        setIsCallingLoading(false);
        return;
      }
      
      // Set calling contact info for UI and ref for closure access
      setCallingContact({ number, name });
      callingContactRef.current = { number, name };
      setCallStatus("connecting");
      setCallDuration(0);
      callDurationRef.current = 0;
      
      console.log("🔵 Browser call - calling device.connect with params:", { To: number, customCallerId: fromNumber });
      const call = await newDevice.connect({
        params: {
          To: number,
          customCallerId: fromNumber
        },
      });

      setActiveCall(call);
      setCallStatus("ringing");

      call.on("accept", () => {
        console.log("Call accepted/connected");
        setIsCallingLoading(false);
        setCallStatus("connected");
        // Start call duration timer
        callTimerRef.current = setInterval(() => {
          callDurationRef.current += 1;
          setCallDuration(d => d + 1);
        }, 1000);
      });

      call.on("disconnect", () => {
        console.log("Call disconnected, duration:", callDurationRef.current);
        const finalDuration = callDurationRef.current;
        const contact = callingContactRef.current;
        setIsCallingLoading(false);
        setCallStatus("ended");
        setActiveCall(null);
        setIsMuted(false);
        if (callTimerRef.current) {
          clearInterval(callTimerRef.current);
          callTimerRef.current = null;
        }
        // Save call to history using ref values
        if (contact) {
          saveBrowserCallRecord(contact.number, contact.name, "completed", finalDuration);
        }
        // Clear call UI after a moment
        setTimeout(() => {
          setCallStatus(null);
          setCallingContact(null);
          callingContactRef.current = null;
          setCallDuration(0);
          callDurationRef.current = 0;
        }, 2000);
      });
      
      call.on("cancel", () => {
        console.log("Call cancelled");
        const contact = callingContactRef.current;
        setIsCallingLoading(false);
        setCallStatus(null);
        setActiveCall(null);
        setCallingContact(null);
        callingContactRef.current = null;
        if (callTimerRef.current) {
          clearInterval(callTimerRef.current);
          callTimerRef.current = null;
        }
        // Save cancelled call to history
        if (contact) {
          saveBrowserCallRecord(contact.number, contact.name, "no-answer", 0);
        }
      });

      call.on("ringing", () => {
        console.log("Call ringing");
        setCallStatus("ringing");
      });

    } catch (error: any) {
      console.error("Browser call failed:", error);
      toast.error("Failed to start browser call: " + error.message);
      setIsCallingLoading(false);
      setCallStatus(null);
      setActiveCall(null);
      setCallingContact(null);
    }
  };

  // Call control functions
  const handleHangup = () => {
    if (activeCall) {
      activeCall.disconnect();
      setActiveCall(null);
      setCallStatus("ended");
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
    }
  };

  const handleToggleMute = () => {
    if (activeCall) {
      const newMuteState = !isMuted;
      activeCall.mute(newMuteState);
      setIsMuted(newMuteState);
      toast.info(newMuteState ? "Muted" : "Unmuted");
    }
  };

  // Save browser call to call history
  const saveBrowserCallRecord = async (contactPhone: string, contactName: string | undefined, status: string, duration: number) => {
    try {
      const token = localStorage.getItem("comsierge_token");
      await fetch(`${API_BASE_URL}/api/calls`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          contactPhone,
          contactName: contactName || contactPhone,
          direction: "outgoing",
          type: "outgoing",
          status,
          duration,
          fromNumber: twilioNumber,
          toNumber: contactPhone,
        }),
      });
    } catch (e) {
      console.error("Failed to save call record:", e);
    }
  };

  const formatCallDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleBridgeCall = () => {
    if (!pendingCall) return;
    setShowCallModeDialog(false);
    // Default to user's forwarding number (from routing settings) for bridging
    setBridgeNumber(user?.forwardingNumber || "");
    setShowBridgeDialog(true);
  };

  const confirmBridgeCall = async () => {
    if (!pendingCall) return;
    const { number, name } = pendingCall;
    
    if (!bridgeNumber) {
      toast.error("Please enter your phone number.");
      return;
    }

    setShowBridgeDialog(false);
    setIsCallingLoading(true);
    
    const fromNum = twilioNumber;
    
    if (!fromNum) {
      toast.error("No Twilio number found. Please contact admin to assign a number.");
      setIsCallingLoading(false);
      return;
    }
    
    try {
      const token = localStorage.getItem("comsierge_token");
      const response = await fetch(`${API_BASE_URL}/api/twilio/make-call`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          toNumber: number,
          fromNumber: fromNum,
          bridgeTo: bridgeNumber,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success(`Calling your phone... We'll connect you to ${name || number}`);
      } else {
        toast.error(data.message || "Failed to place call");
      }
    } catch (error: any) {
      console.error("Bridge call failed:", error);
      toast.error("Failed to place call: " + error.message);
    } finally {
      setIsCallingLoading(false);
    }
  };

  const handlePin = async () => {
    if (!selectedMessage) {
      console.warn("[handlePin] No selected message");
      return;
    }
    const wasPinned = selectedMessage.isPinned || false;
    const nextPinned = !wasPinned;
    const phone = selectedMessage.contactPhone;
    const conversationId = selectedMessage.id;

    console.log("[handlePin] Starting pin toggle:", { phone, wasPinned, nextPinned, conversationId });

    // Close menu immediately for better UX
    setShowMoreMenu(false);

    // Optimistic update for snappy UI
    setMessages(prev => prev.map(m =>
      m.id === conversationId ? { ...m, isPinned: nextPinned } : m
    ));

    try {
      const success = await updateConversation(phone, { isPinned: nextPinned });
      console.log("[handlePin] API result:", success);
      if (success) {
        toast.success(wasPinned ? "Conversation unpinned" : "Conversation pinned");
        // Ensure server truth is reflected (prevents mobile-only weirdness)
        await loadConversations({ showLoading: false, replace: true });
        setSelectedMessageId(conversationId);
      } else {
        // Revert optimistic update
        setMessages(prev => prev.map(m =>
          m.id === conversationId ? { ...m, isPinned: wasPinned } : m
        ));
        toast.error("Failed to update pin status");
      }
    } catch (err) {
      console.error("[handlePin] Error:", err);
      // Revert optimistic update
      setMessages(prev => prev.map(m =>
        m.id === conversationId ? { ...m, isPinned: wasPinned } : m
      ));
      toast.error("Failed to update pin status");
    }
  };

  const handleRemovePriority = async () => {
    if (!selectedMessage) return;
    const phone = selectedMessage.contactPhone;
    const success = await updateConversation(phone, { isPriority: false });
    if (success) {
      toast.success("Removed from priority");
      await loadConversations();
      // If we're on the priority tab, clear selection since this conversation is no longer priority
      if (activeFilter === "priority") {
        setSelectedMessageId(null);
      }
    } else {
      toast.error("Failed to remove priority");
    }
    setShowMoreMenu(false);
  };

  const handleTransferSubmit = async () => {
    if (!transferTo) {
      toast.error("Please select a contact or enter a number to transfer to");
      return;
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

    // Prevent transferring to the same number (Person A -> Person A)
    if (selectedMessage) {
      const normalizeForCompare = (value: string) => {
        let digits = String(value || "").replace(/\D/g, "");
        if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
        return digits;
      };
      const fromDigits = normalizeForCompare(selectedMessage.contactPhone);
      const toDigits = normalizeForCompare(contactPhone);
      if (fromDigits && toDigits && fromDigits === toDigits) {
        toast.error("You can't transfer to the same number");
        return;
      }
    }
    
    // Build a cleaner rule description
    const sourceDisplayName = selectedMessage?.contactName || selectedMessage?.contactPhone || "Unknown";
    const targetDisplayName = contactName || contactPhone;
    const ruleDescription = `Transfer ${transferDescription} from ${sourceDisplayName} to ${targetDisplayName}`;
    
    // Create the rule via API
    const newRule = await createRule({
      rule: ruleDescription,
      active: true,
      type: "transfer",
      conditions: {
        // Scope this transfer to the currently selected conversation.
        sourceContactPhone: selectedMessage?.contactPhone,
        sourceContactName: selectedMessage?.contactName || null,
      },
      transferDetails: {
        mode: transferMode,
        priority: transferType,
        priorityFilter: priorityFilter !== "all" ? priorityFilter : undefined,
        contactName,
        contactPhone,
      },
    });
    
    if (newRule) {
      toast.success(`Transfer rule created! ${transferDescription} -> ${contactName}`);
    } else {
      toast.error("Failed to create transfer rule");
    }

    // Remember last used transfer settings per conversation
    if (selectedMessage) {
      setTransferPrefsByConversation(prev => ({
        ...prev,
        [selectedMessage.id]: {
          to: transferTo,
          mode: transferMode,
          type: transferType,
          priorityFilter,
        },
      }));
    }

    setShowTransferModal(false);
  };

  const filteredTransferContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(transferContactSearch.toLowerCase()) ||
    c.phone.toLowerCase().includes(transferContactSearch.toLowerCase())
  );

  const handleBlock = async () => {
    if (!selectedMessage) return;
    const phone = selectedMessage.contactPhone;
    const success = await updateConversation(phone, { isBlocked: true, isHeld: false });
    if (success) {
      toast.success("Contact blocked");
      // Refresh conversations to reflect the change based on current filter
      await loadConversations();
      // If current filter is not "blocked", clear selection (blocked contact won't be in list)
      if (activeFilter !== "blocked") {
        setSelectedMessageId(null);
      }
    } else {
      toast.error("Failed to block contact");
    }
    setShowMoreMenu(false);
  };

  const handleUnblock = async () => {
    if (!selectedMessage) return;
    const phone = selectedMessage.contactPhone;
    const success = await updateConversation(phone, { isBlocked: false });
    if (success) {
      toast.success("Contact unblocked");
      // Refresh conversations to reflect the change
      await loadConversations();
      // If current filter is "blocked", clear selection (unblocked contact won't be in list)
      if (activeFilter === "blocked") {
        setSelectedMessageId(null);
      }
    } else {
      toast.error("Failed to unblock contact");
    }
    setShowMoreMenu(false);
  };

  const handleHold = async () => {
    if (!selectedMessage) return;
    const phone = selectedMessage.contactPhone;
    const isCurrentlyHeld = selectedMessage.status === "held";
    const success = await updateConversation(phone, { isHeld: !isCurrentlyHeld });
    if (success) {
      toast.success(isCurrentlyHeld ? "Message released from hold" : "Message put on hold");
      // Refresh conversations to reflect the change
      await loadConversations();
      // If filter is "held" and we just unheld, or filter is "all" and we just held, clear selection
      if ((activeFilter === "held" && isCurrentlyHeld) || (activeFilter === "all" && !isCurrentlyHeld)) {
        setSelectedMessageId(null);
      }
    } else {
      toast.error("Failed to update hold status");
    }
    setShowMoreMenu(false);
  };

  const handleToggleFavorite = async () => {
    if (!selectedMessage) return;
    const isCurrentlyFavorite = selectedSavedContact?.isFavorite || false;
    
    if (selectedSavedContact) {
      // Contact exists - update the favorite status
      const { updateContact } = await import("./contactsApi");
      const { success, error } = await updateContact(selectedSavedContact.id, { 
        isFavorite: !isCurrentlyFavorite 
      });
      
      if (success) {
        // Update local contacts state
        setContacts(prev => prev.map(c => 
          c.id === selectedSavedContact.id ? { ...c, isFavorite: !isCurrentlyFavorite } : c
        ));
        toast.success(isCurrentlyFavorite ? "Removed from favorites" : "Added to favorites");
      } else {
        toast.error(error || "Failed to update favorite");
      }
    } else {
      // No saved contact - prompt to save first
      toast.error("Save this contact first to add to favorites");
      openContactEditor();
    }
    setShowMoreMenu(false);
  };

  const handleDelete = async () => {
    if (!selectedMessage) return;
    const conversationId = selectedMessage.id;
    const contactId = selectedMessage.contactId;
    const phone = selectedMessage.contactPhone;
    
    // Store for potential rollback
    const deletedMessage = selectedMessage;
    const deletedThread = threadsByContactId[contactId];
    const deletedTransferPrefs = transferPrefsByConversation[conversationId];

    // Add all phone variations to recently deleted to prevent polling from bringing it back
    const normalizedPhone = normalizePhone(phone);
    const phoneVariations = [
      normalizedPhone,
      normalizedPhone.replace(/^\+1/, ""),
      `+1${normalizedPhone.replace(/^\+1/, "").replace(/^\+/, "")}`,
      phone, // original format too
    ];
    phoneVariations.forEach(p => recentlyDeletedPhones.current.add(p));
    
    // Optimistic update - remove immediately for smooth UX
    setMessages(prev => prev.filter(m => m.id !== conversationId));
    setThreadsByContactId(prev => {
      const next = { ...prev };
      delete next[contactId];
      return next;
    });
    setTransferPrefsByConversation(prev => {
      const next = { ...prev };
      delete next[conversationId];
      return next;
    });
    setSelectedMessageId(null);
    setShowMoreMenu(false);

    // Delete via API
    try {
      const success = await deleteConversationById(conversationId);
      
      if (!success) {
        throw new Error("Delete failed");
      }
      
      toast.success("Conversation deleted");
      
      // Remove from recently deleted after a delay (keep it longer to ensure polling doesn't bring it back)
      setTimeout(() => {
        phoneVariations.forEach(p => recentlyDeletedPhones.current.delete(p));
      }, 30000); // 30 seconds to be safe
    } catch (e) {
      console.error("Delete API error:", e);
      // Remove from recently deleted on error so it can come back
      phoneVariations.forEach(p => recentlyDeletedPhones.current.delete(p));
      // Rollback on error
      setMessages(prev => [deletedMessage, ...prev]);
      if (deletedThread) {
        setThreadsByContactId(prev => ({ ...prev, [contactId]: deletedThread }));
      }
      if (deletedTransferPrefs) {
        setTransferPrefsByConversation(prev => ({ ...prev, [conversationId]: deletedTransferPrefs }));
      }
      toast.error("Failed to delete conversation");
    }
  };

  // Advanced Search handler
  const handleAdvancedSearch = async () => {
    // Check if any search param is set
    const hasParams = advancedSearchParams.q || advancedSearchParams.contact || 
      advancedSearchParams.sentiment || advancedSearchParams.urgency || 
      advancedSearchParams.category || advancedSearchParams.labels ||
      advancedSearchParams.startDate || advancedSearchParams.endDate;
    
    if (!hasParams) {
      toast.error("Please enter at least one search criteria");
      return;
    }
    
    setIsSearching(true);
    try {
      const result = await searchMessages(advancedSearchParams);
      setSearchResults(result.messages);
      if (result.messages.length === 0) {
        toast.info("No messages found matching your criteria");
      } else {
        toast.success(`Found ${result.total} message${result.total !== 1 ? 's' : ''}`);
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Search failed");
    }
    setIsSearching(false);
  };

  const clearAdvancedSearch = () => {
    setAdvancedSearchParams({
      q: "",
      contact: "",
      sentiment: undefined,
      urgency: undefined,
      category: undefined,
      labels: "",
      startDate: "",
      endDate: "",
    });
    setSearchResults([]);
  };

  const openConversationFromSearch = (contactPhone: string) => {
    // Find the conversation in the list or navigate to it
    const existing = messages.find(m => m.contactPhone === contactPhone);
    if (existing) {
      setSelectedMessageId(existing.id);
      setShowAdvancedSearch(false);
      if (isMobile) setMobilePane("chat");
    } else {
      // Start new conversation with this number
      startConversationForNumber(contactPhone);
      setShowAdvancedSearch(false);
    }
  };

  // AI actions
  const handleAiRewrite = async () => {
    if (!newMessage.trim()) {
      toast.error("Type a message first to rewrite");
      return;
    }
    
    setAiAssistMode("rewrite");
    setAiAssistRewrite("");
    setAiAssistSuggestions([]);
    setAiAssistOpen(true);
    
    try {
      const token = localStorage.getItem("comsierge_token");
      const response = await fetch(`${API_BASE_URL}/api/ai/rewrite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          draftMessage: newMessage,
          conversationHistory: activeThread.map(b => ({ direction: b.role === "incoming" ? "incoming" : "outgoing", content: b.content })),
          contactName: selectedMessage?.contactName || "",
          style: "professional",
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setAiAssistRewrite(data.data.rewritten);
      } else {
        toast.error("Failed to rewrite message");
        setAiAssistRewrite("");
      }
    } catch (error) {
      console.error("AI rewrite error:", error);
      toast.error("Failed to connect to AI service");
      setAiAssistRewrite("");
    }
  };

  const handleAiSuggestion = async () => {
    setAiAssistMode("suggest");
    setAiAssistSuggestions([]);
    setAiAssistRewrite("");
    setAiAssistOpen(true);
    
    try {
      const token = localStorage.getItem("comsierge_token");
      const response = await fetch(`${API_BASE_URL}/api/ai/reply-suggestions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          conversationHistory: activeThread.map(b => ({ direction: b.role === "incoming" ? "incoming" : "outgoing", content: b.content })),
          contactName: selectedMessage?.contactName || "",
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setAiAssistSuggestions(data.data.suggestions);
      } else {
        toast.error("Failed to generate suggestions");
        setAiAssistSuggestions([]);
      }
    } catch (error) {
      console.error("AI suggestions error:", error);
      toast.error("Failed to connect to AI service");
      setAiAssistSuggestions([]);
    }
  };

  return (
    <div className="h-full flex bg-white">
      {/* Conversation List */}
      <section
        className={cn(
          "w-full md:shrink-0 flex flex-col min-h-0 border-r border-gray-200 bg-white overflow-hidden transition-all duration-500",
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
        <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-200 overflow-x-auto">
          {([
            { id: "all", label: "All" },
            { id: "priority", label: "Priority" },
            { id: "held", label: "Held" },
            { id: "blocked", label: "Blocked" },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => startTransition(() => setActiveFilter(tab.id))}
              className={cn(
                "px-2 py-1 text-xs rounded transition-colors whitespace-nowrap shrink-0",
                activeFilter === tab.id
                  ? "bg-gray-100 text-gray-800 font-medium"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Held/Spam management bar */}
        {activeFilter === "held" && filteredMessages.length > 0 && (
          <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-800">
                {filteredMessages.length} message{filteredMessages.length !== 1 ? "s" : ""} on hold
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={async () => {
                  // Release all held messages
                  const promises = filteredMessages.map(m => updateConversation(m.contactPhone, { isHeld: false }));
                  await Promise.all(promises);
                  toast.success("All messages released from hold");
                  await loadConversations();
                }}
                className="px-2 py-1 text-xs bg-white border border-amber-300 text-amber-700 rounded hover:bg-amber-100 transition-colors"
              >
                Release All
              </button>
              <button
                onClick={async () => {
                  const confirmed = window.confirm(`Delete all ${filteredMessages.length} held messages?`);
                  if (confirmed) {
                    const promises = filteredMessages.map(m => deleteConversation(m.contactPhone));
                    await Promise.all(promises);
                    toast.success("All held messages deleted");
                    setSelectedMessageId(null);
                    await loadConversations();
                  }
                }}
                className="px-2 py-1 text-xs bg-red-50 border border-red-300 text-red-700 rounded hover:bg-red-100 transition-colors"
              >
                Delete All
              </button>
            </div>
          </div>
        )}

        {/* Blocked management bar */}
        {activeFilter === "blocked" && filteredMessages.length > 0 && (
          <div className="px-3 py-2 bg-red-50 border-b border-red-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Ban className="w-4 h-4 text-red-600" />
              <span className="text-xs font-medium text-red-800">
                {filteredMessages.length} blocked contact{filteredMessages.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={async () => {
                  // Unblock all
                  const promises = filteredMessages.map(m => updateConversation(m.contactPhone, { isBlocked: false }));
                  await Promise.all(promises);
                  toast.success("All contacts unblocked");
                  await loadConversations();
                }}
                className="px-2 py-1 text-xs bg-white border border-red-300 text-red-700 rounded hover:bg-red-100 transition-colors"
              >
                Unblock All
              </button>
            </div>
          </div>
        )}

        {/* Conversation list */}
        <div className="flex-1 min-h-0 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
          {isLoadingMessages && messages.length === 0 ? (
            <div className="divide-y divide-gray-100">
              {[...Array(8)].map((_, i) => (
                <ConversationSkeleton key={i} />
              ))}
            </div>
          ) : searchQuery.trim() && (matchingContacts.length > 0 || canStartNewNumber) && (
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

          {!isLoadingMessages && filteredMessages.length === 0 ? (
            searchQuery.trim() && (matchingContacts.length > 0 || canStartNewNumber) ? null : (
              <div className="p-6 text-center">
                <p className="text-sm text-gray-500">No conversations found</p>
              </div>
            )
          ) : (
            filteredMessages.map((msg) => {
              const isSelected = selectedMessage?.id === msg.id;
              const isUnread = !msg.isRead;
              const isPinned = msg.isPinned || false;
              const statusInfo = getStatusInfo(msg.status);
              // Look up contact to get avatar
              const contactForAvatar = contacts.find(c => normalizePhone(c.phone) === normalizePhone(msg.contactPhone));

              const togglePinFromRow = async (e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Debug logs for mobile troubleshooting
                console.log("[togglePinFromRow] Clicked pin/unpin for:", msg.contactPhone);
                
                const wasPinned = isPinned;
                const nextPinned = !wasPinned;

                // Optimistic update
                setMessages(prev => prev.map(m =>
                  m.id === msg.id ? { ...m, isPinned: nextPinned } : m
                ));

                try {
                  const success = await updateConversation(msg.contactPhone, { isPinned: nextPinned });
                  
                  console.log("[togglePinFromRow] API Success:", success);
                  
                  if (success) {
                    toast.success(wasPinned ? "Unpinned" : "Pinned");
                    // Force refresh to ensure sort order persists
                    await loadConversations({ showLoading: false, replace: true });
                  } else {
                    console.warn("[togglePinFromRow] Update failed (success=false)");
                    // Revert
                    setMessages(prev => prev.map(m =>
                      m.id === msg.id ? { ...m, isPinned: wasPinned } : m
                    ));
                    toast.error("Failed to update pin status");
                  }
                } catch (err) {
                  console.error("[togglePinFromRow] Exception:", err);
                  // Revert
                  setMessages(prev => prev.map(m =>
                    m.id === msg.id ? { ...m, isPinned: wasPinned } : m
                  ));
                  toast.error("Connection error while pinning");
                }
              };

              const releaseFromRow = async (e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                const success = await updateConversation(msg.contactPhone, { isHeld: false });
                if (success) {
                  setMessages(prev => prev.map(m => 
                    m.id === msg.id ? { ...m, status: "normal", isHeld: false } : m
                  ));
                  toast.success("Released from hold");
                }
              };

              const unblockFromRow = async (e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                const success = await updateConversation(msg.contactPhone, { isBlocked: false });
                if (success) {
                  setMessages(prev => prev.map(m => 
                    m.id === msg.id ? { ...m, status: "normal", isBlocked: false } : m
                  ));
                  toast.success("Contact unblocked");
                }
              };

              return (
                <div
                  key={msg.id}
                  onClick={(e) => {
                    // Safety check: ensure we don't handle clicks intended for action buttons
                    if ((e.target as HTMLElement).closest('button')) return;
                    
                    // For mobile debugging
                    console.log("[Row Click] Selecting conversation:", msg.id);
                    
                    handleSelectConversation(msg.id);
                  }}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-gray-100 transition-colors cursor-pointer select-none", // select-none helps mobile feel
                    isSelected ? "bg-gray-100" : "hover:bg-gray-50",
                    isMobile && "active:bg-gray-100" // Mobile active state
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    {contactForAvatar?.avatar ? (
                      <img 
                        src={contactForAvatar.avatar} 
                        alt={msg.contactName} 
                        className="w-10 h-10 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div 
                        className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-white text-sm font-medium bg-indigo-500"
                      >
                        {msg.contactName.charAt(0)}
                      </div>
                    )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className={cn("truncate text-sm text-gray-800", isUnread ? "font-semibold" : "font-medium")}>
                          {msg.contactName}
                        </p>
                        {msg.isMuted && (
                          <span title="Muted">
                            <BellOff className="w-3 h-3 text-orange-400 shrink-0" />
                          </span>
                        )}
                        {isUnread && (
                          <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-emerald-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className="text-xs text-gray-500 truncate max-w-[80px] text-right">{msg.timestamp}</span>
                        {/* 
                          MOBILE FIX (PIN BUTTON):
                          1. pointer-events-auto ensures it catches touches
                          2. onPointerDown with stopPropagation prevents the row click from firing even if onClick delays
                          3. z-index 10 floats it clearly above
                        */}
                        <div 
                          className="relative z-10" 
                          onPointerDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={togglePinFromRow}
                            className={cn(
                              // Keep mobile tap target, but make it minimal on desktop.
                              "p-2 md:p-1 rounded-full hover:bg-gray-50 transition-colors shrink-0 touch-manipulation active:scale-95",
                              isPinned ? "text-amber-400/60" : "text-gray-300/50 hover:text-gray-400/70"
                            )}
                            aria-label={isPinned ? "Unpin" : "Pin"}
                          >
                            <Pin className="w-3.5 h-3.5 opacity-70" />
                          </button>
                        </div>
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
                      
                      {/* Quick action: Release from hold */}
                      {activeFilter === "held" && msg.status === "held" && (
                        <button
                          onClick={releaseFromRow}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
                          title="Release from hold"
                        >
                          <MailCheck className="w-3 h-3" />
                          Release
                        </button>
                      )}
                      
                      {/* Quick action: Unblock */}
                      {activeFilter === "blocked" && msg.status === "blocked" && (
                        <button
                          onClick={unblockFromRow}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                          title="Unblock contact"
                        >
                          <ShieldCheck className="w-3 h-3" />
                          Unblock
                        </button>
                      )}
                    </div>

                    <p className="truncate text-xs text-gray-500 mt-1">
                      {msg.content}
                    </p>
                  </div>
                </div>
              </div>
              );
            })
          )}
        </div>
      </section>

      {/* Chat View */}
      <section
        className={cn(
          "flex-1 flex flex-col bg-white overflow-hidden",
          isMobile && mobilePane === "list" ? "hidden" : "flex",
          isMobile && "h-[100dvh] max-h-[100dvh]"
        )}
        style={isMobile ? { minHeight: 0, height: '100dvh' } : { minHeight: 0 }}
      >
        {selectedMessage ? (
          <>
            {/* Chat header */}
            <div className="h-14 px-4 flex items-center justify-between border-b border-gray-200 shrink-0 bg-white">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {isMobile && (
                  <button
                    className="-ml-2 p-2 rounded hover:bg-gray-100 transition-colors"
                    onClick={() => setMobilePane("list")}
                    aria-label="Back"
                  >
                    <ArrowLeft className="w-5 h-5 text-gray-500" />
                  </button>
                )}
                {selectedSavedContact?.avatar ? (
                  <img 
                    src={selectedSavedContact.avatar} 
                    alt={selectedMessage.contactName} 
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium bg-indigo-500">
                    {selectedMessage.contactName.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {selectedMessage.contactName}
                    </p>
                    {selectedMessage.isPinned && (
                      <Pin
                        className={cn(
                          "shrink-0",
                          isMobile ? "w-2.5 h-2.5 text-amber-400/70" : "w-3 h-3 text-amber-500"
                        )}
                      />
                    )}
                    {selectedMessage.isMuted && (
                      <BellOff className="w-3 h-3 text-orange-400 shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <p className={cn(
                      "truncate",
                      isMobile ? "text-[10px] text-gray-400" : "text-xs text-gray-500"
                    )}>
                      {selectedMessage.status === "blocked" ? "Blocked" : selectedMessage.status === "held" ? "On Hold" : "Messages"}
                    </p>
                    {/* Translation indicator */}
                    {(autoTranslateIncoming || translateOutgoing) && (
                      <button
                        onClick={() => setShowTranslateModal(true)}
                        className={cn(
                          "flex items-center text-[10px] text-indigo-500 hover:text-indigo-600 transition-colors shrink-0",
                          isMobile ? "gap-0.5" : "gap-1"
                        )}
                        title="Translation active"
                      >
                        <Languages className="w-3 h-3" />
                        {!isMobile && (
                          <span>
                            {autoTranslateIncoming && translateOutgoing
                              ? `${languages.find(l => l.code === receiveLanguage)?.name?.slice(0, 2) || "EN"} ↔ ${languages.find(l => l.code === sendLanguage)?.name?.slice(0, 2) || "EN"}`
                              : autoTranslateIncoming
                                ? `→ ${languages.find(l => l.code === receiveLanguage)?.name?.slice(0, 2) || "EN"}`
                                : `${languages.find(l => l.code === sendLanguage)?.name?.slice(0, 2) || "EN"} →`
                            }
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
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
                  onClick={handleCallClick}
                  disabled={isCallingLoading}
                >
                  {isCallingLoading ? (
                    <Loader2 className="w-4 h-4 text-green-600 animate-spin" />
                  ) : (
                    <Phone className="w-4 h-4 text-green-600" />
                  )}
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
                  
                  {showMoreMenu && !isMobile && (
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
                        {selectedMessage.isPinned ? (
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
                        onClick={handleToggleFavorite}
                        className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        {selectedSavedContact?.isFavorite ? (
                          <>
                            <Star className="w-4 h-4 mr-2.5 text-red-500 fill-red-500" />
                            Remove Favorite
                          </>
                        ) : (
                          <>
                            <Star className="w-4 h-4 mr-2.5 text-gray-400" />
                            Add Favorite
                          </>
                        )}
                      </button>
                      {/* Hold/Release toggle - show based on active filter tab */}
                      <button
                        onClick={handleHold}
                        className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        {activeFilter === "held" ? (
                          <>
                            <MailCheck className="w-4 h-4 mr-2.5 text-green-500" />
                            Release from Hold
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-4 h-4 mr-2.5 text-amber-500" />
                            Put on Hold
                          </>
                        )}
                      </button>
                      {/* Remove from Priority - show if conversation is marked priority */}
                      {selectedMessage?.status === "priority" && (
                        <button
                          onClick={handleRemovePriority}
                          className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Sparkles className="w-4 h-4 mr-2.5 text-pink-500" />
                          Remove Priority
                        </button>
                      )}
                      <div className="border-t border-gray-100 my-1" />
                      {selectedMessage?.isBlocked ? (
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
                  
                  {/* Mobile More Menu - Bottom Sheet */}
                  {showMoreMenu && isMobile && createPortal(
                    <>
                      <div 
                        className="fixed inset-0 bg-black/40 z-50"
                        onClick={() => setShowMoreMenu(false)}
                      />
                      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl pb-safe">
                        <div className="flex justify-center py-2">
                          <div className="w-10 h-1 bg-gray-300 rounded-full" />
                        </div>
                        <div className="px-2 pb-4 max-h-[70vh] overflow-y-auto">
                          <button
                            onClick={openContactEditor}
                            className="flex items-center w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                          >
                            {selectedSavedContact ? (
                              <>
                                <Pencil className="w-5 h-5 mr-3 text-blue-500" />
                                Edit contact
                              </>
                            ) : (
                              <>
                                <UserPlus className="w-5 h-5 mr-3 text-blue-500" />
                                Save contact
                              </>
                            )}
                          </button>
                          <button
                            onClick={handleTranslate}
                            className="flex items-center w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                          >
                            <Languages className="w-5 h-5 mr-3 text-blue-500" />
                            Translate
                          </button>
                          <button
                            onClick={handlePin}
                            className="flex items-center w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                          >
                            {selectedMessage.isPinned ? (
                              <>
                                <PinOff className="w-5 h-5 mr-3 text-amber-500" />
                                Unpin
                              </>
                            ) : (
                              <>
                                <Pin className="w-5 h-5 mr-3 text-gray-500" />
                                Pin
                              </>
                            )}
                          </button>
                          <button
                            onClick={handleToggleFavorite}
                            className="flex items-center w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                          >
                            {selectedSavedContact?.isFavorite ? (
                              <>
                                <Star className="w-5 h-5 mr-3 text-red-500 fill-red-500" />
                                Remove Favorite
                              </>
                            ) : (
                              <>
                                <Star className="w-5 h-5 mr-3 text-gray-400" />
                                Add Favorite
                              </>
                            )}
                          </button>
                          <button
                            onClick={handleHold}
                            className="flex items-center w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                          >
                            {activeFilter === "held" ? (
                              <>
                                <MailCheck className="w-5 h-5 mr-3 text-green-500" />
                                Release from Hold
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="w-5 h-5 mr-3 text-amber-500" />
                                Put on Hold
                              </>
                            )}
                          </button>
                          {selectedMessage?.status === "priority" && (
                            <button
                              onClick={handleRemovePriority}
                              className="flex items-center w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                            >
                              <Sparkles className="w-5 h-5 mr-3 text-pink-500" />
                              Remove Priority
                            </button>
                          )}
                          <div className="border-t border-gray-100 my-2 mx-4" />
                          {selectedMessage?.isBlocked ? (
                            <button
                              onClick={handleUnblock}
                              className="flex items-center w-full px-4 py-3 text-sm text-green-600 hover:bg-green-50 rounded-lg"
                            >
                              <Ban className="w-5 h-5 mr-3" />
                              Unblock
                            </button>
                          ) : (
                            <button
                              onClick={handleBlock}
                              className="flex items-center w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <Ban className="w-5 h-5 mr-3" />
                              Block
                            </button>
                          )}
                          <button
                            onClick={handleDelete}
                            className="flex items-center w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-5 h-5 mr-3" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </>,
                    document.body
                  )}
                </div>
              </div>
            </div>

            {/* Messages area */}
            <div
              ref={chatScrollRef}
              className={cn(
                "flex-1 overflow-y-auto p-4 bg-gray-50",
                isMobile && "pb-20"
              )}
              style={{ WebkitOverflowScrolling: "touch", minHeight: 0 }}
              onScroll={(e) => {
                const target = e.currentTarget;
                const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 50;
                userScrolledUp.current = !isAtBottom;
              }}
            >
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
                  const isTranslating = translatingBubbles.has(bubble.id);
                  const hasTranslation = !!bubble.translatedContent;
                  const isIncomingTranslationOn =
                    autoTranslateIncoming && receiveLanguage !== "en";
                  const shouldPreferTranslated =
                    isIncoming &&
                    isIncomingTranslationOn &&
                    !showingOriginal.has(bubble.id);
                  
                  return (
                    <div
                      key={bubble.id}
                      className={cn(
                        "flex items-end gap-2 group",
                        isLeftAligned ? "justify-start" : "justify-end"
                      )}
                    >
                      {isLeftAligned && (
                        selectedSavedContact?.avatar ? (
                          <img 
                            src={selectedSavedContact.avatar} 
                            alt={selectedMessage.contactName} 
                            className="w-7 h-7 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0 bg-indigo-500">
                            {selectedMessage.contactName.charAt(0)}
                          </div>
                        )
                      )}

                      <div className="max-w-[78%]">
                        <div
                          className={cn(
                            "rounded-lg px-3 py-2 relative",
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
                          {/* Show transferred indicator for incoming messages */}
                          {bubble.wasTransferred && !isOutgoing && (
                            <div className="flex items-center gap-1 mb-1 text-purple-600">
                              <ArrowRightLeft className="w-3 h-3" />
                              <span className="text-[10px] font-medium">
                                Transferred via active rule
                                {bubble.transferredTo && (
                                  <span className="text-purple-500"> → {(() => {
                                    const contact = contacts?.find(c => 
                                      c.phone === bubble.transferredTo || 
                                      c.phone?.replace(/\D/g, '') === bubble.transferredTo?.replace(/\D/g, '')
                                    );
                                    return contact?.name || bubble.transferredTo;
                                  })()}</span>
                                )}
                              </span>
                            </div>
                          )}
                          {/* Show forwarded indicator for incoming messages */}
                          {bubble.wasForwarded && !isOutgoing && !bubble.wasTransferred && (
                            <div className="flex items-center gap-1 mb-1 text-green-600">
                              <Forward className="w-3 h-3" />
                              <span className="text-[10px] font-medium">Forwarded to your phone</span>
                            </div>
                          )}
                          
                          {/* Show MMS image attachments */}
                          {bubble.attachments && bubble.attachments.length > 0 && (
                            <div className="mb-2">
                              {bubble.attachments
                                .filter((att) => att.contentType?.startsWith("image/"))
                                .map((att, idx) => (
                                  <a 
                                    key={idx} 
                                    href={att.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="block"
                                  >
                                    <img 
                                      src={att.url} 
                                      alt={att.filename || "MMS image"} 
                                      className="max-w-full max-h-60 rounded-md object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                      loading="lazy"
                                    />
                                  </a>
                                  ))}
                            </div>
                          )}

                          {/* Show voice note (audio) attachments */}
                          {bubble.attachments && bubble.attachments.length > 0 && 
                            bubble.attachments.some((att) => att.contentType?.startsWith("audio/")) && (
                            <div className="mb-2 space-y-2">
                              {bubble.attachments
                                .filter((att) => att.contentType?.startsWith("audio/"))
                                .map((att, idx) => (
                                  <VoiceNotePlayer key={idx} url={att.url} isOutgoing={isOutgoing} />
                                ))}
                            </div>
                          )}
                          
                          {/* Only show text content if it's meaningful (not empty or placeholders) */}
                          {bubble.content && 
                           bubble.content.trim() !== "" && 
                           bubble.content !== "[Image]" && 
                           bubble.content !== "[Voice Note]" && 
                           bubble.content !== "[Audio]" && (
                            <>
                              {/* Avoid flicker: if user prefers translated but it's not ready yet, show a placeholder */}
                              {shouldPreferTranslated && !hasTranslation ? (
                                <p className={cn("text-sm text-gray-400", isTranslating && "animate-pulse")}>Translating…</p>
                              ) : (
                                <p className="text-sm">
                                  {hasTranslation
                                    ? (isIncoming && !isIncomingTranslationOn)
                                      ? bubble.content
                                      : (showingOriginal.has(bubble.id) ? bubble.content : bubble.translatedContent)
                                    : bubble.content}
                                </p>
                              )}
                            </>
                          )}
                          
                          {/* Show translation indicator with View original toggle */}
                          {hasTranslation && (!isIncoming || isIncomingTranslationOn) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleShowOriginal(bubble.id);
                              }}
                              className={cn(
                                "mt-1.5 flex items-center gap-1 text-[10px] transition-colors cursor-pointer",
                                isOutgoing 
                                  ? "text-indigo-200 hover:text-white" 
                                  : "text-gray-400 hover:text-gray-600"
                              )}
                            >
                              <Languages className="w-3 h-3" />
                              <span>
                                {showingOriginal.has(bubble.id) ? "View translated" : "View original"}
                              </span>
                            </button>
                          )}
                          
                          {/* Translate button - show on hover for non-AI messages with actual text content */}
                          {!isAi && !hasTranslation && bubble.content && bubble.content !== "[Image]" && (
                            <button
                              type="button"
                              onClick={() => translateBubble(bubble.id, bubble.content)}
                              disabled={isTranslating}
                              className={cn(
                                "absolute -top-2 opacity-0 group-hover:opacity-100 transition-opacity",
                                "p-1 rounded-full shadow-sm",
                                isOutgoing 
                                  ? "-left-8 bg-white text-indigo-500 hover:bg-indigo-50" 
                                  : "-right-8 bg-indigo-500 text-white hover:bg-indigo-600",
                                isTranslating && "animate-pulse"
                              )}
                              title="Translate message"
                            >
                              <Languages className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <p className={cn("text-[11px] text-gray-500 mt-1", isLeftAligned ? "ml-1" : "text-right mr-1")}>
                          {(() => {
                            if (!isOutgoing) return bubble.timestamp;
                            const s = (bubble.status || "").toLowerCase();
                            const label =
                              s === "pending" ? "sending…" :
                              s === "sent" ? "sent" :
                              s === "delivered" ? "delivered" :
                              s === "failed" ? "not delivered" :
                              null;
                            const detail = s === "failed" && bubble.twilioErrorCode != null
                              ? ` (${bubble.twilioErrorCode})`
                              : "";
                            return label ? `${bubble.timestamp} · ${label}${detail}` : bubble.timestamp;
                          })()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Message input */}
            <div 
              className={cn(
                "p-3 border-t border-gray-200 bg-white shrink-0",
                isMobile && "fixed bottom-0 left-0 right-0 z-40"
              )}
              style={{ 
                paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0.75rem))',
                marginBottom: 'env(safe-area-inset-bottom, 0px)'
              }}
            >
              {/* AI assist output - subtle, above composer */}
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
                            {s.length > 30 ? s.slice(0, 30) + "..." : s}
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
                {/* Image attachment (images only) */}
                <input
                  ref={messageAttachmentInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const compressedBase64 = await compressImage(file, 1200, 0.8);
                      setPendingImage({
                        base64: compressedBase64,
                        mimeType: file.type || "image/jpeg",
                        filename: file.name || "image",
                      });
                    } catch (err) {
                      console.error("Image compression failed:", err);
                      toast.error("Failed to process image. Try a smaller file.");
                      cancelImageAttachment();
                    }
                  }}
                />
                {pendingImage ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
                    <Paperclip className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-blue-600">Image ready</span>
                    <button
                      className="p-1 rounded hover:bg-blue-100 transition-colors"
                      aria-label="Remove image"
                      onClick={cancelImageAttachment}
                      type="button"
                    >
                      <X className="w-4 h-4 text-blue-600" />
                    </button>
                  </div>
                ) : (
                  <button
                    className="p-2 rounded hover:bg-gray-100 transition-colors shrink-0"
                    aria-label="Attach image"
                    onClick={() => messageAttachmentInputRef.current?.click()}
                    type="button"
                  >
                    <Paperclip className="w-4 h-4 text-gray-500" />
                  </button>
                )}
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
                          "😢",
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
                          "😍",
                          "💬",
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
                  className={cn(
                    "p-2 rounded bg-indigo-500 text-white hover:bg-indigo-600 transition-colors shrink-0",
                    isSending && "opacity-50 cursor-not-allowed"
                  )}
                  aria-label="Send"
                  onClick={handleSend}
                  disabled={
                    isSending ||
                    (!pendingImage && newMessage.trim().length === 0)
                  }
                >
                  {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
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
          {showAiChat && selectedMessage ? (
            <>
              <div className="h-14 px-4 flex items-center justify-between border-b border-gray-200 shrink-0 bg-white">
                <div className="flex items-center gap-2 min-w-0">
                  <Bot className="w-4 h-4 text-purple-600" />
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
          ) : null}
        </section>
      )}

      {/* Mobile AI Chat Modal */}
      {isMobile && showAiChat && selectedMessage && createPortal(
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 z-50"
            onClick={closeAiChat}
          />
          {/* Modal */}
          <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[85vh]">
            {/* Handle bar */}
            <div className="flex justify-center py-2">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            {/* Header */}
            <div className="px-4 pb-3 flex items-center justify-between border-b border-gray-200 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-purple-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800">AI Assistant</p>
                  <p className="text-xs text-gray-500 truncate">{selectedMessage.contactName}</p>
                </div>
              </div>
              <button
                className="p-2 rounded hover:bg-gray-100 transition-colors"
                aria-label="Close AI"
                onClick={closeAiChat}
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 min-h-0">
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

            {/* Input */}
            <div className="p-3 border-t border-gray-200 bg-white shrink-0 pb-safe">
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
                    className="w-full px-4 py-3 rounded-lg text-sm bg-gray-50 text-gray-700 placeholder:text-gray-400 border border-gray-200 focus:outline-none focus:border-gray-300"
                  />
                </div>
                <button
                  className="p-3 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors shrink-0"
                  aria-label="Send to AI"
                  onClick={handleAiSend}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
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
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowTranslateModal(false);
            }}
          />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-50 pointer-events-none">
            <div
              className="bg-[#F5F5F5] rounded-xl shadow-2xl w-full max-w-md max-h-[calc(100vh-2rem)] pointer-events-auto overflow-hidden flex flex-col"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
                <h2 className="text-sm font-semibold text-gray-800">Translation Settings</h2>
                <button
                  onClick={() => setShowTranslateModal(false)}
                  className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="px-6 py-5 space-y-5 flex-1 min-h-0 overflow-y-auto">
                {/* Incoming Translation Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                      <ArrowDownToLine className="w-3 h-3 text-blue-600" />
                    </div>
                    <p className="text-xs font-semibold text-gray-800">Incoming Messages</p>
                  </div>
                  <p className="text-[11px] text-gray-500 -mt-1">Show received messages in your language.</p>
                  
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                    <p className="text-xs font-medium text-gray-700">Translate incoming</p>
                    <button
                      type="button"
                      onClick={() => setAutoTranslateIncoming((v) => !v)}
                      className={cn(
                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                        autoTranslateIncoming ? "bg-indigo-500" : "bg-gray-300"
                      )}
                      aria-label="Toggle auto-translate incoming"
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                          autoTranslateIncoming ? "translate-x-4" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>
                  
                  {autoTranslateIncoming && (
                    <div>
                      <p className="text-[11px] text-gray-600 mb-1.5">Translate to:</p>
                      <select
                        value={receiveLanguage}
                        onChange={(e) => setReceiveLanguage(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                      >
                        {languages.map((lang) => (
                          <option key={lang.code} value={lang.code}>
                            {lang.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                
                <div className="border-t border-gray-200" />
                
                {/* Outgoing Translation Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                      <ArrowUpFromLine className="w-3 h-3 text-green-600" />
                    </div>
                    <p className="text-xs font-semibold text-gray-800">Outgoing Messages</p>
                  </div>
                  <p className="text-[11px] text-gray-500 -mt-1">Send your replies in their language.</p>
                  
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                    <p className="text-xs font-medium text-gray-700">Translate outgoing</p>
                    <button
                      type="button"
                      onClick={() => setTranslateOutgoing((v) => !v)}
                      className={cn(
                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                        translateOutgoing ? "bg-indigo-500" : "bg-gray-300"
                      )}
                      aria-label="Toggle translate outgoing"
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                          translateOutgoing ? "translate-x-4" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>

                  {translateOutgoing && (
                    <div>
                      <p className="text-[11px] text-gray-600 mb-1.5">Send in:</p>
                      <select
                        value={sendLanguage}
                        onChange={(e) => setSendLanguage(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                      >
                        {languages.map((lang) => (
                          <option key={lang.code} value={lang.code}>
                            {lang.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="px-6 py-4 border-t border-gray-100 flex flex-col gap-3 shrink-0">
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowTranslateModal(false)}
                    className="flex-1 h-9 text-sm border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      setShowTranslateModal(false);

                      // If auto-translate incoming is enabled, kick off a quiet pass for the current chat
                      if (autoTranslateIncoming && receiveLanguage !== "en") {
                        translateAllIncoming({ showToasts: false, silentBubbles: true });
                      }
                    }}
                    className="flex-1 h-9 text-sm bg-indigo-500 hover:bg-indigo-600 text-white"
                  >
                    Save
                  </Button>
                </div>
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
                        {contactEditForm.avatar ? (
                          <img 
                            src={contactEditForm.avatar} 
                            alt="Contact" 
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                            <span className="text-lg text-gray-700">{contactEditForm.firstName.charAt(0) || "?"}</span>
                          </div>
                        )}
                        <input
                          type="file"
                          ref={contactPhotoInputRef}
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const compressed = await compressImage(file, 200, 0.7);
                                setContactEditForm({ ...contactEditForm, avatar: compressed });
                              } catch (err) {
                                console.error("Image compression failed:", err);
                                toast.error("Failed to process image. Try a smaller file.");
                              }
                            }
                          }}
                        />
                        <button 
                          onClick={() => contactPhotoInputRef.current?.click()}
                          className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gray-800 text-white flex items-center justify-center hover:bg-gray-700 transition-colors" 
                          type="button"
                        >
                          <Camera className="w-3 h-3" />
                        </button>
                      </div>
                      {contactEditForm.avatar && (
                        <button
                          type="button"
                          onClick={() => setContactEditForm({ ...contactEditForm, avatar: "" })}
                          className="mt-1.5 text-xs text-red-500 hover:text-red-600"
                        >
                          Remove photo
                        </button>
                      )}
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
                      <label className="text-xs text-gray-500">Phone {selectedSavedContact ? "" : "*"}</label>
                      <input
                        type="tel"
                        value={contactEditForm.phone}
                        onChange={(e) => !selectedSavedContact && setContactEditForm({ ...contactEditForm, phone: e.target.value })}
                        placeholder="+1 (555) 123-4567"
                        disabled={!!selectedSavedContact}
                        className={cn(
                          "w-full mt-1 px-3 py-1.5 border border-gray-200 rounded text-gray-700 text-xs focus:outline-none focus:border-indigo-300",
                          selectedSavedContact ? "bg-gray-100 cursor-not-allowed" : "bg-gray-50 placeholder:text-gray-400"
                        )}
                      />
                      {selectedSavedContact && (
                        <p className="text-[10px] text-gray-400 mt-0.5">Phone cannot be changed</p>
                      )}
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

      {/* Advanced Search Modal */}
      {showAdvancedSearch && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30">
          <div className="bg-white w-full max-w-lg mx-4 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-indigo-500" />
                <h2 className="text-sm font-semibold text-gray-800">Advanced Search</h2>
              </div>
              <button
                onClick={() => setShowAdvancedSearch(false)}
                className="p-1 rounded hover:bg-gray-100"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Search Form */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Text Search */}
              <div>
                <label className="text-xs font-medium text-gray-600">Message Content</label>
                <input
                  type="text"
                  value={advancedSearchParams.q || ""}
                  onChange={(e) => setAdvancedSearchParams(prev => ({ ...prev, q: e.target.value }))}
                  placeholder="Search text in messages..."
                  className="w-full mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-indigo-300"
                />
              </div>

              {/* Contact */}
              <div>
                <label className="text-xs font-medium text-gray-600">Contact (Name or Phone)</label>
                <input
                  type="text"
                  value={advancedSearchParams.contact || ""}
                  onChange={(e) => setAdvancedSearchParams(prev => ({ ...prev, contact: e.target.value }))}
                  placeholder="Filter by contact..."
                  className="w-full mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-indigo-300"
                />
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">From Date</label>
                  <input
                    type="date"
                    value={advancedSearchParams.startDate || ""}
                    onChange={(e) => setAdvancedSearchParams(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700 focus:outline-none focus:border-indigo-300"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">To Date</label>
                  <input
                    type="date"
                    value={advancedSearchParams.endDate || ""}
                    onChange={(e) => setAdvancedSearchParams(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700 focus:outline-none focus:border-indigo-300"
                  />
                </div>
              </div>

              {/* Sentiment */}
              <div>
                <label className="text-xs font-medium text-gray-600">Sentiment</label>
                <div className="flex gap-2 mt-1">
                  {(["positive", "neutral", "negative"] as const).map((sentiment) => (
                    <button
                      key={sentiment}
                      onClick={() => setAdvancedSearchParams(prev => ({ 
                        ...prev, 
                        sentiment: prev.sentiment === sentiment ? undefined : sentiment 
                      }))}
                      className={cn(
                        "flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors border",
                        advancedSearchParams.sentiment === sentiment
                          ? sentiment === "positive" ? "bg-green-100 border-green-300 text-green-700"
                            : sentiment === "negative" ? "bg-red-100 border-red-300 text-red-700"
                            : "bg-gray-100 border-gray-300 text-gray-700"
                          : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                      )}
                    >
                      {sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Urgency */}
              <div>
                <label className="text-xs font-medium text-gray-600">Urgency Level</label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {(["low", "medium", "high", "emergency"] as const).map((urgency) => (
                    <button
                      key={urgency}
                      onClick={() => setAdvancedSearchParams(prev => ({ 
                        ...prev, 
                        urgency: prev.urgency === urgency ? undefined : urgency 
                      }))}
                      className={cn(
                        "px-3 py-1.5 rounded text-xs font-medium transition-colors border",
                        advancedSearchParams.urgency === urgency
                          ? urgency === "emergency" ? "bg-red-100 border-red-300 text-red-700"
                            : urgency === "high" ? "bg-orange-100 border-orange-300 text-orange-700"
                            : urgency === "medium" ? "bg-yellow-100 border-yellow-300 text-yellow-700"
                            : "bg-blue-100 border-blue-300 text-blue-700"
                          : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                      )}
                    >
                      {urgency.charAt(0).toUpperCase() + urgency.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="text-xs font-medium text-gray-600">Category</label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {(["personal", "business", "finance", "meeting", "promo", "scam"] as const).map((category) => (
                    <button
                      key={category}
                      onClick={() => setAdvancedSearchParams(prev => ({ 
                        ...prev, 
                        category: prev.category === category ? undefined : category 
                      }))}
                      className={cn(
                        "px-3 py-1.5 rounded text-xs font-medium transition-colors border",
                        advancedSearchParams.category === category
                          ? "bg-indigo-100 border-indigo-300 text-indigo-700"
                          : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                      )}
                    >
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Labels */}
              <div>
                <label className="text-xs font-medium text-gray-600">Labels (comma-separated)</label>
                <input
                  type="text"
                  value={advancedSearchParams.labels || ""}
                  onChange={(e) => setAdvancedSearchParams(prev => ({ ...prev, labels: e.target.value }))}
                  placeholder="urgent, important, followup..."
                  className="w-full mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-indigo-300"
                />
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-gray-600">Results ({searchResults.length})</h3>
                    <button
                      onClick={() => setSearchResults([])}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {searchResults.map((result) => (
                      <button
                        key={result.id}
                        onClick={() => openConversationFromSearch(result.contactPhone)}
                        className="w-full text-left p-2 rounded bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-800">{result.contactName}</span>
                          <span className="text-[10px] text-gray-400">
                            {new Date(result.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 truncate mt-0.5">{result.body}</p>
                        <div className="flex gap-1 mt-1">
                          {result.sentiment?.score && (
                            <span className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded",
                              result.sentiment.score === "positive" ? "bg-green-100 text-green-700"
                                : result.sentiment.score === "negative" ? "bg-red-100 text-red-700"
                                : "bg-gray-100 text-gray-600"
                            )}>
                              {result.sentiment.score}
                            </span>
                          )}
                          {result.urgency?.level && (
                            <span className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded",
                              result.urgency.level === "emergency" ? "bg-red-100 text-red-700"
                                : result.urgency.level === "high" ? "bg-orange-100 text-orange-700"
                                : "bg-gray-100 text-gray-600"
                            )}>
                              {result.urgency.level}
                            </span>
                          )}
                          {result.category && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                              {result.category}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-100 flex gap-2 shrink-0">
              <Button
                variant="outline"
                className="flex-1 h-8 text-xs border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                onClick={clearAdvancedSearch}
              >
                Clear All
              </Button>
              <Button
                className="flex-1 h-8 text-xs bg-indigo-500 hover:bg-indigo-600 text-white"
                onClick={handleAdvancedSearch}
                disabled={isSearching}
              >
                {isSearching ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-3 h-3 mr-1.5" />
                    Search
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Active Browser Call UI */}
      {callStatus && callingContact && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70]">
          <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-2xl shadow-2xl w-full max-w-xs p-6 text-white">
            {/* Contact Info */}
            <div className="text-center mb-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl font-semibold">
                  {(callingContact.name || callingContact.number)?.[0]?.toUpperCase() || "?"}
                </span>
              </div>
              <h3 className="text-lg font-semibold truncate">
                {callingContact.name || callingContact.number}
              </h3>
              {callingContact.name && (
                <p className="text-sm text-gray-400">{callingContact.number}</p>
              )}
            </div>

            {/* Call Status */}
            <div className="text-center mb-6">
              {callStatus === "connecting" && (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-gray-300">Connecting...</span>
                </div>
              )}
              {callStatus === "ringing" && (
                <div className="flex items-center justify-center gap-2">
                  <Phone className="w-4 h-4 animate-pulse" />
                  <span className="text-sm text-gray-300">Ringing...</span>
                </div>
              )}
              {callStatus === "connected" && (
                <div className="text-center">
                  <span className="text-2xl font-mono text-green-400">{formatCallDuration(callDuration)}</span>
                  <p className="text-xs text-gray-400 mt-1">Connected</p>
                </div>
              )}
              {callStatus === "ended" && (
                <div className="text-center">
                  <span className="text-sm text-gray-300">Call Ended</span>
                  <p className="text-xs text-gray-400 mt-1">{formatCallDuration(callDuration)}</p>
                </div>
              )}
            </div>

            {/* Call Controls */}
            {(callStatus === "ringing" || callStatus === "connected") && (
              <div className="space-y-4">
                {/* Main controls row */}
                <div className="flex items-center justify-center gap-6">
                  {/* Mute Button */}
                  <button
                    onClick={handleToggleMute}
                    className={cn(
                      "w-14 h-14 rounded-full flex flex-col items-center justify-center transition-all",
                      isMuted 
                        ? "bg-red-500 hover:bg-red-600" 
                        : "bg-gray-700 hover:bg-gray-600"
                    )}
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? (
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    )}
                  </button>

                  {/* Hangup Button */}
                  <button
                    onClick={handleHangup}
                    className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-all"
                    title="End Call"
                  >
                    <Phone className="w-6 h-6 rotate-[135deg]" />
                  </button>
                </div>

                {/* Labels */}
                <div className="flex items-center justify-center gap-6 text-[10px] text-gray-400">
                  <span className="w-14 text-center">{isMuted ? "Unmute" : "Mute"}</span>
                  <span className="w-14 text-center">End</span>
                </div>
              </div>
            )}

            {/* Close button for ended state */}
            {callStatus === "ended" && (
              <div className="flex justify-center mt-4">
                <button
                  className="px-6 py-2.5 bg-white text-gray-900 font-medium rounded-full hover:bg-gray-100 transition-all"
                  onClick={() => {
                    setCallStatus(null);
                    setCallingContact(null);
                    setCallDuration(0);
                  }}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Call Mode Selection Dialog */}
      {showCallModeDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
          <div className="bg-white border border-gray-200 rounded-lg shadow-lg w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-800">Choose Calling Method</h3>
              <Button variant="ghost" size="icon" className="rounded h-7 w-7 text-gray-500 hover:bg-gray-100" onClick={() => setShowCallModeDialog(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-3">
              <p className="text-xs text-gray-500 mb-4">
                How would you like to place this call to <strong>{pendingCall?.name || pendingCall?.number}</strong>?
              </p>

              <button
                onClick={handleBrowserCall}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all group text-left"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 group-hover:bg-indigo-200">
                  <Phone className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Browser Call (VoIP)</p>
                  <p className="text-xs text-gray-500">Call directly from this device using microphone</p>
                </div>
              </button>

              <button
                onClick={handleBridgeCall}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-all group text-left"
              >
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0 group-hover:bg-green-200">
                  <PhoneCall className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Call via My Phone</p>
                  <p className="text-xs text-gray-500">We'll ring your phone, then connect you to them</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bridge Call Dialog */}
      {showBridgeDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
          <div className="bg-white border border-gray-200 rounded-lg shadow-lg w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-800">Call via My Phone</h3>
              <Button variant="ghost" size="icon" className="rounded h-7 w-7 text-gray-500 hover:bg-gray-100" onClick={() => setShowBridgeDialog(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-xs text-green-800 font-medium mb-1">How it works:</p>
                <ol className="text-xs text-green-700 list-decimal list-inside space-y-0.5">
                  <li>We call your phone</li>
                  <li>When you answer, we connect you to <strong>{pendingCall?.name || pendingCall?.number}</strong></li>
                  <li>They see your Comsierge number as caller ID</li>
                </ol>
              </div>
              
              <div>
                <label className="text-xs text-gray-500 block mb-1">Your phone number</label>
                <input
                  type="tel"
                  value={bridgeNumber}
                  onChange={(e) => setBridgeNumber(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded focus:outline-none focus:border-gray-300"
                />
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  className="flex-1 rounded h-8 text-xs border-gray-200 bg-white text-gray-700 hover:bg-gray-50" 
                  onClick={() => setShowBridgeDialog(false)}
                >
                  Cancel
                </Button>
                <Button 
                  className="flex-1 rounded h-8 text-xs bg-green-600 hover:bg-green-700 text-white" 
                  onClick={confirmBridgeCall}
                  disabled={!bridgeNumber}
                >
                  Call Now
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InboxView;
