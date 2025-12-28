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
import { cn } from "@/lib/utils";

type SupportView = "main" | "new-ticket";

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
      case "open": return <AlertCircle className="w-3 h-3 text-indigo-500" />;
      case "in-progress": return <Clock className="w-3 h-3 text-indigo-500" />;
      case "resolved": return <CheckCircle2 className="w-3 h-3 text-gray-400" />;
    }
  };

  if (selectedTicket) {
    return (
      <div className="space-y-3">
        <button
          onClick={() => setSelectedTicket(null)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back
        </button>

        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-xs font-medium text-gray-800">{selectedTicket.subject}</h3>
              <p className="text-xs text-gray-500">{selectedTicket.createdAt}</p>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-xs">
              {getStatusIcon(selectedTicket.status)}
              <span className="text-gray-600 capitalize">{selectedTicket.status.replace("-", " ")}</span>
            </div>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {selectedTicket.replies?.map((reply, idx) => (
              <div key={idx} className={cn("flex", reply.isSupport ? "justify-start" : "justify-end")}>
                <div className={cn(
                  "max-w-[85%] px-2.5 py-1.5 rounded text-xs",
                  reply.isSupport ? "bg-gray-100 text-gray-700" : "bg-indigo-50 text-gray-700"
                )}>
                  <p>{reply.message}</p>
                  <p className="text-[10px] mt-0.5 text-gray-400">{reply.timestamp}</p>
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
      <div className="space-y-3">
        <button
          onClick={() => setView("main")}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back
        </button>

        <h2 className="text-sm font-medium text-gray-800">Contact Support</h2>

        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="relative">
            <label className="text-xs text-gray-500">What's your issue about?</label>
            <button
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              className="w-full mt-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs text-left flex items-center justify-between"
            >
              <span className={category ? "text-gray-700" : "text-gray-400"}>
                {category || "Select an issue type"}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>
            {showCategoryDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowCategoryDropdown(false)} />
                <div className="absolute left-0 right-0 top-full mt-1 bg-[#F9F9F9] border border-gray-200 rounded shadow-lg z-50 max-h-48 overflow-y-auto">
                  {issueCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => { setCategory(cat); setShowCategoryDropdown(false); }}
                      className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div>
            <label className="text-xs text-gray-500">Describe your issue</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us more about the problem..."
              rows={4}
              className="w-full mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-gray-700 text-xs placeholder:text-gray-400 focus:outline-none focus:border-gray-300 resize-none"
            />
          </div>

          <Button className="w-full h-8 text-xs bg-indigo-500 hover:bg-indigo-600 text-white" onClick={submitTicket}>
            <Send className="w-3.5 h-3.5 mr-1.5" /> Submit Ticket
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => setView("new-ticket")}
        className="w-full flex items-center gap-2.5 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
      >
        <div className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center">
          <Send className="w-3.5 h-3.5 text-gray-600" />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-800">Contact Support</p>
          <p className="text-xs text-gray-500">Submit a new ticket</p>
        </div>
      </button>

      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <h3 className="text-xs font-medium text-gray-800 mb-2 flex items-center gap-1.5">
          <MessageCircle className="w-3.5 h-3.5" /> My Tickets
        </h3>
        
        {tickets.length === 0 ? (
          <p className="text-xs text-gray-400 py-3 text-center">No tickets yet</p>
        ) : (
          <div className="space-y-1.5">
            {tickets.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => setSelectedTicket(ticket)}
                className="w-full flex items-center justify-between p-2.5 rounded bg-gray-50 hover:bg-gray-100 transition-colors text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-800 truncate">{ticket.subject}</p>
                  <p className="text-xs text-gray-500">{ticket.createdAt}</p>
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
