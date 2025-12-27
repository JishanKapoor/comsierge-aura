import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  MessageSquare,
  Phone,
  Users,
  Settings,
  Clock,
  Headphones,
  LogOut,
  Bell,
  Copy,
  Check,
  Menu,
  X,
  Route,
  Bot,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Logo from "@/components/Logo";

// Dashboard Components
import InboxView from "@/components/dashboard/InboxView";
import CallsTab from "@/components/dashboard/CallsTab";
import ContactsTab from "@/components/dashboard/ContactsTab";
import SettingsTab from "@/components/dashboard/SettingsTab";
import RemindersTab from "@/components/dashboard/RemindersTab";
import SupportTab from "@/components/dashboard/SupportTab";
import RoutingPanel from "@/components/dashboard/RoutingPanel";
import AIPanel from "@/components/dashboard/AIPanel";

type Tab = "inbox" | "calls" | "contacts" | "routing" | "reminders" | "support" | "settings";

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("inbox");
  const [copied, setCopied] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);

  const phoneNumber = "+1 (437) 239-2448";

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [activeTab]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const copyPhoneNumber = () => {
    navigator.clipboard.writeText(phoneNumber);
    setCopied(true);
    toast.success("Phone number copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const navItems = [
    { id: "inbox" as Tab, icon: MessageSquare, label: "Inbox" },
    { id: "calls" as Tab, icon: Phone, label: "Calls" },
    { id: "contacts" as Tab, icon: Users, label: "Contacts" },
    { id: "routing" as Tab, icon: Route, label: "Routing" },
    { id: "reminders" as Tab, icon: Clock, label: "Reminders" },
    { id: "support" as Tab, icon: Headphones, label: "Support" },
    { id: "settings" as Tab, icon: Settings, label: "Settings" },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "inbox":
        return <InboxView onOpenAI={() => setShowAIPanel(true)} />;
      case "calls":
        return <CallsTab />;
      case "contacts":
        return <ContactsTab />;
      case "routing":
        return <RoutingPanel phoneNumber={phoneNumber} />;
      case "reminders":
        return <RemindersTab />;
      case "support":
        return <SupportTab />;
      case "settings":
        return <SettingsTab />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 z-50 h-screen bg-card/50 border-r border-border/50 flex flex-col transition-all duration-300 ease-out",
          sidebarCollapsed ? "lg:w-16" : "lg:w-56",
          mobileSidebarOpen ? "w-56 translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Sidebar Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-border/30 shrink-0">
          {!sidebarCollapsed && (
            <Link to="/" className="text-lg">
              <Logo />
            </Link>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex p-1.5 rounded-lg hover:bg-secondary/50 transition-colors"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg hover:bg-secondary/50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Phone Number Card */}
        {!sidebarCollapsed && (
          <div className="px-3 py-3 border-b border-border/30">
            <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-secondary/30 border border-border/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-foreground font-mono flex-1 truncate">{phoneNumber}</span>
              <button onClick={copyPhoneNumber} className="p-1 hover:bg-secondary rounded transition-colors">
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
              </button>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                activeTab === item.id
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span className="text-sm font-medium">{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* AI Button */}
        <div className="px-2 pb-3">
          <button
            onClick={() => setShowAIPanel(true)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gradient-to-r from-violet-500/20 to-blue-500/20 border border-violet-500/30 text-foreground hover:from-violet-500/30 hover:to-blue-500/30 transition-all duration-200",
            )}
          >
            <Bot className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span className="text-sm font-medium">Comsierge AI</span>}
          </button>
        </div>

        {/* User Section */}
        <div className="px-2 py-3 border-t border-border/30">
          <div className={cn("flex items-center gap-3 px-2", sidebarCollapsed && "justify-center")}>
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-foreground text-sm font-medium shrink-0">
              {user?.name?.charAt(0).toUpperCase() || "U"}
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{user?.name || "User"}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            )}
            <button
              onClick={handleLogout}
              className={cn("p-2 rounded-lg hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground", sidebarCollapsed && "hidden")}
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen lg:min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-30 h-14 bg-background/95 backdrop-blur-sm border-b border-border/50 px-4 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-secondary/50 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-medium text-foreground capitalize">
              {activeTab === "inbox" ? "Messages" : activeTab}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Notifications */}
            <button className="relative p-2 rounded-lg hover:bg-secondary/50 transition-colors">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500" />
            </button>

            {/* Mobile User Avatar */}
            <div className="lg:hidden flex items-center gap-2 px-2 py-1.5 rounded-lg">
              <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-foreground text-sm font-medium">
                {user?.name?.charAt(0).toUpperCase() || "U"}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          <div className="max-w-6xl mx-auto animate-fade-in">
            {renderContent()}
          </div>
        </main>
      </div>

      {/* AI Panel */}
      <AIPanel isOpen={showAIPanel} onClose={() => setShowAIPanel(false)} />
    </div>
  );
};

export default Dashboard;
