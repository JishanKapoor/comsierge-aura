import { useState } from "react";
import {
  User,
  Globe,
  Bell,
  Shield,
  Phone,
  Key,
  Smartphone,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Forward,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { languages } from "./mockData";
import { useAuth } from "@/contexts/AuthContext";

type SettingsSection = "main" | "profile" | "language" | "notifications" | "privacy" | "offline";

const SettingsTab = () => {
  const { user } = useAuth();
  const [section, setSection] = useState<SettingsSection>("main");
  
  // Profile settings
  const [name, setName] = useState(user?.name || "Demo User");
  const [phoneNumber] = useState("+1 (437) 239-2448");
  const [email, setEmail] = useState(user?.email || "user@example.com");
  
  // Language settings
  const [receiveLanguage, setReceiveLanguage] = useState("en");
  const [sendLanguage, setSendLanguage] = useState("en");
  const [autoTranslate, setAutoTranslate] = useState(true);
  
  // Notification settings
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  
  // Privacy settings
  const [spamProtection, setSpamProtection] = useState(true);
  
  // Offline routing
  const [offlineForwardEnabled, setOfflineForwardEnabled] = useState(false);
  const [offlineForwardNumber, setOfflineForwardNumber] = useState("");
  const [offlineForwardPriority, setOfflineForwardPriority] = useState<"all" | "urgent" | "high">("urgent");

  const menuItems = [
    { id: "profile" as SettingsSection, icon: User, label: "Profile & Account", desc: "Manage your profile" },
    { id: "language" as SettingsSection, icon: Globe, label: "Language", desc: "Translation settings" },
    { id: "notifications" as SettingsSection, icon: Bell, label: "Notifications", desc: "Sound & alerts" },
    { id: "privacy" as SettingsSection, icon: Shield, label: "Spam Protection", desc: "Block unwanted messages" },
    { id: "offline" as SettingsSection, icon: Forward, label: "Offline Routing", desc: "Forward when offline" },
  ];

  if (section !== "main") {
    return (
      <div className="space-y-5 max-w-lg">
        <button
          onClick={() => setSection("main")}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        {section === "profile" && (
          <div className="space-y-5">
            <h2 className="text-lg font-medium text-foreground">Profile & Account</h2>
            
            <div className="bg-card/30 border border-border/50 rounded-xl p-5 space-y-4">
              <div className="flex flex-col items-center mb-4">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-2">
                  <span className="text-2xl text-foreground">{name.charAt(0)}</span>
                </div>
                <Button variant="outline" size="sm">Change Photo</Button>
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
                <input
                  type="text"
                  value={phoneNumber}
                  readOnly
                  className="w-full mt-1 px-3 py-2 bg-secondary/30 border border-border/50 rounded-lg text-foreground text-sm"
                />
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

              <Button size="sm" onClick={() => toast.success("Profile saved")}>Save Changes</Button>
            </div>

            <div className="bg-card/30 border border-border/50 rounded-xl p-5 space-y-2">
              <h3 className="text-sm font-medium text-foreground mb-2">Account</h3>
              <button className="w-full text-left p-2.5 rounded-lg hover:bg-secondary/50 transition-colors flex items-center gap-2 text-sm">
                <Smartphone className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">Connected Devices</span>
              </button>
              <button className="w-full text-left p-2.5 rounded-lg hover:bg-secondary/50 transition-colors flex items-center gap-2 text-sm">
                <Key className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">Change Password</span>
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
            <h2 className="text-lg font-medium text-foreground">Language</h2>
            
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

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-foreground">Auto-translate messages</span>
                <button
                  onClick={() => setAutoTranslate(!autoTranslate)}
                  className={cn(
                    "w-10 h-5 rounded-full transition-colors relative",
                    autoTranslate ? "bg-emerald-500" : "bg-secondary"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                    autoTranslate ? "left-5" : "left-0.5"
                  )} />
                </button>
              </label>
            </div>

            <Button size="sm" onClick={() => toast.success("Language settings saved")}>Save Changes</Button>
          </div>
        )}

        {section === "notifications" && (
          <div className="space-y-5">
            <h2 className="text-lg font-medium text-foreground">Notifications</h2>
            
            <div className="bg-card/30 border border-border/50 rounded-xl p-5 space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-foreground">Sound</span>
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={cn(
                    "w-10 h-5 rounded-full transition-colors relative",
                    soundEnabled ? "bg-emerald-500" : "bg-secondary"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                    soundEnabled ? "left-5" : "left-0.5"
                  )} />
                </button>
              </label>
              
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-foreground">Vibration</span>
                <button
                  onClick={() => setVibrationEnabled(!vibrationEnabled)}
                  className={cn(
                    "w-10 h-5 rounded-full transition-colors relative",
                    vibrationEnabled ? "bg-emerald-500" : "bg-secondary"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                    vibrationEnabled ? "left-5" : "left-0.5"
                  )} />
                </button>
              </label>
            </div>

            <Button size="sm" onClick={() => toast.success("Notification settings saved")}>Save Changes</Button>
          </div>
        )}

        {section === "privacy" && (
          <div className="space-y-5">
            <h2 className="text-lg font-medium text-foreground">Spam Protection</h2>
            
            <div className="bg-card/30 border border-border/50 rounded-xl p-5 space-y-4">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-sm text-foreground block">Enable Spam Protection</span>
                  <span className="text-xs text-muted-foreground">Automatically filter suspicious messages</span>
                </div>
                <button
                  onClick={() => setSpamProtection(!spamProtection)}
                  className={cn(
                    "w-10 h-5 rounded-full transition-colors relative shrink-0",
                    spamProtection ? "bg-emerald-500" : "bg-secondary"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                    spamProtection ? "left-5" : "left-0.5"
                  )} />
                </button>
              </label>

              {spamProtection && (
                <p className="text-xs text-muted-foreground p-3 bg-secondary/30 rounded-lg">
                  Messages containing spam keywords will be automatically moved to blocked folder. 
                  Configure priority routing rules in the Routing section.
                </p>
              )}
            </div>
          </div>
        )}

        {section === "offline" && (
          <div className="space-y-5">
            <h2 className="text-lg font-medium text-foreground">Offline Routing</h2>
            <p className="text-sm text-muted-foreground">Forward messages to your phone when the app is offline or disconnected.</p>
            
            <div className="bg-card/30 border border-border/50 rounded-xl p-5 space-y-4">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-sm text-foreground block">Enable Offline Forwarding</span>
                  <span className="text-xs text-muted-foreground">Forward to your phone when offline</span>
                </div>
                <button
                  onClick={() => setOfflineForwardEnabled(!offlineForwardEnabled)}
                  className={cn(
                    "w-10 h-5 rounded-full transition-colors relative shrink-0",
                    offlineForwardEnabled ? "bg-emerald-500" : "bg-secondary"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                    offlineForwardEnabled ? "left-5" : "left-0.5"
                  )} />
                </button>
              </label>

              {offlineForwardEnabled && (
                <>
                  <div>
                    <label className="text-sm text-muted-foreground">Forward to Number</label>
                    <input
                      type="tel"
                      value={offlineForwardNumber}
                      onChange={(e) => setOfflineForwardNumber(e.target.value)}
                      placeholder="+1 (555) 123-4567"
                      className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-muted-foreground block mb-2">Forward Priority</label>
                    <div className="flex gap-2">
                      {(["all", "urgent", "high"] as const).map((priority) => (
                        <button
                          key={priority}
                          onClick={() => setOfflineForwardPriority(priority)}
                          className={cn(
                            "flex-1 py-2 rounded-lg text-sm transition-colors capitalize",
                            offlineForwardPriority === priority
                              ? "bg-foreground text-background"
                              : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {priority}
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground p-3 bg-secondary/30 rounded-lg">
                    When offline, messages matching the selected priority will be forwarded via SMS to your phone number.
                  </p>
                </>
              )}
            </div>

            <Button size="sm" onClick={() => toast.success("Offline routing settings saved")}>Save Changes</Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-lg">
      <h2 className="text-lg font-medium text-foreground">Settings</h2>
      
      <div className="bg-card/30 border border-border/50 rounded-xl overflow-hidden">
        {menuItems.map((item, index) => (
          <button
            key={item.id}
            onClick={() => setSection(item.id)}
            className={cn(
              "w-full flex items-center gap-3 p-4 hover:bg-secondary/30 transition-colors text-left",
              index !== menuItems.length - 1 && "border-b border-border/30"
            )}
          >
            <div className="w-9 h-9 rounded-lg bg-secondary/50 flex items-center justify-center">
              <item.icon className="w-4 h-4 text-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default SettingsTab;
