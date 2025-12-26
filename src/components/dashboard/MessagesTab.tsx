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
            <div>
              <h3 className="font-medium text-foreground text-sm">{selectedContact.name}</h3>
              <p className="text-xs text-muted-foreground">{selectedContact.phone}</p>
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
                  <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-xl shadow-xl z-50 py-1">
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
                        setShowForwardModal(true);
                      }}
                    >
                      <Forward className="w-4 h-4" /> Forward Chat
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
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {chatMessages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.isIncoming ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[75%] px-4 py-2.5 rounded-2xl ${
                  msg.isIncoming 
                    ? "bg-secondary text-foreground rounded-bl-sm" 
                    : "bg-foreground text-background rounded-br-sm"
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
            className="flex-1 px-3 py-2 bg-transparent text-foreground placeholder:text-muted-foreground text-sm focus:outline-none"
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

        {/* Forward Modal */}
        {showForwardModal && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-xl w-full max-w-md p-5">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-medium text-foreground">Forward Chat</h3>
                <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8" onClick={() => setShowForwardModal(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Select messages:</p>
                  <div className="space-y-1">
                    {(["all", "last10", "last24h"] as const).map((opt) => (
                      <label key={opt} className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/30 cursor-pointer">
                        <input
                          type="radio"
                          checked={forwardOption === opt}
                          onChange={() => setForwardOption(opt)}
                          className="accent-foreground"
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
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {mockContacts
                      .filter((c) => c.id !== selectedChat)
                      .map((contact) => (
                        <label key={contact.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/30 cursor-pointer">
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
                            className="accent-foreground rounded"
                          />
                          <span className="text-sm text-foreground">{contact.name}</span>
                        </label>
                      ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1 rounded-lg" onClick={() => setShowForwardModal(false)}>
                    Cancel
                  </Button>
                  <Button className="flex-1 rounded-lg" onClick={handleForwardChat}>
                    Forward
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
      <div className="flex gap-2">
        {(["all", "unread", "priority", "blocked"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${
              filter === f
                ? "bg-foreground text-background"
                : "bg-secondary/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
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
                  <span className="text-[10px]">{getStatusLabel(msg.status)}</span>
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
