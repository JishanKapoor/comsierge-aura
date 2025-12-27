import { useState, useRef, useEffect } from "react";
import {
  Search,
  Plus,
  Shield,
  ShieldCheck,
  ShieldX,
  Crown,
  MoreVertical,
  Phone,
  Bot,
  Forward,
  Pin,
  BellOff,
  Trash2,
  Send,
  Paperclip,
  X,
  Languages,
  PenLine,
  Ban,
  ChevronDown,
  Sparkles,
  Globe,
  Lightbulb,
  ArrowLeft,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { mockMessages, mockChatHistory, mockContacts, languages } from "./mockData";
import { Message, ChatMessage, AIMessage } from "./types";

type Filter = "all" | "unread" | "priority" | "blocked";

interface InboxViewProps {
  onOpenAI: () => void;
}

const InboxView = ({ onOpenAI }: InboxViewProps) => {
  const [messages] = useState<Message[]>(mockMessages);
  const [filter, setFilter] = useState<Filter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [showTranslation, setShowTranslation] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [receiveLanguage, setReceiveLanguage] = useState("en");
  const [sendLanguage, setSendLanguage] = useState("en");
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  
  // AI Assistant State
  const [showAIBubble, setShowAIBubble] = useState(false);
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(true);
  const aiMessagesEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const aiSuggestions = [
    "Summarize this chat",
    "Suggest a reply",
    "What action items are pending?",
  ];

  useEffect(() => {
    aiMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const filteredMessages = messages.filter((msg) => {
    const matchesSearch =
      msg.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.content.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filter === "all") return matchesSearch;
    if (filter === "unread") return matchesSearch && !msg.isRead;
    if (filter === "priority") return matchesSearch && msg.status === "priority";
    if (filter === "blocked") return matchesSearch && msg.status === "blocked";
    return matchesSearch;
  });

  const getStatusIcon = (status: Message["status"]) => {
    switch (status) {
      case "protected": return <Shield className="w-3 h-3" />;
      case "allowed": return <ShieldCheck className="w-3 h-3" />;
      case "blocked": return <ShieldX className="w-3 h-3" />;
      case "priority": return <Crown className="w-3 h-3" />;
    }
  };

  const openChat = (contactId: string) => {
    setSelectedChat(contactId);
    const history = mockChatHistory[contactId] || [];
    setChatMessages(history);
    setAiMessages([]);
    setShowAIBubble(false);
  };

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    const msg: ChatMessage = {
      id: `new-${Date.now()}`,
      content: newMessage,
      isIncoming: false,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setChatMessages([...chatMessages, msg]);
    setNewMessage("");
    toast.success("Message sent");
  };

  const handleAISend = (text?: string) => {
    const messageText = text || aiInput;
    if (!messageText.trim()) return;

    const userMessage: AIMessage = {
      id: `user-${Date.now()}`,
      content: messageText,
      isUser: true,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setAiMessages(prev => [...prev, userMessage]);
    setAiInput("");

    setTimeout(() => {
      let response = "";
      const contact = selectedContact?.name || "this person";
      
      if (messageText.toLowerCase().includes("summarize")) {
        response = `**Chat Summary with ${contact}:**\n\n• ${chatMessages.length} messages exchanged\n• Topics: Scheduling, coordination\n• Tone: Friendly, casual\n• Key point: Meeting confirmation needed`;
      } else if (messageText.toLowerCase().includes("reply") || messageText.toLowerCase().includes("suggest")) {
        response = `**Suggested Replies:**\n\n1. "Sounds good, I'll be there!"\n2. "Thanks for letting me know"\n3. "Can we reschedule?"`;
      } else if (messageText.toLowerCase().includes("action") || messageText.toLowerCase().includes("pending")) {
        response = `**Action Items:**\n\n• Confirm meeting time\n• Send follow-up message\n• Update calendar`;
      } else {
        response = `I can help you with:\n• Summarizing chats\n• Suggesting replies\n• Finding action items\n\nWhat would you like to know?`;
      }

      const aiMessage: AIMessage = {
        id: `ai-${Date.now()}`,
        content: response,
        isUser: false,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setAiMessages(prev => [...prev, aiMessage]);
    }, 500);
  };

  const selectedContact = mockContacts.find((c) => c.id === selectedChat);

  return (
    <div className="h-[calc(100vh-120px)] flex rounded-xl overflow-hidden border border-border/50 bg-card/30">
      {/* Chat List */}
      <div className={cn(
        "w-full md:w-80 lg:w-96 border-r border-border/30 flex flex-col shrink-0 bg-card/20",
        selectedChat && "hidden md:flex"
      )}>
        {/* List Header */}
        <div className="p-3 border-b border-border/30 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-foreground">Messages</h2>
            <div className="flex gap-1">
              {/* Language Selector */}
              <div className="relative">
                <button
                  onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                  className="p-2 rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <Globe className="w-4 h-4 text-muted-foreground" />
                </button>
                {showLanguageDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowLanguageDropdown(false)} />
                    <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-xl shadow-xl z-50 p-3 space-y-3">
                      <div>
                        <label className="text-xs text-muted-foreground">Receive in</label>
                        <select
                          value={receiveLanguage}
                          onChange={(e) => setReceiveLanguage(e.target.value)}
                          className="w-full mt-1 px-2 py-1.5 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-xs focus:outline-none"
                        >
                          {languages.map((lang) => (
                            <option key={lang.code} value={lang.code}>{lang.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Send in</label>
                        <select
                          value={sendLanguage}
                          onChange={(e) => setSendLanguage(e.target.value)}
                          className="w-full mt-1 px-2 py-1.5 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-xs focus:outline-none"
                        >
                          {languages.map((lang) => (
                            <option key={lang.code} value={lang.code}>{lang.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-secondary/30 border border-border/30 rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-border/60"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-1">
            {(["all", "unread", "priority", "blocked"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs transition-colors",
                  filter === f 
                    ? "bg-foreground text-background" 
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto">
          {filteredMessages.map((msg) => (
            <button
              key={msg.id}
              onClick={() => openChat(msg.contactId)}
              className={cn(
                "w-full flex items-start gap-3 p-3 border-b border-border/20 hover:bg-secondary/30 transition-colors text-left",
                selectedChat === msg.contactId && "bg-secondary/40"
              )}
            >
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-foreground text-sm font-medium shrink-0">
                {msg.contactName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground text-sm truncate">{msg.contactName}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{msg.timestamp}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{msg.content}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={cn(
                    "flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px]",
                    msg.status === "priority" && "bg-amber-500/15 text-amber-500",
                    msg.status === "blocked" && "bg-destructive/15 text-destructive",
                    msg.status === "allowed" && "bg-emerald-500/15 text-emerald-500",
                    msg.status === "protected" && "bg-blue-500/15 text-blue-500"
                  )}>
                    {getStatusIcon(msg.status)}
                  </span>
                </div>
              </div>
              {!msg.isRead && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2" />}
            </button>
          ))}
        </div>
      </div>

      {/* Chat View */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0",
        !selectedChat && "hidden md:flex"
      )}>
        {selectedChat && selectedContact ? (
          <>
            {/* Chat Header */}
            <div className="h-14 px-4 flex items-center justify-between border-b border-border/30 shrink-0 bg-card/30">
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedChat(null)} className="md:hidden p-1">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-foreground text-sm font-medium">
                  {selectedContact.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-medium text-foreground text-sm">{selectedContact.name}</h3>
                  <p className="text-xs text-muted-foreground">{selectedContact.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toast.info("Calling...")}>
                  <Phone className="w-4 h-4" />
                </Button>
                <div className="relative">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowChatMenu(!showChatMenu)}>
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                  {showChatMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowChatMenu(false)} />
                      <div className="absolute right-0 top-full mt-1 w-40 bg-card border border-border rounded-xl shadow-xl z-50 py-1">
                        <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary/50" onClick={() => { setShowTranslation(!showTranslation); setShowChatMenu(false); }}>
                          <Languages className="w-4 h-4" /> Translate
                        </button>
                        <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary/50" onClick={() => { setShowChatMenu(false); setShowTransferModal(true); }}>
                          <Forward className="w-4 h-4" /> Transfer
                        </button>
                        <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary/50" onClick={() => toast.success("Pinned")}>
                          <Pin className="w-4 h-4" /> Pin
                        </button>
                        <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary/50" onClick={() => toast.success("Muted")}>
                          <BellOff className="w-4 h-4" /> Mute
                        </button>
                        <div className="my-1 border-t border-border" />
                        <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10" onClick={() => toast.success("Blocked")}>
                          <Ban className="w-4 h-4" /> Block
                        </button>
                        <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10" onClick={() => { toast.success("Deleted"); setSelectedChat(null); }}>
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 flex overflow-hidden">
              {/* Chat Messages */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className={cn("flex", msg.isIncoming ? "justify-start" : "justify-end")}>
                      <div className={cn(
                        "max-w-[70%] px-3 py-2 rounded-2xl text-sm",
                        msg.isIncoming 
                          ? "bg-secondary/60 text-foreground rounded-bl-sm" 
                          : "bg-blue-500/20 text-foreground rounded-br-sm border border-blue-500/30"
                      )}>
                        <p>{msg.content}</p>
                        <p className="text-[10px] mt-1 opacity-50">{msg.timestamp}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                {/* AI Suggestions */}
                {showSuggestions && (
                  <div className="px-4 py-2 border-t border-border/20 flex items-center gap-2 overflow-x-auto">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    {aiSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => { setShowAIBubble(true); handleAISend(suggestion); }}
                        className="shrink-0 px-2.5 py-1 text-xs bg-secondary/40 hover:bg-secondary/60 text-foreground rounded-full transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                    <button onClick={() => setShowSuggestions(false)} className="shrink-0 p-1 rounded hover:bg-secondary/50">
                      <X className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>
                )}

                {/* Input */}
                <div className="p-3 border-t border-border/30">
                  <div className="flex items-center gap-2 bg-secondary/30 rounded-xl px-3 py-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                      <Paperclip className="w-4 h-4" />
                    </Button>
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                      placeholder="Type a message..."
                      className="flex-1 bg-transparent text-foreground text-sm placeholder:text-muted-foreground focus:outline-none"
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => toast.info("Rewrite with AI")}>
                      <PenLine className="w-4 h-4" />
                    </Button>
                    <Button size="icon" className="h-8 w-8 shrink-0" onClick={sendMessage}>
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Inline AI Panel */}
              {showAIBubble && (
                <div className="w-72 border-l border-border/30 flex flex-col bg-card/50">
                  <div className="h-10 px-3 flex items-center justify-between border-b border-border/30 shrink-0">
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-violet-400" />
                      <span className="text-xs font-medium">AI Assistant</span>
                    </div>
                    <button onClick={() => setShowAIBubble(false)} className="p-1 hover:bg-secondary/50 rounded">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {aiMessages.length === 0 && (
                      <div className="text-center py-6">
                        <Bot className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Ask about this chat</p>
                      </div>
                    )}
                    {aiMessages.map((msg) => (
                      <div key={msg.id} className={cn("flex", msg.isUser ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[90%] px-2.5 py-1.5 rounded-lg text-xs",
                          msg.isUser ? "bg-foreground text-background" : "bg-secondary/50 text-foreground"
                        )}>
                          <p className="whitespace-pre-line">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={aiMessagesEndRef} />
                  </div>

                  <div className="p-2 border-t border-border/30">
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={aiInput}
                        onChange={(e) => setAiInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAISend()}
                        placeholder="Ask AI..."
                        className="flex-1 px-2 py-1.5 bg-secondary/40 rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                      />
                      <Button size="icon" className="h-7 w-7 shrink-0" onClick={() => handleAISend()}>
                        <Send className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* AI Toggle Button */}
            {!showAIBubble && (
              <button
                onClick={() => setShowAIBubble(true)}
                className="absolute right-4 bottom-20 w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 text-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
              >
                <Bot className="w-5 h-5" />
              </button>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Select a conversation</p>
            </div>
          </div>
        )}
      </div>

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-sm p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-foreground">Transfer Chat</h3>
              <button onClick={() => setShowTransferModal(false)} className="p-1 hover:bg-secondary/50 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Forward to</label>
              <input
                type="tel"
                placeholder="+1 (555) 123-4567"
                className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowTransferModal(false)}>Cancel</Button>
              <Button className="flex-1" onClick={() => { toast.success("Transferred"); setShowTransferModal(false); }}>Transfer</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InboxView;
