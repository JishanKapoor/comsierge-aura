import { useState } from "react";
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
  MessageSquare,
  X,
  Languages,
  PenLine,
  Ban,
  ChevronDown,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { mockMessages, mockChatHistory, mockContacts } from "./mockData";
import { Message, ChatMessage } from "./types";

type Filter = "all" | "unread" | "priority" | "blocked";
type PriorityLabel = "all" | "urgent" | "high" | "meeting" | "deadline" | "follow-up";
type TransferCriteria = "all" | "priority" | "sentiment" | "label";

interface MessagesTabProps {
  onOpenAI: (context?: string) => void;
}

const MessagesTab = ({ onOpenAI }: MessagesTabProps) => {
  const [messages] = useState<Message[]>(mockMessages);
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

  const filteredMessages = messages.filter((msg) => {
    const matchesSearch =
      msg.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.content.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filter === "all") return matchesSearch;
    if (filter === "unread") return matchesSearch && !msg.isRead;
    if (filter === "priority") {
      if (priorityLabel === "all") return matchesSearch && msg.status === "priority";
      // In real implementation, would filter by specific label
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

  const handleTransferChat = () => {
    if (transferTo.length === 0 && !customNumber.trim()) {
      toast.error("Please select a contact or enter a number");
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

  const selectedContact = mockContacts.find((c) => c.id === selectedChat);

  // Chat View
  if (selectedChat && selectedContact) {
    return (
      <div className="flex flex-col h-[calc(100vh-180px)]">
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
            <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8" onClick={() => toast.info("Calling...")}>
              <Phone className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-lg h-8 w-8"
              onClick={() => onOpenAI(`Analyze chat with ${selectedContact.name}`)}
            >
              <Bot className="w-4 h-4" />
            </Button>
            <div className="relative">
              <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8" onClick={() => setShowChatMenu(!showChatMenu)}>
                <MoreVertical className="w-4 h-4" />
              </Button>
              {showChatMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowChatMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 w-52 bg-card border border-border rounded-xl shadow-xl z-50 py-1">
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary/50"
                      onClick={() => {
                        setShowTranslation(!showTranslation);
                        setShowChatMenu(false);
                        toast.info(showTranslation ? "Translation off" : "Translation enabled");
                      }}
                    >
                      <Languages className="w-4 h-4" /> Translate Messages
                    </button>
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary/50"
                      onClick={() => {
                        setShowChatMenu(false);
                        setShowTransferModal(true);
                      }}
                    >
                      <Forward className="w-4 h-4" /> Transfer Chat
                    </button>
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary/50"
                      onClick={() => toast.success("Conversation pinned")}
                    >
                      <Pin className="w-4 h-4" /> Pin Conversation
                    </button>
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary/50"
                      onClick={() => toast.success("Notifications muted")}
                    >
                      <BellOff className="w-4 h-4" /> Mute
                    </button>
                    <div className="my-1 border-t border-border" />
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
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
                      <Trash2 className="w-4 h-4" /> Delete Chat
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
                    ? "bg-blue-500/15 text-foreground rounded-bl-sm border border-blue-500/20" 
                    : "bg-emerald-500/15 text-foreground rounded-br-sm border border-emerald-500/20"
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

        {/* Message Input */}
        <div className="flex items-center gap-2 p-3 mt-4 bg-card/50 border border-border/50 rounded-xl">
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
          <Button
            variant="ghost"
            size="icon"
            className="rounded-lg h-8 w-8 shrink-0"
            onClick={() => toast.info("Rewrite with AI")}
          >
            <PenLine className="w-4 h-4" />
          </Button>
          <Button size="icon" className="rounded-lg h-8 w-8 shrink-0" onClick={sendMessage}>
            <Send className="w-4 h-4" />
          </Button>
        </div>

        {/* Transfer Modal */}
        {showTransferModal && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-card border border-border rounded-t-2xl sm:rounded-xl w-full sm:max-w-sm max-h-[70vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
              <div className="shrink-0 bg-card border-b border-border/50 px-4 py-3 flex items-center justify-between">
                <h3 className="font-medium text-foreground text-sm">Transfer Chat</h3>
                <Button variant="ghost" size="icon" className="rounded-lg h-7 w-7" onClick={() => setShowTransferModal(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Transfer messages:</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(["all", "priority", "sentiment", "label"] as TransferCriteria[]).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setTransferCriteria(opt)}
                        className={`px-2 py-2 rounded-lg text-xs transition-colors ${
                          transferCriteria === opt
                            ? "bg-foreground text-background"
                            : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                        }`}
                      >
                        {opt === "all" && "All"}
                        {opt === "priority" && "Priority"}
                        {opt === "sentiment" && "Sentiment"}
                        {opt === "label" && "By Label"}
                      </button>
                    ))}
                  </div>
                </div>

                {transferCriteria === "label" && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Select label:</p>
                    <div className="flex flex-wrap gap-1">
                      {transferLabels.slice(0, 5).map((label) => (
                        <button
                          key={label}
                          onClick={() => setTransferLabel(label)}
                          className={`px-2 py-1 rounded-full text-xs transition-colors ${
                            transferLabel === label
                              ? "bg-foreground text-background"
                              : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Phone number:</p>
                  <input
                    type="tel"
                    value={customNumber}
                    onChange={(e) => setCustomNumber(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className="w-full px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none"
                  />
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Or select contacts:</p>
                  <div className="max-h-24 overflow-y-auto space-y-0.5 bg-secondary/30 rounded-lg p-1.5">
                    {mockContacts
                      .filter((c) => c.id !== selectedChat)
                      .slice(0, 4)
                      .map((contact) => (
                        <label key={contact.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-secondary/50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={transferTo.includes(contact.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setTransferTo([...transferTo, contact.id]);
                              } else {
                                setTransferTo(transferTo.filter((id) => id !== contact.id));
                              }
                            }}
                            className="accent-foreground rounded shrink-0"
                          />
                          <span className="text-xs text-foreground truncate">{contact.name}</span>
                        </label>
                      ))}
                  </div>
                </div>
              </div>

              <div className="shrink-0 px-3 py-2.5 border-t border-border/50 bg-card flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 rounded-lg h-8" onClick={() => setShowTransferModal(false)}>
                  Cancel
                </Button>
                <Button size="sm" className="flex-1 rounded-lg h-8" onClick={handleTransferChat}>
                  Create Rule
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-foreground">Messages</h2>
        <Button size="sm" className="gap-1.5 rounded-lg">
          <Plus className="w-4 h-4" /> New
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
          className="w-full pl-10 pr-4 py-2.5 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-border"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(["all", "unread", "priority", "blocked"] as Filter[]).map((f) => (
          <div key={f} className="relative">
            <button
              onClick={() => {
                setFilter(f);
                if (f !== "priority") setShowPriorityDropdown(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors inline-flex items-center gap-1 ${
                filter === f
                  ? "bg-foreground text-background"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
              {f === "priority" && filter === "priority" && (
                <ChevronDown
                  className={`w-3 h-3 transition-transform ${showPriorityDropdown ? "rotate-180" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPriorityDropdown(!showPriorityDropdown);
                  }}
                />
              )}
            </button>
            
            {/* Priority Label Dropdown */}
            {f === "priority" && filter === "priority" && showPriorityDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowPriorityDropdown(false)} />
                <div className="absolute left-0 top-full mt-1 w-36 bg-card border border-border rounded-lg shadow-xl z-50 py-1">
                  {priorityLabels.map((label) => (
                    <button
                      key={label.id}
                      onClick={() => {
                        setPriorityLabel(label.id);
                        setShowPriorityDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                        priorityLabel === label.id
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                      }`}
                    >
                      {label.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
        
        {/* Show selected priority label badge */}
        {filter === "priority" && priorityLabel !== "all" && (
          <span className="px-2 py-1 rounded-full text-xs bg-accent/20 text-accent-foreground flex items-center gap-1">
            <Tag className="w-3 h-3" />
            {priorityLabels.find(l => l.id === priorityLabel)?.label}
            <button onClick={() => setPriorityLabel("all")} className="ml-1 hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          </span>
        )}
      </div>

      {/* Messages List */}
      <div className="bg-card/30 border border-border/50 rounded-xl overflow-hidden">
        {filteredMessages.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No messages found</p>
          </div>
        ) : (
          filteredMessages.map((msg) => (
            <div
              key={msg.id}
              onClick={() => openChat(msg.contactId)}
              className={`flex items-center gap-3 p-4 border-b border-border/30 last:border-b-0 hover:bg-secondary/20 transition-colors cursor-pointer ${
                !msg.isRead ? "bg-secondary/10" : ""
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-foreground text-sm font-medium shrink-0">
                {msg.contactName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-sm truncate ${!msg.isRead ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                    {msg.contactName}
                  </span>
                  {!msg.isRead && <span className="w-1.5 h-1.5 rounded-full bg-foreground shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground truncate">{msg.content}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-muted-foreground mb-1">{msg.timestamp}</p>
                <div className="flex items-center gap-1 justify-end text-muted-foreground">
                  {getStatusIcon(msg.status)}
                  <span className="text-[10px] hidden sm:inline">{getStatusLabel(msg.status)}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MessagesTab;
