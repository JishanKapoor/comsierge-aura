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
    { value: "all", label: "Send All Messages", icon: "🟢" },
    { value: "high_medium", label: "High & Medium Priority Only", icon: "🟡" },
    { value: "high_only", label: "High Priority Only", icon: "🟠" },
    { value: "dnd", label: "Do Not Disturb (None)", icon: "🔴" },
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
    toast.success("Reminder created!");
  };

  const menuItems = [
    { id: "profile" as SettingsSection, icon: User, label: "Profile & Account", desc: "Manage your profile, phone number" },
    { id: "language" as SettingsSection, icon: Globe, label: "Language & Translation", desc: "Set message languages" },
    { id: "notifications" as SettingsSection, icon: Bell, label: "Notifications & Sending Rules", desc: "Control when messages are sent" },
    { id: "privacy" as SettingsSection, icon: Shield, label: "Privacy & Blocking", desc: "Spam filters, blocked contacts" },
    { id: "reminders" as SettingsSection, icon: Clock, label: "Reminders & Scheduling", desc: "Manage scheduled calls & reminders" },
    { id: "appearance" as SettingsSection, icon: Palette, label: "Appearance", desc: "Theme, font size, display" },
    { id: "support" as SettingsSection, icon: HelpCircle, label: "Help & Support", desc: "FAQ, contact support" },
  ];

  if (section !== "main") {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSection("main")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Back to Settings
        </button>

        {section === "profile" && (
          <div className="space-y-6">
            <h2 className="text-xl font-light text-foreground">Profile & Account</h2>
            
            <div className="bg-card/50 border border-border rounded-2xl p-6 space-y-4">
              <div className="flex flex-col items-center mb-6">
                <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-2">
                  <span className="text-3xl text-foreground">{name.charAt(0)}</span>
                </div>
                <Button variant="outline" size="sm">Change Photo</Button>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Your Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full mt-1 px-4 py-2 bg-background border border-border rounded-xl text-foreground"
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Your Phone Number</label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={phoneNumber}
                    readOnly
                    className="flex-1 px-4 py-2 bg-background border border-border rounded-xl text-foreground"
                  />
                  <Button variant="outline" size="sm">Change</Button>
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full mt-1 px-4 py-2 bg-background border border-border rounded-xl text-foreground"
                />
              </div>

              <Button onClick={() => toast.success("Profile saved!")}>
                <Save className="w-4 h-4 mr-2" /> Save Changes
              </Button>
            </div>

            <div className="bg-card/50 border border-border rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Key className="w-5 h-5 text-muted-foreground" />
                <h3 className="font-medium text-foreground">Change Password</h3>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full mt-1 px-4 py-2 bg-background border border-border rounded-xl text-foreground"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full mt-1 px-4 py-2 bg-background border border-border rounded-xl text-foreground"
                />
              </div>
              <Button onClick={() => {
                toast.success("Password updated!");
                setCurrentPassword("");
                setNewPassword("");
              }}>Update Password</Button>
            </div>

            <div className="bg-card/50 border border-border rounded-2xl p-6 space-y-3">
              <h3 className="font-medium text-foreground">Account Settings</h3>
              <button className="w-full text-left p-3 rounded-xl hover:bg-secondary/50 transition-colors flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-muted-foreground" />
                <span className="text-foreground">Connected Devices</span>
              </button>
              <button className="w-full text-left p-3 rounded-xl hover:bg-secondary/50 transition-colors flex items-center gap-3">
                <Shield className="w-5 h-5 text-muted-foreground" />
                <span className="text-foreground">Two-Factor Authentication</span>
              </button>
              <button className="w-full text-left p-3 rounded-xl hover:bg-destructive/10 transition-colors flex items-center gap-3 text-destructive">
                <Trash2 className="w-5 h-5" />
                <span>Delete Account</span>
              </button>
            </div>
          </div>
        )}

        {section === "language" && (
          <div className="space-y-6">
            <h2 className="text-xl font-light text-foreground">Language & Translation</h2>
            
            <div className="bg-card/50 border border-border rounded-2xl p-6 space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">📥 Receive Messages In</label>
                <select
                  value={receiveLanguage}
                  onChange={(e) => setReceiveLanguage(e.target.value)}
                  className="w-full mt-1 px-4 py-2 bg-background border border-border rounded-xl text-foreground"
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>{lang.name}</option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoTranslate}
                  onChange={(e) => setAutoTranslate(e.target.checked)}
                />
                <span className="text-foreground">Auto-translate incoming messages</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer ml-6">
                <input
                  type="checkbox"
                  checked={showOriginal}
                  onChange={(e) => setShowOriginal(e.target.checked)}
                />
                <span className="text-muted-foreground text-sm">Show original language below</span>
              </label>

              <div>
                <label className="text-sm text-muted-foreground">📤 Send Messages In</label>
                <select
                  value={sendLanguage}
                  onChange={(e) => setSendLanguage(e.target.value)}
                  className="w-full mt-1 px-4 py-2 bg-background border border-border rounded-xl text-foreground"
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>{lang.name}</option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={previewTranslation}
                  onChange={(e) => setPreviewTranslation(e.target.checked)}
                />
                <span className="text-foreground">Show translation preview before sending</span>
              </label>
            </div>

            <div className="bg-card/50 border border-border rounded-2xl p-6">
              <h3 className="font-medium text-foreground mb-4">Saved Language Pairs</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                  <span className="text-foreground">English ↔ Spanish</span>
                  <Button variant="ghost" size="sm"><X className="w-4 h-4" /></Button>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                  <span className="text-foreground">English ↔ French</span>
                  <Button variant="ghost" size="sm"><X className="w-4 h-4" /></Button>
                </div>
                <Button variant="outline" size="sm" className="gap-2">
                  <Plus className="w-4 h-4" /> Add Language Pair
                </Button>
              </div>
            </div>

            <Button onClick={() => toast.success("Language settings saved!")}>
              <Save className="w-4 h-4 mr-2" /> Save Changes
            </Button>
          </div>
        )}

        {section === "notifications" && (
          <div className="space-y-6">
            <h2 className="text-xl font-light text-foreground">Notifications & Sending Rules</h2>
            
            <div className="bg-card/50 border border-border rounded-2xl p-6 space-y-4">
              <h3 className="font-medium text-foreground">Sending Mode</h3>
              <div className="space-y-2">
                {sendingModeOptions.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/30 cursor-pointer">
                    <input
                      type="radio"
                      name="sendingMode"
                      checked={sendingMode === opt.value}
                      onChange={() => setSendingMode(opt.value as typeof sendingMode)}
                    />
                    <span className="text-lg">{opt.icon}</span>
                    <span className="text-foreground">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-card/50 border border-border rounded-2xl p-6 space-y-4">
              <h3 className="font-medium text-foreground">Schedule Do Not Disturb</h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scheduleEnabled}
                  onChange={(e) => setScheduleEnabled(e.target.checked)}
                />
                <span className="text-foreground">Enable scheduled DND</span>
              </label>
              {scheduleEnabled && (
                <div className="grid grid-cols-2 gap-4 ml-6">
                  <div>
                    <label className="text-sm text-muted-foreground">From</label>
                    <input
                      type="time"
                      value={scheduleFrom}
                      onChange={(e) => setScheduleFrom(e.target.value)}
                      className="w-full mt-1 px-4 py-2 bg-background border border-border rounded-xl text-foreground"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Until</label>
                    <input
                      type="time"
                      value={scheduleTo}
                      onChange={(e) => setScheduleTo(e.target.value)}
                      className="w-full mt-1 px-4 py-2 bg-background border border-border rounded-xl text-foreground"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="bg-card/50 border border-border rounded-2xl p-6 space-y-3">
              <h3 className="font-medium text-foreground">Notification Settings</h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={soundEnabled} onChange={(e) => setSoundEnabled(e.target.checked)} />
                <span className="text-foreground">Sound</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={vibrationEnabled} onChange={(e) => setVibrationEnabled(e.target.checked)} />
                <span className="text-foreground">Vibration</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={previewEnabled} onChange={(e) => setPreviewEnabled(e.target.checked)} />
                <span className="text-foreground">Show message preview</span>
              </label>
            </div>

            <Button onClick={() => toast.success("Notification settings saved!")}>
              <Save className="w-4 h-4 mr-2" /> Save Changes
            </Button>
          </div>
        )}

        {section === "privacy" && (
          <div className="space-y-6">
            <h2 className="text-xl font-light text-foreground">Priority & Spam Rules</h2>
            
            <div className="bg-card/50 border border-border rounded-2xl p-6 space-y-4">
              <h3 className="font-medium text-foreground">🎯 High Priority Rules</h3>
              <p className="text-sm text-muted-foreground">These bypass Do Not Disturb</p>
              
              <div>
                <label className="text-sm text-muted-foreground">Priority Contacts</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {priorityContacts.map((contact) => (
                    <span key={contact} className="px-3 py-1 rounded-full bg-primary/20 text-primary text-sm flex items-center gap-1">
                      {contact}
                      <button onClick={() => setPriorityContacts(priorityContacts.filter(c => c !== contact))}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => {
                    const newContact = prompt("Enter contact name:");
                    if (newContact) setPriorityContacts([...priorityContacts, newContact]);
                  }}>+ Add</Button>
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Priority Keywords</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {priorityKeywords.map((keyword) => (
                    <span key={keyword} className="px-3 py-1 rounded-full bg-secondary text-foreground text-sm flex items-center gap-1">
                      {keyword}
                      <button onClick={() => setPriorityKeywords(priorityKeywords.filter(k => k !== keyword))}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => {
                    const newKeyword = prompt("Enter keyword:");
                    if (newKeyword) setPriorityKeywords([...priorityKeywords, newKeyword]);
                  }}>+ Add</Button>
                </div>
              </div>
            </div>

            <div className="bg-card/50 border border-border rounded-2xl p-6 space-y-4">
              <h3 className="font-medium text-foreground">🚫 Spam & Block Rules</h3>
              
              <div>
                <label className="text-sm text-muted-foreground">Blocked Numbers</label>
                <div className="space-y-2 mt-2">
                  {blockedNumbers.map((number) => (
                    <div key={number} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                      <span className="text-foreground">{number}</span>
                      <button onClick={() => setBlockedNumbers(blockedNumbers.filter(n => n !== number))}>
                        <X className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newBlockedNumber}
                      onChange={(e) => setNewBlockedNumber(e.target.value)}
                      placeholder="Enter number to block..."
                      className="flex-1 px-4 py-2 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground"
                    />
                    <Button onClick={() => {
                      if (newBlockedNumber) {
                        setBlockedNumbers([...blockedNumbers, newBlockedNumber]);
                        setNewBlockedNumber("");
                      }
                    }}>Block</Button>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Spam Keywords</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {spamKeywords.map((keyword) => (
                    <span key={keyword} className="px-3 py-1 rounded-full bg-destructive/20 text-destructive text-sm flex items-center gap-1">
                      "{keyword}"
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
                    placeholder="Add spam keyword..."
                    className="flex-1 px-4 py-2 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground"
                  />
                  <Button variant="outline" onClick={() => {
                    if (newSpamKeyword) {
                      setSpamKeywords([...spamKeywords, newSpamKeyword]);
                      setNewSpamKeyword("");
                    }
                  }}>Add</Button>
                </div>
              </div>
            </div>

            <Button onClick={() => toast.success("Privacy settings saved!")}>
              <Save className="w-4 h-4 mr-2" /> Save Changes
            </Button>
          </div>
        )}

        {section === "reminders" && (
          <div className="space-y-6">
            <h2 className="text-xl font-light text-foreground">Reminders & Scheduled Events</h2>
            
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => { setReminderType("personal"); setShowNewReminder(true); }}>
                <Plus className="w-4 h-4 mr-2" /> New Reminder
              </Button>
              <Button variant="outline" onClick={() => { setReminderType("call"); setShowNewReminder(true); }}>
                <Phone className="w-4 h-4 mr-2" /> Schedule Call
              </Button>
              <Button variant="outline" onClick={() => { setReminderType("message"); setShowNewReminder(true); }}>
                <MessageSquare className="w-4 h-4 mr-2" /> Schedule Message
              </Button>
            </div>

            <div className="bg-card/50 border border-border rounded-2xl p-6 space-y-4">
              <h3 className="font-medium text-foreground">Upcoming</h3>
              {reminders.filter(r => !r.isCompleted).map((reminder) => (
                <div key={reminder.id} className="flex items-start gap-4 p-3 rounded-xl bg-secondary/30">
                  <div className="text-2xl">
                    {reminder.type === "personal" && "📅"}
                    {reminder.type === "call" && "📞"}
                    {reminder.type === "message" && "💬"}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">{reminder.datetime}</p>
                    <p className="font-medium text-foreground">{reminder.title}</p>
                    {reminder.contactName && (
                      <p className="text-sm text-muted-foreground">with {reminder.contactName}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm">Edit</Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setReminders(reminders.filter(r => r.id !== reminder.id))}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {reminders.filter(r => !r.isCompleted).length === 0 && (
                <p className="text-muted-foreground text-center py-4">No upcoming reminders</p>
              )}
            </div>

            {/* New Reminder Modal */}
            {showNewReminder && (
              <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4">
                <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-foreground">
                      {reminderType === "personal" && "Create Reminder"}
                      {reminderType === "call" && "Schedule Call"}
                      {reminderType === "message" && "Schedule Message"}
                    </h3>
                    <Button variant="ghost" size="icon" onClick={() => setShowNewReminder(false)}>
                      <X className="w-5 h-5" />
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-muted-foreground">Reminder Type</label>
                      <div className="flex gap-2 mt-1">
                        {(["personal", "call", "message"] as const).map((type) => (
                          <button
                            key={type}
                            onClick={() => setReminderType(type)}
                            className={`px-3 py-1.5 rounded-full text-sm capitalize ${
                              reminderType === type
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>

                    {(reminderType === "call" || reminderType === "message") && (
                      <div>
                        <label className="text-sm text-muted-foreground">Contact</label>
                        <select
                          value={reminderContact}
                          onChange={(e) => setReminderContact(e.target.value)}
                          className="w-full mt-1 px-4 py-2 bg-background border border-border rounded-xl text-foreground"
                        >
                          <option value="">Select contact...</option>
                          {mockContacts.map((contact) => (
                            <option key={contact.id} value={contact.id}>{contact.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="text-sm text-muted-foreground">
                        {reminderType === "personal" ? "What" : reminderType === "call" ? "Call notes" : "Message to send"}
                      </label>
                      <input
                        type="text"
                        value={reminderTitle}
                        onChange={(e) => setReminderTitle(e.target.value)}
                        placeholder={reminderType === "personal" ? "I have an exam..." : "Discuss project timeline..."}
                        className="w-full mt-1 px-4 py-2 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-muted-foreground">When</label>
                        <input
                          type="date"
                          value={reminderDate}
                          onChange={(e) => setReminderDate(e.target.value)}
                          className="w-full mt-1 px-4 py-2 bg-background border border-border rounded-xl text-foreground"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground">Time</label>
                        <input
                          type="time"
                          value={reminderTime}
                          onChange={(e) => setReminderTime(e.target.value)}
                          className="w-full mt-1 px-4 py-2 bg-background border border-border rounded-xl text-foreground"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button variant="outline" className="flex-1" onClick={() => setShowNewReminder(false)}>
                        Cancel
                      </Button>
                      <Button className="flex-1" onClick={saveReminder}>
                        Create
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {section === "appearance" && (
          <div className="space-y-6">
            <h2 className="text-xl font-light text-foreground">Appearance</h2>
            <div className="bg-card/50 border border-border rounded-2xl p-6">
              <p className="text-muted-foreground">Theme customization coming soon...</p>
            </div>
          </div>
        )}

        {section === "support" && (
          <div className="space-y-6">
            <h2 className="text-xl font-light text-foreground">Help & Support</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="bg-card/50 border border-border rounded-2xl p-6">
                <HelpCircle className="w-8 h-8 text-muted-foreground mb-4" />
                <h3 className="font-medium text-foreground">Help Center</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">Browse FAQs and documentation</p>
                <Button variant="outline">Visit Help Center</Button>
              </div>
              <div className="bg-card/50 border border-border rounded-2xl p-6">
                <MessageSquare className="w-8 h-8 text-muted-foreground mb-4" />
                <h3 className="font-medium text-foreground">Contact Support</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">Get help from our team</p>
                <Button>Start Chat</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-light text-foreground">⚙️ Settings</h2>
      
      <div className="bg-card/50 border border-border rounded-2xl overflow-hidden">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setSection(item.id)}
            className="w-full flex items-center gap-4 p-4 border-b border-border last:border-b-0 hover:bg-secondary/30 transition-colors text-left"
          >
            <item.icon className="w-5 h-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="font-medium text-foreground">{item.label}</p>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default SettingsTab;