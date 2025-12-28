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
      <div className="space-y-4">
        <button
          onClick={() => setSection("main")}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back
        </button>

        {section === "profile" && (
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-gray-800">Profile & Account</h2>
            
            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex flex-col items-center mb-3">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                  <span className="text-lg text-gray-700">{name.charAt(0)}</span>
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs border-gray-200 bg-white text-gray-700 hover:bg-gray-50">Change Photo</Button>
              </div>

              <div>
                <label className="text-xs text-gray-500">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-gray-700 text-xs focus:outline-none focus:border-gray-300"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500">Phone Number</label>
                <input
                  type="text"
                  value={phoneNumber}
                  readOnly
                  className="w-full mt-1 px-3 py-1.5 bg-gray-100 border border-gray-200 rounded text-gray-600 text-xs"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-gray-700 text-xs focus:outline-none focus:border-gray-300"
                />
              </div>

              <Button size="sm" className="h-7 text-xs bg-indigo-500 hover:bg-indigo-600 text-white" onClick={() => toast.success("Profile saved")}>Save Changes</Button>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-1">
              <h3 className="text-xs font-medium text-gray-800 mb-2">Account</h3>
              <button className="w-full text-left p-2 rounded hover:bg-gray-50 transition-colors flex items-center gap-2 text-xs">
                <Smartphone className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-gray-700">Connected Devices</span>
              </button>
              <button className="w-full text-left p-2 rounded hover:bg-gray-50 transition-colors flex items-center gap-2 text-xs">
                <Key className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-gray-700">Change Password</span>
              </button>
              <button className="w-full text-left p-2 rounded hover:bg-gray-50 transition-colors flex items-center gap-2 text-xs text-gray-400">
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Account</span>
              </button>
            </div>
          </div>
        )}

        {section === "language" && (
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-gray-800">Language</h2>
            
            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              <div>
                <label className="text-xs text-gray-500">Receive Messages In</label>
                <select
                  value={receiveLanguage}
                  onChange={(e) => setReceiveLanguage(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-gray-700 text-xs focus:outline-none focus:border-gray-300"
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>{lang.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-500">Send Messages In</label>
                <select
                  value={sendLanguage}
                  onChange={(e) => setSendLanguage(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-gray-700 text-xs focus:outline-none focus:border-gray-300"
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>{lang.name}</option>
                  ))}
                </select>
              </div>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs text-gray-700">Auto-translate messages</span>
                <button
                  onClick={() => setAutoTranslate(!autoTranslate)}
                  className={cn(
                    "w-8 h-4 rounded-full transition-colors relative",
                    autoTranslate ? "bg-indigo-500" : "bg-gray-300"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform",
                    autoTranslate ? "left-4" : "left-0.5"
                  )} />
                </button>
              </label>
            </div>

            <Button size="sm" className="h-7 text-xs bg-indigo-500 hover:bg-indigo-600 text-white" onClick={() => toast.success("Language settings saved")}>Save Changes</Button>
          </div>
        )}

        {section === "notifications" && (
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-gray-800">Notifications</h2>
            
            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs text-gray-700">Sound</span>
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={cn(
                    "w-8 h-4 rounded-full transition-colors relative",
                    soundEnabled ? "bg-indigo-500" : "bg-gray-300"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform",
                    soundEnabled ? "left-4" : "left-0.5"
                  )} />
                </button>
              </label>
              
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs text-gray-700">Vibration</span>
                <button
                  onClick={() => setVibrationEnabled(!vibrationEnabled)}
                  className={cn(
                    "w-8 h-4 rounded-full transition-colors relative",
                    vibrationEnabled ? "bg-indigo-500" : "bg-gray-300"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform",
                    vibrationEnabled ? "left-4" : "left-0.5"
                  )} />
                </button>
              </label>
            </div>

            <Button size="sm" className="h-7 text-xs bg-indigo-500 hover:bg-indigo-600 text-white" onClick={() => toast.success("Notification settings saved")}>Save Changes</Button>
          </div>
        )}

        {section === "privacy" && (
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-gray-800">Spam Protection</h2>
            
            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-xs text-gray-700 block">Enable Spam Protection</span>
                  <span className="text-xs text-gray-500">Automatically filter suspicious messages</span>
                </div>
                <button
                  onClick={() => setSpamProtection(!spamProtection)}
                  className={cn(
                    "w-8 h-4 rounded-full transition-colors relative shrink-0",
                    spamProtection ? "bg-indigo-500" : "bg-gray-300"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform",
                    spamProtection ? "left-4" : "left-0.5"
                  )} />
                </button>
              </label>

              {spamProtection && (
                <p className="text-xs text-gray-500 p-2.5 bg-gray-50 rounded">
                  Messages containing spam keywords will be automatically moved to blocked folder. 
                  Configure priority routing rules in the Routing section.
                </p>
              )}
            </div>
          </div>
        )}

        {section === "offline" && (
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-gray-800">Offline Routing</h2>
            <p className="text-xs text-gray-500">Forward messages to your phone when the app is offline or disconnected.</p>
            
            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-xs text-gray-700 block">Enable Offline Forwarding</span>
                  <span className="text-xs text-gray-500">Forward to your phone when offline</span>
                </div>
                <button
                  onClick={() => setOfflineForwardEnabled(!offlineForwardEnabled)}
                  className={cn(
                    "w-8 h-4 rounded-full transition-colors relative shrink-0",
                    offlineForwardEnabled ? "bg-indigo-500" : "bg-gray-300"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform",
                    offlineForwardEnabled ? "left-4" : "left-0.5"
                  )} />
                </button>
              </label>

              {offlineForwardEnabled && (
                <>
                  <div>
                    <label className="text-xs text-gray-500">Forward to Number</label>
                    <input
                      type="tel"
                      value={offlineForwardNumber}
                      onChange={(e) => setOfflineForwardNumber(e.target.value)}
                      placeholder="+1 (555) 123-4567"
                      className="w-full mt-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-gray-700 text-xs placeholder:text-gray-400 focus:outline-none focus:border-gray-300"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 block mb-1.5">Forward Priority</label>
                    <div className="flex gap-1.5">
                      {(["all", "urgent", "high"] as const).map((priority) => (
                        <button
                          key={priority}
                          onClick={() => setOfflineForwardPriority(priority)}
                          className={cn(
                            "flex-1 py-1.5 rounded text-xs font-medium transition-colors capitalize",
                            offlineForwardPriority === priority
                              ? "bg-gray-800 text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          )}
                        >
                          {priority}
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 p-2.5 bg-gray-50 rounded">
                    When offline, messages matching the selected priority will be forwarded via SMS to your phone number.
                  </p>
                </>
              )}
            </div>

            <Button size="sm" className="h-7 text-xs bg-indigo-500 hover:bg-indigo-600 text-white" onClick={() => toast.success("Offline routing settings saved")}>Save Changes</Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {menuItems.map((item, index) => (
          <button
            key={item.id}
            onClick={() => setSection(item.id)}
            className={cn(
              "w-full flex items-center gap-2.5 p-3 hover:bg-gray-50 transition-colors text-left",
              index !== menuItems.length - 1 && "border-b border-gray-100"
            )}
          >
            <div className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center">
              <item.icon className="w-3.5 h-3.5 text-gray-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800">{item.label}</p>
              <p className="text-xs text-gray-500">{item.desc}</p>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default SettingsTab;
