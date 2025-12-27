import { useState } from "react";
import {
  Clock,
  Plus,
  X,
  Phone,
  MessageSquare,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
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
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-foreground">Reminders</h2>
        <Button size="sm" className="rounded-lg gap-1" onClick={() => setShowNewReminder(true)}>
          <Plus className="w-4 h-4" /> Add
        </Button>
      </div>

      {/* Quick Add Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => { setReminderType("call"); setShowNewReminder(true); }}
          className="flex-1 flex items-center justify-center gap-2 p-3 bg-card/30 border border-border/50 rounded-xl hover:bg-secondary/30 transition-colors"
        >
          <Phone className="w-4 h-4 text-blue-500" />
          <span className="text-sm text-foreground">Call</span>
        </button>
        <button
          onClick={() => { setReminderType("message"); setShowNewReminder(true); }}
          className="flex-1 flex items-center justify-center gap-2 p-3 bg-card/30 border border-border/50 rounded-xl hover:bg-secondary/30 transition-colors"
        >
          <MessageSquare className="w-4 h-4 text-emerald-500" />
          <span className="text-sm text-foreground">Message</span>
        </button>
        <button
          onClick={() => { setReminderType("personal"); setShowNewReminder(true); }}
          className="flex-1 flex items-center justify-center gap-2 p-3 bg-card/30 border border-border/50 rounded-xl hover:bg-secondary/30 transition-colors"
        >
          <Clock className="w-4 h-4 text-amber-500" />
          <span className="text-sm text-foreground">Reminder</span>
        </button>
      </div>

      {/* New Reminder Form */}
      {showNewReminder && (
        <div className="bg-card/50 border border-border/50 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {(["personal", "call", "message"] as ReminderType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setReminderType(type)}
                  className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                    reminderType === type ? "bg-foreground text-background" : "bg-secondary/50 text-muted-foreground"
                  }`}
                >
                  {type === "personal" ? "Reminder" : type === "call" ? "Call" : "Message"}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowNewReminder(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {(reminderType === "call" || reminderType === "message") && (
            <div className="relative">
              <label className="text-xs text-muted-foreground">Contact</label>
              <button
                onClick={() => setShowContactDropdown(!showContactDropdown)}
                className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm text-left flex items-center justify-between"
              >
                <span className={selectedContactName ? "text-foreground" : "text-muted-foreground"}>
                  {selectedContactName || "Select contact"}
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>
              {showContactDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowContactDropdown(false)} />
                  <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl z-50 max-h-32 overflow-y-auto">
                    {mockContacts.map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() => { setReminderContact(contact.id); setShowContactDropdown(false); }}
                        className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-secondary/50"
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
            <label className="text-xs text-muted-foreground">
              {reminderType === "personal" ? "What do you need to remember?" : reminderType === "call" ? "Call about..." : "Message to send"}
            </label>
            <input
              type="text"
              value={reminderTitle}
              onChange={(e) => setReminderTitle(e.target.value)}
              placeholder={reminderType === "personal" ? "e.g., Buy groceries" : "e.g., Discuss project"}
              className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Date</label>
              <input
                type="date"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Time</label>
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setShowNewReminder(false)}>
              Cancel
            </Button>
            <Button size="sm" className="rounded-lg" onClick={saveReminder}>
              Create
            </Button>
          </div>
        </div>
      )}

      {/* Upcoming */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Upcoming</p>
        {upcomingReminders.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No upcoming reminders</p>
        ) : (
          upcomingReminders.map((reminder) => (
            <div key={reminder.id} className="flex items-center gap-3 p-3 bg-card/30 border border-border/50 rounded-xl">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                reminder.type === "call" ? "bg-blue-500/15" : reminder.type === "message" ? "bg-emerald-500/15" : "bg-amber-500/15"
              }`}>
                {reminder.type === "call" && <Phone className="w-4 h-4 text-blue-500" />}
                {reminder.type === "message" && <MessageSquare className="w-4 h-4 text-emerald-500" />}
                {reminder.type === "personal" && <Clock className="w-4 h-4 text-amber-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{reminder.title}</p>
                <p className="text-xs text-muted-foreground">{reminder.datetime}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    setReminders(reminders.map(r => r.id === reminder.id ? { ...r, isCompleted: true } : r));
                    toast.success("Done");
                  }}
                >
                  <CheckCircle2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setReminders(reminders.filter(r => r.id !== reminder.id))}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Completed */}
      {completedReminders.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Completed</p>
          {completedReminders.map((reminder) => (
            <div key={reminder.id} className="flex items-center gap-3 p-3 bg-secondary/20 rounded-xl opacity-50">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground line-through truncate">{reminder.title}</p>
                <p className="text-xs text-muted-foreground">{reminder.datetime}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
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