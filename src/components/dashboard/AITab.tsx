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
  "What did Giuseppe say?",
  "List unread messages",
];

const AITab = ({ initialContext }: AITabProps) => {
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: "1",
      content: "Hi! I'm your Comsierge AI assistant. I can help you analyze your messages, summarize conversations, translate content, and more. What would you like to know?",
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

    // Simulate AI response
    setTimeout(() => {
      let aiResponse = "";

      if (messageText.toLowerCase().includes("summarize") && messageText.toLowerCase().includes("giuseppe")) {
        aiResponse = "📝 **Summary of chat with Giuseppe:**\n\nGiuseppe messaged about meeting tomorrow at 3pm. You agreed to the meeting. He also mentioned he might bring documents to discuss. Your last exchange was about confirming the time.";
      } else if (messageText.toLowerCase().includes("mom") || messageText.toLowerCase().includes("dinner")) {
        aiResponse = "👩 **Messages from Mom:**\n\nMom reminded you about dinner tonight at 7pm at the usual place. She asked you to bring dessert. This was a priority message flagged by the 'Family' rule.";
      } else if (messageText.toLowerCase().includes("translate")) {
        aiResponse = "🌐 **Translation:**\n\nI can translate messages for you. Your current settings are:\n- Receive in: English\n- Send in: English\n\nWould you like me to translate a specific message or change your translation settings?";
      } else if (messageText.toLowerCase().includes("missed") || messageText.toLowerCase().includes("call")) {
        aiResponse = "📞 **Missed Calls:**\n\nYou have 1 missed call:\n- Unknown Number (Yesterday) - Blocked as spam\n\nAll other calls today were answered successfully.";
      } else if (messageText.toLowerCase().includes("unread")) {
        aiResponse = "📬 **Unread Messages:**\n\n1. **Mom** (Priority) - \"Don't forget dinner tonight!\"\n2. **Giuseppe** (Priority) - \"Hey, can we meet tomorrow?\"\n\nWould you like me to summarize any of these?";
      } else if (messageText.toLowerCase().includes("today") && messageText.toLowerCase().includes("message")) {
        aiResponse = "📊 **Today's Message Summary:**\n\n- 4 messages received\n- 2 priority messages (Mom, Giuseppe)\n- 1 delivery notification (FedEx)\n- 1 blocked spam message\n\nMost important: Mom's dinner reminder and Giuseppe's meeting request.";
      } else {
        aiResponse = "I understand you're asking about: \"" + messageText + "\"\n\nI can help you with:\n• Summarizing conversations\n• Finding specific messages\n• Translating content\n• Analyzing message patterns\n• Extracting action items\n\nCould you be more specific about what you'd like to know?";
      }

      const aiMessage: AIMessage = {
        id: `ai-${Date.now()}`,
        content: aiResponse,
        isUser: false,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, aiMessage]);
    }, 1000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] md:h-[calc(100vh-220px)]">
      {/* Header */}
      <div className="dashboard-card flex items-center gap-4 p-5 mb-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <Bot className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="dashboard-section-title">Comsierge AI</h2>
          <p className="text-sm text-muted-foreground">Ask me anything about your messages!</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="dashboard-card p-4 mb-4">
        <p className="text-sm text-muted-foreground mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" /> Quick Actions
        </p>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <button
              key={action}
              onClick={() => handleSend(action)}
              className="px-3 py-2 text-xs bg-secondary/50 hover:bg-secondary text-foreground rounded-xl transition-colors border border-border/30"
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.isUser ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                msg.isUser
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-br-md"
                  : "dashboard-card rounded-bl-md"
              }`}
            >
              <p className="text-sm whitespace-pre-line">{msg.content}</p>
              <p className="text-[10px] mt-2 opacity-50">{msg.timestamp}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="dashboard-card p-3 mt-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="rounded-xl shrink-0">
            <Paperclip className="w-5 h-5" />
          </Button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask AI anything..."
            className="dashboard-input flex-1"
          />
          <Button 
            size="icon" 
            className="rounded-xl shrink-0 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90"
            onClick={() => handleSend()}
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AITab;
