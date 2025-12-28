import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Phone,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Search,
  Bell,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  UserPlus,
  Activity,
  DollarSign,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type Tab = "overview" | "users" | "analytics" | "settings";

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const sidebarItems = [
    { id: "overview" as Tab, icon: BarChart3, label: "Overview" },
    { id: "users" as Tab, icon: Users, label: "User Management" },
    { id: "analytics" as Tab, icon: Activity, label: "Analytics" },
    { id: "settings" as Tab, icon: Settings, label: "Settings" },
  ];

  const stats = [
    { label: "Total Users", value: "12,847", change: "+12%", trend: "up", icon: Users },
    { label: "Active Sessions", value: "1,294", change: "+8%", trend: "up", icon: Activity },
    { label: "Revenue", value: "$48,294", change: "+23%", trend: "up", icon: DollarSign },
    { label: "New Signups", value: "384", change: "-3%", trend: "down", icon: UserPlus },
  ];

  const mockUsers = [
    { id: 1, name: "John Smith", email: "john@example.com", role: "Pro", status: "Active", joined: "Dec 15, 2024" },
    { id: 2, name: "Sarah Johnson", email: "sarah@example.com", role: "Free", status: "Active", joined: "Dec 10, 2024" },
    { id: 3, name: "Mike Wilson", email: "mike@example.com", role: "Pro", status: "Inactive", joined: "Nov 28, 2024" },
    { id: 4, name: "Emily Brown", email: "emily@example.com", role: "Enterprise", status: "Active", joined: "Nov 15, 2024" },
    { id: 5, name: "David Lee", email: "david@example.com", role: "Free", status: "Active", joined: "Nov 1, 2024" },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "overview":
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-light text-foreground">Dashboard Overview</h2>
            
            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="bg-card/50 border border-border rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                      <stat.icon className="w-5 h-5 text-foreground" />
                    </div>
                    <span className={`text-sm flex items-center gap-1 ${
                      stat.trend === "up" ? "text-green-500" : "text-red-500"
                    }`}>
                      {stat.trend === "up" ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      {stat.change}
                    </span>
                  </div>
                  <p className="text-2xl font-light text-foreground">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Recent Activity */}
            <div className="bg-card/50 border border-border rounded-2xl p-6">
              <h3 className="font-medium text-foreground mb-4">Recent Activity</h3>
              <div className="space-y-4">
                {[
                  { action: "New user registered", user: "john@example.com", time: "2 minutes ago" },
                  { action: "Subscription upgraded", user: "sarah@example.com", time: "15 minutes ago" },
                  { action: "Payment received", user: "mike@example.com", time: "1 hour ago" },
                  { action: "User deactivated", user: "old@example.com", time: "3 hours ago" },
                ].map((activity, i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b border-border last:border-b-0">
                    <div>
                      <p className="text-foreground">{activity.action}</p>
                      <p className="text-sm text-muted-foreground">{activity.user}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{activity.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "users":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-light text-foreground">User Management</h2>
              <Button className="gap-2">
                <UserPlus className="w-4 h-4" /> Add User
              </Button>
            </div>

            <div className="bg-card/50 border border-border rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-secondary/30">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">User</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Role</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Joined</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockUsers.map((u) => (
                      <tr key={u.id} className="border-t border-border hover:bg-secondary/20 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-foreground font-medium">
                              {u.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{u.name}</p>
                              <p className="text-sm text-muted-foreground">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            u.role === "Enterprise" ? "bg-purple-500/20 text-purple-400" :
                            u.role === "Pro" ? "bg-blue-500/20 text-blue-400" :
                            "bg-secondary text-muted-foreground"
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            u.status === "Active" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                          }`}>
                            {u.status}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-muted-foreground">{u.joined}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <button className="p-2 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button className="p-2 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button className="p-2 hover:bg-destructive/20 rounded-lg transition-colors text-muted-foreground hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      case "analytics":
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-light text-foreground">Analytics</h2>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div className="bg-card/50 border border-border rounded-2xl p-6">
                <h3 className="font-medium text-foreground mb-4">User Growth</h3>
                <div className="h-48 flex items-end justify-between gap-2">
                  {[40, 65, 45, 80, 55, 90, 75].map((height, i) => (
                    <div key={i} className="flex-1 bg-primary/20 rounded-t-lg relative" style={{ height: `${height}%` }}>
                      <div className="absolute bottom-0 left-0 right-0 bg-primary rounded-t-lg" style={{ height: `${height * 0.6}%` }} />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                </div>
              </div>

              <div className="bg-card/50 border border-border rounded-2xl p-6">
                <h3 className="font-medium text-foreground mb-4">Revenue by Plan</h3>
                <div className="space-y-4">
                  {[
                    { plan: "Enterprise", value: 45, color: "bg-purple-500" },
                    { plan: "Pro", value: 35, color: "bg-blue-500" },
                    { plan: "Free", value: 20, color: "bg-secondary" },
                  ].map((item) => (
                    <div key={item.plan}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">{item.plan}</span>
                        <span className="text-foreground">{item.value}%</span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case "settings":
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-light text-foreground">Admin Settings</h2>
            <div className="bg-card/50 border border-border rounded-2xl p-6">
              <p className="text-muted-foreground">Admin settings panel - Configure system-wide settings here.</p>
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
            <span>Admin</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Admin Panel</span>
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
                placeholder="Search users, analytics..."
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
              <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-500 font-medium">
                A
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-medium text-foreground">{user?.name}</p>
                <p className="text-xs text-muted-foreground">Administrator</p>
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

export default AdminDashboard;
