import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const openAI = (context?: string) => {
    setAiContext(context);
    setActiveTab("ai");
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
      {/* Header */}
      <header className="h-14 bg-card/30 border-b border-border flex items-center justify-between px-4 sticky top-0 z-40">
        <div className="flex items-center gap-2.5 text-lg font-medium tracking-tight text-foreground">
          <Phone className="w-5 h-5" />
          <span>comsierge.</span>
        </div>
        <div className="flex items-center gap-3">
          <button className="relative text-muted-foreground hover:text-foreground transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-destructive" />
          </button>
          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-foreground font-medium">
            {user?.name?.charAt(0).toUpperCase() || "U"}
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 pb-20">
        <div className="max-w-4xl mx-auto">
          {renderContent()}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-card/95 backdrop-blur border-t border-border flex items-center justify-around px-2 z-50">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setActiveTab(item.id);
              if (item.id !== "ai") setAiContext(undefined);
            }}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors ${
              activeTab === item.id
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px]">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default Dashboard;