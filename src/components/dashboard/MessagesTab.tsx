import { useState, useRef, useEffect } from "react";
import {
  Search,
  Plus,
  Shield,
  ShieldCheck,
  ShieldX,
  Crown,
  MoreVertical,
  ArrowLeft,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { isValidUsPhoneNumber } from "@/lib/validations";
import { mockMessages, mockChatHistory, languages } from "./mockData";
import { Message, ChatMessage, AIMessage, Contact } from "./types";
import { fetchContacts } from "./contactsApi";

type Filter = "all" | "unread" | "priority" | "blocked";
type PriorityLabel = "all" | "urgent" | "high" | "meeting" | "deadline" | "follow-up";
type TransferCriteria = "all" | "priority" | "sentiment" | "label";

const MessagesTab = () => {
  const [messages] = useState<Message[]>(mockMessages);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [priorityLabel, setPriorityLabel] = useState<PriorityLabel>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [showTranslation, setShowTranslation] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [receiveLanguage, setReceiveLanguage] = useState("en");
  const [sendLanguage, setSendLanguage] = useState("en");
  
  // AI Assistant State
  const [showAIBubble, setShowAIBubble] = useState(false);
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(true);
  const aiMessagesEndRef = useRef<HTMLDivElement>(null);
  
  // Transfer state
  const [transferCriteria, setTransferCriteria] = useState<TransferCriteria>("all");
  const [transferLabel, setTransferLabel] = useState<string>("urgent");
  const [transferTo, setTransferTo] = useState<string[]>([]);
  const [customNumber, setCustomNumber] = useState("");

  const priorityLabels: { id: PriorityLabel; label: string }[] = [
    { id: "all", label: "All Priority" },
    { id: "urgent", label: "Urgent" },
    { id: "high", label: "High" },
    { id: "meeting", label: "Meeting" },
    { id: "deadline", label: "Deadline" },
    { id: "follow-up", label: "Follow-up" },
  ];

  const transferLabels = ["Urgent", "High", "Meeting", "Deadline", "Follow-up", "Important", "Personal", "Work"];

  const aiSuggestions = [
    "Summarize this chat",
    "Suggest a reply",
    "What action items are pending?",
    "Translate last message",
  ];

  // Fetch contacts from API on mount
  useEffect(() => {
    const loadContactsData = async () => {
      const data = await fetchContacts();
      setContacts(data);
    };
    loadContactsData();
  }, []);

  useEffect(() => {
    aiMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);

  const filteredMessages = messages.filter((msg) => {
    const matchesSearch =
      msg.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.content.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filter === "all") return matchesSearch;
    if (filter === "unread") return matchesSearch && !msg.isRead;
    if (filter === "priority") {
      if (priorityLabel === "all") return matchesSearch && msg.status === "priority";
      return matchesSearch && msg.status === "priority";
    }
    if (filter === "blocked") return matchesSearch && msg.status === "blocked";
    return matchesSearch;
  });

  const getStatusIcon = (status: Message["status"]) => {
    switch (status) {
      case "protected":
        return <Shield className="w-3.5 h-3.5" />;
      case "allowed":
        return <ShieldCheck className="w-3.5 h-3.5" />;
      case "blocked":
        return <ShieldX className="w-3.5 h-3.5" />;
      case "priority":
        return <Crown className="w-3.5 h-3.5" />;
    }
  };

  const getStatusLabel = (status: Message["status"]) => {
    switch (status) {
      case "protected":
        return "Protected";
      case "allowed":
        return "Allowed";
      case "blocked":
        return "Blocked";
      case "priority":
        return "Priority";
    }
  };

  const openChat = (contactId: string) => {
    setSelectedChat(contactId);
    const history = mockChatHistory[contactId] || [];
    setChatMessages(history);
    // Reset AI bubble when opening new chat
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

  const handleTransferChat = () => {
    if (transferTo.length === 0 && !customNumber.trim()) {
      toast.error("Please select a contact or enter a number");
      return;
    }

    if (customNumber.trim() && !isValidUsPhoneNumber(customNumber.trim())) {
      toast.error("Enter a valid phone number (10 digits, optional +1)");
      return;
    }
    const destination = customNumber.trim() || `${transferTo.length} contact(s)`;
    toast.success(`Transfer rule created for ${destination}`);
    setShowTransferModal(false);
    setTransferTo([]);
    setCustomNumber("");
    setTransferCriteria("all");
  };

  const handleBlockNumber = () => {
    toast.success("Number blocked");
    setShowChatMenu(false);
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

    // Simulate AI response
    setTimeout(() => {
      let response = "";
      const contact = selectedContact?.name || "this person";
      
      if (messageText.toLowerCase().includes("summarize")) {
        response = `Summary of chat with ${contact}:\n\nYou've had ${chatMessages.length} messages. The conversation appears to be about scheduling and coordination. Key points include meeting times and confirmations.`;
      } else if (messageText.toLowerCase().includes("reply") || messageText.toLowerCase().includes("suggest")) {
        response = `Here are some reply suggestions:\n\n1. "Sounds good, I'll be there!"\n2. "Thanks for letting me know"\n3. "Can we reschedule to a different time?"`;
      } else if (messageText.toLowerCase().includes("action") || messageText.toLowerCase().includes("pending")) {
        response = `Action items from this chat:\n\n• Confirm meeting time\n• Send follow-up message\n• Update calendar`;
      } else if (messageText.toLowerCase().includes("translate")) {
        response = `The last message translated:\n\n"${chatMessages[chatMessages.length - 1]?.content || 'No messages to translate'}"`;
      } else {
        response = `I can help you with:\n• Summarizing this chat\n• Suggesting replies\n• Finding action items\n• Translating messages\n\nWhat would you like to know?`;
      }

      const aiMessage: AIMessage = {
        id: `ai-${Date.now()}`,
        content: response,
        isUser: false,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setAiMessages(prev => [...prev, aiMessage]);
    }, 600);
  };

  const selectedContact = contacts.find((c) => c.id === selectedChat);

  // Chat View
  if (selectedChat && selectedContact) {
    return (
      <div className="flex flex-col h-[calc(100vh-180px)] relative">
        {/* Chat Header */}
        <div className="flex items-center justify-between p-3 mb-4 bg-card/50 border border-border/50 rounded-xl">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSelectedChat(null)} className="rounded-lg h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-foreground text-sm font-medium">
              {selectedContact.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <h3 className="font-medium text-foreground text-sm truncate">{selectedContact.name}</h3>
              <p className="text-xs text-muted-foreground truncate">{selectedContact.phone}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8" onClick={() => setShowLanguageModal(true)}>
              <Globe className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8" onClick={() => toast.info("Calling...")}>
              <Phone className="w-4 h-4" />
            </Button>
            <div className="relative">
              <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8" onClick={() => setShowChatMenu(!showChatMenu)}>
                <MoreVertical className="w-4 h-4" />
              </Button>
              {showChatMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowChatMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 w-44 bg-card border border-border rounded-xl shadow-xl z-50 py-1">
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary/50"
                      onClick={() => {
                        setShowTranslation(!showTranslation);
                        setShowChatMenu(false);
                        toast.info(showTranslation ? "Translation off" : "Translation on");
                      }}
                    >
                      <Languages className="w-4 h-4" /> Translate
                    </button>
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary/50"
                      onClick={() => { setShowChatMenu(false); setShowTransferModal(true); }}
                    >
                      <Forward className="w-4 h-4" /> Transfer
                    </button>
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary/50"
                      onClick={() => toast.success("Pinned")}
                    >
                      <Pin className="w-4 h-4" /> Pin
                    </button>
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary/50"
                      onClick={() => toast.success("Muted")}
                    >
                      <BellOff className="w-4 h-4" /> Mute
                    </button>
                    <div className="my-1 border-t border-border" />
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:bg-gray-100"
                      onClick={handleBlockNumber}
                    >
                      <Ban className="w-4 h-4" /> Block
                    </button>
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:bg-gray-100"
                      onClick={() => { toast.success("Deleted"); setSelectedChat(null); }}
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {chatMessages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.isIncoming ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[75%] px-4 py-2.5 rounded-2xl ${
                  msg.isIncoming 
                    ? "bg-gray-100 text-foreground rounded-bl-sm" 
                    : "bg-primary text-primary-foreground rounded-br-sm"
                }`}
              >
                <p className="text-sm">{msg.content}</p>
                {msg.translated && showTranslation && (
                  <p className="text-xs mt-1 opacity-60 italic">{msg.translated}</p>
                )}
                <p className="text-[10px] mt-1 opacity-40">{msg.timestamp}</p>
              </div>
            </div>
          ))}
        </div>

        {/* AI Suggestions Bar */}
        {showSuggestions && (
          <div className="py-2 flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => setShowSuggestions(false)}
              className="shrink-0 p-1 rounded hover:bg-secondary/50"
            >
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
            <Lightbulb className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            {aiSuggestions.slice(0, 3).map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => { setShowAIBubble(true); handleAISend(suggestion); }}
                className="shrink-0 px-2.5 py-1 text-xs bg-secondary/50 hover:bg-secondary text-foreground rounded-full transition-colors border border-border/30"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {/* Message Input */}
        <div className="flex items-center gap-2 p-3 mt-2 bg-card/50 border border-border/50 rounded-xl">
          <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8 shrink-0">
            <Paperclip className="w-4 h-4" />
          </Button>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type message..."
            className="flex-1 px-3 py-2 bg-transparent text-foreground placeholder:text-muted-foreground text-sm focus:outline-none min-w-0"
          />
          <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8 shrink-0" onClick={() => toast.info("Rewrite with AI")}>
            <PenLine className="w-4 h-4" />
          </Button>
          <Button size="icon" className="rounded-lg h-8 w-8 shrink-0" onClick={sendMessage}>
            <Send className="w-4 h-4" />
          </Button>
        </div>

        {/* AI Bubble Chat - Right Side */}
        {showAIBubble && (
          <div className="absolute right-0 top-16 bottom-24 w-72 bg-card border border-border rounded-xl shadow-xl z-30 flex flex-col overflow-hidden">
            <div className="shrink-0 px-3 py-2 border-b border-border/50 flex items-center justify-between bg-secondary/30">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-foreground" />
                <span className="text-xs font-medium text-foreground">AI Assistant</span>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowAIBubble(false)}>
                <X className="w-3 h-3" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {aiMessages.length === 0 && (
                <div className="text-center py-4">
                  <Bot className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Ask me about this conversation</p>
                </div>
              )}
              {aiMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.isUser ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[90%] px-2.5 py-1.5 rounded-lg text-xs ${
                    msg.isUser
                      ? "bg-foreground text-background"
                      : "bg-secondary/50 text-foreground"
                  }`}>
                    <p className="whitespace-pre-line">{msg.content}</p>
                  </div>
                </div>
              ))}
              <div ref={aiMessagesEndRef} />
            </div>

            <div className="shrink-0 p-2 border-t border-border/50">
              <div className="flex gap-1">
                <input
                  type="text"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAISend()}
                  placeholder="Ask AI..."
                  className="flex-1 px-2 py-1.5 bg-secondary/50 rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
                <Button size="icon" className="h-7 w-7 rounded-lg shrink-0" onClick={() => handleAISend()}>
                  <Send className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* AI Bubble Toggle Button */}
        {!showAIBubble && (
          <button
            onClick={() => setShowAIBubble(true)}
            className="absolute right-2 bottom-20 w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
          >
            <Bot className="w-5 h-5" />
          </button>
        )}

        {/* Language Modal */}
        {showLanguageModal && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-xl w-full max-w-xs p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-foreground text-sm">Language Settings</h3>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowLanguageModal(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Receive messages in</label>
                <select
                  value={receiveLanguage}
                  onChange={(e) => setReceiveLanguage(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none"
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>{lang.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Send messages in</label>
                <select
                  value={sendLanguage}
                  onChange={(e) => setSendLanguage(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none"
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>{lang.name}</option>
                  ))}
                </select>
              </div>
              <Button size="sm" className="w-full rounded-lg" onClick={() => { setShowLanguageModal(false); toast.success("Language settings saved"); }}>
                Save
              </Button>
            </div>
          </div>
        )}

        {/* Transfer Modal */}
        {showTransferModal && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-xl w-full max-w-xs max-h-[60vh] overflow-hidden flex flex-col">
              <div className="shrink-0 px-4 py-3 flex items-center justify-between border-b border-border/50">
                <h3 className="font-medium text-foreground text-sm">Transfer Chat</h3>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowTransferModal(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Transfer:</p>
                  <div className="grid grid-cols-2 gap-1">
                    {(["all", "priority", "sentiment", "label"] as TransferCriteria[]).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setTransferCriteria(opt)}
                        className={`px-2 py-1.5 rounded-lg text-xs ${
                          transferCriteria === opt ? "bg-foreground text-background" : "bg-secondary/50 text-muted-foreground"
                        }`}
                      >
                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Phone number:</p>
                  <input
                    type="tel"
                    value={customNumber}
                    onChange={(e) => setCustomNumber(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className="w-full px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none"
                  />
                </div>
              </div>

              <div className="shrink-0 px-3 py-2 border-t border-border/50 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 rounded-lg h-8 bg-white text-gray-700 border-gray-200 hover:bg-gray-50" onClick={() => setShowTransferModal(false)}>
                  Cancel
                </Button>
                <Button size="sm" className="flex-1 rounded-lg h-8" onClick={handleTransferChat}>
                  Transfer
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Messages List View
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-foreground">Messages</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-lg bg-white text-gray-700 border-gray-200 hover:bg-gray-50" onClick={() => setShowLanguageModal(true)}>
            <Globe className="w-4 h-4" />
          </Button>
          <Button size="sm" className="gap-1.5 rounded-lg">
            <Plus className="w-4 h-4" /> New
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search messages..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-border"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {(["all", "unread", "priority", "blocked"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors shrink-0 ${
              filter === f ? "bg-foreground text-background" : "bg-secondary/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        {filter === "priority" && (
          <div className="relative">
            <button
              onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-secondary/50 text-muted-foreground"
            >
              {priorityLabels.find((p) => p.id === priorityLabel)?.label}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showPriorityDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowPriorityDropdown(false)} />
                <div className="absolute left-0 top-full mt-1 w-36 bg-card border border-border rounded-xl shadow-xl z-50 py-1">
                  {priorityLabels.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setPriorityLabel(p.id); setShowPriorityDropdown(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-secondary/50 ${
                        priorityLabel === p.id ? "text-foreground font-medium" : "text-muted-foreground"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Messages List */}
      <div className="space-y-2">
        {filteredMessages.map((msg) => (
          <button
            key={msg.id}
            onClick={() => openChat(msg.contactId)}
            className="w-full flex items-start gap-3 p-3 rounded-xl bg-card/30 border border-border/50 hover:bg-secondary/20 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-foreground text-sm font-medium shrink-0">
              {msg.contactName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground text-sm truncate">{msg.contactName}</span>
                <span className="text-xs text-muted-foreground shrink-0">{msg.timestamp}</span>
              </div>
              <p className="text-sm text-muted-foreground truncate mt-0.5">{msg.content}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${
                    msg.status === "priority"
                      ? "bg-gray-100 text-gray-600"
                      : msg.status === "blocked"
                      ? "bg-gray-100 text-gray-500"
                      : "bg-gray-50 text-gray-500"
                  }`}
                >
                  {getStatusIcon(msg.status)}
                  {getStatusLabel(msg.status)}
                </span>
                {msg.rule && <span className="text-[10px] text-muted-foreground">{msg.rule}</span>}
              </div>
            </div>
            {!msg.isRead && <span className="w-2 h-2 rounded-full bg-foreground shrink-0 mt-2" />}
          </button>
        ))}
        {filteredMessages.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">No messages found</div>
        )}
      </div>

      {/* Language Modal for List View */}
      {showLanguageModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-xs p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-foreground text-sm">Language Settings</h3>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowLanguageModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Receive messages in</label>
              <select
                value={receiveLanguage}
                onChange={(e) => setReceiveLanguage(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>{lang.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Send messages in</label>
              <select
                value={sendLanguage}
                onChange={(e) => setSendLanguage(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>{lang.name}</option>
                ))}
              </select>
            </div>
            <Button size="sm" className="w-full rounded-lg" onClick={() => { setShowLanguageModal(false); toast.success("Language settings saved"); }}>
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessagesTab;