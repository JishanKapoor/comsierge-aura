import { useState } from "react";
import {
  Search,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Calendar,
  Clock,
  X,
  Info,
  Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { mockCalls, mockContacts } from "./mockData";
import { Call } from "./types";

type Filter = "all" | "missed" | "incoming" | "outgoing";

const CallsTab = () => {
  const [calls] = useState<Call[]>(mockCalls);
  const [filter, setFilter] = useState<Filter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showMakeCall, setShowMakeCall] = useState(false);
  const [showScheduleCall, setShowScheduleCall] = useState(false);
  const [dialNumber, setDialNumber] = useState("");
  const [scheduleContact, setScheduleContact] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleNotes, setScheduleNotes] = useState("");
  const [remindBefore, setRemindBefore] = useState(true);
  const [notifyContact, setNotifyContact] = useState(false);

  const filteredCalls = calls.filter((call) => {
    const matchesSearch =
      call.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      call.phone.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filter === "all") return matchesSearch;
    return matchesSearch && call.type === filter;
  });

  const getCallIcon = (type: Call["type"]) => {
    switch (type) {
      case "incoming":
        return <PhoneIncoming className="w-4 h-4 text-green-400" />;
      case "outgoing":
        return <PhoneOutgoing className="w-4 h-4 text-blue-400" />;
      case "missed":
        return <PhoneMissed className="w-4 h-4 text-destructive" />;
    }
  };

  const makeCall = (number: string, name?: string) => {
    toast.success(`Calling ${name || number}...`);
    setShowMakeCall(false);
    setDialNumber("");
  };

  const scheduleCall = () => {
    if (!scheduleContact || !scheduleDate || !scheduleTime) {
      toast.error("Please fill in all required fields");
      return;
    }
    toast.success(`Call scheduled for ${scheduleDate} at ${scheduleTime}`);
    setShowScheduleCall(false);
    setScheduleContact("");
    setScheduleDate("");
    setScheduleTime("");
    setScheduleNotes("");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-light text-foreground">Calls</h2>
        <div className="flex gap-2">
          <Button className="gap-2" onClick={() => setShowMakeCall(true)}>
            <Phone className="w-4 h-4" /> Make Call
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setShowScheduleCall(true)}>
            <Calendar className="w-4 h-4" /> Schedule Call
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search call history..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(["all", "missed", "incoming", "outgoing"] as Filter[]).map((f) => (
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

      {/* Calls List */}
      <div className="bg-card/50 border border-border rounded-2xl overflow-hidden">
        {filteredCalls.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No calls found</div>
        ) : (
          filteredCalls.map((call) => (
            <div
              key={call.id}
              className="flex items-center gap-4 p-4 border-b border-border last:border-b-0 hover:bg-secondary/30 transition-colors"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                call.type === "missed" ? "bg-destructive/20" : "bg-secondary"
              }`}>
                {getCallIcon(call.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">{call.contactName}</p>
                <p className="text-sm text-muted-foreground">{call.phone}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{call.timestamp}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                  <Clock className="w-3 h-3" />
                  {call.duration || "Missed"}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => makeCall(call.phone, call.contactName)}
                >
                  <Phone className="w-4 h-4" />
                </Button>
                {call.isBlocked ? (
                  <Button variant="ghost" size="icon" className="text-destructive">
                    <Ban className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button variant="ghost" size="icon">
                    <Info className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Make Call Modal */}
      {showMakeCall && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-foreground">Make a Call</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowMakeCall(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search contacts or enter number..."
                  value={dialNumber}
                  onChange={(e) => setDialNumber(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground text-lg"
                />
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Recent Contacts:</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {mockContacts.slice(0, 5).map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                          <span className="text-sm text-foreground">{contact.name.charAt(0)}</span>
                        </div>
                        <span className="text-foreground">{contact.name}</span>
                      </div>
                      <Button size="sm" onClick={() => makeCall(contact.phone, contact.name)}>
                        <Phone className="w-4 h-4 mr-1" /> Call
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setShowMakeCall(false)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => dialNumber && makeCall(dialNumber)}
                  disabled={!dialNumber}
                >
                  <Phone className="w-4 h-4 mr-2" /> Call
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Call Modal */}
      {showScheduleCall && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-foreground">Schedule a Call</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowScheduleCall(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Contact</label>
                <select
                  value={scheduleContact}
                  onChange={(e) => setScheduleContact(e.target.value)}
                  className="w-full mt-1 px-4 py-2 bg-secondary border border-border rounded-xl text-foreground"
                >
                  <option value="">Select contact...</option>
                  {mockContacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>{contact.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Date</label>
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="w-full mt-1 px-4 py-2 bg-secondary border border-border rounded-xl text-foreground"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Time</label>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full mt-1 px-4 py-2 bg-secondary border border-border rounded-xl text-foreground"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Timezone</label>
                <select className="w-full mt-1 px-4 py-2 bg-secondary border border-border rounded-xl text-foreground">
                  <option>Your Local Time</option>
                  <option>UTC</option>
                  <option>EST</option>
                  <option>PST</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={remindBefore}
                    onChange={(e) => setRemindBefore(e.target.checked)}
                  />
                  <span className="text-sm text-foreground">Remind me 15 minutes before</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyContact}
                    onChange={(e) => setNotifyContact(e.target.checked)}
                  />
                  <span className="text-sm text-foreground">Send notification to contact</span>
                </label>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Notes (optional)</label>
                <textarea
                  value={scheduleNotes}
                  onChange={(e) => setScheduleNotes(e.target.value)}
                  placeholder="Discuss project timeline..."
                  className="w-full mt-1 px-4 py-2 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground resize-none h-20"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setShowScheduleCall(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={scheduleCall}>
                  Schedule
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallsTab;