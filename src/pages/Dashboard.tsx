import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Phone,
  MessageSquare,
  Settings,
  LogOut,
  Users,
  Bot,
  User,
  Bell,
  ChevronDown,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import MessagesTab from "@/components/dashboard/MessagesTab";
import CallsTab from "@/components/dashboard/CallsTab";
import ContactsTab from "@/components/dashboard/ContactsTab";
import AITab from "@/components/dashboard/AITab";
import SettingsTab from "@/components/dashboard/SettingsTab";
import ProfileTab from "@/components/dashboard/ProfileTab";

type Tab = "messages" | "calls" | "contacts" | "ai" | "settings" | "profile";

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("messages");
  const [aiContext, setAiContext] = useState<string | undefined>();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const phoneNumber = "+1 (437) 239-2448";

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const openAI = (context?: string) => {
    setAiContext(context);
    setActiveTab("ai");
  };

  const copyPhoneNumber = () => {
    navigator.clipboard.writeText(phoneNumber);
    setCopied(true);
    toast.success("Phone number copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const navItems = [
    { id: "messages" as Tab, icon: MessageSquare, label: "Messages" },
    { id: "calls" as Tab, icon: Phone, label: "Calls" },
    { id: "contacts" as Tab, icon: Users, label: "Contacts" },
    { id: "ai" as Tab, icon: Bot, label: "AI" },
    { id: "settings" as Tab, icon: Settings, label: "Settings" },
    { id: "profile" as Tab, icon: User, label: "Profile" },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "messages":
        return <MessagesTab onOpenAI={openAI} />;
      case "calls":
        return <CallsTab />;
      case "contacts":
        return <ContactsTab />;
      case "ai":
        return <AITab initialContext={aiContext} />;
      case "settings":
        return <SettingsTab />;
      case "profile":
        return <ProfileTab onNavigate={(tab) => setActiveTab(tab as Tab)} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header - Sticky, not fixed */}
      <header className="sticky top-0 z-40 bg-gradient-to-b from-background via-background to-background/95 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2.5 text-lg font-medium tracking-tight text-foreground hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Phone className="w-4 h-4 text-white" />
            </div>
            <span className="hidden sm:inline">comsierge.</span>
          </Link>

          {/* Phone Number - Center (Desktop) */}
          <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50 border border-border/50">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-medium text-foreground">{phoneNumber}</span>
            <button
              onClick={copyPhoneNumber}
              className="p-1 rounded-md hover:bg-secondary transition-colors"
              title="Copy phone number"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </button>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <button className="relative p-2 rounded-xl hover:bg-secondary/50 transition-colors">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive" />
            </button>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1.5 pr-3 rounded-xl hover:bg-secondary/50 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-medium">
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <span className="hidden sm:inline text-sm font-medium text-foreground">
                  {user?.name || "User"}
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>

              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 w-64 bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden">
                    <div className="p-4 border-b border-border/50">
                      <p className="font-medium text-foreground">{user?.name || "Demo User"}</p>
                      <p className="text-sm text-muted-foreground">{user?.email || "user@example.com"}</p>
                      {/* Mobile Phone Display */}
                      <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-secondary/50">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-xs font-medium text-foreground">{phoneNumber}</span>
                        <button onClick={copyPhoneNumber} className="ml-auto">
                          {copied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="p-2">
                      <button
                        onClick={() => {
                          setActiveTab("profile");
                          setShowUserMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-foreground hover:bg-secondary/50 transition-colors"
                      >
                        <User className="w-4 h-4" />
                        View Profile
                      </button>
                      <button
                        onClick={() => {
                          setActiveTab("settings");
                          setShowUserMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-foreground hover:bg-secondary/50 transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                        Settings
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Log Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-24 md:pb-8">
        <div className="max-w-5xl mx-auto px-4 py-6">
          {/* Desktop Tab Navigation */}
          <div className="hidden md:flex items-center gap-1 mb-8 p-1 bg-secondary/30 rounded-2xl w-fit">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (item.id !== "ai") setAiContext(undefined);
                }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  activeTab === item.id
                    ? "bg-card text-foreground shadow-lg"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="min-h-[calc(100vh-220px)]">
            {renderContent()}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border/50 safe-area-bottom">
        <div className="flex items-center justify-around px-2 py-3">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                if (item.id !== "ai") setAiContext(undefined);
              }}
              className={`dashboard-nav-item ${
                activeTab === item.id
                  ? "dashboard-nav-item-active"
                  : "dashboard-nav-item-inactive"
              }`}
            >
              <item.icon className={`w-5 h-5 ${activeTab === item.id ? "text-emerald-400" : ""}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default Dashboard;
