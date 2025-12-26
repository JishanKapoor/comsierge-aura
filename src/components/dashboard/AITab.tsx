import { useState, useRef, useEffect } from "react";
import { Bot, Send, Paperclip, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AIMessage } from "./types";

interface AITabProps {
  initialContext?: string;
}

const quickActions = [
  "Summarize today's messages",
  "Find messages from Mom",
  "Show missed calls",
  "Translate recent message",
  "List unread messages",
];

const AITab = ({ initialContext }: AITabProps) => {
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: "1",
      content: "Hi! I'm your Comsierge AI assistant. I can help you analyze messages, summarize conversations, translate content, and more. What would you like to know?",
      isUser: false,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState(initialContext || "");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (initialContext) {
      handleSend(initialContext);
    }
  }, []);

  const handleSend = (text?: string) => {
    const messageText = text || input;
    if (!messageText.trim()) return;

    const userMessage: AIMessage = {
      id: `user-${Date.now()}`,
      content: messageText,
      isUser: true,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    setTimeout(() => {
      let aiResponse = "";

      if (messageText.toLowerCase().includes("summarize") && messageText.toLowerCase().includes("giuseppe")) {
        aiResponse = "Summary of chat with Giuseppe:\n\nGiuseppe messaged about meeting tomorrow at 3pm. You agreed to the meeting. He mentioned bringing documents. Your last exchange was confirming the time.";
      } else if (messageText.toLowerCase().includes("mom") || messageText.toLowerCase().includes("dinner")) {
        aiResponse = "Messages from Mom:\n\nMom reminded you about dinner tonight at 7pm. She asked you to bring dessert. This was flagged as priority by the Family rule.";
      } else if (messageText.toLowerCase().includes("translate")) {
        aiResponse = "Translation Settings:\n\nCurrent configuration:\n- Receive in: English\n- Send in: English\n\nWould you like to translate a specific message or change settings?";
      } else if (messageText.toLowerCase().includes("missed") || messageText.toLowerCase().includes("call")) {
        aiResponse = "Missed Calls:\n\n1 missed call:\n- Unknown Number (Yesterday) - Blocked as spam\n\nAll other calls today were answered.";
      } else if (messageText.toLowerCase().includes("unread")) {
        aiResponse = "Unread Messages:\n\n1. Mom (Priority) - \"Don't forget dinner tonight!\"\n2. Giuseppe - \"Hey, can we meet tomorrow?\"\n\nWould you like me to summarize any of these?";
      } else {
        aiResponse = "I can help you with:\n\n• Summarizing conversations\n• Finding specific messages\n• Translating content\n• Analyzing patterns\n• Extracting action items\n\nCould you be more specific?";
      }

      const aiMessage: AIMessage = {
        id: `ai-${Date.now()}`,
        content: aiResponse,
        isUser: false,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, aiMessage]);
    }, 800);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 mb-4 bg-card/30 border border-border/50 rounded-xl">
        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
          <Bot className="w-5 h-5 text-foreground" />
        </div>
        <div>
          <h2 className="text-sm font-medium text-foreground">Comsierge AI</h2>
          <p className="text-xs text-muted-foreground">Ask about your messages</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-4">
        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Quick Actions
        </p>
        <div className="flex flex-wrap gap-1.5">
          {quickActions.map((action) => (
            <button
              key={action}
              onClick={() => handleSend(action)}
              className="px-2.5 py-1.5 text-xs bg-secondary/50 hover:bg-secondary text-foreground rounded-lg transition-colors border border-border/30"
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.isUser ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${
                msg.isUser
                  ? "bg-foreground text-background rounded-br-sm"
                  : "bg-card/50 border border-border/50 rounded-bl-sm"
              }`}
            >
              <p className="text-sm whitespace-pre-line">{msg.content}</p>
              <p className="text-[10px] mt-1.5 opacity-40">{msg.timestamp}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 p-3 mt-4 bg-card/30 border border-border/50 rounded-xl">
        <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8 shrink-0">
          <Paperclip className="w-4 h-4" />
        </Button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask anything..."
          className="flex-1 px-3 py-2 bg-transparent text-foreground text-sm placeholder:text-muted-foreground focus:outline-none"
        />
        <Button size="icon" className="rounded-lg h-8 w-8 shrink-0" onClick={() => handleSend()}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default AITab;
