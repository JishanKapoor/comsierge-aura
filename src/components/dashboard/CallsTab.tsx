import { useState, useEffect, useRef, useCallback } from "react";
import { API_BASE_URL } from "@/config";
import {
  Search,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Calendar,
  Clock,
  Volume2,
  VolumeX,
  ArrowRightLeft,
  X,
  Ban,
  Loader2,
  Mic,
  MicOff,
  Pause,
  Play,
  UserPlus,
  Grid3X3,
  CircleDot,
  Users,
  PhoneOff,
  Video,
  PhoneCall,
  RefreshCw,
  Trash2,
  Voicemail,
  Square,
  FileText,
  Sparkles,
  Send,
  MessageSquare,
  Copy,
  ChevronRight,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { isValidUsPhoneNumber } from "@/lib/validations";
import { Call, Contact } from "./types";
import { fetchContacts } from "./contactsApi";
import { fetchCalls, saveCallRecord, deleteCallRecord, CallRecord } from "./callsApi";
import { useAuth } from "@/contexts/AuthContext";
import { Device } from "@twilio/voice-sdk";
import { CallSkeleton } from "./LoadingSkeletons";

type Filter = "all" | "missed" | "incoming" | "outgoing" | "voicemail" | "routed" | "blocked";

interface CallsTabProps {
  selectedContactPhone?: string | null;
  onClearSelection?: () => void;
  isActive?: boolean;
  initialCall?: { number: string; name?: string; method?: "browser" | "bridge" } | null;
  onClearInitialCall?: () => void;
}

const CallsTab = ({ selectedContactPhone, onClearSelection, isActive = true, initialCall, onClearInitialCall }: CallsTabProps) => {
  const { user } = useAuth();
  const [twilioNumber, setTwilioNumber] = useState<string | null>(null);
  
  // Bridge Call State
  const [showBridgeDialog, setShowBridgeDialog] = useState(false);
  const [bridgeNumber, setBridgeNumber] = useState("");

  useEffect(() => {
    const loadTwilioConfig = async () => {
      try {
        const token = localStorage.getItem("comsierge_token");
        const response = await fetch(`${API_BASE_URL}/api/twilio/config`, {
          headers: { 
            "Authorization": token ? `Bearer ${token}` : "" 
          }
        });
        const data = await response.json();
        
        if (data.success && data.assignedNumber) {
          setTwilioNumber(data.assignedNumber);
        }
      } catch (e) {
        console.error("Failed to load Twilio config", e);
      }
    };
    loadTwilioConfig();
  }, []);

  const [calls, setCalls] = useState<Call[]>([]);
  const [isLoadingCalls, setIsLoadingCalls] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [showExtraCallFilters, setShowExtraCallFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showScheduleCall, setShowScheduleCall] = useState(false);
  const [isCallingLoading, setIsCallingLoading] = useState(false);
  const [activeCall, setActiveCall] = useState<{
    number: string;
    name?: string;
    startedAt: number;
    connectedAt?: number; // When call was actually answered (for timer)
    isSpeakerOn: boolean;
    isMuted: boolean;
    isOnHold: boolean;
    isRecording: boolean;
    callSid?: string;
    conferenceName?: string;
    participants?: { number: string; name?: string; callSid?: string }[];
    status: "ringing" | "connected" | "ended";
  } | null>(null);
  const [callNowMs, setCallNowMs] = useState<number>(() => Date.now());
  const [showTransferCall, setShowTransferCall] = useState(false);
  const [transferCallTo, setTransferCallTo] = useState("");
  const [showKeypad, setShowKeypad] = useState(false);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [addParticipantNumber, setAddParticipantNumber] = useState("");
  const [scheduleContact, setScheduleContact] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleNotes, setScheduleNotes] = useState("");
  const [remindBefore, setRemindBefore] = useState(true);
  const [notifyContact, setNotifyContact] = useState(false);
  
  // Browser Calling State
  const [device, setDevice] = useState<Device | null>(null);
  const [showCallModeDialog, setShowCallModeDialog] = useState(false);
  const [pendingCall, setPendingCall] = useState<{ number: string; name?: string } | null>(null);

  // Voicemail playback state
  const [playingVoicemailId, setPlayingVoicemailId] = useState<string | null>(null);
  const voicemailAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // Active Twilio Call reference (for mute/unmute)
  const activeCallRef = useRef<any>(null);

  // Transcript viewing state
  const [viewingTranscript, setViewingTranscript] = useState<{ 
    id: string; 
    contactName: string; 
    transcription: string; 
    timestamp: string;
    phone?: string;
  } | null>(null);
  
  // AI Chat about transcript state
  const [transcriptAiMessages, setTranscriptAiMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [transcriptAiInput, setTranscriptAiInput] = useState("");
  const [isTranscriptAiLoading, setIsTranscriptAiLoading] = useState(false);
  const transcriptAiChatRef = useRef<HTMLDivElement>(null);

  // Note: Ringtone is handled by Twilio SDK - no custom ringtone needed

  // Fetch contacts from API on mount and when tab becomes visible
  const loadContactsData = useCallback(async () => {
    const data = await fetchContacts();
    setContacts(data);
  }, []);

  useEffect(() => {
    loadContactsData();
  }, [loadContactsData]);

  // Refresh contacts when this tab becomes active (user may have renamed in Contacts tab)
  useEffect(() => {
    if (isActive) {
      loadContactsData();
    }
  }, [isActive, loadContactsData]);

  // Refresh contacts when window/tab regains visibility
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        loadContactsData();
      }
    };
    const handleFocus = () => loadContactsData();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadContactsData]);

  // Reusable function to load calls from API
  const loadCalls = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoadingCalls(true);
    try {
      // For voicemail, routed, and blocked filters, we need to fetch all calls and filter client-side
      const apiFilter = (filter === "all" || filter === "voicemail" || filter === "routed" || filter === "blocked") ? undefined : filter;
      const callRecords = await fetchCalls(apiFilter);
      
      // Helper functions for formatting (inside callback to avoid closure issues)
      const formatDurationForCall = (seconds: number): string | undefined => {
        if (!seconds || seconds <= 0) return undefined;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins === 0) return `${secs}s`;
        return `${mins}m ${secs}s`;
      };
      
      const formatTimestampForCall = (dateStr: string): string => {
        const date = new Date(dateStr);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const isYesterday = date.toDateString() === yesterday.toDateString();
        
        const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        
        if (isToday) {
          return `Today, ${timeStr}`;
        } else if (isYesterday) {
          return `Yesterday, ${timeStr}`;
        } else {
          return date.toLocaleDateString([], { month: "short", day: "numeric" }) + `, ${timeStr}`;
        }
      };
      
      // Build a set of blocked phone numbers from contacts
      const blockedPhones = new Set<string>();
      contacts.forEach(c => {
        if (c.isBlocked) {
          const normalizedPhone = c.phone?.replace(/[^\d+]/g, "");
          blockedPhones.add(normalizedPhone);
          blockedPhones.add(normalizedPhone.replace("+1", ""));
          if (!normalizedPhone.startsWith("+1")) {
            blockedPhones.add("+1" + normalizedPhone);
          }
        }
      });
      
      // Convert CallRecord to Call type for display
      const formattedCalls: Call[] = callRecords.map((record) => {
        const normalizedPhone = record.contactPhone?.replace(/[^\d+]/g, "") || "";
        const isBlockedContact = blockedPhones.has(normalizedPhone) || 
                                  blockedPhones.has(normalizedPhone.replace("+1", "")) ||
                                  blockedPhones.has("+1" + normalizedPhone.replace("+1", ""));
        
        return {
          id: record.id,
          contactId: `phone:${record.contactPhone}`,
          contactName: record.contactName || record.contactPhone,
          phone: record.contactPhone,
          timestamp: formatTimestampForCall(record.createdAt),
          type: record.type,
          status: record.status as Call["status"],
          duration: formatDurationForCall(record.duration),
          isBlocked: record.status === "blocked" || isBlockedContact,
          recordingUrl: record.recordingUrl,
          transcription: record.transcription,
          hasVoicemail: record.hasVoicemail,
          voicemailUrl: record.voicemailUrl,
          voicemailDuration: record.voicemailDuration,
          voicemailTranscript: record.voicemailTranscript,
          // Routing fields
          forwardedTo: record.forwardedTo,
          matchedRule: record.matchedRule,
          reason: record.reason,
        };
      });
      setCalls(formattedCalls);
    } catch (error) {
      console.error("Error loading calls:", error);
      // Only show toast on initial load, not on silent refreshes
      if (showLoading) {
        toast.error("Failed to load call history");
      }
    } finally {
      if (showLoading) setIsLoadingCalls(false);
    }
  }, [filter, contacts]);

  // Track if this is the initial load
  const hasInitiallyLoaded = useRef(false);

  // Fetch call history from API on mount and when filter changes
  useEffect(() => {
    // Only show loading skeleton on very first load, not on filter changes
    const shouldShowLoading = !hasInitiallyLoaded.current;
    loadCalls(shouldShowLoading);
    hasInitiallyLoaded.current = true;
  }, [loadCalls]);

  // Poll for new calls every 10 seconds (silent refresh)
  useEffect(() => {
    const pollInterval = setInterval(() => {
      loadCalls(false);
    }, 10000);
    return () => clearInterval(pollInterval);
  }, [loadCalls]);
  
  // Get Twilio credentials helper - uses the API-fetched twilioNumber
  // Backend will handle actual credentials lookup
  const getTwilioCredentials = () => {
    return {
      accountSid: null, // Backend uses env vars or DB
      authToken: null,  // Backend uses env vars or DB
      fromNumber: twilioNumber || user?.phoneNumber || null,
    };
  };

  // When navigating from contacts, just filter to show that contact's call history
  useEffect(() => {
    if (selectedContactPhone) {
      const contact = contacts.find(c => c.phone === selectedContactPhone);
      // Set search to filter to this contact's call history
      setSearchQuery(contact?.name || selectedContactPhone);
      onClearSelection?.();
    }
  }, [selectedContactPhone, contacts]);

  // If another tab (like Rules AI) requests a call, either:
  // - If method is specified, directly start that call type
  // - If no method, show the call mode dialog
  useEffect(() => {
    if (!isActive) return;
    if (!initialCall?.number) return;
    
    setPendingCall({ number: initialCall.number, name: initialCall.name });
    
    if (initialCall.method === "browser") {
      // Directly trigger browser call (will be handled after pendingCall is set)
      // We need a slight delay to ensure pendingCall state is set
      setTimeout(() => {
        setShowCallModeDialog(false);
        // Trigger browser call by dispatching to the handler
        const browserCallEvent = new CustomEvent("triggerBrowserCall");
        window.dispatchEvent(browserCallEvent);
      }, 50);
    } else if (initialCall.method === "bridge") {
      // Show bridge dialog directly
      setTimeout(() => {
        setShowCallModeDialog(false);
        setShowBridgeDialog(true);
        setBridgeNumber(user?.forwardingNumber || "");
      }, 50);
    } else {
      // No method specified, show the call mode selection dialog
      setShowCallModeDialog(true);
    }
    
    onClearInitialCall?.();
  }, [initialCall, isActive]);

  // Listen for browser call trigger from AI-initiated calls
  useEffect(() => {
    const handleTriggerBrowserCall = () => {
      if (pendingCall) {
        handleBrowserCall();
      }
    };
    window.addEventListener("triggerBrowserCall", handleTriggerBrowserCall);
    return () => window.removeEventListener("triggerBrowserCall", handleTriggerBrowserCall);
  }, [pendingCall]);

  useEffect(() => {
    if (!activeCall) return;
    const t = setInterval(() => setCallNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [activeCall]);

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Filter calls - API already filters by type, just do client-side search
  // For voicemail filter, we filter client-side since API doesn't have voicemail filter
  // For routed filter, show only forwarded or transferred calls
  // Blocked calls only appear in "blocked" filter, not in any other filter
  const filteredCalls = calls.filter((call) => {
    const isBlockedCall = call.status === "blocked" || call.isBlocked;
    
    // Blocked filter - show only blocked calls
    if (filter === "blocked") {
      if (!isBlockedCall) return false;
    } else {
      // All other filters - exclude blocked calls
      if (isBlockedCall) return false;
    }
    
    // Voicemail filter - show only calls with voicemails
    if (filter === "voicemail" && !call.hasVoicemail) return false;
    
    // Routed filter - show only forwarded or transferred calls
    if (filter === "routed" && call.status !== "forwarded" && call.status !== "transferred") return false;
    
    if (!searchQuery) return true;
    const matchesSearch =
      call.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      call.phone.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Refresh call history from API
  const refreshCalls = async () => {
    setIsLoadingCalls(true);
    try {
      // For voicemail, routed, and blocked filters, we need to fetch all calls and filter client-side
      const apiFilter = (filter === "all" || filter === "voicemail" || filter === "routed" || filter === "blocked") ? undefined : filter;
      const callRecords = await fetchCalls(apiFilter);
      
      // Build a set of blocked phone numbers from contacts
      const blockedPhones = new Set<string>();
      contacts.forEach(c => {
        if (c.isBlocked) {
          const normalizedPhone = c.phone?.replace(/[^\d+]/g, "");
          blockedPhones.add(normalizedPhone);
          blockedPhones.add(normalizedPhone.replace("+1", ""));
          if (!normalizedPhone.startsWith("+1")) {
            blockedPhones.add("+1" + normalizedPhone);
          }
        }
      });
      
      const formattedCalls: Call[] = callRecords.map((record) => {
        const formatDurationSec = (seconds: number): string | undefined => {
          if (!seconds || seconds <= 0) return undefined;
          const mins = Math.floor(seconds / 60);
          const secs = seconds % 60;
          if (mins === 0) return `${secs}s`;
          return `${mins}m ${secs}s`;
        };

        const allowedStatuses: Array<NonNullable<Call["status"]>> = [
          "initiated",
          "ringing",
          "in-progress",
          "completed",
          "busy",
          "failed",
          "no-answer",
          "canceled",
          "missed",
          "forwarded",
          "blocked",
          "transferred",
        ];
        
        const formatTimestamp = (dateStr: string): string => {
          const date = new Date(dateStr);
          const now = new Date();
          const isToday = date.toDateString() === now.toDateString();
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          const isYesterday = date.toDateString() === yesterday.toDateString();
          
          const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          
          if (isToday) {
            return `Today, ${timeStr}`;
          } else if (isYesterday) {
            return `Yesterday, ${timeStr}`;
          } else {
            return date.toLocaleDateString([], { month: "short", day: "numeric" }) + `, ${timeStr}`;
          }
        };
        
        const normalizedPhone = record.contactPhone?.replace(/[^\d+]/g, "") || "";
        const isBlockedContact = blockedPhones.has(normalizedPhone) || 
                                  blockedPhones.has(normalizedPhone.replace("+1", "")) ||
                                  blockedPhones.has("+1" + normalizedPhone.replace("+1", ""));
        
        const phone = record.contactPhone || record.toNumber || record.fromNumber || "";
        const contactName = record.contactName || phone || "Unknown";
        const status =
          typeof record.status === "string" && (allowedStatuses as string[]).includes(record.status)
            ? (record.status as Call["status"])
            : undefined;

        return {
          id: record.id,
          contactId: `phone:${phone}`,
          contactName,
          phone,
          timestamp: formatTimestamp(record.createdAt),
          type: record.type,
          status,
          duration: formatDurationSec(record.duration),
          isBlocked: record.status === "blocked" || isBlockedContact,
          recordingUrl: record.recordingUrl,
          transcription: record.transcription,
          hasVoicemail: record.hasVoicemail,
          voicemailUrl: record.voicemailUrl,
          voicemailDuration: record.voicemailDuration,
          voicemailTranscript: record.voicemailTranscript,
        };
      });
      setCalls(formattedCalls);
    } catch (error) {
      console.error("Error refreshing calls:", error);
      toast.error("Failed to refresh call history");
    } finally {
      setIsLoadingCalls(false);
    }
  };

  const getCallIcon = (type: Call["type"]) => {
    switch (type) {
      case "incoming":
        return <PhoneIncoming className="w-3.5 h-3.5 text-gray-500" />;
      case "outgoing":
        return <PhoneOutgoing className="w-3.5 h-3.5 text-gray-500" />;
      case "missed":
        return <PhoneMissed className="w-3.5 h-3.5 text-gray-500" />;
    }
  };

  const getCallBgClass = (type: Call["type"]) => {
    switch (type) {
      case "incoming":
        return "bg-gray-100";
      case "outgoing":
        return "bg-gray-100";
      case "missed":
        return "bg-gray-100";
    }
  };

  // Find contact by phone number (handles various formats)
  const findContactByPhone = useCallback((phone: string) => {
    const normalizedPhone = phone?.replace(/[^\d+]/g, "") || "";
    return contacts.find(c => {
      const contactPhone = c.phone?.replace(/[^\d+]/g, "") || "";
      return contactPhone === normalizedPhone || 
             contactPhone === normalizedPhone.replace("+1", "") ||
             "+1" + contactPhone === normalizedPhone;
    });
  }, [contacts]);

  // Block/unblock a phone number
  const toggleBlockNumber = async (phone: string, currentlyBlocked: boolean) => {
    try {
      const token = localStorage.getItem("comsierge_token");
      
      // First check if contact exists
      const contactsRes = await fetch(`${API_BASE_URL}/api/contacts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const contactsData = await contactsRes.json();
      
      // Find contact by phone
      const normalizedPhone = phone.replace(/[^\d+]/g, "");
      const contact = contactsData.data?.find((c: any) => {
        const contactPhone = c.phone?.replace(/[^\d+]/g, "");
        return contactPhone === normalizedPhone || 
               contactPhone === normalizedPhone.replace("+1", "") ||
               "+1" + contactPhone === normalizedPhone;
      });
      
      if (contact) {
        // Update existing contact
        const res = await fetch(`${API_BASE_URL}/api/contacts/${contact._id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ isBlocked: !currentlyBlocked }),
        });
        
        if (res.ok) {
          toast.success(currentlyBlocked ? "Number unblocked" : "Number blocked");
          // Update local state
          setCalls(prev => prev.map(c => 
            c.phone === phone ? { ...c, isBlocked: !currentlyBlocked } : c
          ));
        } else {
          toast.error("Failed to update block status");
        }
      } else {
        // Create new contact and block it
        const res = await fetch(`${API_BASE_URL}/api/contacts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ 
            phone: phone,
            name: phone,
            isBlocked: true,
          }),
        });
        
        if (res.ok) {
          toast.success("Number blocked");
          setCalls(prev => prev.map(c => 
            c.phone === phone ? { ...c, isBlocked: true } : c
          ));
        } else {
          toast.error("Failed to block number");
        }
      }
    } catch (error) {
      console.error("Block/unblock error:", error);
      toast.error("Failed to update block status");
    }
  };

  // Voicemail playback handler
  const playVoicemail = (callId: string) => {
    // If already playing this voicemail, stop it
    if (playingVoicemailId === callId) {
      if (voicemailAudioRef.current) {
        voicemailAudioRef.current.pause();
        voicemailAudioRef.current = null;
      }
      setPlayingVoicemailId(null);
      return;
    }

    // Stop any currently playing voicemail
    if (voicemailAudioRef.current) {
      voicemailAudioRef.current.pause();
    }

    // Use our proxy endpoint which handles Twilio auth
    const token = localStorage.getItem("comsierge_token");
    const audioUrl = `${API_BASE_URL}/api/calls/${callId}/voicemail`;
    
    // Use fetch to get the audio with auth header
    fetch(audioUrl, {
      headers: {
        'Authorization': token ? `Bearer ${token}` : ''
      }
    })
    .then(response => {
      if (!response.ok) throw new Error('Failed to fetch voicemail');
      return response.blob();
    })
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob);
      const audio = new Audio(blobUrl);
      voicemailAudioRef.current = audio;
      setPlayingVoicemailId(callId);

      audio.onended = () => {
        setPlayingVoicemailId(null);
        voicemailAudioRef.current = null;
        URL.revokeObjectURL(blobUrl);
      };

      audio.onerror = () => {
        toast.error("Failed to play voicemail");
        setPlayingVoicemailId(null);
        voicemailAudioRef.current = null;
        URL.revokeObjectURL(blobUrl);
      };

      audio.play().catch(() => {
        toast.error("Failed to play voicemail");
        setPlayingVoicemailId(null);
        voicemailAudioRef.current = null;
        URL.revokeObjectURL(blobUrl);
      });
    })
    .catch(() => {
      toast.error("Failed to load voicemail");
      setPlayingVoicemailId(null);
    });
  };

  // Clean up voicemail audio on unmount
  useEffect(() => {
    return () => {
      if (voicemailAudioRef.current) {
        voicemailAudioRef.current.pause();
      }
    };
  }, []);

  // Ask AI about transcript
  const askAiAboutTranscript = async (question: string) => {
    if (!viewingTranscript || !question.trim()) return;
    
    const userMessage = question.trim();
    setTranscriptAiMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setTranscriptAiInput("");
    setIsTranscriptAiLoading(true);
    
    // Scroll to bottom
    setTimeout(() => {
      transcriptAiChatRef.current?.scrollTo({ top: transcriptAiChatRef.current.scrollHeight, behavior: "smooth" });
    }, 100);
    
    try {
      const token = localStorage.getItem("comsierge_token");
      const response = await fetch(`${API_BASE_URL}/api/ai/analyze-transcript`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          transcript: viewingTranscript.transcription,
          contactName: viewingTranscript.contactName,
          question: userMessage,
          conversationHistory: transcriptAiMessages,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setTranscriptAiMessages(prev => [...prev, { role: "assistant", content: data.response }]);
      } else {
        toast.error(data.message || "Failed to get AI response");
        setTranscriptAiMessages(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't analyze that. Please try again." }]);
      }
    } catch (error) {
      console.error("AI transcript analysis error:", error);
      toast.error("Failed to connect to AI");
      setTranscriptAiMessages(prev => [...prev, { role: "assistant", content: "Sorry, there was an error. Please try again." }]);
    } finally {
      setIsTranscriptAiLoading(false);
      setTimeout(() => {
        transcriptAiChatRef.current?.scrollTo({ top: transcriptAiChatRef.current.scrollHeight, behavior: "smooth" });
      }, 100);
    }
  };

  // Quick AI prompts for transcript analysis
  const quickTranscriptPrompts = [
    { label: "Summarize", prompt: "Give me a brief summary of this call" },
    { label: "Action Items", prompt: "What are the action items or follow-ups from this call?" },
    { label: "Key Points", prompt: "What are the key points discussed?" },
    { label: "Sentiment", prompt: "What was the tone and sentiment of this conversation?" },
  ];

  const makeCall = async (number: string, name?: string) => {
    if (!isValidUsPhoneNumber(number)) {
      toast.error("Enter a valid phone number (10 digits, optional +1)");
      return;
    }
    
    // Format phone number
    let toNumber = number.replace(/[^\d+]/g, "");
    if (!toNumber.startsWith("+")) {
      toNumber = "+1" + toNumber;
    }

    setPendingCall({ number: toNumber, name });
    setShowCallModeDialog(true);
  };

  const handleBrowserCall = async () => {
    if (!pendingCall) return;
    const { number, name } = pendingCall;
    setShowCallModeDialog(false);
    setIsCallingLoading(true);

    try {
      // 1. Get Access Token
      const creds = getTwilioCredentials();
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
      if (!data.success) {
        throw new Error(data.message);
      }

      // 2. Initialize Device with sounds disabled to prevent double ring
      const newDevice = new Device(data.token, {
        // Disable all default sounds - we don't need ringtone for outgoing calls
        disableAudioContextSounds: true,
      });

      newDevice.on("error", (error) => {
        console.error("Twilio Device Error:", error);
        toast.error("Call error: " + error.message);
        setActiveCall(prev => prev ? { ...prev, status: "ended" } : null);
        setIsCallingLoading(false);
      });

      await newDevice.register();
      setDevice(newDevice);

      // 3. Connect
      // Use the API-fetched Twilio number for caller ID
      const fromNumber = twilioNumber;
      if (!fromNumber) {
        toast.error("No Comsierge number found. Contact admin to assign a number.");
        setIsCallingLoading(false);
        return;
      }
      
      const call = await newDevice.connect({
        params: {
          To: number,
          customCallerId: fromNumber // Pass Twilio number as caller ID
        },
      });
      
      // Store the call reference for mute/unmute
      activeCallRef.current = call;

      // Set active call with ringing status
      // startedAt is for tracking when call initiated, connectedAt is for timer
      const callStartTime = Date.now();
      setActiveCall({ 
        number, 
        name, 
        startedAt: callStartTime,
        connectedAt: undefined, // Will be set when call connects
        isSpeakerOn: false,
        isMuted: false,
        isOnHold: false,
        isRecording: false,
        status: "ringing",
      });
      
      toast.success(`Calling ${name || number} via Browser...`);
      setSearchQuery("");

      call.on("accept", (c) => {
        console.log("Call accepted");
        // Set connectedAt to NOW when the call is actually answered
        setActiveCall(prev => prev ? { 
          ...prev, 
          status: "connected", 
          callSid: c.parameters.CallSid,
          connectedAt: Date.now() // Timer starts NOW when connected
        } : null);
        setIsCallingLoading(false);
      });

      call.on("disconnect", () => {
        console.log("Call disconnected");
        activeCallRef.current = null;
        setActiveCall(null);
        setIsCallingLoading(false);
      });
      
      call.on("cancel", () => {
         activeCallRef.current = null;
         setActiveCall(null);
         setIsCallingLoading(false);
      });

    } catch (error: any) {
      console.error("Browser call failed:", error);
      toast.error("Failed to start browser call: " + error.message);
      setIsCallingLoading(false);
    }
  };

  const handleBridgeCall = async () => {
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
    
    // Use the fetched Twilio number as FROM
    const fromNum = twilioNumber;
    
    if (!fromNum) {
      toast.error("No Comsierge number found. Please contact admin to assign a number.");
      setIsCallingLoading(false);
      return;
    }
    
    try {
      const requestBody = {
        toNumber: number,
        fromNumber: fromNum,
        bridgeTo: bridgeNumber,
      };
      
      const token = localStorage.getItem("comsierge_token");
      const response = await fetch(`${API_BASE_URL}/api/twilio/make-call`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(requestBody),
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        toast.error(data?.message || `Failed to initiate call (HTTP ${response.status})`);
        setIsCallingLoading(false);
        return;
      }

      if (data && data.success === false) {
        toast.error(data.message || "Failed to initiate call");
        setIsCallingLoading(false);
        return;
      }

      // Success! Just show a toast and close everything - call happens on their real phone
      toast.success(`Calling your phone now. Answer to connect to ${name || number}.`, {
        duration: 5000,
      });
      
      // Reset everything - no active call UI needed for bridge calls
      setSearchQuery("");
      setPendingCall(null);
      setIsCallingLoading(false);

      // Backend creates the CallRecord for Click-to-Call. Just refresh/poll to show status changes.
      loadCalls(false);

      // Auto-refresh aggressively at first so UI updates quickly
      // 0-60s: every 2s, then 60-120s: every 5s
      let refreshInterval: any = setInterval(() => {
        loadCalls(false);
      }, 2000);
      (window as any).__callRefreshInterval = refreshInterval;

      const switchTimer = setTimeout(() => {
        clearInterval(refreshInterval);
        refreshInterval = setInterval(() => {
          loadCalls(false);
        }, 5000);
        (window as any).__callRefreshInterval = refreshInterval;
      }, 60000);

      const stopTimer = setTimeout(() => {
        clearInterval(refreshInterval);
        clearTimeout(switchTimer);
      }, 120000);

      (window as any).__callRefreshStopTimer = stopTimer;
      
    } catch (error: any) {
      console.error("Bridge call failed:", error);
      toast.error("Failed to initiate call: " + error.message);
      setIsCallingLoading(false);
    }
  };

  const hangUp = async () => {
    if (!activeCall) return;

    // If this is a Browser VoIP call, end it via the Twilio Voice SDK.
    // Calling the REST API here is unreliable because browser calls often don't have
    // account credentials client-side and the CallSid in the browser is not always the PSTN leg.
    if (activeCallRef.current && typeof activeCallRef.current.disconnect === "function") {
      try {
        activeCallRef.current.disconnect();
      } catch (e) {
        console.error("VoIP disconnect error:", e);
      }
      try {
        device?.disconnectAll?.();
      } catch (e) {
        console.error("Device disconnectAll error:", e);
      }

      activeCallRef.current = null;
      setActiveCall(null);
      setShowTransferCall(false);
      setTransferCallTo("");
      setShowKeypad(false);
      setShowAddParticipant(false);

      // Refresh to reflect final status/recording when webhooks arrive
      loadCalls(false);
      toast.success("Call ended");
      return;
    }
    
    // Non-VoIP (server-controlled) call
    if (activeCall.callSid) {
      try {
        const token = localStorage.getItem("comsierge_token");
        await fetch(`${API_BASE_URL}/api/twilio/end-call`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": token ? `Bearer ${token}` : "",
          },
          body: JSON.stringify({
            callSid: activeCall.callSid,
          }),
        });
      } catch (error) {
        console.error("End call API error:", error);
      }
    }
    
    // Use connectedAt for duration calculation (only count connected time)
    const durationMs = activeCall.connectedAt ? Date.now() - activeCall.connectedAt : 0;
    const durationSec = Math.floor(durationMs / 1000);
    const wasMissed = activeCall.status === "ringing" || !activeCall.connectedAt;
    
    // For server-controlled calls, the backend/webhooks are the source of truth.
    // Just refresh the call list instead of creating a local CallRecord.
    loadCalls(false);
    
    toast.success(wasMissed ? "Call canceled" : `Call ended (${formatDuration(durationMs)})`);
    setActiveCall(null);
    setShowTransferCall(false);
    setTransferCallTo("");
    setShowKeypad(false);
    setShowAddParticipant(false);
  };

  const toggleSpeaker = () => {
    if (!activeCall) return;
    setActiveCall(prev => prev ? { ...prev, isSpeakerOn: !prev.isSpeakerOn } : prev);
    toast.info(activeCall.isSpeakerOn ? "Speaker off" : "Speaker on");
  };

  const toggleMute = async () => {
    if (!activeCall) return;
    
    // Actually mute/unmute the Twilio call
    if (activeCallRef.current && typeof activeCallRef.current.mute === 'function') {
      const newMuteState = !activeCall.isMuted;
      try {
        activeCallRef.current.mute(newMuteState);
      } catch (e) {
        console.error("VoIP mute error:", e);
      }
      setActiveCall(prev => prev ? { ...prev, isMuted: newMuteState } : prev);
      toast.info(newMuteState ? "Muted" : "Unmuted");
    } else {
      // Fallback for non-browser calls
      setActiveCall(prev => prev ? { ...prev, isMuted: !prev.isMuted } : prev);
      toast.info(activeCall.isMuted ? "Unmuted" : "Muted");
    }
  };

  const toggleHold = async () => {
    if (!activeCall) return;
    
    const newHoldState = !activeCall.isOnHold;
    
    if (activeCall.callSid) {
      try {
        const token = localStorage.getItem("comsierge_token");
        const response = await fetch(`${API_BASE_URL}/api/twilio/hold-call`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": token ? `Bearer ${token}` : "",
          },
          body: JSON.stringify({
            callSid: activeCall.callSid,
            hold: newHoldState,
          }),
        });
        const data = await response.json();
        if (!data.success) {
          toast.error(data.message || "Failed to update hold status");
          return;
        }
      } catch (error) {
        console.error("Hold call error:", error);
      }
    }
    
    setActiveCall(prev => prev ? { ...prev, isOnHold: newHoldState } : prev);
    toast.info(newHoldState ? "Call on hold" : "Call resumed");
  };

  const toggleRecording = async () => {
    if (!activeCall) return;
    
    const newRecordingState = !activeCall.isRecording;
    
    if (activeCall.callSid) {
      try {
        const token = localStorage.getItem("comsierge_token");
        const response = await fetch(`${API_BASE_URL}/api/twilio/record-call`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": token ? `Bearer ${token}` : "",
          },
          body: JSON.stringify({
            callSid: activeCall.callSid,
            action: newRecordingState ? "start" : "stop",
          }),
        });
        const data = await response.json();
        if (!data.success) {
          toast.error(data.message || "Failed to toggle recording");
          return;
        }
      } catch (error) {
        console.error("Record call error:", error);
      }
    }
    
    setActiveCall(prev => prev ? { ...prev, isRecording: newRecordingState } : prev);
    toast.info(newRecordingState ? "Recording started" : "Recording stopped");
  };

  const sendDTMF = async (digit: string) => {
    if (!activeCall) return;
    
    if (activeCall.callSid) {
      try {
        const token = localStorage.getItem("comsierge_token");
        await fetch(`${API_BASE_URL}/api/twilio/send-dtmf`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": token ? `Bearer ${token}` : "",
          },
          body: JSON.stringify({
            callSid: activeCall.callSid,
            digits: digit,
          }),
        });
      } catch (error) {
        console.error("Send DTMF error:", error);
      }
    }
    
    // Play tone feedback (visual/audio feedback would be nice)
    toast.info(`Sent: ${digit}`, { duration: 500 });
  };

  const addParticipant = async () => {
    if (!activeCall) return;
    if (!addParticipantNumber.trim()) {
      toast.error("Enter a phone number to add");
      return;
    }
    if (!isValidUsPhoneNumber(addParticipantNumber.trim())) {
      toast.error("Enter a valid phone number");
      return;
    }

    const creds = getTwilioCredentials();
    let participantNum = addParticipantNumber.replace(/[^\d+]/g, "");
    if (!participantNum.startsWith("+")) {
      participantNum = "+1" + participantNum;
    }

    // If no conference yet, create one
    if (!activeCall.conferenceName) {
      if (creds) {
        try {
          const confName = `comsierge-conf-${Date.now()}`;
          const response = await fetch(`${API_BASE_URL}/api/twilio/create-conference`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accountSid: creds.accountSid,
              authToken: creds.authToken,
              fromNumber: creds.fromNumber,
              participants: [activeCall.number, participantNum],
              conferenceName: confName,
            }),
          });
          const data = await response.json();
          if (!data.success) {
            toast.error(data.message || "Failed to create conference");
            return;
          }
          
          setActiveCall(prev => prev ? {
            ...prev,
            conferenceName: confName,
            participants: [
              { number: activeCall.number, name: activeCall.name },
              { number: participantNum },
            ],
          } : prev);
          toast.success(`Conference started with ${participantNum}`);
        } catch (error) {
          console.error("Create conference error:", error);
          toast.error("Failed to create conference");
        }
      } else {
        // Simulate adding participant
        setActiveCall(prev => prev ? {
          ...prev,
          conferenceName: `sim-conf-${Date.now()}`,
          participants: [
            ...(prev.participants || []),
            { number: participantNum },
          ],
        } : prev);
        toast.success(`Added ${participantNum} to call (simulated)`);
      }
    } else {
      // Add to existing conference
      if (creds) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/twilio/add-participant`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accountSid: creds.accountSid,
              authToken: creds.authToken,
              fromNumber: creds.fromNumber,
              participantNumber: participantNum,
              conferenceName: activeCall.conferenceName,
            }),
          });
          const data = await response.json();
          if (!data.success) {
            toast.error(data.message || "Failed to add participant");
            return;
          }
          
          setActiveCall(prev => prev ? {
            ...prev,
            participants: [
              ...(prev.participants || []),
              { number: participantNum, callSid: data.data?.callSid },
            ],
          } : prev);
          toast.success(`Added ${participantNum} to conference`);
        } catch (error) {
          console.error("Add participant error:", error);
          toast.error("Failed to add participant");
        }
      } else {
        setActiveCall(prev => prev ? {
          ...prev,
          participants: [
            ...(prev.participants || []),
            { number: participantNum },
          ],
        } : prev);
        toast.success(`Added ${participantNum} (simulated)`);
      }
    }
    
    setAddParticipantNumber("");
    setShowAddParticipant(false);
  };

  const submitTransferCall = async () => {
    if (!activeCall) return;
    if (!transferCallTo.trim()) {
      toast.error("Enter a number to transfer to");
      return;
    }
    if (!isValidUsPhoneNumber(transferCallTo.trim())) {
      toast.error("Enter a valid phone number (10 digits, optional +1)");
      return;
    }
    
    let transferNum = transferCallTo.replace(/[^\d+]/g, "");
    if (!transferNum.startsWith("+")) {
      transferNum = "+1" + transferNum;
    }
    
    if (activeCall.callSid) {
      try {
        // Calculate duration before transfer (time spent talking)
        const durationMs = activeCall.connectedAt ? Date.now() - activeCall.connectedAt : 0;
        const durationSec = Math.floor(durationMs / 1000);
        
        const token = localStorage.getItem("comsierge_token");
        const response = await fetch(`${API_BASE_URL}/api/twilio/transfer-call`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": token ? `Bearer ${token}` : "",
          },
          body: JSON.stringify({
            callSid: activeCall.callSid,
            transferTo: transferNum,
            duration: durationSec, // Send duration before transfer
          }),
        });
        const data = await response.json();
        if (!data.success) {
          toast.error(data.message || "Failed to transfer call");
          return;
        }
        toast.success(`Call transferred to ${transferCallTo.trim()}`);
        
        // Refresh calls to show the transferred status
        loadCalls(false);

        // Ensure the agent browser leg ends immediately.
        if (activeCallRef.current && typeof activeCallRef.current.disconnect === "function") {
          try {
            activeCallRef.current.disconnect();
          } catch (e) {
            console.error("VoIP disconnect after transfer error:", e);
          }
        }
        activeCallRef.current = null;
        setActiveCall(null);
      } catch (error) {
        console.error("Transfer call error:", error);
        toast.error("Failed to transfer call");
        return;
      }
    } else {
      toast.error("No active call to transfer");
    }
    
    setShowTransferCall(false);
    setTransferCallTo("");
  };

  const scheduleCall = () => {
    if (!scheduleContact || !scheduleDate || !scheduleTime) {
      toast.error("Please fill in all required fields");
      return;
    }
    toast.success(`Call scheduled for ${scheduleDate} at ${scheduleTime}`);
    setShowScheduleCall(false);
    setScheduleContact("");
    setScheduleDate("");
    setScheduleTime("");
    setScheduleNotes("");
  };

  // Filter contacts based on search query (for dropdown)
  const matchingContacts = searchQuery.length > 0 
    ? contacts.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        c.phone.includes(searchQuery)
      ).slice(0, 5)
    : [];
  
  const [showContactDropdown, setShowContactDropdown] = useState(false);

  return (
    <div className="h-full min-h-0 flex flex-col gap-3">
      {/* Header with Search and Actions */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search contacts or dial a number..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowContactDropdown(e.target.value.length > 0);
            }}
            onFocus={() => searchQuery.length > 0 && setShowContactDropdown(true)}
            onBlur={() => setTimeout(() => setShowContactDropdown(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchQuery && isValidUsPhoneNumber(searchQuery)) {
                makeCall(searchQuery);
              }
            }}
            className="w-full h-9 pl-9 pr-3 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400 text-gray-700 placeholder:text-gray-400"
          />
          
          {/* Contact Dropdown */}
          {showContactDropdown && matchingContacts.length > 0 && !isValidUsPhoneNumber(searchQuery) && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden">
              {matchingContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer"
                  onMouseDown={() => {
                    makeCall(contact.phone, contact.name);
                    setShowContactDropdown(false);
                  }}
                >
                  <div className="flex items-center gap-2">
                    {contact.avatar ? (
                      <img 
                        src={contact.avatar} 
                        alt={contact.name} 
                        className="w-7 h-7 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-medium text-indigo-600">
                        {contact.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-medium text-gray-800">{contact.name}</p>
                      <p className="text-xs text-gray-500">{contact.phone}</p>
                    </div>
                  </div>
                  <Phone className="w-3.5 h-3.5 text-green-500" />
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Call button - only shows when valid number is entered */}
        {searchQuery && isValidUsPhoneNumber(searchQuery) && (
          <Button
            size="sm"
            className="gap-1.5 rounded-lg h-9 px-4 text-xs bg-green-500 hover:bg-green-600 text-white shrink-0"
            onClick={() => makeCall(searchQuery)}
          >
            <Phone className="w-3.5 h-3.5" /> Call
          </Button>
        )}
        
        <Button
          variant="outline"
          size="icon"
          className="rounded-lg h-9 w-9 border-gray-200 text-gray-500 hover:bg-gray-50 shrink-0"
          onClick={refreshCalls}
          disabled={isLoadingCalls}
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${isLoadingCalls ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {(["all", "missed", "incoming", "outgoing"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2.5 py-1 text-xs rounded font-medium capitalize transition-colors ${
              filter === f ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f}
          </button>
        ))}

        {(() => {
          const extraFilters: Filter[] = ["routed", "voicemail", "blocked"];
          const isExtraActive = extraFilters.includes(filter);
          const isOpen = showExtraCallFilters || isExtraActive;

          return (
            <>
              <button
                type="button"
                onClick={() => {
                  if (isOpen && isExtraActive) {
                    setFilter("all");
                    setShowExtraCallFilters(false);
                    return;
                  }

                  setShowExtraCallFilters(!isOpen);
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  isExtraActive ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                aria-label={isOpen ? "Hide extra call filters" : "Show extra call filters"}
                title={isOpen ? "Hide" : "Show"}
              >
                <ChevronRight className={`w-3 h-3 transition-transform ${isOpen ? "rotate-90" : "rotate-0"}`} />
              </button>

              {isOpen && (
                <div className="flex items-center gap-1.5">
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                  <div className="flex flex-wrap items-center gap-1.5">
                    {extraFilters.map((f) => (
                      <button
                        key={f}
                        onClick={() => {
                          setFilter(f);
                          setShowExtraCallFilters(true);
                        }}
                        className={`px-2.5 py-1 text-xs rounded font-medium capitalize transition-colors flex items-center gap-1 ${
                          filter === f ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {f === "voicemail" && <Voicemail className="w-3 h-3" />}
                        {f === "routed" && <ArrowRightLeft className="w-3 h-3" />}
                        {f === "blocked" && <Ban className="w-3 h-3" />}
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Calls List */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex-1 min-h-0">
        {isLoadingCalls && calls.length === 0 ? (
          <div className="divide-y divide-gray-100">
            {[...Array(6)].map((_, i) => (
              <CallSkeleton key={i} />
            ))}
          </div>
        ) : filteredCalls.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <Phone className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-xs">{searchQuery ? "No calls matching your search" : "No calls found"}</p>
          </div>
        ) : (
          <div className="max-h-full overflow-y-auto">
            {filteredCalls.map((call) => {
              const callContact = findContactByPhone(call.phone);
              return (
              <div key={call.id} className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors group">
                {callContact?.avatar ? (
                  <div className="relative shrink-0">
                    <img 
                      src={callContact.avatar} 
                      alt={call.contactName} 
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full ${getCallBgClass(call.type)} flex items-center justify-center border border-white`}>
                      {call.hasVoicemail ? (
                        <Voicemail className="w-2.5 h-2.5 text-amber-500" />
                      ) : (
                        <span className="scale-75">{getCallIcon(call.type)}</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className={`w-8 h-8 rounded-full ${getCallBgClass(call.type)} flex items-center justify-center shrink-0`}>
                    {call.hasVoicemail ? (
                      <Voicemail className="w-3.5 h-3.5 text-amber-500" />
                    ) : (
                      getCallIcon(call.type)
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate flex items-center gap-1.5 flex-wrap">
                    {call.contactName}
                    {/* Status badges - check specific statuses first, then fallback to completed logic */}
                    {call.status === "transferred" && (
                      <span className="text-[10px] px-1 py-0.5 bg-blue-100 text-blue-700 rounded">Transferred</span>
                    )}
                    {call.status === "forwarded" && (
                      <span className="text-[10px] px-1 py-0.5 bg-green-100 text-green-700 rounded">Routed</span>
                    )}
                    {call.status === "completed" && call.type === "outgoing" && (parseInt(call.duration || "0", 10) > 0) && (
                      <span className="text-[10px] px-1 py-0.5 bg-green-100 text-green-700 rounded">Connected</span>
                    )}
                    {call.status === "completed" && call.type === "incoming" && (parseInt(call.duration || "0", 10) > 0) && (
                      <span className="text-[10px] px-1 py-0.5 bg-green-100 text-green-700 rounded">Answered</span>
                    )}
                    {/* Only show "No Answer" for completed calls with 0 duration that weren't transferred/forwarded */}
                    {call.status === "completed" && (parseInt(call.duration || "0", 10) === 0) && !call.forwardedTo && (
                      <span className="text-[10px] px-1 py-0.5 bg-orange-100 text-orange-700 rounded">No Answer</span>
                    )}
                    {call.status === "blocked" && (
                      <span className="text-[10px] px-1 py-0.5 bg-red-100 text-red-700 rounded">Blocked</span>
                    )}
                    {call.status === "busy" && (
                      <span className="text-[10px] px-1 py-0.5 bg-yellow-100 text-yellow-700 rounded">Busy</span>
                    )}
                    {call.status === "no-answer" && (
                      <span className="text-[10px] px-1 py-0.5 bg-orange-100 text-orange-700 rounded">No Answer</span>
                    )}
                    {call.status === "failed" && (
                      <span className="text-[10px] px-1 py-0.5 bg-red-100 text-red-700 rounded">Failed</span>
                    )}
                    {call.status === "canceled" && (
                      <span className="text-[10px] px-1 py-0.5 bg-gray-100 text-gray-600 rounded">Canceled</span>
                    )}
                    {call.status === "initiated" && (
                      <span className="text-[10px] px-1 py-0.5 bg-blue-100 text-blue-700 rounded">Dialing...</span>
                    )}
                    {call.status === "ringing" && (
                      <span className="text-[10px] px-1 py-0.5 bg-blue-100 text-blue-700 rounded">Ringing</span>
                    )}
                    {call.hasVoicemail && (
                      <span className="text-[10px] px-1 py-0.5 bg-amber-100 text-amber-700 rounded">Voicemail</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{call.phone}</p>
                  {/* Show routing destination for forwarded/transferred calls */}
                  {call.status === "forwarded" && call.forwardedTo && (
                    <p className="text-xs text-green-600 truncate mt-0.5 flex items-center gap-1">
                      <ArrowRightLeft className="w-3 h-3" />
                      Routed to {call.forwardedTo}
                    </p>
                  )}
                  {call.status === "transferred" && call.forwardedTo && (
                    <p className="text-xs text-blue-600 truncate mt-0.5 flex items-center gap-1">
                      <ArrowRightLeft className="w-3 h-3" />
                      Transferred to {call.forwardedTo}
                    </p>
                  )}
                  {call.transcription && (
                    <p className="text-xs text-indigo-500 truncate mt-0.5 flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      AI transcript available
                    </p>
                  )}
                  {call.hasVoicemail && call.voicemailTranscript && (
                    <p className="text-xs text-amber-600 truncate mt-0.5 italic">"{call.voicemailTranscript}"</p>
                  )}
                  {call.hasVoicemail && !call.voicemailTranscript && (
                    <p className="text-xs text-amber-500 truncate mt-0.5 flex items-center gap-1">
                      <Voicemail className="w-3 h-3" />
                      Voicemail left
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0 hidden sm:block">
                  <p className="text-xs text-gray-500">{call.timestamp}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1 justify-end mt-0.5">
                    {call.status === "blocked" || call.isBlocked ? (
                      <>
                        <Ban className="w-3 h-3 text-red-500" />
                        Blocked
                      </>
                    ) : call.status === "missed" || call.type === "missed" ? (
                      <>
                        <PhoneMissed className="w-3 h-3 text-red-400" />
                        Missed
                      </>
                    ) : call.hasVoicemail ? (
                      <>
                        <Voicemail className="w-3 h-3 text-amber-500" />
                        {call.voicemailDuration ? `${call.voicemailDuration}s` : "Voicemail"}
                      </>
                    ) : call.transcription && !call.forwardedTo ? (
                      <>
                        <Bot className="w-3 h-3 text-indigo-500" />
                        AI Handled
                      </>
                    ) : call.status === "completed" ? (
                      <>
                        {parseInt(call.duration || "0", 10) > 0 ? (
                          <>
                            <Clock className="w-3 h-3 text-green-500" />
                            {call.duration || "-"}
                          </>
                        ) : (
                          <>
                            <PhoneMissed className="w-3 h-3 text-orange-500" />
                            No Answer
                          </>
                        )}
                      </>
                    ) : call.status === "forwarded" || call.status === "transferred" ? (
                      <>
                        <ArrowRightLeft className="w-3 h-3 text-green-500" />
                        Routed
                      </>
                    ) : (
                      <>
                        <Clock className="w-3 h-3" />
                        {call.duration || "-"}
                      </>
                    )}
                  </p>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  {/* Transcript button */}
                  {call.transcription && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded h-7 w-7 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50"
                      onClick={() => setViewingTranscript({
                        id: call.id,
                        contactName: call.contactName,
                        transcription: call.transcription!,
                        timestamp: call.timestamp,
                        phone: call.phone
                      })}
                      aria-label="View transcript"
                      title="View AI transcript & Ask AI"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {call.hasVoicemail && call.voicemailUrl && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`rounded h-7 w-7 ${playingVoicemailId === call.id ? 'text-amber-600 bg-amber-50' : 'text-amber-500 hover:text-amber-600 hover:bg-amber-50'}`}
                      onClick={() => playVoicemail(call.id)}
                      aria-label={playingVoicemailId === call.id ? "Stop voicemail" : "Play voicemail"}
                    >
                      {playingVoicemailId === call.id ? (
                        <Square className="w-3.5 h-3.5" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded h-7 w-7 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                    onClick={() => makeCall(call.phone, call.contactName)}
                    aria-label="Call"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </Button>
                  {/* Block/Unblock Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`rounded h-7 w-7 ${
                      call.isBlocked 
                        ? "text-red-500 hover:text-green-600 hover:bg-green-50" 
                        : "text-gray-400 hover:text-red-500 hover:bg-red-50"
                    }`}
                    onClick={() => toggleBlockNumber(call.phone, call.isBlocked || false)}
                    aria-label={call.isBlocked ? "Unblock" : "Block"}
                    title={call.isBlocked ? "Unblock this number" : "Block this number"}
                  >
                    <Ban className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded h-7 w-7 text-gray-400 hover:text-red-500 hover:bg-red-50"
                    onClick={async () => {
                      const confirmed = window.confirm(`Delete this call record?`);
                      if (confirmed) {
                        const success = await deleteCallRecord(call.id);
                        if (success) {
                          setCalls(prev => prev.filter(c => c.id !== call.id));
                          toast.success("Call record deleted");
                        } else {
                          toast.error("Failed to delete call record");
                        }
                      }
                    }}
                    aria-label="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )})}
          </div>
        )}
      </div>

      {/* Active Call Modal - Simplified */}
      {activeCall && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-2xl shadow-2xl w-full max-w-xs p-6 text-white">
            {/* Contact Info */}
            <div className="text-center mb-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl font-semibold">
                  {(activeCall.name || activeCall.number)?.[0]?.toUpperCase() || "?"}
                </span>
              </div>
              <h3 className="text-lg font-semibold truncate">
                {activeCall.name || activeCall.number}
              </h3>
              {activeCall.name && (
                <p className="text-sm text-gray-400">{activeCall.number}</p>
              )}
            </div>

            {/* Call Status */}
            <div className="text-center mb-6">
              {activeCall.status === "ringing" && (
                <div className="flex items-center justify-center gap-2">
                  <Phone className="w-4 h-4 animate-pulse" />
                  <span className="text-sm text-gray-300">Ringing...</span>
                </div>
              )}
              {activeCall.status === "connected" && (
                <div className="text-center">
                  <span className="text-2xl font-mono text-green-400">{formatDuration(callNowMs - (activeCall.connectedAt || activeCall.startedAt))}</span>
                  <p className="text-xs text-gray-400 mt-1">Connected</p>
                </div>
              )}
            </div>

            {/* Call Controls */}
            {(activeCall.status === "ringing" || activeCall.status === "connected") && (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-4">
                  {/* Mute Button */}
                  <button
                    onClick={toggleMute}
                    className={`w-12 h-12 rounded-full flex flex-col items-center justify-center transition-all ${
                      activeCall.isMuted 
                        ? "bg-red-500 hover:bg-red-600" 
                        : "bg-gray-700 hover:bg-gray-600"
                    }`}
                    title={activeCall.isMuted ? "Unmute" : "Mute"}
                  >
                    {activeCall.isMuted ? (
                      <MicOff className="w-5 h-5" />
                    ) : (
                      <Mic className="w-5 h-5" />
                    )}
                  </button>

                  {/* Transfer Button - only when connected */}
                  {activeCall.status === "connected" && (
                    <button
                      onClick={() => setShowTransferCall(!showTransferCall)}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                        showTransferCall 
                          ? "bg-indigo-500 hover:bg-indigo-600" 
                          : "bg-gray-700 hover:bg-gray-600"
                      }`}
                      title="Transfer Call"
                    >
                      <ArrowRightLeft className="w-5 h-5" />
                    </button>
                  )}

                  {/* Hangup Button */}
                  <button
                    onClick={hangUp}
                    className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-all"
                    title="End Call"
                  >
                    <Phone className="w-5 h-5 rotate-[135deg]" />
                  </button>
                </div>

                {/* Labels */}
                <div className="flex items-center justify-center gap-4 text-[10px] text-gray-400">
                  <span className="w-12 text-center">{activeCall.isMuted ? "Unmute" : "Mute"}</span>
                  {activeCall.status === "connected" && <span className="w-12 text-center">Transfer</span>}
                  <span className="w-12 text-center">End</span>
                </div>

                {/* Transfer Panel */}
                {showTransferCall && activeCall.status === "connected" && (
                  <div className="mt-4 p-3 bg-gray-800 rounded-xl space-y-3">
                    <p className="text-xs text-gray-400">Transfer call to:</p>
                    <input
                      type="tel"
                      value={transferCallTo}
                      onChange={(e) => setTransferCallTo(e.target.value)}
                      placeholder="Phone number (10 digits)"
                      className="w-full h-9 px-3 text-sm bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-indigo-400 text-white placeholder:text-gray-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowTransferCall(false)}
                        className="flex-1 h-8 text-xs bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={submitTransferCall}
                        disabled={!transferCallTo.trim()}
                        className="flex-1 h-8 text-xs bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-600 disabled:text-gray-400 rounded-lg transition-colors flex items-center justify-center gap-1"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        Transfer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transcript Viewer Modal with AI Chat */}
      {viewingTranscript && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gradient-to-r from-indigo-50 to-purple-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">Call Transcript</h3>
                  <p className="text-xs text-gray-500">
                    {viewingTranscript.contactName} • {viewingTranscript.timestamp}
                  </p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full h-8 w-8 text-gray-500 hover:bg-white/80" 
                onClick={() => {
                  setViewingTranscript(null);
                  setTranscriptAiMessages([]);
                  setTranscriptAiInput("");
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Two-column layout on desktop, stacked on mobile */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* Transcript Column */}
              <div className="flex-1 flex flex-col border-b md:border-b-0 md:border-r border-gray-100 max-h-[40vh] md:max-h-none">
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between shrink-0">
                  <span className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5" />
                    Transcript
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-6 px-2 text-gray-500 hover:text-gray-700"
                    onClick={() => {
                      navigator.clipboard.writeText(viewingTranscript.transcription);
                      toast.success("Copied!");
                    }}
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copy
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {viewingTranscript.transcription}
                  </p>
                </div>
              </div>
              
              {/* AI Chat Column */}
              <div className="flex-1 flex flex-col bg-gray-50 min-h-[300px] md:min-h-0">
                <div className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center gap-2 shrink-0">
                  <Sparkles className="w-4 h-4 text-white" />
                  <span className="text-xs font-medium text-white">Ask AI about this call</span>
                </div>
                
                {/* Quick prompts */}
                {transcriptAiMessages.length === 0 && (
                  <div className="p-3 border-b border-gray-200 bg-white">
                    <p className="text-xs text-gray-500 mb-2">Quick actions:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {quickTranscriptPrompts.map((item) => (
                        <button
                          key={item.label}
                          onClick={() => askAiAboutTranscript(item.prompt)}
                          className="px-2.5 py-1 text-xs bg-indigo-50 text-indigo-700 rounded-full hover:bg-indigo-100 transition-colors flex items-center gap-1"
                        >
                          <ChevronRight className="w-3 h-3" />
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Chat messages */}
                <div 
                  ref={transcriptAiChatRef}
                  className="flex-1 overflow-y-auto p-3 space-y-3"
                >
                  {transcriptAiMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4">
                      <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-3">
                        <MessageSquare className="w-6 h-6 text-indigo-500" />
                      </div>
                      <p className="text-sm text-gray-600 font-medium">Ask me anything about this call</p>
                      <p className="text-xs text-gray-400 mt-1">
                        I can summarize, find action items, or answer questions
                      </p>
                    </div>
                  ) : (
                    transcriptAiMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                            msg.role === "user"
                              ? "bg-indigo-500 text-white rounded-br-sm"
                              : "bg-white border border-gray-200 text-gray-700 rounded-bl-sm shadow-sm"
                          }`}
                        >
                          {msg.role === "assistant" && (
                            <div className="flex items-center gap-1.5 mb-1.5 text-indigo-500">
                              <Sparkles className="w-3 h-3" />
                              <span className="text-xs font-medium">AI</span>
                            </div>
                          )}
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        </div>
                      </div>
                    ))
                  )}
                  {isTranscriptAiLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-gray-200 px-3 py-2 rounded-xl rounded-bl-sm shadow-sm">
                        <div className="flex items-center gap-2 text-indigo-500">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span className="text-xs">Analyzing...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Chat input */}
                <div className="p-3 bg-white border-t border-gray-200 shrink-0">
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      askAiAboutTranscript(transcriptAiInput);
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={transcriptAiInput}
                      onChange={(e) => setTranscriptAiInput(e.target.value)}
                      placeholder="Ask about this call..."
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      disabled={isTranscriptAiLoading}
                    />
                    <Button
                      type="submit"
                      disabled={!transcriptAiInput.trim() || isTranscriptAiLoading}
                      className="px-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Call Modal */}
      {showScheduleCall && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-gray-200 rounded-lg shadow-lg w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-800">Schedule a Call</h3>
              <Button variant="ghost" size="icon" className="rounded h-7 w-7 text-gray-500 hover:bg-gray-100" onClick={() => setShowScheduleCall(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500">Contact</label>
                <select
                  value={scheduleContact}
                  onChange={(e) => setScheduleContact(e.target.value)}
                  className="w-full h-8 px-3 text-xs bg-gray-50 border border-gray-200 rounded focus:outline-none focus:border-gray-300 text-gray-700 mt-1"
                >
                  <option value="">Select contact...</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>{contact.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Date</label>
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="w-full h-8 px-3 text-xs bg-gray-50 border border-gray-200 rounded focus:outline-none focus:border-gray-300 text-gray-700 mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Time</label>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full h-8 px-3 text-xs bg-gray-50 border border-gray-200 rounded focus:outline-none focus:border-gray-300 text-gray-700 mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500">Timezone</label>
                <select className="w-full h-8 px-3 text-xs bg-gray-50 border border-gray-200 rounded focus:outline-none focus:border-gray-300 text-gray-700 mt-1">
                  <option>Your Local Time</option>
                  <option>UTC</option>
                  <option>EST</option>
                  <option>PST</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={remindBefore}
                    onChange={(e) => setRemindBefore(e.target.checked)}
                    className="w-3.5 h-3.5 accent-indigo-500 rounded"
                  />
                  <span className="text-xs text-gray-700">Remind me 15 minutes before</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={notifyContact}
                    onChange={(e) => setNotifyContact(e.target.checked)}
                    className="w-3.5 h-3.5 accent-indigo-500 rounded"
                  />
                  <span className="text-xs text-gray-700">Send notification to contact</span>
                </label>
              </div>

              <div>
                <label className="text-xs text-gray-500">Notes (optional)</label>
                <textarea
                  value={scheduleNotes}
                  onChange={(e) => setScheduleNotes(e.target.value)}
                  placeholder="Discuss project timeline..."
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded focus:outline-none focus:border-gray-300 text-gray-700 placeholder:text-gray-400 mt-1 resize-none h-16"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 rounded h-8 text-xs border-gray-200 bg-white text-gray-700 hover:bg-gray-50" onClick={() => setShowScheduleCall(false)}>
                  Cancel
                </Button>
                <Button 
                  className="flex-1 rounded h-8 text-xs bg-indigo-500 hover:bg-indigo-600 text-white" 
                  onClick={scheduleCall}
                >
                  Schedule
                </Button>
              </div>
            </div>
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
                <label className="text-xs font-medium text-gray-700 mb-1 block">Call me on this number</label>
                <input
                  type="tel"
                  value={bridgeNumber}
                  onChange={(e) => setBridgeNumber(e.target.value)}
                  placeholder="+1..."
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded focus:outline-none focus:border-indigo-500 text-gray-800"
                />
                <p className="text-[10px] text-gray-400 mt-1">Your personal phone number</p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 rounded h-8 text-xs border-gray-200 bg-white text-gray-700 hover:bg-gray-50" onClick={() => setShowBridgeDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  className="flex-1 rounded h-8 text-xs bg-green-500 hover:bg-green-600 text-white" 
                  onClick={confirmBridgeCall}
                  disabled={!bridgeNumber || isCallingLoading || bridgeNumber.replace(/[^\d+]/g, "") === pendingCall?.number?.replace(/[^\d+]/g, "")}
                >
                  {isCallingLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <PhoneCall className="w-3 h-3 mr-1" />}
                  Call Me Now
                </Button>
              </div>
              {bridgeNumber && pendingCall?.number && bridgeNumber.replace(/[^\d+]/g, "") === pendingCall.number.replace(/[^\d+]/g, "") && (
                <p className="text-xs text-red-500 text-center">Your number cannot be the same as the contact you're calling</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallsTab;
