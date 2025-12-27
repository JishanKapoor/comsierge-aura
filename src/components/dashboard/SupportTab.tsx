import { useState } from "react";
import {
  Send,
  ChevronLeft,
  MessageCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type SupportView = "main" | "new-ticket" | "history";

interface Ticket {
  id: string;
  subject: string;
  category: string;
  message: string;
  status: "open" | "in-progress" | "resolved";
  createdAt: string;
  replies?: { message: string; isSupport: boolean; timestamp: string }[];
}

const issueCategories = [
  "Call Quality Issues",
  "Message Not Delivered",
  "Billing & Subscription",
  "Account Access",
  "Spam Protection",
  "App Performance",
  "Feature Request",
  "Other",
];

const SupportTab = () => {
  const [view, setView] = useState<SupportView>("main");
  const [category, setCategory] = useState("");
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  
  const [tickets, setTickets] = useState<Ticket[]>([
    {
      id: "1",
      subject: "Call forwarding issue",
      category: "Call Quality Issues",
      message: "I'm having trouble setting up call forwarding.",
      status: "resolved",
      createdAt: "Dec 20, 2024",
      replies: [
        { message: "I'm having trouble setting up call forwarding.", isSupport: false, timestamp: "Dec 20, 10:30 AM" },
        { message: "Hi! I'd be happy to help. What number are you forwarding to?", isSupport: true, timestamp: "Dec 20, 11:15 AM" },
        { message: "+1 (555) 123-4567", isSupport: false, timestamp: "Dec 20, 11:20 AM" },
        { message: "Done! Forwarding is now enabled.", isSupport: true, timestamp: "Dec 20, 11:45 AM" },
      ],
    },
    {
      id: "2",
      subject: "Billing question",
      category: "Billing & Subscription",
      message: "I was charged twice this month.",
      status: "in-progress",
      createdAt: "Dec 24, 2024",
      replies: [
        { message: "I was charged twice this month.", isSupport: false, timestamp: "Dec 24, 2:00 PM" },
        { message: "We're looking into this and will update you within 24 hours.", isSupport: true, timestamp: "Dec 24, 2:30 PM" },
      ],
    },
  ]);

  const submitTicket = () => {
    if (!category || !message.trim()) {
      toast.error("Please select a category and describe your issue");
      return;
    }
    const newTicket: Ticket = {
      id: `${Date.now()}`,
      subject: category,
      category,
      message,
      status: "open",
      createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      replies: [{ message, isSupport: false, timestamp: new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) }],
    };
    setTickets([newTicket, ...tickets]);
    setCategory("");
    setMessage("");
    toast.success("Ticket submitted! We'll respond soon.");
    setView("main");
  };

  const getStatusIcon = (status: Ticket["status"]) => {
    switch (status) {
      case "open": return <AlertCircle className="w-3.5 h-3.5 text-amber-500" />;
      case "in-progress": return <Clock className="w-3.5 h-3.5 text-blue-500" />;
      case "resolved": return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
    }
  };

  if (selectedTicket) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedTicket(null)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        <div className="bg-card/30 border border-border/50 rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-medium text-foreground text-sm">{selectedTicket.subject}</h3>
              <p className="text-xs text-muted-foreground">{selectedTicket.createdAt}</p>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/50 text-xs">
              {getStatusIcon(selectedTicket.status)}
              <span className="text-muted-foreground capitalize">{selectedTicket.status.replace("-", " ")}</span>
            </div>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {selectedTicket.replies?.map((reply, idx) => (
              <div key={idx} className={`flex ${reply.isSupport ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                  reply.isSupport ? "bg-secondary/50 text-foreground" : "bg-foreground/10 text-foreground"
                }`}>
                  <p>{reply.message}</p>
                  <p className="text-[10px] mt-1 opacity-50">{reply.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (view === "new-ticket") {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setView("main")}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        <h2 className="text-lg font-medium text-foreground">Contact Support</h2>

        <div className="bg-card/30 border border-border/50 rounded-xl p-4 space-y-4">
          <div className="relative">
            <label className="text-sm text-muted-foreground">What's your issue about?</label>
            <button
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              className="w-full mt-1 px-3 py-2.5 bg-secondary/50 border border-border/50 rounded-lg text-sm text-left flex items-center justify-between"
            >
              <span className={category ? "text-foreground" : "text-muted-foreground"}>
                {category || "Select an issue type"}
              </span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </button>
            {showCategoryDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowCategoryDropdown(false)} />
                <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                  {issueCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => { setCategory(cat); setShowCategoryDropdown(false); }}
                      className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-secondary/50"
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Describe your issue</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us more about the problem..."
              rows={4}
              className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none resize-none"
            />
          </div>

          <Button className="rounded-lg w-full" onClick={submitTicket}>
            <Send className="w-4 h-4 mr-2" /> Submit Ticket
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium text-foreground">Support</h2>

      <button
        onClick={() => setView("new-ticket")}
        className="w-full flex items-center gap-3 p-4 bg-card/30 border border-border/50 rounded-xl hover:bg-secondary/20 transition-colors text-left"
      >
        <div className="w-10 h-10 rounded-lg bg-foreground/10 flex items-center justify-center">
          <Send className="w-5 h-5 text-foreground" />
        </div>
        <div>
          <p className="font-medium text-foreground text-sm">Contact Support</p>
          <p className="text-xs text-muted-foreground">Submit a new ticket</p>
        </div>
      </button>

      <div className="bg-card/30 border border-border/50 rounded-xl p-4">
        <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
          <MessageCircle className="w-4 h-4" /> My Tickets
        </h3>
        
        {tickets.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No tickets yet</p>
        ) : (
          <div className="space-y-2">
            {tickets.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => setSelectedTicket(ticket)}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground truncate">{ticket.subject}</p>
                  <p className="text-xs text-muted-foreground">{ticket.createdAt}</p>
                </div>
                <div className="ml-2 shrink-0">
                  {getStatusIcon(ticket.status)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SupportTab;