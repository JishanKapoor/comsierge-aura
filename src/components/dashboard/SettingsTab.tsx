import { useState } from "react";
import {
  User,
  Globe,
  Bell,
  Shield,
  Clock,
  HelpCircle,
  ChevronRight,
  Phone,
  Key,
  Smartphone,
  Trash2,
  Plus,
  X,
  Calendar,
  MessageSquare,
  Palette,
  Save,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { languages, mockReminders, mockContacts } from "./mockData";
import { useAuth } from "@/contexts/AuthContext";

type SettingsSection = "main" | "profile" | "language" | "notifications" | "privacy" | "reminders" | "appearance" | "support";

const SettingsTab = () => {
  const { user } = useAuth();
  const [section, setSection] = useState<SettingsSection>("main");
  
  // Profile settings
  const [name, setName] = useState(user?.name || "Demo User");
  const [phoneNumber] = useState("+1 (437) 239-2448");
  const [email, setEmail] = useState(user?.email || "user@example.com");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  
  // Language settings
  const [receiveLanguage, setReceiveLanguage] = useState("en");
  const [sendLanguage, setSendLanguage] = useState("en");
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [showOriginal, setShowOriginal] = useState(true);
  const [previewTranslation, setPreviewTranslation] = useState(true);
  
  // Notification settings
  const [sendingMode, setSendingMode] = useState<"all" | "high_medium" | "high_only" | "dnd">("all");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleFrom, setScheduleFrom] = useState("22:00");
  const [scheduleTo, setScheduleTo] = useState("07:00");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [previewEnabled, setPreviewEnabled] = useState(true);
  
  // Privacy settings
  const [priorityContacts, setPriorityContacts] = useState<string[]>(["Mom", "Boss"]);
  const [priorityKeywords, setPriorityKeywords] = useState<string[]>(["Emergency", "Urgent", "Family", "Bank"]);
  const [blockedNumbers, setBlockedNumbers] = useState<string[]>(["+1 (437) 239-2448", "+1 (437) 239-2447"]);
  const [spamKeywords, setSpamKeywords] = useState<string[]>(["car warranty", "free gift", "click here"]);
  const [newBlockedNumber, setNewBlockedNumber] = useState("");
  const [newSpamKeyword, setNewSpamKeyword] = useState("");
  
  // Reminders
  const [reminders, setReminders] = useState(mockReminders);
  const [showNewReminder, setShowNewReminder] = useState(false);
  const [reminderType, setReminderType] = useState<"personal" | "call" | "message">("personal");
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [reminderContact, setReminderContact] = useState("");

  const sendingModeOptions = [
    { value: "all", label: "Send All Messages", color: "bg-foreground/20" },
    { value: "high_medium", label: "High & Medium Priority Only", color: "bg-foreground/15" },
    { value: "high_only", label: "High Priority Only", color: "bg-foreground/10" },
    { value: "dnd", label: "Do Not Disturb", color: "bg-foreground/5" },
  ];

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

  const menuItems = [
    { id: "profile" as SettingsSection, icon: User, label: "Profile & Account", desc: "Manage your profile, phone number" },
    { id: "language" as SettingsSection, icon: Globe, label: "Language & Translation", desc: "Set message languages" },
    { id: "notifications" as SettingsSection, icon: Bell, label: "Notifications & Sending", desc: "Control when messages are sent" },
    { id: "privacy" as SettingsSection, icon: Shield, label: "Privacy & Blocking", desc: "Spam filters, blocked contacts" },
    { id: "reminders" as SettingsSection, icon: Clock, label: "Reminders & Scheduling", desc: "Manage scheduled events" },
    { id: "appearance" as SettingsSection, icon: Palette, label: "Appearance", desc: "Theme, display settings" },
    { id: "support" as SettingsSection, icon: HelpCircle, label: "Help & Support", desc: "FAQ, contact support" },
  ];

  if (section !== "main") {
    return (
      <div className="space-y-5">
        <button
          onClick={() => setSection("main")}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        {section === "profile" && (
          <div className="space-y-5">
            <h2 className="text-lg font-medium text-foreground">Profile & Account</h2>
            
            <div className="bg-card/30 border border-border/50 rounded-xl p-5 space-y-4">
              <div className="flex flex-col items-center mb-4">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-2">
                  <span className="text-2xl text-foreground">{name.charAt(0)}</span>
                </div>
                <Button variant="outline" size="sm" className="rounded-lg">Change Photo</Button>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Phone Number</label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={phoneNumber}
                    readOnly
                    className="flex-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm"
                  />
                  <Button variant="outline" size="sm" className="rounded-lg">Change</Button>
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none"
                />
              </div>

              <Button size="sm" className="rounded-lg" onClick={() => toast.success("Profile saved")}>
                Save Changes
              </Button>
            </div>

            <div className="bg-card/30 border border-border/50 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-medium text-foreground">Change Password</h3>
              <div>
                <label className="text-sm text-muted-foreground">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none"
                />
              </div>
              <Button size="sm" variant="outline" className="rounded-lg" onClick={() => {
                toast.success("Password updated");
                setCurrentPassword("");
                setNewPassword("");
              }}>Update Password</Button>
            </div>

            <div className="bg-card/30 border border-border/50 rounded-xl p-5 space-y-2">
              <h3 className="text-sm font-medium text-foreground mb-2">Account</h3>
              <button className="w-full text-left p-2.5 rounded-lg hover:bg-secondary/50 transition-colors flex items-center gap-2 text-sm">
                <Smartphone className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">Connected Devices</span>
              </button>
              <button className="w-full text-left p-2.5 rounded-lg hover:bg-secondary/50 transition-colors flex items-center gap-2 text-sm">
                <Shield className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">Two-Factor Authentication</span>
              </button>
              <button className="w-full text-left p-2.5 rounded-lg hover:bg-destructive/10 transition-colors flex items-center gap-2 text-sm text-destructive">
                <Trash2 className="w-4 h-4" />
                <span>Delete Account</span>
              </button>
            </div>
          </div>
        )}

        {section === "language" && (
          <div className="space-y-5">
            <h2 className="text-lg font-medium text-foreground">Language & Translation</h2>
            
            <div className="bg-card/30 border border-border/50 rounded-xl p-5 space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Receive Messages In</label>
                <select
                  value={receiveLanguage}
                  onChange={(e) => setReceiveLanguage(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none"
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>{lang.name}</option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={autoTranslate}
                  onChange={(e) => setAutoTranslate(e.target.checked)}
                  className="accent-foreground"
                />
                <span className="text-foreground">Auto-translate incoming messages</span>
              </label>

              {autoTranslate && (
                <label className="flex items-center gap-2 cursor-pointer ml-5 text-sm">
                  <input
                    type="checkbox"
                    checked={showOriginal}
                    onChange={(e) => setShowOriginal(e.target.checked)}
                    className="accent-foreground"
                  />
                  <span className="text-muted-foreground">Show original text</span>
                </label>
              )}

              <div>
                <label className="text-sm text-muted-foreground">Send Messages In</label>
                <select
                  value={sendLanguage}
                  onChange={(e) => setSendLanguage(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none"
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>{lang.name}</option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={previewTranslation}
                  onChange={(e) => setPreviewTranslation(e.target.checked)}
                  className="accent-foreground"
                />
                <span className="text-foreground">Preview translation before sending</span>
              </label>
            </div>

            <div className="bg-card/30 border border-border/50 rounded-xl p-5">
              <h3 className="text-sm font-medium text-foreground mb-3">Saved Language Pairs</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 text-sm">
                  <span className="text-foreground">English - Spanish</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6"><X className="w-3 h-3" /></Button>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 text-sm">
                  <span className="text-foreground">English - French</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6"><X className="w-3 h-3" /></Button>
                </div>
                <Button variant="outline" size="sm" className="gap-1 rounded-lg">
                  <Plus className="w-3 h-3" /> Add Pair
                </Button>
              </div>
            </div>

            <Button size="sm" className="rounded-lg" onClick={() => toast.success("Settings saved")}>
              Save Changes
            </Button>
          </div>
        )}

        {section === "notifications" && (
          <div className="space-y-5">
            <h2 className="text-lg font-medium text-foreground">Notifications & Sending</h2>
            
            <div className="bg-card/30 border border-border/50 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-medium text-foreground">Sending Mode</h3>
              <div className="space-y-1">
                {sendingModeOptions.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-secondary/30 cursor-pointer">
                    <input
                      type="radio"
                      name="sendingMode"
                      checked={sendingMode === opt.value}
                      onChange={() => setSendingMode(opt.value as typeof sendingMode)}
                      className="accent-foreground"
                    />
                    <span className="text-sm text-foreground">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-card/30 border border-border/50 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-medium text-foreground">Schedule Do Not Disturb</h3>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={scheduleEnabled}
                  onChange={(e) => setScheduleEnabled(e.target.checked)}
                  className="accent-foreground"
                />
                <span className="text-foreground">Enable scheduled DND</span>
              </label>
              {scheduleEnabled && (
                <div className="grid grid-cols-2 gap-3 ml-5">
                  <div>
                    <label className="text-xs text-muted-foreground">From</label>
                    <input
                      type="time"
                      value={scheduleFrom}
                      onChange={(e) => setScheduleFrom(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Until</label>
                    <input
                      type="time"
                      value={scheduleTo}
                      onChange={(e) => setScheduleTo(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="bg-card/30 border border-border/50 rounded-xl p-5 space-y-2">
              <h3 className="text-sm font-medium text-foreground mb-2">Notifications</h3>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={soundEnabled} onChange={(e) => setSoundEnabled(e.target.checked)} className="accent-foreground" />
                <span className="text-foreground">Sound</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={vibrationEnabled} onChange={(e) => setVibrationEnabled(e.target.checked)} className="accent-foreground" />
                <span className="text-foreground">Vibration</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={previewEnabled} onChange={(e) => setPreviewEnabled(e.target.checked)} className="accent-foreground" />
                <span className="text-foreground">Show message preview</span>
              </label>
            </div>

            <Button size="sm" className="rounded-lg" onClick={() => toast.success("Settings saved")}>
              Save Changes
            </Button>
          </div>
        )}

        {section === "privacy" && (
          <div className="space-y-5">
            <h2 className="text-lg font-medium text-foreground">Priority & Spam Rules</h2>
            
            <div className="bg-card/30 border border-border/50 rounded-xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-medium text-foreground">High Priority Rules</h3>
                <p className="text-xs text-muted-foreground mt-0.5">These bypass Do Not Disturb</p>
              </div>
              
              <div>
                <label className="text-xs text-muted-foreground">Priority Contacts</label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {priorityContacts.map((contact) => (
                    <span key={contact} className="px-2 py-1 rounded-md bg-secondary/50 text-foreground text-xs flex items-center gap-1">
                      {contact}
                      <button onClick={() => setPriorityContacts(priorityContacts.filter(c => c !== contact))}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <Button variant="outline" size="sm" className="h-6 text-xs rounded-md" onClick={() => {
                    const newContact = prompt("Enter contact name:");
                    if (newContact) setPriorityContacts([...priorityContacts, newContact]);
                  }}>+ Add</Button>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Priority Keywords</label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {priorityKeywords.map((keyword) => (
                    <span key={keyword} className="px-2 py-1 rounded-md bg-secondary/30 text-foreground text-xs flex items-center gap-1">
                      {keyword}
                      <button onClick={() => setPriorityKeywords(priorityKeywords.filter(k => k !== keyword))}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <Button variant="outline" size="sm" className="h-6 text-xs rounded-md" onClick={() => {
                    const newKeyword = prompt("Enter keyword:");
                    if (newKeyword) setPriorityKeywords([...priorityKeywords, newKeyword]);
                  }}>+ Add</Button>
                </div>
              </div>
            </div>

            <div className="bg-card/30 border border-border/50 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-medium text-foreground">Spam & Block Rules</h3>
              
              <div>
                <label className="text-xs text-muted-foreground">Blocked Numbers</label>
                <div className="space-y-1.5 mt-1.5">
                  {blockedNumbers.map((number) => (
                    <div key={number} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 text-sm">
                      <span className="text-foreground">{number}</span>
                      <button onClick={() => setBlockedNumbers(blockedNumbers.filter(n => n !== number))}>
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newBlockedNumber}
                      onChange={(e) => setNewBlockedNumber(e.target.value)}
                      placeholder="Enter number..."
                      className="flex-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none"
                    />
                    <Button size="sm" className="rounded-lg" onClick={() => {
                      if (newBlockedNumber) {
                        setBlockedNumbers([...blockedNumbers, newBlockedNumber]);
                        setNewBlockedNumber("");
                      }
                    }}>Block</Button>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Spam Keywords</label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {spamKeywords.map((keyword) => (
                    <span key={keyword} className="px-2 py-1 rounded-md bg-destructive/10 text-destructive text-xs flex items-center gap-1">
                      {keyword}
                      <button onClick={() => setSpamKeywords(spamKeywords.filter(k => k !== keyword))}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={newSpamKeyword}
                    onChange={(e) => setNewSpamKeyword(e.target.value)}
                    placeholder="Add keyword..."
                    className="flex-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none"
                  />
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => {
                    if (newSpamKeyword) {
                      setSpamKeywords([...spamKeywords, newSpamKeyword]);
                      setNewSpamKeyword("");
                    }
                  }}>Add</Button>
                </div>
              </div>
            </div>

            <Button size="sm" className="rounded-lg" onClick={() => toast.success("Settings saved")}>
              Save Changes
            </Button>
          </div>
        )}

        {section === "reminders" && (
          <div className="space-y-5">
            <h2 className="text-lg font-medium text-foreground">Reminders & Scheduling</h2>
            
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

            <div className="bg-card/30 border border-border/50 rounded-xl p-5">
              <h3 className="text-sm font-medium text-foreground mb-3">Upcoming</h3>
              {reminders.filter(r => !r.isCompleted).length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming reminders</p>
              ) : (
                <div className="space-y-2">
                  {reminders.filter(r => !r.isCompleted).map((reminder) => (
                    <div key={reminder.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                      <div>
                        <p className="text-sm text-foreground">{reminder.title}</p>
                        <p className="text-xs text-muted-foreground">{reminder.datetime}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                          setReminders(reminders.map(r => r.id === reminder.id ? { ...r, isCompleted: true } : r));
                          toast.success("Completed");
                        }}>
                          <Clock className="w-3.5 h-3.5" />
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

            {showNewReminder && (
              <div className="bg-card/30 border border-border/50 rounded-xl p-5 space-y-4">
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
          </div>
        )}

        {section === "appearance" && (
          <div className="space-y-5">
            <h2 className="text-lg font-medium text-foreground">Appearance</h2>
            <div className="bg-card/30 border border-border/50 rounded-xl p-5 space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Theme</label>
                <div className="flex gap-2 mt-2">
                  <button className="flex-1 p-3 rounded-lg bg-foreground text-background text-sm font-medium">Dark</button>
                  <button className="flex-1 p-3 rounded-lg bg-secondary/50 text-muted-foreground text-sm">Light</button>
                  <button className="flex-1 p-3 rounded-lg bg-secondary/50 text-muted-foreground text-sm">System</button>
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Font Size</label>
                <div className="flex gap-2 mt-2">
                  <button className="flex-1 p-2 rounded-lg bg-secondary/50 text-muted-foreground text-xs">Small</button>
                  <button className="flex-1 p-2 rounded-lg bg-foreground text-background text-sm font-medium">Medium</button>
                  <button className="flex-1 p-2 rounded-lg bg-secondary/50 text-muted-foreground text-base">Large</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {section === "support" && (
          <div className="space-y-5">
            <h2 className="text-lg font-medium text-foreground">Help & Support</h2>
            <div className="bg-card/30 border border-border/50 rounded-xl p-5 space-y-2">
              <button className="w-full text-left p-3 rounded-lg hover:bg-secondary/50 transition-colors text-sm text-foreground">
                FAQ
              </button>
              <button className="w-full text-left p-3 rounded-lg hover:bg-secondary/50 transition-colors text-sm text-foreground">
                Contact Support
              </button>
              <button className="w-full text-left p-3 rounded-lg hover:bg-secondary/50 transition-colors text-sm text-foreground">
                Report a Problem
              </button>
              <button className="w-full text-left p-3 rounded-lg hover:bg-secondary/50 transition-colors text-sm text-foreground">
                Privacy Policy
              </button>
              <button className="w-full text-left p-3 rounded-lg hover:bg-secondary/50 transition-colors text-sm text-foreground">
                Terms of Service
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-medium text-foreground">Settings</h2>
      
      <div className="bg-card/30 border border-border/50 rounded-xl overflow-hidden">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setSection(item.id)}
            className="w-full flex items-center gap-3 p-4 border-b border-border/30 last:border-b-0 hover:bg-secondary/20 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0">
              <item.icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default SettingsTab;
