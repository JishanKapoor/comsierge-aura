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
  ChevronDown,
  Copy,
  Check,
  Menu,
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
  const [showMobileNav, setShowMobileNav] = useState(false);

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
    toast.success("Phone number copied");
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
      {/* Header - Linear style */}
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-12 flex items-center justify-between">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 text-sm font-semibold text-foreground"
          >
            <div className="w-6 h-6 rounded bg-foreground flex items-center justify-center">
              <Phone className="w-3.5 h-3.5 text-background" />
            </div>
            <span className="hidden sm:inline">Comsierge</span>
          </Link>

          {/* Phone Number - Center */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-md bg-muted border border-border">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="text-xs text-muted-foreground font-mono">{phoneNumber}</span>
            <button
              onClick={copyPhoneNumber}
              className="p-0.5 rounded hover:bg-background transition-colors"
            >
              {copied ? (
                <Check className="w-3 h-3 text-green-600" />
              ) : (
                <Copy className="w-3 h-3 text-muted-foreground" />
              )}
            </button>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-2">
            {/* Mobile menu toggle */}
            <button 
              className="md:hidden p-2 rounded-md hover:bg-muted transition-colors"
              onClick={() => setShowMobileNav(!showMobileNav)}
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1 pr-2 rounded-md hover:bg-muted transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-foreground flex items-center justify-center text-background text-xs font-medium">
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </button>

              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 w-56 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                    <div className="p-3 border-b border-border">
                      <p className="font-medium text-foreground text-sm">{user?.name || "Demo User"}</p>
                      <p className="text-xs text-muted-foreground">{user?.email || "user@example.com"}</p>
                      {/* Mobile Phone Display */}
                      <div className="mt-2 flex items-center gap-2 p-2 rounded-md bg-muted">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        <span className="text-xs text-muted-foreground font-mono flex-1">{phoneNumber}</span>
                        <button onClick={copyPhoneNumber}>
                          {copied ? (
                            <Check className="w-3 h-3 text-green-600" />
                          ) : (
                            <Copy className="w-3 h-3 text-muted-foreground" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="p-1">
                      <button
                        onClick={() => {
                          setActiveTab("profile");
                          setShowUserMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-foreground hover:bg-muted transition-colors"
                      >
                        <User className="w-4 h-4 text-muted-foreground" />
                        Profile
                      </button>
                      <button
                        onClick={() => {
                          setActiveTab("settings");
                          setShowUserMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-foreground hover:bg-muted transition-colors"
                      >
                        <Settings className="w-4 h-4 text-muted-foreground" />
                        Settings
                      </button>
                      <div className="my-1 border-t border-border" />
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors"
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

      {/* Mobile Nav Dropdown */}
      {showMobileNav && (
        <div className="md:hidden bg-card border-b border-border px-4 py-2">
          <div className="flex flex-wrap gap-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setShowMobileNav(false);
                  if (item.id !== "ai") setAiContext(undefined);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === item.id
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <item.icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 pb-16 md:pb-14">
        <div className="max-w-6xl mx-auto px-4 py-4">
          {renderContent()}
        </div>
      </main>

      {/* Bottom Navigation - Footer style */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border">
        <div className="max-w-6xl mx-auto flex items-center justify-around">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                if (item.id !== "ai") setAiContext(undefined);
              }}
              className={`linear-nav-item flex-1 ${
                activeTab === item.id
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className={`w-5 h-5 ${activeTab === item.id ? "text-foreground" : ""}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default Dashboard;