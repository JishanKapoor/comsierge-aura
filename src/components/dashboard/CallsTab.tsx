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

type Filter = "all" | "missed" | "incoming" | "outgoing";

interface CallsTabProps {
  selectedContactPhone?: string | null;
  onClearSelection?: () => void;
}

const CallsTab = ({ selectedContactPhone, onClearSelection }: CallsTabProps) => {
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
  const [searchQuery, setSearchQuery] = useState("");
  const [showScheduleCall, setShowScheduleCall] = useState(false);
  const [isCallingLoading, setIsCallingLoading] = useState(false);
  const [activeCall, setActiveCall] = useState<{
    number: string;
    name?: string;
    startedAt: number;
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

  // Transcript viewing state
  const [viewingTranscript, setViewingTranscript] = useState<{ id: string; contactName: string; transcription: string; timestamp: string } | null>(null);

  // Audio refs for ringtone
  const ringToneRef = useRef<HTMLAudioElement | null>(null);
  
  // Initialize ringtone audio
  useEffect(() => {
    // Create a simple ringtone using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const createRingtone = () => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 440;
      oscillator.type = "sine";
      gainNode.gain.value = 0.3;
      
      return { oscillator, gainNode, audioContext };
    };
    
    // Store the create function for later use
    (window as any).__ringToneCreate = createRingtone;
    
    return () => {
      audioContext.close();
    };
  }, []);
  
  // Play/stop ringtone based on call status
  useEffect(() => {
    let ringInterval: NodeJS.Timeout | null = null;
    let oscillator: OscillatorNode | null = null;
    let gainNode: GainNode | null = null;
    
    if (activeCall?.status === "ringing") {
      // Play ringtone pattern (ring for 1 sec, silence for 2 sec)
      const playRing = () => {
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          oscillator = audioContext.createOscillator();
          gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.value = 440;
          oscillator.type = "sine";
          gainNode.gain.value = 0.2;
          
          oscillator.start();
          
          // Stop after 1 second
          setTimeout(() => {
            if (oscillator) {
              oscillator.stop();
              audioContext.close();
            }
          }, 1000);
        } catch (e) {
          console.log("Audio not available");
        }
      };
      
      playRing();
      ringInterval = setInterval(playRing, 3000);
    }
    
    return () => {
      if (ringInterval) clearInterval(ringInterval);
      if (oscillator) {
        try { oscillator.stop(); } catch(e) {}
      }
    };
  }, [activeCall?.status]);

  // Fetch contacts from API on mount
  useEffect(() => {
    const loadContactsData = async () => {
      const data = await fetchContacts();
      setContacts(data);
    };
    loadContactsData();
  }, []);

  // Reusable function to load calls from API
  const loadCalls = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoadingCalls(true);
    try {
      const callRecords = await fetchCalls(filter === "all" ? undefined : filter);
      
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
      
      // Convert CallRecord to Call type for display
      const formattedCalls: Call[] = callRecords.map((record) => ({
        id: record.id,
        contactId: `phone:${record.contactPhone}`,
        contactName: record.contactName || record.contactPhone,
        phone: record.contactPhone,
        timestamp: formatTimestampForCall(record.createdAt),
        type: record.type,
        duration: formatDurationForCall(record.duration),
        isBlocked: false,
        recordingUrl: record.recordingUrl,
        transcription: record.transcription,
        hasVoicemail: record.hasVoicemail,
        voicemailUrl: record.voicemailUrl,
        voicemailDuration: record.voicemailDuration,
        voicemailTranscript: record.voicemailTranscript,
      }));
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
  }, [filter]);

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

  // Auto-trigger call when navigating from contacts
  useEffect(() => {
    if (selectedContactPhone) {
      const contact = contacts.find(c => c.phone === selectedContactPhone);
      // Set search to show the number, then trigger call
      setSearchQuery(selectedContactPhone);
      makeCall(selectedContactPhone, contact?.name);
      onClearSelection?.();
    }
  }, [selectedContactPhone, contacts]);

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
  const filteredCalls = calls.filter((call) => {
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
      const callRecords = await fetchCalls(filter === "all" ? undefined : filter);
      const formattedCalls: Call[] = callRecords.map((record) => {
        const formatDurationSec = (seconds: number): string | undefined => {
          if (!seconds || seconds <= 0) return undefined;
          const mins = Math.floor(seconds / 60);
          const secs = seconds % 60;
          if (mins === 0) return `${secs}s`;
          return `${mins}m ${secs}s`;
        };
        
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
        
        return {
          id: record.id,
          contactId: `phone:${record.contactPhone}`,
          contactName: record.contactName || record.contactPhone,
          phone: record.contactPhone,
          timestamp: formatTimestamp(record.createdAt),
          type: record.type,
          duration: formatDurationSec(record.duration),
          isBlocked: false,
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
    const audioUrl = `/api/calls/${callId}/voicemail`;
    
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

      // 2. Initialize Device
      const newDevice = new Device(data.token, {
        codecPreferences: ["opus", "pcmu"],
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
        toast.error("No Twilio number found. Contact admin to assign a number.");
        setIsCallingLoading(false);
        return;
      }
      
      const call = await newDevice.connect({
        params: {
          To: number,
          customCallerId: fromNumber // Pass Twilio number as caller ID
        },
      });

      // Set active call with ringing status
      const callStartTime = Date.now();
      setActiveCall({ 
        number, 
        name, 
        startedAt: callStartTime, 
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
        setActiveCall(prev => prev ? { ...prev, status: "connected", callSid: c.parameters.CallSid } : null);
        setIsCallingLoading(false);
      });

      call.on("disconnect", () => {
        console.log("Call disconnected");
        setActiveCall(null);
        setIsCallingLoading(false);
      });
      
      call.on("cancel", () => {
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
      toast.error("No Twilio number found. Please contact admin to assign a number.");
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
      
      // Log the call to history
      const callSid = data?.data?.callSid as string | undefined;
      if (callSid) {
        try {
          await saveCallRecord({
            contactPhone: number,
            contactName: name,
            direction: "outgoing",
            duration: 0,
            status: "initiated",
            callSid,
          });
          // Refresh calls list
          const updatedCalls = await fetchCalls();
          setCalls(updatedCalls.map((record) => {
            const formatDuration = (seconds: number): string | undefined => {
              if (!seconds || seconds <= 0) return undefined;
              const mins = Math.floor(seconds / 60);
              const secs = seconds % 60;
              if (mins === 0) return `${secs}s`;
              return `${mins}m ${secs}s`;
            };
            const formatTimestamp = (dateStr: string): string => {
              const date = new Date(dateStr);
              const now = new Date();
              const isToday = date.toDateString() === now.toDateString();
              if (isToday) {
                return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
              }
              return date.toLocaleDateString([], { month: "short", day: "numeric" });
            };
            return {
              id: record.id,
              name: record.contactName || record.contactPhone,
              number: record.contactPhone,
              time: formatTimestamp(record.createdAt),
              duration: formatDuration(record.duration),
              type: record.direction === "incoming" 
                ? (record.status === "missed" ? "missed" : "incoming")
                : "outgoing",
            } as Call;
          }));
        } catch (e) {
          console.error("Failed to save call record:", e);
        }
      }
      
    } catch (error: any) {
      console.error("Bridge call failed:", error);
      toast.error("Failed to initiate call: " + error.message);
      setIsCallingLoading(false);
    }
  };

  const hangUp = async () => {
    if (!activeCall) return;
    
    const creds = getTwilioCredentials();
    
    // If we have a real call SID, end it via API
    if (creds && activeCall.callSid) {
      try {
        await fetch(`${API_BASE_URL}/api/twilio/end-call`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountSid: creds.accountSid,
            authToken: creds.authToken,
            callSid: activeCall.callSid,
          }),
        });
      } catch (error) {
        console.error("End call API error:", error);
      }
    }
    
    const durationMs = Date.now() - activeCall.startedAt;
    const durationSec = Math.floor(durationMs / 1000);
    const wasMissed = activeCall.status === "ringing";
    
    // Save call record to database
    const savedCall = await saveCallRecord({
      contactPhone: activeCall.number,
      contactName: activeCall.name,
      direction: "outgoing",
      type: wasMissed ? "missed" : "outgoing",
      status: wasMissed ? "canceled" : "completed",
      twilioSid: activeCall.callSid,
      fromNumber: user?.phoneNumber || "",
      toNumber: activeCall.number,
      duration: wasMissed ? 0 : durationSec,
      startTime: new Date(activeCall.startedAt).toISOString(),
      endTime: new Date().toISOString(),
    });
    
    // Add to local call history (or refresh from API)
    if (savedCall) {
      const newCall: Call = {
        id: savedCall.id,
        contactId: `phone:${activeCall.number}`,
        contactName: activeCall.name || activeCall.number,
        phone: activeCall.number,
        timestamp: `Today, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        type: wasMissed ? "missed" : "outgoing",
        duration: wasMissed ? undefined : formatDuration(durationMs),
        isBlocked: false,
      };
      setCalls(prev => [newCall, ...prev]);
    }
    
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
    setActiveCall(prev => prev ? { ...prev, isMuted: !prev.isMuted } : prev);
    toast.info(activeCall.isMuted ? "Unmuted" : "Muted");
  };

  const toggleHold = async () => {
    if (!activeCall) return;
    
    const creds = getTwilioCredentials();
    const newHoldState = !activeCall.isOnHold;
    
    if (creds && activeCall.callSid) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/twilio/hold-call`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountSid: creds.accountSid,
            authToken: creds.authToken,
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
    
    const creds = getTwilioCredentials();
    const newRecordingState = !activeCall.isRecording;
    
    if (creds && activeCall.callSid) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/twilio/record-call`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountSid: creds.accountSid,
            authToken: creds.authToken,
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
    
    const creds = getTwilioCredentials();
    
    if (creds && activeCall.callSid) {
      try {
        await fetch(`${API_BASE_URL}/api/twilio/send-dtmf`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountSid: creds.accountSid,
            authToken: creds.authToken,
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
    
    const creds = getTwilioCredentials();
    let transferNum = transferCallTo.replace(/[^\d+]/g, "");
    if (!transferNum.startsWith("+")) {
      transferNum = "+1" + transferNum;
    }
    
    if (creds && activeCall.callSid) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/twilio/transfer-call`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountSid: creds.accountSid,
            authToken: creds.authToken,
            callSid: activeCall.callSid,
            transferTo: transferNum,
            fromNumber: creds.fromNumber,
          }),
        });
        const data = await response.json();
        if (!data.success) {
          toast.error(data.message || "Failed to transfer call");
          return;
        }
        toast.success(`Call transferred to ${transferCallTo.trim()}`);
        setActiveCall(null);
      } catch (error) {
        console.error("Transfer call error:", error);
        toast.error("Failed to transfer call");
        return;
      }
    } else {
      toast.success(`Transferring call to ${transferCallTo.trim()} (simulated)`);
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
                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-medium text-indigo-600">
                      {contact.name.charAt(0)}
                    </div>
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
      <div className="flex gap-1.5 flex-wrap">
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
            {filteredCalls.map((call) => (
              <div key={call.id} className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors group">
                <div className={`w-8 h-8 rounded-full ${getCallBgClass(call.type)} flex items-center justify-center shrink-0`}>
                  {call.hasVoicemail ? (
                    <Voicemail className="w-3.5 h-3.5 text-amber-500" />
                  ) : (
                    getCallIcon(call.type)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{call.contactName}</p>
                  <p className="text-xs text-gray-500 truncate">{call.phone}</p>
                  {call.transcription && (
                    <p className="text-xs text-indigo-500 truncate mt-0.5 flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      AI transcript available
                    </p>
                  )}
                  {call.hasVoicemail && call.voicemailTranscript && (
                    <p className="text-xs text-gray-400 truncate mt-0.5 italic">"{call.voicemailTranscript}"</p>
                  )}
                </div>
                <div className="text-right shrink-0 hidden sm:block">
                  <p className="text-xs text-gray-500">{call.timestamp}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1 justify-end mt-0.5">
                    {call.hasVoicemail ? (
                      <>
                        <Voicemail className="w-3 h-3 text-amber-500" />
                        {call.voicemailDuration ? `${call.voicemailDuration}s` : "Voicemail"}
                      </>
                    ) : (
                      <>
                        <Clock className="w-3 h-3" />
                        {call.duration || "Missed"}
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
                        timestamp: call.timestamp
                      })}
                      aria-label="View transcript"
                      title="View AI transcript"
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded h-7 w-7 text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
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
                  {call.isBlocked && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded h-7 w-7 text-gray-400 hover:bg-gray-100"
                      onClick={() => toast("Blocked", { description: "This number is blocked" })}
                      aria-label="Blocked"
                    >
                      <Ban className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Call Modal - Full Featured */}
      {activeCall && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-gray-200 rounded-lg shadow-lg w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-gray-800 flex items-center gap-2">
                  {activeCall.status === "ringing" ? (
                    <span className="flex items-center gap-1 text-green-600 animate-pulse">
                      <PhoneCall className="w-3.5 h-3.5" /> Ringing...
                    </span>
                  ) : activeCall.isOnHold ? (
                    <span className="flex items-center gap-1 text-amber-600">
                      <Pause className="w-3.5 h-3.5" /> On Hold
                    </span>
                  ) : activeCall.conferenceName ? (
                    <span className="flex items-center gap-1 text-indigo-600">
                      <Users className="w-3.5 h-3.5" /> Conference Call
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-green-600">
                      <Phone className="w-3.5 h-3.5" /> In call
                    </span>
                  )}
                  {activeCall.isRecording && (
                    <span className="flex items-center gap-1 text-red-500 animate-pulse">
                      <CircleDot className="w-3 h-3" /> Recording
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500">
                  {activeCall.name ? `${activeCall.name} • ${activeCall.number}` : activeCall.number}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="rounded h-7 w-7 text-gray-500 hover:bg-gray-100"
                onClick={hangUp}
                aria-label="Hang up"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Call Info & Timer */}
            <div className="text-center py-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 ${
                activeCall.status === "ringing" ? "bg-green-100 animate-pulse" : "bg-gray-100"
              }`}>
                {activeCall.status === "ringing" ? (
                  <PhoneCall className="w-6 h-6 text-green-600 animate-bounce" />
                ) : activeCall.conferenceName ? (
                  <Users className="w-6 h-6 text-indigo-600" />
                ) : (
                  <Phone className="w-6 h-6 text-gray-600" />
                )}
              </div>
              <p className="text-xs text-gray-500">
                {activeCall.status === "ringing" ? "Ringing" : "Duration"}
              </p>
              <p className="text-2xl font-semibold text-gray-800">
                {activeCall.status === "ringing" 
                  ? formatDuration(callNowMs - activeCall.startedAt)
                  : formatDuration(callNowMs - activeCall.startedAt)
                }
              </p>
              
              {/* Speaker status indicator */}
              {activeCall.isSpeakerOn && activeCall.status === "connected" && (
                <div className="mt-2 flex items-center justify-center gap-1 text-indigo-600">
                  <Volume2 className="w-4 h-4" />
                  <span className="text-xs font-medium">Speaker On</span>
                </div>
              )}
              
              {/* Conference Participants */}
              {activeCall.participants && activeCall.participants.length > 0 && (
                <div className="mt-3 text-xs text-gray-500">
                  <p className="font-medium mb-1">Participants ({activeCall.participants.length + 1}):</p>
                  <div className="flex flex-wrap gap-1 justify-center">
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded">You</span>
                    {activeCall.participants.map((p, i) => (
                      <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                        {p.name || p.number}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Main Control Buttons - 4 columns (only show when connected) */}
            {activeCall.status === "connected" && (
              <>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {/* Mute */}
                  <button
                    onClick={toggleMute}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                      activeCall.isMuted ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {activeCall.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    <span className="text-xs">{activeCall.isMuted ? "Unmute" : "Mute"}</span>
                  </button>

                  {/* Speaker */}
                  <button
                    onClick={toggleSpeaker}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                      activeCall.isSpeakerOn ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {activeCall.isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                    <span className="text-xs">{activeCall.isSpeakerOn ? "Speaker" : "Earpiece"}</span>
                  </button>

                  {/* Hold */}
                  <button
                    onClick={toggleHold}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                      activeCall.isOnHold ? "bg-amber-100 text-amber-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {activeCall.isOnHold ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                    <span className="text-xs">{activeCall.isOnHold ? "Resume" : "Hold"}</span>
                  </button>

                  {/* Record */}
                  <button
                    onClick={toggleRecording}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                      activeCall.isRecording ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    <CircleDot className="w-5 h-5" />
                    <span className="text-xs">{activeCall.isRecording ? "Stop" : "Record"}</span>
                  </button>
                </div>

                {/* Secondary Controls - 3 columns */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {/* Keypad */}
                  <button
                    onClick={() => { setShowKeypad(v => !v); setShowTransferCall(false); setShowAddParticipant(false); }}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                      showKeypad ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    <Grid3X3 className="w-5 h-5" />
                    <span className="text-xs">Keypad</span>
                  </button>

                  {/* Add Participant */}
                  <button
                    onClick={() => { setShowAddParticipant(v => !v); setShowTransferCall(false); setShowKeypad(false); }}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                      showAddParticipant ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    <UserPlus className="w-5 h-5" />
                    <span className="text-xs">Add</span>
                  </button>

                  {/* Transfer */}
                  <button
                    onClick={() => { setShowTransferCall(v => !v); setShowKeypad(false); setShowAddParticipant(false); }}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                      showTransferCall ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    <ArrowRightLeft className="w-5 h-5" />
                    <span className="text-xs">Transfer</span>
                  </button>
                </div>
              </>
            )}

            {/* Ringing state - show cancel only */}
            {activeCall.status === "ringing" && (
              <div className="text-center py-4">
                <p className="text-xs text-gray-500 mb-4">Waiting for answer...</p>
              </div>
            )}

            {/* Keypad Panel */}
            {showKeypad && (
              <div className="bg-gray-50 rounded-lg p-3 mb-3">
                <div className="grid grid-cols-3 gap-2">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((digit) => (
                    <button
                      key={digit}
                      onClick={() => sendDTMF(digit)}
                      className="h-11 rounded-lg bg-white border border-gray-200 text-gray-800 font-medium text-lg hover:bg-gray-100 transition-colors"
                    >
                      {digit}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Add Participant Panel */}
            {showAddParticipant && (
              <div className="bg-gray-50 rounded-lg p-3 mb-3 space-y-2">
                <p className="text-xs font-medium text-gray-600">Add participant to call:</p>
                <input
                  type="text"
                  value={addParticipantNumber}
                  onChange={(e) => setAddParticipantNumber(e.target.value)}
                  placeholder="Phone number (10 digits)"
                  className="w-full h-9 px-3 text-sm bg-white border border-gray-200 rounded focus:outline-none focus:border-indigo-300 text-gray-700 placeholder:text-gray-400"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 rounded h-8 text-xs border-gray-200"
                    onClick={() => setShowAddParticipant(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 rounded h-8 text-xs bg-indigo-500 hover:bg-indigo-600 text-white"
                    onClick={addParticipant}
                    disabled={!addParticipantNumber.trim()}
                  >
                    <UserPlus className="w-3.5 h-3.5 mr-1" /> Add
                  </Button>
                </div>
                {/* Quick add from contacts */}
                <div className="pt-2 border-t border-gray-200">
                  <p className="text-xs text-gray-500 mb-2">Quick add:</p>
                  <div className="flex flex-wrap gap-1">
                    {contacts.slice(0, 4).map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setAddParticipantNumber(c.phone)}
                        className="px-2 py-1 text-xs bg-white border border-gray-200 rounded hover:bg-gray-100"
                      >
                        {c.name.split(" ")[0]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Transfer Panel */}
            {showTransferCall && (
              <div className="bg-gray-50 rounded-lg p-3 mb-3 space-y-2">
                <p className="text-xs font-medium text-gray-600">Transfer call to:</p>
                <input
                  type="text"
                  value={transferCallTo}
                  onChange={(e) => setTransferCallTo(e.target.value)}
                  placeholder="Phone number (10 digits)"
                  className="w-full h-9 px-3 text-sm bg-white border border-gray-200 rounded focus:outline-none focus:border-indigo-300 text-gray-700 placeholder:text-gray-400"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 rounded h-8 text-xs border-gray-200"
                    onClick={() => setShowTransferCall(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 rounded h-8 text-xs bg-indigo-500 hover:bg-indigo-600 text-white"
                    onClick={submitTransferCall}
                    disabled={!transferCallTo.trim()}
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 mr-1" /> Transfer
                  </Button>
                </div>
              </div>
            )}

            {/* Hang Up Button */}
            <Button
              className="w-full rounded h-10 text-sm bg-red-500 hover:bg-red-600 text-white font-medium"
              onClick={hangUp}
            >
              <PhoneOff className="w-4 h-4 mr-2" /> End Call
            </Button>
          </div>
        </div>
      )}

      {/* Transcript Viewer Modal */}
      {viewingTranscript && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-gray-200 rounded-lg shadow-lg w-full max-w-lg p-5 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div>
                <h3 className="text-sm font-medium text-gray-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  Call Transcript
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {viewingTranscript.contactName} • {viewingTranscript.timestamp}
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded h-7 w-7 text-gray-500 hover:bg-gray-100" 
                onClick={() => setViewingTranscript(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {viewingTranscript.transcription}
              </p>
            </div>
            
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between shrink-0">
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Mic className="w-3 h-3" />
                AI-generated transcript
              </p>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => {
                  navigator.clipboard.writeText(viewingTranscript.transcription);
                  toast.success("Transcript copied to clipboard");
                }}
              >
                Copy
              </Button>
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
