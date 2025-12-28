import { useState } from "react";
import {
  Clock,
  Plus,
  X,
  Phone,
  MessageSquare,
  CheckCircle2,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { mockReminders, mockContacts } from "./mockData";

type ReminderType = "personal" | "call" | "message";

const RemindersTab = () => {
  const [reminders, setReminders] = useState(mockReminders);
  const [showNewReminder, setShowNewReminder] = useState(false);
  const [reminderType, setReminderType] = useState<ReminderType>("personal");
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [reminderContact, setReminderContact] = useState("");
  const [showContactDropdown, setShowContactDropdown] = useState(false);

  const saveReminder = () => {
    if (!reminderTitle || !reminderDate || !reminderTime) {
      toast.error("Please fill in all fields");
      return;
    }
    const newReminder = {
      id: `new-${Date.now()}`,
      type: reminderType,
      title: reminderTitle,
      datetime: `${reminderDate}, ${reminderTime}`,
      contactId: reminderContact || undefined,
      contactName: mockContacts.find(c => c.id === reminderContact)?.name,
      isCompleted: false,
    };
    setReminders([...reminders, newReminder]);
    setShowNewReminder(false);
    setReminderTitle("");
    setReminderDate("");
    setReminderTime("");
    setReminderContact("");
    toast.success("Reminder created");
  };

  const upcomingReminders = reminders.filter(r => !r.isCompleted);
  const completedReminders = reminders.filter(r => r.isCompleted);

  const selectedContactName = mockContacts.find(c => c.id === reminderContact)?.name;

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5 h-7 text-xs rounded bg-indigo-500 hover:bg-indigo-600 text-white" onClick={() => setShowNewReminder(true)}>
          <Plus className="w-3.5 h-3.5" /> Add
        </Button>
      </div>

      {/* AI Detection Note */}
      <div className="flex items-center gap-2 p-2.5 bg-gray-50 border border-gray-200 rounded">
        <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
        <p className="text-xs text-gray-600">AI auto-detects dates in messages. Click "Create Reminder" in any chat.</p>
      </div>

      {/* Quick Add Buttons */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => { setReminderType("call"); setShowNewReminder(true); }}
          className="flex flex-col items-center gap-1.5 p-3 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors"
        >
          <Phone className="w-4 h-4 text-gray-500" />
          <span className="text-xs text-gray-700">Call</span>
        </button>
        <button
          onClick={() => { setReminderType("message"); setShowNewReminder(true); }}
          className="flex flex-col items-center gap-1.5 p-3 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors"
        >
          <MessageSquare className="w-4 h-4 text-gray-500" />
          <span className="text-xs text-gray-700">Message</span>
        </button>
        <button
          onClick={() => { setReminderType("personal"); setShowNewReminder(true); }}
          className="flex flex-col items-center gap-1.5 p-3 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors"
        >
          <Clock className="w-4 h-4 text-gray-500" />
          <span className="text-xs text-gray-700">Reminder</span>
        </button>
      </div>

      {/* New Reminder Form */}
      {showNewReminder && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {(["personal", "call", "message"] as ReminderType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setReminderType(type)}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-medium transition-colors capitalize",
                    reminderType === type ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600"
                  )}
                >
                  {type === "personal" ? "Reminder" : type}
                </button>
              ))}
            </div>
            <button onClick={() => setShowNewReminder(false)} className="p-1 hover:bg-gray-100 rounded">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {(reminderType === "call" || reminderType === "message") && (
            <div className="relative">
              <label className="text-xs text-gray-500">Contact</label>
              <button
                onClick={() => setShowContactDropdown(!showContactDropdown)}
                className="w-full mt-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs text-left flex items-center justify-between"
              >
                <span className={selectedContactName ? "text-gray-700" : "text-gray-400"}>
                  {selectedContactName || "Select contact"}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              </button>
              {showContactDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowContactDropdown(false)} />
                  <div className="absolute left-0 right-0 top-full mt-1 bg-[#F9F9F9] border border-gray-200 rounded shadow-lg z-50 max-h-32 overflow-y-auto">
                    {mockContacts.map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() => { setReminderContact(contact.id); setShowContactDropdown(false); }}
                        className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
                      >
                        {contact.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500">
              {reminderType === "personal" ? "What to remember" : reminderType === "call" ? "Call about" : "Message to send"}
            </label>
            <input
              type="text"
              value={reminderTitle}
              onChange={(e) => setReminderTitle(e.target.value)}
              placeholder={reminderType === "personal" ? "e.g., Buy groceries" : "e.g., Discuss project"}
              className="w-full mt-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-gray-700 text-xs placeholder:text-gray-400 focus:outline-none focus:border-gray-300"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500">Date</label>
              <input
                type="date"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
                className="w-full mt-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-gray-700 text-xs focus:outline-none focus:border-gray-300"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Time</label>
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="w-full mt-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-gray-700 text-xs focus:outline-none focus:border-gray-300"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 h-8 text-xs border-gray-200 bg-white text-gray-700 hover:bg-gray-50" onClick={() => setShowNewReminder(false)}>Cancel</Button>
            <Button className="flex-1 h-8 text-xs bg-indigo-500 hover:bg-indigo-600 text-white" onClick={saveReminder}>Create</Button>
          </div>
        </div>
      )}

      {/* Upcoming */}
      <div className="space-y-2">
        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Upcoming</p>
        {upcomingReminders.length === 0 ? (
          <p className="text-xs text-gray-400 py-3 text-center">No upcoming reminders</p>
        ) : (
          upcomingReminders.map((reminder) => (
            <div key={reminder.id} className="flex items-center gap-2.5 p-2.5 bg-white border border-gray-200 rounded">
              <div className={cn(
                "w-7 h-7 rounded flex items-center justify-center",
                reminder.type === "call" ? "bg-gray-100" : reminder.type === "message" ? "bg-gray-100" : "bg-gray-100"
              )}>
                {reminder.type === "call" && <Phone className="w-3.5 h-3.5 text-gray-500" />}
                {reminder.type === "message" && <MessageSquare className="w-3.5 h-3.5 text-gray-500" />}
                {reminder.type === "personal" && <Clock className="w-3.5 h-3.5 text-gray-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-800 truncate">{reminder.title}</p>
                <p className="text-xs text-gray-500">{reminder.datetime}</p>
              </div>
              <div className="flex gap-0.5 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-gray-500 hover:bg-gray-100"
                  onClick={() => {
                    setReminders(reminders.map(r => r.id === reminder.id ? { ...r, isCompleted: true } : r));
                    toast.success("Done");
                  }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-gray-500 hover:bg-gray-100"
                  onClick={() => setReminders(reminders.filter(r => r.id !== reminder.id))}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Completed */}
      {completedReminders.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Completed</p>
          {completedReminders.map((reminder) => (
            <div key={reminder.id} className="flex items-center gap-2.5 p-2.5 bg-gray-50 rounded opacity-60">
              <CheckCircle2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-600 line-through truncate">{reminder.title}</p>
                <p className="text-xs text-gray-400">{reminder.datetime}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-gray-400 hover:bg-gray-100 shrink-0"
                onClick={() => setReminders(reminders.filter(r => r.id !== reminder.id))}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RemindersTab;
