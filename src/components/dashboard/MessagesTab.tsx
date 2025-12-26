import { useState } from "react";
import {
  Search,
  Plus,
  Star,
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
  Settings,
  Globe,
  Send,
  Paperclip,
  Smile,
  X,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { mockMessages, mockChatHistory, mockContacts } from "./mockData";
import { Message, ChatMessage, Contact } from "./types";

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
        return <ShieldCheck className="w-4 h-4 text-green-400" />;
      case "blocked":
        return <ShieldX className="w-4 h-4 text-destructive" />;
      case "priority":
        return <Crown className="w-4 h-4 text-yellow-400" />;
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

  if (selectedChat && selectedContact) {
    return (
      <div className="flex flex-col h-full">
        {/* Chat Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSelectedChat(null)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
              <span className="text-foreground font-medium">{selectedContact.name.charAt(0)}</span>
            </div>
            <div>
              <h3 className="font-medium text-foreground">{selectedContact.name}</h3>
              <p className="text-xs text-muted-foreground">{selectedContact.phone}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => toast.info("Initiating call...")}>
              <Phone className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenAI(`Analyze chat with ${selectedContact.name}: ${chatMessages.map(m => m.content).join(", ")}`)}
            >
              <Bot className="w-5 h-5" />
            </Button>
            <div className="relative">
              <Button variant="ghost" size="icon" onClick={() => setShowChatMenu(!showChatMenu)}>
                <MoreVertical className="w-5 h-5" />
              </Button>
              {showChatMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-xl shadow-lg z-50 py-2">
                  <button
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-secondary/50"
                    onClick={() => toast.info("Initiating call...")}
                  >
                    <Phone className="w-4 h-4" /> Voice Call
                  </button>
                  <button
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-secondary/50"
                    onClick={() => onOpenAI(`Analyze chat with ${selectedContact.name}`)}
                  >
                    <Bot className="w-4 h-4" /> Ask AI About This Chat
                  </button>
                  <button
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-secondary/50"
                    onClick={() => {
                      setShowChatMenu(false);
                      setShowForwardModal(true);
                    }}
                  >
                    <Forward className="w-4 h-4" /> Forward Chat
                  </button>
                  <button
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-secondary/50"
                    onClick={() => toast.success("Conversation pinned")}
                  >
                    <Pin className="w-4 h-4" /> Pin Conversation
                  </button>
                  <button
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-secondary/50"
                    onClick={() => toast.success("Notifications muted")}
                  >
                    <BellOff className="w-4 h-4" /> Mute Notifications
                  </button>
                  <button
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      toast.success("Chat deleted");
                      setSelectedChat(null);
                    }}
                  >
                    <Trash2 className="w-4 h-4" /> Delete Chat
                  </button>
                  <button
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-secondary/50"
                    onClick={() => toast.info("Chat settings")}
                  >
                    <Settings className="w-4 h-4" /> Chat Settings
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex justify-center">
            <button
              className="text-xs text-primary hover:underline flex items-center gap-1"
              onClick={() => onOpenAI(`Summarize my chat with ${selectedContact.name}`)}
            >
              <Bot className="w-3 h-3" /> Ask AI about this chat
            </button>
          </div>
          {chatMessages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.isIncoming ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[70%] px-4 py-2 rounded-2xl ${
                  msg.isIncoming ? "bg-secondary text-foreground" : "bg-primary text-primary-foreground"
                }`}
              >
                <p className="text-sm">{msg.content}</p>
                {msg.translated && (
                  <p className="text-xs mt-1 opacity-70 italic">{msg.translated}</p>
                )}
                <p className="text-[10px] mt-1 opacity-50">{msg.timestamp}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Message Input */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon">
              <Paperclip className="w-5 h-5" />
            </Button>
            <div className="flex-1 relative">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Type message..."
                className="w-full px-4 py-2 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <Button variant="ghost" size="icon">
              <Smile className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={showTranslation ? "text-primary" : ""}
              onClick={() => {
                setShowTranslation(!showTranslation);
                toast.info(showTranslation ? "Translation off" : "Translation on (EN → ES)");
              }}
            >
              <Globe className="w-5 h-5" />
            </Button>
            <Button size="icon" onClick={sendMessage}>
              <Send className="w-5 h-5" />
            </Button>
          </div>
          {showTranslation && (
            <p className="text-xs text-primary mt-2">🌐 Translating: English → Spanish</p>
          )}
        </div>

        {/* Forward Modal */}
        {showForwardModal && (
          <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-foreground">Forward Chat to...</h3>
                <Button variant="ghost" size="icon" onClick={() => setShowForwardModal(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Select messages to forward:</p>
                  <div className="space-y-2">
                    {(["all", "last10", "last24h"] as const).map((opt) => (
                      <label key={opt} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={forwardOption === opt}
                          onChange={() => setForwardOption(opt)}
                          className="text-primary"
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
                  <p className="text-sm text-muted-foreground mb-2">Forward to:</p>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {mockContacts
                      .filter((c) => c.id !== selectedChat)
                      .map((contact) => (
                        <label key={contact.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-secondary/50">
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
                            className="text-primary"
                          />
                          <span className="text-sm text-foreground">{contact.name}</span>
                        </label>
                      ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setShowForwardModal(false)}>
                    Cancel
                  </Button>
                  <Button className="flex-1" onClick={handleForwardChat}>
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-light text-foreground">Messages</h2>
        <Button className="gap-2">
          <Plus className="w-4 h-4" /> New Chat
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
          className="w-full pl-10 pr-4 py-2 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(["all", "unread", "priority", "blocked"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm capitalize transition-colors ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Messages List */}
      <div className="bg-card/50 border border-border rounded-2xl overflow-hidden">
        {filteredMessages.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No messages found</div>
        ) : (
          filteredMessages.map((msg) => (
            <div
              key={msg.id}
              onClick={() => openChat(msg.contactId)}
              className={`flex items-center gap-4 p-4 border-b border-border last:border-b-0 hover:bg-secondary/30 transition-colors cursor-pointer ${
                !msg.isRead ? "bg-secondary/20" : ""
              }`}
            >
              <div className="flex-shrink-0">{getStatusIcon(msg.status)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${!msg.isRead ? "text-foreground" : "text-muted-foreground"}`}>
                    {msg.contactName}
                  </span>
                  {!msg.isRead && <span className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <p className="text-sm text-muted-foreground truncate">"{msg.content}"</p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-xs text-muted-foreground">{msg.timestamp}</p>
                <p className={`text-xs mt-1 ${
                  msg.status === "blocked" ? "text-destructive" : 
                  msg.status === "priority" ? "text-yellow-400" : "text-muted-foreground"
                }`}>
                  {getStatusLabel(msg.status)}
                </p>
                {msg.rule && <p className="text-[10px] text-muted-foreground">Rule: {msg.rule}</p>}
              </div>
              {msg.status === "blocked" && (
                <Button variant="ghost" size="sm" onClick={(e) => {
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