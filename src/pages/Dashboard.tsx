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
  Bell,
  Copy,
  Check,
  Clock,
  Headphones,
} from "lucide-react";
import { toast } from "sonner";
import MessagesTab from "@/components/dashboard/MessagesTab";
import CallsTab from "@/components/dashboard/CallsTab";
import ContactsTab from "@/components/dashboard/ContactsTab";
import AITab from "@/components/dashboard/AITab";
import SettingsTab from "@/components/dashboard/SettingsTab";
import RemindersTab from "@/components/dashboard/RemindersTab";
import SupportTab from "@/components/dashboard/SupportTab";
import Logo from "@/components/Logo";

type Tab = "messages" | "calls" | "contacts" | "ai" | "settings" | "reminders" | "support";

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("messages");
  const [aiContext, setAiContext] = useState<string | undefined>();
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
    toast.success("Phone number copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const navItems = [
    { id: "messages" as Tab, icon: MessageSquare, label: "Messages" },
    { id: "calls" as Tab, icon: Phone, label: "Calls" },
    { id: "contacts" as Tab, icon: Users, label: "Contacts" },
    { id: "reminders" as Tab, icon: Clock, label: "Reminders" },
    { id: "ai" as Tab, icon: Bot, label: "AI" },
    { id: "support" as Tab, icon: Headphones, label: "Support" },
    { id: "settings" as Tab, icon: Settings, label: "Settings" },
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
      case "reminders":
        return <RemindersTab />;
      case "support":
        return <SupportTab />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="text-lg">
            <Logo />
          </Link>

          {/* Phone Number - Center (Desktop) */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 border border-border/30">
            <span className="w-1.5 h-1.5 rounded-full bg-gold/60" />
            <span className="text-sm text-gold">{phoneNumber}</span>
            <button
              onClick={copyPhoneNumber}
              className="p-1 rounded hover:bg-secondary transition-colors"
            >
              {copied ? (
                <Check className="w-3 h-3 text-gold" />
              ) : (
                <Copy className="w-3 h-3 text-gold/60" />
              )}
            </button>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <button className="relative p-2 rounded-lg hover:bg-secondary/50 transition-colors">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-foreground" />
            </button>

            {/* User Avatar + Name */}
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg">
              <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-foreground text-sm font-medium">
                {user?.name?.charAt(0).toUpperCase() || "U"}
              </div>
              <span className="text-sm text-foreground hidden sm:inline">{user?.name || "User"}</span>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-20">
        <div className="max-w-5xl mx-auto px-4 py-6">
          {renderContent()}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border/50">
        <div className="max-w-5xl mx-auto flex items-center justify-around px-2 py-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                if (item.id !== "ai") setAiContext(undefined);
              }}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
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
