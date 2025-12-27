import { useState, useRef, useEffect } from "react";
import { Bot, X, Send, Sparkles, MessageSquare, Clock, Zap, Filter, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AIMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: string;
}

interface AICondition {
  id: string;
  rule: string;
  active: boolean;
  createdAt: string;
}

interface AIPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const AIPanel = ({ isOpen, onClose }: AIPanelProps) => {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "conditions">("chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [conditions, setConditions] = useState<AICondition[]>([
    { id: "1", rule: "Auto-reply to delivery messages with 'Thanks, leave at door'", active: true, createdAt: "Dec 24" },
    { id: "2", rule: "Forward urgent family messages to +1 (555) 999-8888", active: true, createdAt: "Dec 22" },
    { id: "3", rule: "Block messages containing 'car warranty'", active: false, createdAt: "Dec 20" },
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const exampleQueries = [
    "Show urgent messages from tenants",
    "Find pickup notifications",
    "Summarize family chat",
    "Create auto-reply rule",
  ];

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: AIMessage = {
      id: `user-${Date.now()}`,
      content: input,
      isUser: true,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    setTimeout(() => {
      let response = "";
      const lowerInput = input.toLowerCase();

      if (lowerInput.includes("urgent") || lowerInput.includes("priority")) {
        response = `**Urgent Messages Found:**\n\n1. **Mom** (2:30pm): "Don't forget dinner tonight!" - Family\n2. **Giuseppe** (11:30am): "Hey, can we meet tomorrow?" - Family\n\n*2 urgent messages in the last 24 hours*`;
      } else if (lowerInput.includes("pickup") || lowerInput.includes("delivery")) {
        response = `**Pickup/Delivery Messages:**\n\n1. **FedEx** (1:15pm): "Your package will arrive tomorrow between 2-4pm"\n\n*1 delivery notification found*`;
      } else if (lowerInput.includes("summarize") || lowerInput.includes("summary")) {
        response = `**Chat Summary:**\n\n• **Mom**: Dinner tonight at 7pm, usual place\n• **Giuseppe**: Wants to meet tomorrow, time TBD\n• **FedEx**: Package arriving tomorrow 2-4pm\n\n*3 active conversations, 2 need responses*`;
      } else if (lowerInput.includes("auto-reply") || lowerInput.includes("rule") || lowerInput.includes("create")) {
        response = `I can create an auto-reply rule for you. What should I:\n\n1. **Trigger on**: Keywords, sender, or time?\n2. **Reply with**: What message?\n3. **Apply to**: All messages or specific contacts?\n\nExample: "Auto-reply 'On vacation until Jan 2' to all non-priority messages"`;
      } else if (lowerInput.includes("family")) {
        response = `**Family Messages Today:**\n\n• **Mom**: "Don't forget dinner tonight!" (2:30pm)\n  → Waiting for your response\n\n• **Giuseppe**: "Hey, can we meet tomorrow?" (11:30am)\n  → Suggested reply: "Sure! What time works?"\n\n*2 family members reached out today*`;
      } else {
        response = `I can help you with:\n\n• **Search**: "Show urgent messages from tenants"\n• **Summarize**: "What did family say about dinner?"\n• **Automate**: "Create auto-reply for delivery"\n• **Filter**: "Find messages about appointments"\n\nTry asking something specific!`;
      }

      const aiMessage: AIMessage = {
        id: `ai-${Date.now()}`,
        content: response,
        isUser: false,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages(prev => [...prev, aiMessage]);
      setIsLoading(false);
    }, 800);
  };

  const toggleCondition = (id: string) => {
    setConditions(prev => prev.map(c => c.id === id ? { ...c, active: !c.active } : c));
    toast.success("Condition updated");
  };

  const deleteCondition = (id: string) => {
    setConditions(prev => prev.filter(c => c.id !== id));
    toast.success("Condition deleted");
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-background/60 backdrop-blur-sm z-50" onClick={onClose} />
      
      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-card border-l border-border z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-border/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-medium text-foreground text-sm">Comsierge AI</h2>
              <p className="text-xs text-muted-foreground">Your intelligent assistant</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-secondary/50 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-4 py-2 border-b border-border/30 flex gap-1">
          <button
            onClick={() => setActiveTab("chat")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors",
              activeTab === "chat" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Chat
          </button>
          <button
            onClick={() => setActiveTab("conditions")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors",
              activeTab === "conditions" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Zap className="w-3.5 h-3.5" />
            Conditions
          </button>
        </div>

        {activeTab === "chat" ? (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="space-y-4">
                  <div className="text-center py-6">
                    <Sparkles className="w-10 h-10 mx-auto mb-3 text-violet-400 opacity-60" />
                    <h3 className="font-medium text-foreground mb-1">Ask me anything</h3>
                    <p className="text-xs text-muted-foreground">I can search, summarize, and automate your messages</p>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Try asking</p>
                    {exampleQueries.map((query) => (
                      <button
                        key={query}
                        onClick={() => { setInput(query); }}
                        className="w-full text-left px-3 py-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 text-sm text-foreground transition-colors"
                      >
                        {query}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {messages.map((msg) => (
                <div key={msg.id} className={cn("flex", msg.isUser ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[85%] px-3 py-2 rounded-xl text-sm",
                    msg.isUser 
                      ? "bg-foreground text-background rounded-br-sm" 
                      : "bg-secondary/50 text-foreground rounded-bl-sm"
                  )}>
                    <p className="whitespace-pre-line">{msg.content}</p>
                    <p className="text-[10px] mt-1 opacity-50">{msg.timestamp}</p>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-secondary/50 px-4 py-3 rounded-xl rounded-bl-sm">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border/50">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Ask Comsierge AI..."
                  className="flex-1 px-4 py-2.5 bg-secondary/40 border border-border/30 rounded-xl text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-border/60"
                />
                <Button size="icon" className="h-10 w-10 shrink-0" onClick={handleSend} disabled={isLoading}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Active Conditions</p>
            
            {conditions.map((condition) => (
              <div key={condition.id} className={cn(
                "p-3 rounded-xl border transition-colors",
                condition.active ? "bg-secondary/30 border-border/50" : "bg-secondary/10 border-border/20 opacity-60"
              )}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{condition.rule}</p>
                    <p className="text-xs text-muted-foreground mt-1">Created {condition.createdAt}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleCondition(condition.id)}
                      className={cn(
                        "w-10 h-5 rounded-full transition-colors relative",
                        condition.active ? "bg-emerald-500" : "bg-secondary"
                      )}
                    >
                      <span className={cn(
                        "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                        condition.active ? "left-5" : "left-0.5"
                      )} />
                    </button>
                    <button
                      onClick={() => deleteCondition(condition.id)}
                      className="p-1.5 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            
            <button
              onClick={() => { setActiveTab("chat"); setInput("Create a new auto-reply rule"); }}
              className="w-full py-3 rounded-xl border border-dashed border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors text-sm"
            >
              + Create new condition via AI chat
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default AIPanel;
