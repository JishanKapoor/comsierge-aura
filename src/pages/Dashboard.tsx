import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Phone,
  Mail,
  MessageSquare,
  Settings,
  CreditCard,
  HelpCircle,
  LogOut,
  Inbox,
  Filter,
  Globe,
  Forward,
  Key,
  User,
  ChevronDown,
  Search,
  Bell,
  Plus,
  MoreHorizontal,
  Star,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Tab = "inbox" | "calls" | "messages" | "views" | "settings" | "billing" | "support";

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("inbox");
  const [language, setLanguage] = useState("en");

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const sidebarItems = [
    { id: "inbox" as Tab, icon: Inbox, label: "Inbox", count: 12 },
    { id: "calls" as Tab, icon: Phone, label: "Calls", count: 3 },
    { id: "messages" as Tab, icon: MessageSquare, label: "Messages", count: 8 },
    { id: "views" as Tab, icon: Filter, label: "Custom Views" },
    { id: "settings" as Tab, icon: Settings, label: "Settings" },
    { id: "billing" as Tab, icon: CreditCard, label: "Billing" },
    { id: "support" as Tab, icon: HelpCircle, label: "Support" },
  ];

  const mockInboxItems = [
    { id: 1, from: "John Smith", subject: "Meeting Tomorrow", time: "2m ago", starred: true, read: false },
    { id: 2, from: "Sarah Johnson", subject: "Project Update", time: "15m ago", starred: false, read: false },
    { id: 3, from: "Mike Wilson", subject: "Quick Question", time: "1h ago", starred: true, read: true },
    { id: 4, from: "Emily Brown", subject: "Invoice Attached", time: "3h ago", starred: false, read: true },
    { id: 5, from: "David Lee", subject: "Re: Proposal", time: "5h ago", starred: false, read: true },
  ];

  const mockCalls = [
    { id: 1, name: "John Smith", number: "+1 234 567 8900", time: "10:30 AM", type: "incoming", duration: "5:23" },
    { id: 2, name: "Sarah Johnson", number: "+1 234 567 8901", time: "9:15 AM", type: "outgoing", duration: "12:45" },
    { id: 3, name: "Unknown", number: "+1 234 567 8902", time: "Yesterday", type: "missed", duration: "-" },
  ];

  const languages = [
    { code: "en", name: "English" },
    { code: "es", name: "Español" },
    { code: "fr", name: "Français" },
    { code: "de", name: "Deutsch" },
    { code: "zh", name: "中文" },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "inbox":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-light text-foreground">Inbox</h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="w-4 h-4" /> Filter
                </Button>
                <Button variant="outline" size="sm" className="gap-2">
                  <Forward className="w-4 h-4" /> Forward to Email
                </Button>
              </div>
            </div>
            <div className="bg-card/50 border border-border rounded-2xl overflow-hidden">
              {mockInboxItems.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-4 p-4 border-b border-border last:border-b-0 hover:bg-secondary/30 transition-colors cursor-pointer ${
                    !item.read ? "bg-secondary/20" : ""
                  }`}
                >
                  <button className="text-muted-foreground hover:text-yellow-500 transition-colors">
                    <Star className={`w-4 h-4 ${item.starred ? "fill-yellow-500 text-yellow-500" : ""}`} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${!item.read ? "text-foreground" : "text-muted-foreground"}`}>
                        {item.from}
                      </span>
                      {!item.read && <span className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{item.subject}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{item.time}</span>
                  <button className="text-muted-foreground hover:text-foreground">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );

      case "calls":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-light text-foreground">Calls</h2>
              <Button className="gap-2">
                <Phone className="w-4 h-4" /> New Call
              </Button>
            </div>
            <div className="bg-card/50 border border-border rounded-2xl overflow-hidden">
              {mockCalls.map((call) => (
                <div key={call.id} className="flex items-center gap-4 p-4 border-b border-border last:border-b-0 hover:bg-secondary/30 transition-colors">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    call.type === "missed" ? "bg-destructive/20" : "bg-secondary"
                  }`}>
                    <Phone className={`w-4 h-4 ${call.type === "missed" ? "text-destructive" : "text-foreground"}`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{call.name}</p>
                    <p className="text-sm text-muted-foreground">{call.number}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">{call.time}</p>
                    <p className="text-xs text-muted-foreground">{call.duration}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case "messages":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-light text-foreground">Messages</h2>
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> New Message
              </Button>
            </div>
            <div className="bg-card/50 border border-border rounded-2xl p-8 text-center">
              <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Send and receive SMS messages</p>
              <Button className="mt-4">Compose Message</Button>
            </div>
          </div>
        );

      case "views":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-light text-foreground">Custom Views</h2>
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> Create View
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {["Urgent", "VIP Contacts", "Unread", "Starred"].map((view) => (
                <div key={view} className="bg-card/50 border border-border rounded-2xl p-6 hover:border-primary/50 transition-colors cursor-pointer">
                  <Filter className="w-8 h-8 text-muted-foreground mb-4" />
                  <h3 className="font-medium text-foreground">{view}</h3>
                  <p className="text-sm text-muted-foreground mt-1">Custom filter view</p>
                </div>
              ))}
            </div>
          </div>
        );

      case "settings":
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-light text-foreground">Settings</h2>
            
            <div className="space-y-4">
              <div className="bg-card/50 border border-border rounded-2xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <User className="w-5 h-5 text-muted-foreground" />
                  <h3 className="font-medium text-foreground">Profile</h3>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm text-muted-foreground">Name</label>
                    <input
                      type="text"
                      defaultValue={user?.name}
                      className="w-full mt-1 px-4 py-2 bg-background border border-border rounded-xl text-foreground"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Email</label>
                    <input
                      type="email"
                      defaultValue={user?.email}
                      className="w-full mt-1 px-4 py-2 bg-background border border-border rounded-xl text-foreground"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-card/50 border border-border rounded-2xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <Key className="w-5 h-5 text-muted-foreground" />
                  <h3 className="font-medium text-foreground">Change Password</h3>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm text-muted-foreground">Current Password</label>
                    <input type="password" className="w-full mt-1 px-4 py-2 bg-background border border-border rounded-xl text-foreground" />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">New Password</label>
                    <input type="password" className="w-full mt-1 px-4 py-2 bg-background border border-border rounded-xl text-foreground" />
                  </div>
                </div>
                <Button className="mt-4">Update Password</Button>
              </div>

              <div className="bg-card/50 border border-border rounded-2xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <Globe className="w-5 h-5 text-muted-foreground" />
                  <h3 className="font-medium text-foreground">Language</h3>
                </div>
                <select
                  value={language}
                  onChange={(e) => {
                    setLanguage(e.target.value);
                    toast.success(`Language changed to ${languages.find(l => l.code === e.target.value)?.name}`);
                  }}
                  className="w-full max-w-xs px-4 py-2 bg-background border border-border rounded-xl text-foreground"
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>{lang.name}</option>
                  ))}
                </select>
              </div>

              <div className="bg-card/50 border border-border rounded-2xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <Forward className="w-5 h-5 text-muted-foreground" />
                  <h3 className="font-medium text-foreground">Email Forwarding</h3>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Forward messages to</label>
                  <input
                    type="email"
                    placeholder="your-email@example.com"
                    className="w-full mt-1 px-4 py-2 bg-background border border-border rounded-xl text-foreground"
                  />
                </div>
                <Button className="mt-4">Save Forwarding Settings</Button>
              </div>
            </div>
          </div>
        );

      case "billing":
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-light text-foreground">Billing & Payments</h2>
            <div className="bg-card/50 border border-border rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-sm text-muted-foreground">Current Plan</p>
                  <p className="text-2xl font-light text-foreground">Pro Plan</p>
                </div>
                <Button variant="outline">Change Plan</Button>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 bg-background rounded-xl">
                  <p className="text-sm text-muted-foreground">Monthly Cost</p>
                  <p className="text-xl font-medium text-foreground">$29/mo</p>
                </div>
                <div className="p-4 bg-background rounded-xl">
                  <p className="text-sm text-muted-foreground">Next Billing</p>
                  <p className="text-xl font-medium text-foreground">Jan 15, 2025</p>
                </div>
                <div className="p-4 bg-background rounded-xl">
                  <p className="text-sm text-muted-foreground">Payment Method</p>
                  <p className="text-xl font-medium text-foreground">•••• 4242</p>
                </div>
              </div>
              <Button className="mt-6 gap-2">
                <CreditCard className="w-4 h-4" /> Update Payment Method
              </Button>
            </div>
          </div>
        );

      case "support":
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-light text-foreground">Support</h2>
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
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-card/30 border-r border-border flex flex-col">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-2.5 text-xl font-medium tracking-tight text-foreground">
            <Phone className="w-5 h-5" />
            <span>comsierge.</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                activeTab === item.id
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.count && (
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">{item.count}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-16 bg-card/30 border-b border-border flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                className="pl-10 pr-4 py-2 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground w-64"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative text-muted-foreground hover:text-foreground transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-destructive" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-foreground font-medium">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-medium text-foreground">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-6 overflow-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
