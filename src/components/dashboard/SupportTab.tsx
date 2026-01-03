import { useState, useEffect, useRef } from "react";
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
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  SupportTicket,
  createTicketAsync,
  addReplyAsync,
  loadTicketsAsync,
} from "./supportStore";

type SupportView = "main" | "new-ticket";

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
  const { user } = useAuth();
  const [view, setView] = useState<SupportView>("main");
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when selected ticket changes or new replies come in
  useEffect(() => {
    if (messagesEndRef.current && selectedTicket) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedTicket, selectedTicket?.replies.length]);

  // Load user's tickets on mount and poll for updates
  useEffect(() => {
    const loadUserTickets = async () => {
      if (user) {
        const userTickets = await loadTicketsAsync();
        setTickets(userTickets);
        
        // Update selected ticket if it exists
        if (selectedTicket) {
          const updated = userTickets.find(t => t.id === selectedTicket.id);
          if (updated) {
            setSelectedTicket(updated);
          }
        }
      }
    };

    loadUserTickets();
    
    // Poll for updates every 5 seconds (to catch admin replies)
    const interval = setInterval(loadUserTickets, 5000);
    return () => clearInterval(interval);
  }, [user, selectedTicket?.id]);

  const submitTicket = async () => {
    if (!category || !message.trim()) {
      toast.error("Please select a category and describe your issue");
      return;
    }
    
    if (!user) {
      toast.error("You must be logged in to submit a ticket");
      return;
    }

    const newTicket = await createTicketAsync(
      category,
      message.trim(),
      category // subject same as category
    );

    if (newTicket) {
      setTickets([newTicket, ...tickets]);
      setCategory("");
      setMessage("");
      toast.success("Ticket submitted! We'll respond soon.");
      setView("main");
    } else {
      toast.error("Failed to create ticket");
    }
  };

  const submitReply = async () => {
    if (!replyMessage.trim() || !selectedTicket || !user) return;

    const updatedTicket = await addReplyAsync(
      selectedTicket.id,
      replyMessage.trim()
    );

    if (updatedTicket) {
      setSelectedTicket(updatedTicket);
      setTickets(tickets.map(t => t.id === updatedTicket.id ? updatedTicket : t));
      setReplyMessage("");
      toast.success("Reply sent!");
    }
  };

  const getStatusIcon = (status: SupportTicket["status"]) => {
    switch (status) {
      case "open":
        return <AlertCircle className="w-3 h-3 text-indigo-500" />;
      case "in-progress":
        return <Clock className="w-3 h-3 text-amber-500" />;
      case "resolved":
        return <CheckCircle2 className="w-3 h-3 text-green-600" />;
    }
  };

  const getStatusPillClass = (status: SupportTicket["status"]) => {
    switch (status) {
      case "open":
        return "bg-indigo-50 text-indigo-600";
      case "in-progress":
        return "bg-amber-50 text-amber-600";
      case "resolved":
        return "bg-green-50 text-green-600";
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  if (selectedTicket) {
    return (
      <div className="h-full flex flex-col">
        <button
          onClick={() => {
            setSelectedTicket(null);
            setReplyMessage("");
          }}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-3 shrink-0"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back
        </button>

        <div className="flex-1 flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden">
          {/* Header */}
          <div className="flex items-start justify-between p-3 border-b border-gray-100 shrink-0">
            <div>
              <h3 className="text-xs font-medium text-gray-800">{selectedTicket.subject}</h3>
              <p className="text-xs text-gray-500">{formatDate(selectedTicket.createdAt)}</p>
            </div>
            <div
              className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded text-xs",
                getStatusPillClass(selectedTicket.status)
              )}
            >
              {getStatusIcon(selectedTicket.status)}
              <span className="capitalize">{selectedTicket.status.replace("-", " ")}</span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {selectedTicket.replies?.map((reply, idx) => (
              <div key={idx} className={cn("flex", reply.isSupport ? "justify-start" : "justify-end")}>
                <div
                  className={cn(
                    "max-w-[85%] px-2.5 py-1.5 rounded text-xs",
                    reply.isSupport ? "bg-gray-100 text-gray-700" : "bg-indigo-500 text-white"
                  )}
                >
                  {reply.isSupport && reply.authorName && (
                    <p className="text-[10px] font-medium text-indigo-600 mb-0.5">{reply.authorName}</p>
                  )}
                  <p>{reply.message}</p>
                  <p className={cn("text-[10px] mt-0.5", reply.isSupport ? "text-gray-400" : "text-indigo-200")}>
                    {reply.timestamp}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply input - only show for non-resolved tickets */}
          {selectedTicket.status !== "resolved" && (
            <div className="p-3 border-t border-gray-100 shrink-0">
              <div className="flex items-end gap-2">
                <textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Type your reply..."
                  rows={2}
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-gray-300 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submitReply();
                    }
                  }}
                />
                <Button
                  className="h-9 px-3 text-xs bg-indigo-500 hover:bg-indigo-600 text-white shrink-0"
                  onClick={submitReply}
                  disabled={!replyMessage.trim()}
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Resolved notice */}
          {selectedTicket.status === "resolved" && (
            <div className="p-3 border-t border-gray-100 shrink-0">
              <p className="text-xs text-gray-500 text-center">
                This ticket has been resolved. Need more help?{" "}
                <button
                  onClick={() => {
                    setSelectedTicket(null);
                    setView("new-ticket");
                  }}
                  className="text-indigo-600 hover:underline"
                >
                  Open a new ticket
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === "new-ticket") {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setView("main")}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back
        </button>

        <h2 className="text-sm font-medium text-gray-800">Contact Support</h2>

        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-5">
          <div>
            <label className="text-xs text-gray-500 block mb-2">What's your issue about?</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded text-gray-700 text-xs focus:outline-none focus:border-gray-300"
            >
              <option value="" disabled>
                Select a category
              </option>
              {issueCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-2">Describe your issue</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us more about the problem..."
              rows={5}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded text-gray-700 text-xs placeholder:text-gray-400 focus:outline-none focus:border-gray-300 resize-none"
            />
          </div>

          <Button
            className="w-full h-9 text-xs bg-indigo-500 hover:bg-indigo-600 text-white"
            onClick={submitTicket}
          >
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
                  <p className="text-xs text-gray-500">{formatDate(ticket.createdAt)}</p>
                </div>
                <div
                  className={cn(
                    "ml-2 shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px]",
                    getStatusPillClass(ticket.status)
                  )}
                >
                  {getStatusIcon(ticket.status)}
                  <span className="capitalize">{ticket.status.replace("-", " ")}</span>
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
