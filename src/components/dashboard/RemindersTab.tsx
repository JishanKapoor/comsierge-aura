import { useState } from "react";
import {
  Clock,
  Plus,
  X,
  Phone,
  MessageSquare,
  Calendar,
  CheckCircle2,
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

  const saveReminder = () => {
    if (!reminderTitle || !reminderDate || !reminderTime) {
      toast.error("Please fill in all required fields");
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-foreground">Reminders & Scheduling</h2>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button size="sm" className="rounded-lg" onClick={() => { setReminderType("personal"); setShowNewReminder(true); }}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Reminder
        </Button>
        <Button size="sm" variant="outline" className="rounded-lg" onClick={() => { setReminderType("call"); setShowNewReminder(true); }}>
          <Phone className="w-3.5 h-3.5 mr-1" /> Schedule Call
        </Button>
        <Button size="sm" variant="outline" className="rounded-lg" onClick={() => { setReminderType("message"); setShowNewReminder(true); }}>
          <MessageSquare className="w-3.5 h-3.5 mr-1" /> Schedule Message
        </Button>
      </div>

      {showNewReminder && (
        <div className="bg-card/30 border border-border/50 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">
              New {reminderType === "personal" ? "Reminder" : reminderType === "call" ? "Scheduled Call" : "Scheduled Message"}
            </h3>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowNewReminder(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {(reminderType === "call" || reminderType === "message") && (
            <div>
              <label className="text-xs text-muted-foreground">Contact</label>
              <select
                value={reminderContact}
                onChange={(e) => setReminderContact(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none"
              >
                <option value="">Select contact...</option>
                {mockContacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>{contact.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground">
              {reminderType === "personal" ? "Reminder" : reminderType === "call" ? "Notes" : "Message"}
            </label>
            <input
              type="text"
              value={reminderTitle}
              onChange={(e) => setReminderTitle(e.target.value)}
              placeholder={reminderType === "personal" ? "e.g., I have an exam" : "Add notes..."}
              className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
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
            <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setShowNewReminder(false)}>
              Cancel
            </Button>
            <Button size="sm" className="rounded-lg" onClick={saveReminder}>
              Create
            </Button>
          </div>
        </div>
      )}

      <div className="bg-card/30 border border-border/50 rounded-xl p-4">
        <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4" /> Upcoming
        </h3>
        {upcomingReminders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming reminders</p>
        ) : (
          <div className="space-y-2">
            {upcomingReminders.map((reminder) => (
              <div key={reminder.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center">
                    {reminder.type === "call" && <Phone className="w-4 h-4 text-muted-foreground" />}
                    {reminder.type === "message" && <MessageSquare className="w-4 h-4 text-muted-foreground" />}
                    {reminder.type === "personal" && <Clock className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <div>
                    <p className="text-sm text-foreground">{reminder.title}</p>
                    <p className="text-xs text-muted-foreground">{reminder.datetime}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                    setReminders(reminders.map(r => r.id === reminder.id ? { ...r, isCompleted: true } : r));
                    toast.success("Completed");
                  }}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                    setReminders(reminders.filter(r => r.id !== reminder.id));
                  }}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {completedReminders.length > 0 && (
        <div className="bg-card/30 border border-border/50 rounded-xl p-4">
          <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Completed
          </h3>
          <div className="space-y-2">
            {completedReminders.map((reminder) => (
              <div key={reminder.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 opacity-60">
                <div>
                  <p className="text-sm text-foreground line-through">{reminder.title}</p>
                  <p className="text-xs text-muted-foreground">{reminder.datetime}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                  setReminders(reminders.filter(r => r.id !== reminder.id));
                }}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RemindersTab;
