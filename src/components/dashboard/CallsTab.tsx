import { useState, useEffect } from "react";
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

interface CallsTabProps {
  selectedContactPhone?: string | null;
  onClearSelection?: () => void;
}

const CallsTab = ({ selectedContactPhone, onClearSelection }: CallsTabProps) => {
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

  // Auto-open Make Call dialog when navigating from contacts
  useEffect(() => {
    if (selectedContactPhone) {
      const contact = mockContacts.find(c => c.phone === selectedContactPhone);
      setDialNumber(selectedContactPhone);
      setShowMakeCall(true);
      if (contact) {
        toast.success(`Calling ${contact.name}...`);
      }
      onClearSelection?.();
    }
  }, [selectedContactPhone]);

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
        return <PhoneIncoming className="w-3.5 h-3.5 text-gray-500" />;
      case "outgoing":
        return <PhoneOutgoing className="w-3.5 h-3.5 text-gray-500" />;
      case "missed":
        return <PhoneMissed className="w-3.5 h-3.5 text-gray-500" />;
    }
  };

  const getCallBgClass = (type: Call["type"]) => {
    switch (type) {
      case "incoming":
        return "bg-gray-100";
      case "outgoing":
        return "bg-gray-100";
      case "missed":
        return "bg-gray-100";
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
    <div className="h-full min-h-0 flex flex-col gap-3">
      {/* Actions */}
      <div className="flex justify-end">
        <Button
          size="sm"
          className="gap-1.5 rounded h-7 text-xs bg-indigo-500 hover:bg-indigo-600 text-white"
          onClick={() => setShowMakeCall(true)}
        >
          <Phone className="w-3.5 h-3.5" /> Make Call
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search call history..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-8 pl-9 pr-3 text-xs bg-gray-50 border border-gray-200 rounded focus:outline-none focus:border-gray-300 text-gray-700 placeholder:text-gray-400"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 flex-wrap">
        {(["all", "missed", "incoming", "outgoing"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2.5 py-1 text-xs rounded font-medium capitalize transition-colors ${
              filter === f ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Calls List */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex-1 min-h-0">
        {filteredCalls.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <Phone className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-xs">No calls found</p>
          </div>
        ) : (
          <div className="max-h-full overflow-y-auto">
            {filteredCalls.map((call) => (
              <div key={call.id} className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors">
                <div className={`w-8 h-8 rounded-full ${getCallBgClass(call.type)} flex items-center justify-center shrink-0`}>
                  {getCallIcon(call.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{call.contactName}</p>
                  <p className="text-xs text-gray-500 truncate">{call.phone}</p>
                </div>
                <div className="text-right shrink-0 hidden sm:block">
                  <p className="text-xs text-gray-500">{call.timestamp}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1 justify-end mt-0.5">
                    <Clock className="w-3 h-3" />
                    {call.duration || "Missed"}
                  </p>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded h-7 w-7 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                    onClick={() => makeCall(call.phone, call.contactName)}
                    aria-label="Call"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </Button>
                  {call.isBlocked ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded h-7 w-7 text-gray-400 hover:bg-gray-100"
                      onClick={() => toast("Blocked", { description: "This number is blocked" })}
                      aria-label="Blocked"
                    >
                      <Ban className="w-3.5 h-3.5" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded h-7 w-7 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                      onClick={() => toast("Call details", { description: call.phone })}
                      aria-label="Info"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Make Call Modal */}
      {showMakeCall && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-gray-200 rounded-lg shadow-lg w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-800">Make a Call</h3>
              <Button variant="ghost" size="icon" className="rounded h-7 w-7 text-gray-500 hover:bg-gray-100" onClick={() => setShowMakeCall(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search contacts or enter number..."
                  value={dialNumber}
                  onChange={(e) => setDialNumber(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 text-sm bg-gray-50 border border-gray-200 rounded focus:outline-none focus:border-gray-300 text-gray-700 placeholder:text-gray-400"
                />
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-2">Recent Contacts:</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {mockContacts.slice(0, 5).map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between p-2 rounded hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
                          {contact.name.charAt(0)}
                        </div>
                        <span className="text-xs font-medium text-gray-700">{contact.name}</span>
                      </div>
                      <Button 
                        size="sm" 
                        className="rounded h-7 text-xs bg-indigo-500 hover:bg-indigo-600 text-white"
                        onClick={() => makeCall(contact.phone, contact.name)}
                      >
                        <Phone className="w-3 h-3 mr-1" /> Call
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 rounded h-8 text-xs border-gray-200 bg-white text-gray-700 hover:bg-gray-50" onClick={() => setShowMakeCall(false)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 rounded h-8 text-xs bg-indigo-500 hover:bg-indigo-600 text-white"
                  onClick={() => dialNumber && makeCall(dialNumber)}
                  disabled={!dialNumber}
                >
                  <Phone className="w-3.5 h-3.5 mr-1.5" /> Call
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Call Modal */}
      {showScheduleCall && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-gray-200 rounded-lg shadow-lg w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-800">Schedule a Call</h3>
              <Button variant="ghost" size="icon" className="rounded h-7 w-7 text-gray-500 hover:bg-gray-100" onClick={() => setShowScheduleCall(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500">Contact</label>
                <select
                  value={scheduleContact}
                  onChange={(e) => setScheduleContact(e.target.value)}
                  className="w-full h-8 px-3 text-xs bg-gray-50 border border-gray-200 rounded focus:outline-none focus:border-gray-300 text-gray-700 mt-1"
                >
                  <option value="">Select contact...</option>
                  {mockContacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>{contact.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Date</label>
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="w-full h-8 px-3 text-xs bg-gray-50 border border-gray-200 rounded focus:outline-none focus:border-gray-300 text-gray-700 mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Time</label>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full h-8 px-3 text-xs bg-gray-50 border border-gray-200 rounded focus:outline-none focus:border-gray-300 text-gray-700 mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500">Timezone</label>
                <select className="w-full h-8 px-3 text-xs bg-gray-50 border border-gray-200 rounded focus:outline-none focus:border-gray-300 text-gray-700 mt-1">
                  <option>Your Local Time</option>
                  <option>UTC</option>
                  <option>EST</option>
                  <option>PST</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={remindBefore}
                    onChange={(e) => setRemindBefore(e.target.checked)}
                    className="w-3.5 h-3.5 accent-indigo-500 rounded"
                  />
                  <span className="text-xs text-gray-700">Remind me 15 minutes before</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={notifyContact}
                    onChange={(e) => setNotifyContact(e.target.checked)}
                    className="w-3.5 h-3.5 accent-indigo-500 rounded"
                  />
                  <span className="text-xs text-gray-700">Send notification to contact</span>
                </label>
              </div>

              <div>
                <label className="text-xs text-gray-500">Notes (optional)</label>
                <textarea
                  value={scheduleNotes}
                  onChange={(e) => setScheduleNotes(e.target.value)}
                  placeholder="Discuss project timeline..."
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded focus:outline-none focus:border-gray-300 text-gray-700 placeholder:text-gray-400 mt-1 resize-none h-16"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 rounded h-8 text-xs border-gray-200 bg-white text-gray-700 hover:bg-gray-50" onClick={() => setShowScheduleCall(false)}>
                  Cancel
                </Button>
                <Button 
                  className="flex-1 rounded h-8 text-xs bg-indigo-500 hover:bg-indigo-600 text-white" 
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
