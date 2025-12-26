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
        return <PhoneIncoming className="w-4 h-4 text-emerald-400" />;
      case "outgoing":
        return <PhoneOutgoing className="w-4 h-4 text-blue-400" />;
      case "missed":
        return <PhoneMissed className="w-4 h-4 text-destructive" />;
    }
  };

  const getCallBgClass = (type: Call["type"]) => {
    switch (type) {
      case "incoming":
        return "bg-emerald-500/10";
      case "outgoing":
        return "bg-blue-500/10";
      case "missed":
        return "bg-destructive/10";
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="dashboard-section-title">Calls</h2>
        <div className="flex gap-2">
          <Button 
            className="gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90" 
            onClick={() => setShowMakeCall(true)}
          >
            <Phone className="w-4 h-4" /> Make Call
          </Button>
          <Button variant="outline" className="gap-2 rounded-xl" onClick={() => setShowScheduleCall(true)}>
            <Calendar className="w-4 h-4" /> Schedule
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search call history..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="dashboard-input pl-11"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "missed", "incoming", "outgoing"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`dashboard-filter-btn capitalize ${
              filter === f ? "dashboard-filter-btn-active" : "dashboard-filter-btn-inactive"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Calls List */}
      <div className="dashboard-card overflow-hidden">
        {filteredCalls.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Phone className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No calls found</p>
          </div>
        ) : (
          filteredCalls.map((call) => (
            <div key={call.id} className="dashboard-list-item">
              <div className={`dashboard-avatar w-12 h-12 ${getCallBgClass(call.type)} shrink-0`}>
                {getCallIcon(call.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{call.contactName}</p>
                <p className="text-sm text-muted-foreground truncate">{call.phone}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm text-muted-foreground">{call.timestamp}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end mt-1">
                  <Clock className="w-3 h-3" />
                  {call.duration || "Missed"}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-xl"
                  onClick={() => makeCall(call.phone, call.contactName)}
                >
                  <Phone className="w-4 h-4" />
                </Button>
                {call.isBlocked ? (
                  <Button variant="ghost" size="icon" className="rounded-xl text-destructive">
                    <Ban className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button variant="ghost" size="icon" className="rounded-xl">
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
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="dashboard-card w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="dashboard-section-title">Make a Call</h3>
              <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setShowMakeCall(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="space-y-5">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search contacts or enter number..."
                  value={dialNumber}
                  onChange={(e) => setDialNumber(e.target.value)}
                  className="dashboard-input pl-11 text-lg"
                />
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-3">Recent Contacts:</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {mockContacts.slice(0, 5).map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between p-3 rounded-xl hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="dashboard-avatar w-10 h-10 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400">
                          {contact.name.charAt(0)}
                        </div>
                        <span className="text-foreground font-medium">{contact.name}</span>
                      </div>
                      <Button 
                        size="sm" 
                        className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90"
                        onClick={() => makeCall(contact.phone, contact.name)}
                      >
                        <Phone className="w-4 h-4 mr-1" /> Call
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowMakeCall(false)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90"
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
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="dashboard-card w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="dashboard-section-title">Schedule a Call</h3>
              <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setShowScheduleCall(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="text-sm text-muted-foreground">Contact</label>
                <select
                  value={scheduleContact}
                  onChange={(e) => setScheduleContact(e.target.value)}
                  className="dashboard-input mt-1.5"
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
                    className="dashboard-input mt-1.5"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Time</label>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="dashboard-input mt-1.5"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Timezone</label>
                <select className="dashboard-input mt-1.5">
                  <option>Your Local Time</option>
                  <option>UTC</option>
                  <option>EST</option>
                  <option>PST</option>
                </select>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-secondary/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={remindBefore}
                    onChange={(e) => setRemindBefore(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 rounded"
                  />
                  <span className="text-sm text-foreground">Remind me 15 minutes before</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-secondary/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={notifyContact}
                    onChange={(e) => setNotifyContact(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 rounded"
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
                  className="dashboard-input mt-1.5 resize-none h-20"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowScheduleCall(false)}>
                  Cancel
                </Button>
                <Button 
                  className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90" 
                  onClick={scheduleCall}
                >
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
