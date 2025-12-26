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
  Globe,
  Send,
  Paperclip,
  MessageSquare,
  Smile,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { mockMessages, mockChatHistory, mockContacts } from "./mockData";
import { Message, ChatMessage } from "./types";

type Filter = "all" | "unread" | "priority" | "blocked";

interface MessagesTabProps {
  onOpenAI: (context?: string) => void;
}

const MessagesTab = ({ onOpenAI }: MessagesTabProps) => {
  const [messages] = useState<Message[]>(mockMessages);
  const [filter, setFilter] = useState<Filter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [showTranslation, setShowTranslation] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardTo, setForwardTo] = useState<string[]>([]);
  const [forwardOption, setForwardOption] = useState<"all" | "last10" | "last24h">("all");

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
      case "protected":
        return <Shield className="w-4 h-4 text-blue-400" />;
      case "allowed":
        return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
      case "blocked":
        return <ShieldX className="w-4 h-4 text-destructive" />;
      case "priority":
        return <Crown className="w-4 h-4 text-amber-400" />;
    }
  };

  const getStatusBadgeClass = (status: Message["status"]) => {
    switch (status) {
      case "protected":
        return "status-badge-protected";
      case "allowed":
        return "status-badge-allowed";
      case "blocked":
        return "status-badge-blocked";
      case "priority":
        return "status-badge-priority";
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
    toast.success("Message sent!");
  };

  const handleForwardChat = () => {
    if (forwardTo.length === 0) {
      toast.error("Please select at least one contact");
      return;
    }
    toast.success(`Chat forwarded to ${forwardTo.length} contact(s)`);
    setShowForwardModal(false);
    setForwardTo([]);
  };

  const selectedContact = mockContacts.find((c) => c.id === selectedChat);

  // Chat View
  if (selectedChat && selectedContact) {
    return (
      <div className="flex flex-col h-[calc(100vh-200px)] md:h-[calc(100vh-220px)]">
        {/* Chat Header */}
        <div className="dashboard-card flex items-center justify-between p-4 mb-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSelectedChat(null)} className="rounded-xl">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="dashboard-avatar w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              {selectedContact.name.charAt(0)}
            </div>
            <div>
              <h3 className="font-medium text-foreground">{selectedContact.name}</h3>
              <p className="text-xs text-muted-foreground">{selectedContact.phone}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => toast.info("Initiating call...")}>
              <Phone className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl"
              onClick={() => onOpenAI(`Analyze chat with ${selectedContact.name}: ${chatMessages.map(m => m.content).join(", ")}`)}
            >
              <Bot className="w-5 h-5" />
            </Button>
            <div className="relative">
              <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setShowChatMenu(!showChatMenu)}>
                <MoreVertical className="w-5 h-5" />
              </Button>
              {showChatMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowChatMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-2xl shadow-2xl z-50 py-2">
                    <button
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-secondary/50"
                      onClick={() => toast.info("Initiating call...")}
                    >
                      <Phone className="w-4 h-4" /> Voice Call
                    </button>
                    <button
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-secondary/50"
                      onClick={() => onOpenAI(`Analyze chat with ${selectedContact.name}`)}
                    >
                      <Bot className="w-4 h-4" /> Ask AI About This Chat
                    </button>
                    <button
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-secondary/50"
                      onClick={() => {
                        setShowChatMenu(false);
                        setShowForwardModal(true);
                      }}
                    >
                      <Forward className="w-4 h-4" /> Forward Chat
                    </button>
                    <button
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-secondary/50"
                      onClick={() => toast.success("Conversation pinned")}
                    >
                      <Pin className="w-4 h-4" /> Pin Conversation
                    </button>
                    <button
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-secondary/50"
                      onClick={() => toast.success("Notifications muted")}
                    >
                      <BellOff className="w-4 h-4" /> Mute Notifications
                    </button>
                    <div className="my-1 border-t border-border" />
                    <button
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10"
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
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          <div className="flex justify-center">
            <button
              className="text-xs text-emerald-400 hover:underline flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-500/10"
              onClick={() => onOpenAI(`Summarize my chat with ${selectedContact.name}`)}
            >
              <Bot className="w-3 h-3" /> Ask AI about this chat
            </button>
          </div>
          {chatMessages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.isIncoming ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[75%] px-4 py-3 rounded-2xl ${
                  msg.isIncoming 
                    ? "bg-secondary text-foreground rounded-bl-md" 
                    : "bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-br-md"
                }`}
              >
                <p className="text-sm">{msg.content}</p>
                {msg.translated && (
                  <p className="text-xs mt-1 opacity-70 italic">{msg.translated}</p>
                )}
                <p className="text-[10px] mt-1.5 opacity-50">{msg.timestamp}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Message Input */}
        <div className="dashboard-card p-3 mt-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="rounded-xl shrink-0">
              <Paperclip className="w-5 h-5" />
            </Button>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Type message..."
              className="dashboard-input flex-1"
            />
            <Button variant="ghost" size="icon" className="rounded-xl shrink-0">
              <Smile className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={`rounded-xl shrink-0 ${showTranslation ? "text-emerald-400 bg-emerald-500/10" : ""}`}
              onClick={() => {
                setShowTranslation(!showTranslation);
                toast.info(showTranslation ? "Translation off" : "Translation on (EN → ES)");
              }}
            >
              <Globe className="w-5 h-5" />
            </Button>
            <Button size="icon" className="rounded-xl shrink-0 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90" onClick={sendMessage}>
              <Send className="w-5 h-5" />
            </Button>
          </div>
          {showTranslation && (
            <p className="text-xs text-emerald-400 mt-2 ml-12">🌐 Translating: English → Spanish</p>
          )}
        </div>

        {/* Forward Modal */}
        {showForwardModal && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="dashboard-card w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="dashboard-section-title">Forward Chat</h3>
                <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setShowForwardModal(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
              
              <div className="space-y-5">
                <div>
                  <p className="text-sm text-muted-foreground mb-3">Select messages to forward:</p>
                  <div className="space-y-2">
                    {(["all", "last10", "last24h"] as const).map((opt) => (
                      <label key={opt} className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/30 cursor-pointer transition-colors">
                        <input
                          type="radio"
                          checked={forwardOption === opt}
                          onChange={() => setForwardOption(opt)}
                          className="w-4 h-4 text-emerald-500 accent-emerald-500"
                        />
                        <span className="text-sm text-foreground">
                          {opt === "all" && "All messages"}
                          {opt === "last10" && "Last 10 messages"}
                          {opt === "last24h" && "Last 24 hours"}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-3">Forward to:</p>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {mockContacts
                      .filter((c) => c.id !== selectedChat)
                      .map((contact) => (
                        <label key={contact.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/30 cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={forwardTo.includes(contact.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setForwardTo([...forwardTo, contact.id]);
                              } else {
                                setForwardTo(forwardTo.filter((id) => id !== contact.id));
                              }
                            }}
                            className="w-4 h-4 text-emerald-500 accent-emerald-500 rounded"
                          />
                          <span className="text-sm text-foreground">{contact.name}</span>
                        </label>
                      ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowForwardModal(false)}>
                    Cancel
                  </Button>
                  <Button className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90" onClick={handleForwardChat}>
                    Forward →
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="dashboard-section-title">Messages</h2>
        <Button className="gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90">
          <Plus className="w-4 h-4" /> New Chat
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search messages..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="dashboard-input pl-11"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "unread", "priority", "blocked"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`dashboard-filter-btn capitalize ${
              filter === f ? "dashboard-filter-btn-active" : "dashboard-filter-btn-inactive"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Messages List */}
      <div className="dashboard-card overflow-hidden">
        {filteredMessages.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No messages found</p>
          </div>
        ) : (
          filteredMessages.map((msg) => (
            <div
              key={msg.id}
              onClick={() => openChat(msg.contactId)}
              className={`dashboard-list-item ${!msg.isRead ? "bg-secondary/30" : ""}`}
            >
              <div className="dashboard-avatar w-12 h-12 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400 shrink-0">
                {msg.contactName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`font-medium truncate ${!msg.isRead ? "text-foreground" : "text-muted-foreground"}`}>
                    {msg.contactName}
                  </span>
                  {!msg.isRead && <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />}
                </div>
                <p className="text-sm text-muted-foreground truncate">{msg.content}</p>
              </div>
              <div className="shrink-0 text-right space-y-1.5">
                <p className="text-xs text-muted-foreground">{msg.timestamp}</p>
                <span className={`status-badge ${getStatusBadgeClass(msg.status)}`}>
                  {getStatusIcon(msg.status)}
                  <span>{getStatusLabel(msg.status)}</span>
                </span>
              </div>
              {msg.status === "blocked" && (
                <Button variant="ghost" size="sm" className="ml-2 rounded-xl" onClick={(e) => {
                  e.stopPropagation();
                  toast.success("Message restored");
                }}>
                  Restore
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MessagesTab;
