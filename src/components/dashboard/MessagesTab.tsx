import { useState } from "react";
import {
  Search,
  Plus,
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
  MessageSquare,
  X,
  Languages,
  PenLine,
  Ban,
  Filter,
  ChevronDown,
  AlertTriangle,
  Calendar,
  Briefcase,
  Heart,
  Tag,
  User as UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { mockMessages, mockChatHistory, mockContacts } from "./mockData";
import { Message, ChatMessage } from "./types";

type Filter = "all" | "unread" | "priority" | "blocked";
type PriorityLabel = "urgent" | "high" | "meeting" | "personal" | "work";
type TransferType = "all" | "priority" | "sentiment" | "label";
type SentimentFilter = "positive" | "negative" | "neutral";

interface MessagesTabProps {
  onOpenAI: (context?: string) => void;
}

const PRIORITY_LABELS: { id: PriorityLabel; label: string; icon: React.ElementType; className: string }[] = [
  { id: "urgent", label: "Urgent", icon: AlertTriangle, className: "label-urgent" },
  { id: "high", label: "High Priority", icon: Tag, className: "label-high" },
  { id: "meeting", label: "Meeting", icon: Calendar, className: "label-meeting" },
  { id: "personal", label: "Personal", icon: Heart, className: "label-personal" },
  { id: "work", label: "Work", icon: Briefcase, className: "label-work" },
];

const MessagesTab = ({ onOpenAI }: MessagesTabProps) => {
  const [messages] = useState<Message[]>(mockMessages);
  const [filter, setFilter] = useState<Filter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [showTranslation, setShowTranslation] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showPriorityFilter, setShowPriorityFilter] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState<PriorityLabel[]>([]);
  
  // Transfer state
  const [transferType, setTransferType] = useState<TransferType>("all");
  const [transferTo, setTransferTo] = useState<string>("");
  const [customNumber, setCustomNumber] = useState("");
  const [selectedSentiment, setSelectedSentiment] = useState<SentimentFilter>("positive");
  const [selectedTransferLabels, setSelectedTransferLabels] = useState<PriorityLabel[]>([]);

  const filteredMessages = messages.filter((msg) => {
    const matchesSearch =
      msg.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.content.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filter === "all") return matchesSearch;
    if (filter === "unread") return matchesSearch && !msg.isRead;
    if (filter === "priority") {
      if (selectedLabels.length === 0) return matchesSearch && msg.status === "priority";
      // Filter by selected labels (mock - in real app would check msg.labels)
      return matchesSearch && msg.status === "priority";
    }
    if (filter === "blocked") return matchesSearch && msg.status === "blocked";
    return matchesSearch;
  });

  const getStatusLabel = (status: Message["status"]) => {
    switch (status) {
      case "protected": return "Protected";
      case "allowed": return "Allowed";
      case "blocked": return "Blocked";
      case "priority": return "Priority";
    }
  };

  const getStatusClass = (status: Message["status"]) => {
    switch (status) {
      case "priority": return "label-high";
      case "blocked": return "label-urgent";
      case "allowed": return "label-personal";
      case "protected": return "label-meeting";
    }
  };

  const openChat = (contactId: string) => {
    setSelectedChat(contactId);
    setChatMessages(mockChatHistory[contactId] || []);
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

  const handleTransfer = () => {
    const destination = transferTo === "custom" ? customNumber : transferTo;
    if (!destination) {
      toast.error("Please select or enter a destination");
      return;
    }
    
    let description = "";
    if (transferType === "all") {
      description = "All messages";
    } else if (transferType === "priority") {
      description = "Priority messages";
    } else if (transferType === "sentiment") {
      description = `${selectedSentiment.charAt(0).toUpperCase() + selectedSentiment.slice(1)} sentiment messages`;
    } else if (transferType === "label") {
      description = `Messages with labels: ${selectedTransferLabels.join(", ")}`;
    }
    
    toast.success(`Transfer rule created: ${description} will be forwarded to ${destination}`);
    setShowTransferModal(false);
    resetTransferState();
  };

  const resetTransferState = () => {
    setTransferType("all");
    setTransferTo("");
    setCustomNumber("");
    setSelectedSentiment("positive");
    setSelectedTransferLabels([]);
  };

  const handleBlockNumber = () => {
    toast.success("Number blocked");
    setShowChatMenu(false);
  };

  const selectedContact = mockContacts.find((c) => c.id === selectedChat);

  // Chat View
  if (selectedChat && selectedContact) {
    return (
      <div className="flex flex-col h-[calc(100vh-140px)]">
        {/* Chat Header */}
        <div className="flex items-center justify-between p-3 mb-3 bg-card border border-border rounded-lg">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSelectedChat(null)} className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-foreground text-sm font-medium">
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
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onOpenAI(`Analyze chat with ${selectedContact.name}`)}
            >
              <Bot className="w-4 h-4" />
            </Button>
            <div className="relative">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowChatMenu(!showChatMenu)}>
                <MoreVertical className="w-4 h-4" />
              </Button>
              {showChatMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowChatMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 w-52 bg-card border border-border rounded-lg shadow-lg z-50 py-1">
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
                      onClick={() => {
                        setShowTranslation(!showTranslation);
                        setShowChatMenu(false);
                        toast.info(showTranslation ? "Translation off" : "Translation enabled");
                      }}
                    >
                      <Languages className="w-4 h-4" /> Translate Messages
                    </button>
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
                      onClick={() => {
                        setShowChatMenu(false);
                        setShowTransferModal(true);
                      }}
                    >
                      <Forward className="w-4 h-4" /> Transfer Chat
                    </button>
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
                      onClick={() => {
                        toast.success("Conversation pinned");
                        setShowChatMenu(false);
                      }}
                    >
                      <Pin className="w-4 h-4" /> Pin Conversation
                    </button>
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
                      onClick={() => {
                        toast.success("Notifications muted");
                        setShowChatMenu(false);
                      }}
                    >
                      <BellOff className="w-4 h-4" /> Mute
                    </button>
                    <div className="my-1 border-t border-border" />
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
                      onClick={handleBlockNumber}
                    >
                      <Ban className="w-4 h-4" /> Block Number
                    </button>
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        toast.success("Chat deleted");
                        setSelectedChat(null);
                      }}
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
        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {chatMessages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.isIncoming ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[75%] px-3 py-2 rounded-lg ${
                  msg.isIncoming 
                    ? "bg-muted text-foreground" 
                    : "bg-foreground text-background"
                }`}
              >
                <p className="text-sm">{msg.content}</p>
                {msg.translated && showTranslation && (
                  <p className="text-xs mt-1 opacity-60 italic">{msg.translated}</p>
                )}
                <p className="text-[10px] mt-1 opacity-50">{msg.timestamp}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Message Input */}
        <div className="flex items-center gap-2 p-2 mt-3 bg-card border border-border rounded-lg">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <Paperclip className="w-4 h-4" />
          </Button>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type message..."
            className="flex-1 px-2 py-1.5 bg-transparent text-foreground placeholder:text-muted-foreground text-sm focus:outline-none"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => toast.info("Rewrite with AI")}
          >
            <PenLine className="w-4 h-4" />
          </Button>
          <Button size="icon" className="h-8 w-8 shrink-0" onClick={sendMessage}>
            <Send className="w-4 h-4" />
          </Button>
        </div>

        {/* Transfer Modal */}
        {showTransferModal && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
                <h3 className="font-medium text-foreground">Transfer Chat</h3>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowTransferModal(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="p-4 space-y-4">
                {/* Transfer Type */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Transfer Rule</p>
                  <div className="space-y-1">
                    {[
                      { id: "all" as TransferType, label: "All messages from this number" },
                      { id: "priority" as TransferType, label: "Priority messages only" },
                      { id: "sentiment" as TransferType, label: "By sentiment" },
                      { id: "label" as TransferType, label: "By label/category" },
                    ].map((opt) => (
                      <label key={opt.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer">
                        <input
                          type="radio"
                          checked={transferType === opt.id}
                          onChange={() => setTransferType(opt.id)}
                          className="accent-foreground"
                        />
                        <span className="text-sm text-foreground">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Sentiment Selection */}
                {transferType === "sentiment" && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Sentiment Type</p>
                    <div className="flex flex-wrap gap-2">
                      {(["positive", "negative", "neutral"] as SentimentFilter[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => setSelectedSentiment(s)}
                          className={`px-3 py-1.5 rounded-md text-sm capitalize ${
                            selectedSentiment === s
                              ? "bg-foreground text-background"
                              : "bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Label Selection */}
                {transferType === "label" && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Select Labels</p>
                    <div className="flex flex-wrap gap-2">
                      {PRIORITY_LABELS.map((label) => (
                        <button
                          key={label.id}
                          onClick={() => {
                            if (selectedTransferLabels.includes(label.id)) {
                              setSelectedTransferLabels(selectedTransferLabels.filter((l) => l !== label.id));
                            } else {
                              setSelectedTransferLabels([...selectedTransferLabels, label.id]);
                            }
                          }}
                          className={`label-pill ${label.className} ${
                            selectedTransferLabels.includes(label.id) ? "ring-2 ring-offset-1 ring-foreground" : ""
                          }`}
                        >
                          <label.icon className="w-3 h-3" />
                          {label.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transfer To */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Transfer To</p>
                  
                  {/* Custom Number Input */}
                  <div className="mb-2">
                    <input
                      type="tel"
                      value={customNumber}
                      onChange={(e) => {
                        setCustomNumber(e.target.value);
                        setTransferTo("custom");
                      }}
                      placeholder="Enter phone number..."
                      className="linear-input"
                    />
                  </div>
                  
                  <p className="text-xs text-muted-foreground mb-2">Or select a contact:</p>
                  <div className="max-h-32 overflow-y-auto space-y-1 border border-border rounded-md p-1">
                    {mockContacts
                      .filter((c) => c.id !== selectedChat)
                      .map((contact) => (
                        <label key={contact.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer">
                          <input
                            type="radio"
                            name="transferTo"
                            checked={transferTo === contact.id}
                            onChange={() => {
                              setTransferTo(contact.id);
                              setCustomNumber("");
                            }}
                            className="accent-foreground"
                          />
                          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                            <span className="text-xs">{contact.name.charAt(0)}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-foreground truncate block">{contact.name}</span>
                            <span className="text-xs text-muted-foreground">{contact.phone}</span>
                          </div>
                        </label>
                      ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowTransferModal(false)}>
                    Cancel
                  </Button>
                  <Button className="flex-1" onClick={handleTransfer}>
                    Create Rule
                  </Button>
                </div>
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
        <h2 className="text-lg font-semibold text-foreground">Messages</h2>
        <Button size="sm" className="gap-1.5 h-8">
          <Plus className="w-3.5 h-3.5" /> New
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search messages..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="linear-input pl-9"
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "unread", "priority", "blocked"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => {
              setFilter(f);
              if (f !== "priority") setShowPriorityFilter(false);
            }}
            className={`linear-btn capitalize ${
              filter === f ? "linear-btn-active" : "linear-btn-ghost"
            }`}
          >
            {f}
          </button>
        ))}
        
        {/* Priority Label Filter */}
        {filter === "priority" && (
          <div className="relative">
            <button
              onClick={() => setShowPriorityFilter(!showPriorityFilter)}
              className="linear-btn linear-btn-ghost flex items-center gap-1"
            >
              <Filter className="w-3.5 h-3.5" />
              Labels
              <ChevronDown className="w-3 h-3" />
            </button>
            
            {showPriorityFilter && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowPriorityFilter(false)} />
                <div className="absolute left-0 top-full mt-1 w-48 bg-card border border-border rounded-lg shadow-lg z-50 p-2">
                  {PRIORITY_LABELS.map((label) => (
                    <label key={label.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedLabels.includes(label.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedLabels([...selectedLabels, label.id]);
                          } else {
                            setSelectedLabels(selectedLabels.filter((l) => l !== label.id));
                          }
                        }}
                        className="accent-foreground rounded"
                      />
                      <span className={`label-pill ${label.className}`}>
                        <label.icon className="w-3 h-3" />
                        {label.label}
                      </span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Messages List */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {filteredMessages.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No messages found</p>
          </div>
        ) : (
          filteredMessages.map((msg) => (
            <div
              key={msg.id}
              onClick={() => openChat(msg.contactId)}
              className={`linear-list-item ${!msg.isRead ? "bg-muted/30" : ""}`}
            >
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-foreground text-sm font-medium shrink-0">
                {msg.contactName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-sm truncate ${!msg.isRead ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                    {msg.contactName}
                  </span>
                  {!msg.isRead && <span className="status-dot status-dot-unread shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground truncate">{msg.content}</p>
              </div>
              <div className="shrink-0 text-right flex flex-col items-end gap-1">
                <p className="text-xs text-muted-foreground">{msg.timestamp}</p>
                <span className={`label-pill ${getStatusClass(msg.status)}`}>
                  {getStatusLabel(msg.status)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MessagesTab;