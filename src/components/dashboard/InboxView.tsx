import { useEffect, useMemo, useState, useRef } from "react";
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
  BellOff,
  Ban,
  Trash2,
  Globe,
  Wand2,
  Lightbulb,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { mockMessages, languages } from "./mockData";
import type { Message } from "./types";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

type ChatBubble = {
  id: string;
  role: "incoming" | "outgoing" | "ai";
  content: string;
  timestamp: string;
};

type FilterType = "all" | "unread" | "priority" | "blocked";

interface InboxViewProps {
  selectedContactPhone?: string | null;
  onClearSelection?: () => void;
}

const InboxView = ({ selectedContactPhone, onClearSelection }: InboxViewProps) => {
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [mobilePane, setMobilePane] = useState<"list" | "chat">("list");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  
  // Menu states
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [receiveLanguage, setReceiveLanguage] = useState("en");
  const [sendLanguage, setSendLanguage] = useState("en");
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const languageMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
      if (languageMenuRef.current && !languageMenuRef.current.contains(e.target as Node)) {
        setShowLanguageMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  const filteredMessages = useMemo(() => {
    return messages.filter((msg) => {
      const matchesSearch =
        msg.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        msg.content.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Filter by tab
      if (activeFilter === "all" && msg.status === "blocked") return false; // All excludes blocked
      if (activeFilter === "unread" && (msg.isRead || msg.status === "blocked")) return false;
      if (activeFilter === "priority" && msg.status !== "priority") return false;
      if (activeFilter === "blocked" && msg.status !== "blocked") return false;
      
      return matchesSearch;
    });
  }, [messages, searchQuery, activeFilter]);

  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    filteredMessages[0]?.id ?? null
  );

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

  const handleSelectConversation = (id: string) => {
    setSelectedMessageId(id);
    if (isMobile) setMobilePane("chat");
  };

  const handleSend = () => {
    const trimmed = newMessage.trim();
    if (!trimmed || !selectedMessage) return;

    const now = new Date();
    const timestamp = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase();
    const outgoing: ChatBubble = {
      id: `${selectedMessage.contactId}-${now.getTime()}`,
      role: "outgoing",
      content: trimmed,
      timestamp,
    };

    setThreadsByContactId((prev) => ({
      ...prev,
      [selectedMessage.contactId]: [...(prev[selectedMessage.contactId] ?? []), outgoing],
    }));

    setNewMessage("");
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
      default:
        return { color: "hsl(var(--chat-blue))", bg: "hsl(var(--chat-blue) / 0.12)", icon: MessageSquare, label: "Message" };
    }
  };

  // More menu actions
  const handleTranslate = () => {
    toast.success("Translating conversation...");
    setShowMoreMenu(false);
  };

  const handleTransfer = () => {
    toast("Transfer conversation", { description: "Select a team member to transfer to" });
    setShowMoreMenu(false);
  };

  const handlePin = () => {
    toast.success("Conversation pinned");
    setShowMoreMenu(false);
  };

  const handleMute = () => {
    toast.success("Conversation muted");
    setShowMoreMenu(false);
  };

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
    setMessages(prev => prev.filter(m => m.id !== selectedMessage.id));
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
    toast.success("AI is rewriting your message...");
    // Simulate AI rewrite
    setTimeout(() => {
      setNewMessage(prev => `${prev} (AI enhanced)`);
    }, 500);
  };

  const handleAiSuggestion = () => {
    toast.success("AI is generating suggestions...");
    const suggestions = [
      "Thank you for reaching out! I'll look into this right away.",
      "I understand your concern. Let me help you with that.",
      "Great question! Here's what I can do for you.",
    ];
    const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
    setTimeout(() => {
      setNewMessage(randomSuggestion);
    }, 500);
  };

  const filterTabs: { id: FilterType; label: string }[] = [
    { id: "all", label: "All" },
    { id: "unread", label: "Unread" },
    { id: "priority", label: "Priority" },
    { id: "blocked", label: "Blocked" },
  ];

  return (
    <div className="h-full flex bg-white">
      {/* Conversation List */}
      <section
        className={cn(
          "w-full md:w-80 md:shrink-0 flex flex-col border-r border-gray-200 bg-white",
          isMobile && mobilePane === "chat" ? "hidden" : "flex"
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
          {filterTabs.map((tab) => (
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
          {filteredMessages.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-gray-500">No conversations found</p>
            </div>
          ) : (
            filteredMessages.map((msg) => {
              const isSelected = selectedMessage?.id === msg.id;
              const isUnread = !msg.isRead;
              const statusInfo = getStatusInfo(msg.status);

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
                          <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-indigo-500" />
                        )}
                      </div>
                      <span className="text-xs text-gray-500 shrink-0">
                        {msg.timestamp}
                      </span>
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
                {/* Language menu */}
                <div className="relative" ref={languageMenuRef}>
                  <button
                    className="p-2 rounded hover:bg-gray-100 transition-colors"
                    aria-label="Language"
                    onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                  >
                    <Globe className="w-4 h-4 text-gray-500" />
                  </button>
                  
                  {showLanguageMenu && (
                    <div className="absolute right-0 top-10 w-64 bg-[#F9F9F9] border border-gray-200 rounded-lg shadow-lg py-2 z-50">
                      <div className="px-3 py-2 border-b border-gray-100">
                        <p className="text-xs font-medium text-gray-800 mb-2">Receive in</p>
                        <select
                          value={receiveLanguage}
                          onChange={(e) => setReceiveLanguage(e.target.value)}
                          className="w-full px-2 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded focus:outline-none focus:border-indigo-500"
                        >
                          {languages.map((lang) => (
                            <option key={lang.code} value={lang.code}>{lang.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="px-3 py-2">
                        <p className="text-xs font-medium text-gray-800 mb-2">Send in</p>
                        <select
                          value={sendLanguage}
                          onChange={(e) => setSendLanguage(e.target.value)}
                          className="w-full px-2 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded focus:outline-none focus:border-indigo-500"
                        >
                          {languages.map((lang) => (
                            <option key={lang.code} value={lang.code}>{lang.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  className="p-2 rounded hover:bg-gray-100 transition-colors"
                  aria-label="Call"
                  onClick={() => toast("Calling…", { description: selectedMessage.contactName })}
                >
                  <Phone className="w-4 h-4 text-gray-500" />
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
                    <div className="absolute right-0 top-10 w-44 bg-[#F9F9F9] border border-gray-200 rounded-lg shadow-lg py-1 z-50">
                      <button
                        onClick={handleTranslate}
                        className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Languages className="w-4 h-4 mr-2.5 text-gray-500" />
                        Translate
                      </button>
                      <button
                        onClick={handleTransfer}
                        className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <ArrowRightLeft className="w-4 h-4 mr-2.5 text-gray-500" />
                        Transfer
                      </button>
                      <button
                        onClick={handlePin}
                        className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Pin className="w-4 h-4 mr-2.5 text-gray-500" />
                        Pin
                      </button>
                      <button
                        onClick={handleMute}
                        className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <BellOff className="w-4 h-4 mr-2.5 text-gray-500" />
                        Mute
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
              <div className="max-w-2xl mx-auto space-y-4">
                {/* Date separator */}
                <div className="flex items-center justify-center">
                  <span className="px-3 py-1 rounded-full bg-gray-200 text-[11px] font-medium text-gray-600">
                    Today
                  </span>
                </div>

                {activeThread.map((bubble) => {
                  const isOutgoing = bubble.role === "outgoing";
                  const isAi = bubble.role === "ai";
                  const isRightAligned = isOutgoing || isAi;
                  return (
                    <div
                      key={bubble.id}
                      className={cn(
                        "flex items-end gap-2",
                        isRightAligned ? "justify-end" : "justify-start"
                      )}
                    >
                      {!isRightAligned && (
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0 bg-indigo-500"
                        >
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
                                ? "bg-purple-100 border border-purple-200 text-gray-700 rounded-br-sm"
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
                        <p
                          className={cn(
                            "text-[11px] text-gray-500 mt-1",
                            isRightAligned ? "text-right mr-1" : "ml-1"
                          )}
                        >
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
              {/* AI action buttons */}
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={handleAiRewrite}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-purple-600 bg-purple-50 hover:bg-purple-100 rounded transition-colors"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  AI Rewrite
                </button>
                <button
                  onClick={handleAiSuggestion}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-purple-600 bg-purple-50 hover:bg-purple-100 rounded transition-colors"
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  AI Suggestion
                </button>
              </div>
              
              <div className="flex items-end gap-2">
                <button
                  className="p-2 rounded hover:bg-gray-100 transition-colors shrink-0"
                  aria-label="Attach"
                  onClick={() => toast("Attach", { description: "Coming soon" })}
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
                    }}
                    className="w-full px-4 py-2 rounded text-sm bg-gray-50 text-gray-700 placeholder:text-gray-400 border border-gray-200 focus:outline-none focus:border-gray-300"
                  />
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    onClick={() => toast("Emoji", { description: "Coming soon" })}
                    aria-label="Emoji"
                    type="button"
                  >
                    <Smile className="w-4 h-4 text-gray-400" />
                  </button>
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
    </div>
  );
};

export default InboxView;
