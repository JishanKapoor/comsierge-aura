import { useState } from "react";
import {
  Send,
  ChevronLeft,
  MessageCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type SupportView = "main" | "new-ticket" | "history";

interface Ticket {
  id: string;
  subject: string;
  message: string;
  status: "open" | "in-progress" | "resolved";
  createdAt: string;
  replies?: { message: string; isSupport: boolean; timestamp: string }[];
}

const SupportTab = () => {
  const [view, setView] = useState<SupportView>("main");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  
  const [tickets, setTickets] = useState<Ticket[]>([
    {
      id: "1",
      subject: "Issue with call forwarding",
      message: "I'm having trouble setting up call forwarding to my other number.",
      status: "resolved",
      createdAt: "Dec 20, 2024",
      replies: [
        { message: "I'm having trouble setting up call forwarding to my other number.", isSupport: false, timestamp: "Dec 20, 10:30 AM" },
        { message: "Hi! I'd be happy to help. Could you please tell me which number you're trying to forward to?", isSupport: true, timestamp: "Dec 20, 11:15 AM" },
        { message: "It's +1 (555) 123-4567", isSupport: false, timestamp: "Dec 20, 11:20 AM" },
        { message: "I've enabled forwarding for that number. Please try again now!", isSupport: true, timestamp: "Dec 20, 11:45 AM" },
      ],
    },
    {
      id: "2",
      subject: "Billing question",
      message: "I was charged twice this month, can you help?",
      status: "in-progress",
      createdAt: "Dec 24, 2024",
      replies: [
        { message: "I was charged twice this month, can you help?", isSupport: false, timestamp: "Dec 24, 2:00 PM" },
        { message: "We're looking into this and will get back to you within 24 hours.", isSupport: true, timestamp: "Dec 24, 2:30 PM" },
      ],
    },
  ]);

  const submitTicket = () => {
    if (!subject.trim() || !message.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    const newTicket: Ticket = {
      id: `${Date.now()}`,
      subject,
      message,
      status: "open",
      createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      replies: [{ message, isSupport: false, timestamp: new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) }],
    };
    setTickets([newTicket, ...tickets]);
    setSubject("");
    setMessage("");
    toast.success("Ticket submitted! We'll get back to you soon.");
    setView("main");
  };

  const getStatusIcon = (status: Ticket["status"]) => {
    switch (status) {
      case "open":
        return <AlertCircle className="w-4 h-4 text-amber-500" />;
      case "in-progress":
        return <Clock className="w-4 h-4 text-blue-500" />;
      case "resolved":
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    }
  };

  const getStatusLabel = (status: Ticket["status"]) => {
    switch (status) {
      case "open":
        return "Open";
      case "in-progress":
        return "In Progress";
      case "resolved":
        return "Resolved";
    }
  };

  if (selectedTicket) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedTicket(null)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <div className="bg-card/30 border border-border/50 rounded-xl p-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-medium text-foreground">{selectedTicket.subject}</h3>
              <p className="text-xs text-muted-foreground">{selectedTicket.createdAt}</p>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-secondary/50 text-xs">
              {getStatusIcon(selectedTicket.status)}
              <span className="text-muted-foreground">{getStatusLabel(selectedTicket.status)}</span>
            </div>
          </div>

          <div className="space-y-3">
            {selectedTicket.replies?.map((reply, idx) => (
              <div key={idx} className={`flex ${reply.isSupport ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                  reply.isSupport 
                    ? "bg-secondary/50 text-foreground" 
                    : "bg-foreground/10 text-foreground"
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
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <h2 className="text-lg font-medium text-foreground">Submit a Ticket</h2>

        <div className="bg-card/30 border border-border/50 rounded-xl p-4 space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief description of your issue"
              className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your issue in detail..."
              rows={4}
              className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none resize-none"
            />
          </div>

          <Button className="rounded-lg" onClick={submitTicket}>
            <Send className="w-4 h-4 mr-2" /> Submit Ticket
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-medium text-foreground">Contact Support</h2>

      <div className="grid gap-3">
        <button
          onClick={() => setView("new-ticket")}
          className="flex items-center gap-3 p-4 bg-card/30 border border-border/50 rounded-xl hover:bg-secondary/20 transition-colors text-left"
        >
          <div className="w-10 h-10 rounded-lg bg-foreground/10 flex items-center justify-center">
            <Send className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <p className="font-medium text-foreground">Submit a Ticket</p>
            <p className="text-xs text-muted-foreground">Get help from our support team</p>
          </div>
        </button>

        <div className="bg-card/30 border border-border/50 rounded-xl p-4">
          <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <MessageCircle className="w-4 h-4" /> My Tickets
          </h3>
          
          {tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No previous tickets</p>
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
                  <div className="flex items-center gap-1.5 ml-2 shrink-0">
                    {getStatusIcon(ticket.status)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupportTab;
