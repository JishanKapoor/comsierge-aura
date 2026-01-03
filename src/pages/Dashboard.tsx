import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Menu,
  Inbox,
  Users,
  LogOut,
  Copy,
  Phone,
  Route,
  Headphones,
  Zap,
  ChevronUp,
  User as UserIcon,
  Lock,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import InboxView from "@/components/dashboard/InboxView";
import CallsTab from "@/components/dashboard/CallsTab";
import ContactsTab from "@/components/dashboard/ContactsTab";
import SupportTab from "@/components/dashboard/SupportTab";
import RoutingPanel from "@/components/dashboard/RoutingPanel";
import ActiveRulesTab from "@/components/dashboard/ActiveRulesTab";
import ProfileTab from "@/components/dashboard/ProfileTab";

type Tab = "inbox" | "calls" | "contacts" | "routing" | "rules" | "support" | "profile";

const Dashboard = () => {
  const { user, logout, refreshUser, isLoading } = useAuth();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("inbox");
  const [selectedContactPhone, setSelectedContactPhone] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  
  // Change password modal state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Use the user's assigned phone number or a placeholder
  const phoneNumber = user?.phoneNumber || "No number assigned";

  // Redirect to select-number page if user has no phone number
  useEffect(() => {
    if (user && !user.phoneNumber) {
      navigate("/select-number", { replace: true });
    } else if (user && user.phoneNumber && !user.forwardingNumber) {
      // Has phone but no forwarding - redirect to setup
      navigate("/setup-forwarding", { replace: true });
    }
  }, [user, navigate]);

  // Periodically check if user still has a phone number (in case admin unassigns it)
  useEffect(() => {
    // Don't start polling until user has a phone
    if (!user?.phoneNumber) return;
    
    const checkPhoneStatus = () => {
      refreshUser();
    };
    
    // Check every 15 seconds
    const interval = setInterval(checkPhoneStatus, 15000);
    
    // Also check when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshUser();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshUser, user?.phoneNumber]);

  // Don't render dashboard if user has no phone number - prevents flicker
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-gray-300 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  // Redirect to auth if not logged in
  if (!user) {
    navigate("/auth", { replace: true });
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-gray-300 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }
  
  // Redirect to select-number if no phone assigned
  if (!user.phoneNumber) {
    navigate("/select-number", { replace: true });
    return null;
  }

  // Handle navigation from contacts
  const handleNavigateFromContacts = (tab: string, contactPhone?: string) => {
    // Clear first to ensure the useEffect triggers even for the same phone
    setSelectedContactPhone(null);
    setActiveTab(tab as Tab);
    if (contactPhone) {
      // Use setTimeout to ensure state update happens after clear
      setTimeout(() => {
        setSelectedContactPhone(contactPhone);
      }, 0);
    }
  };

  // Close menu on tab change (mobile)
  useEffect(() => {
    setShowMenu(false);
  }, [activeTab]);

  // Close user menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const copyPhoneNumber = async () => {
    try {
      await navigator.clipboard.writeText(phoneNumber);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords don't match");
      return;
    }
    if (newPassword === currentPassword) {
      toast.error("New password must be different from current password");
      return;
    }

    setIsChangingPassword(true);
    try {
      const token = localStorage.getItem("comsierge_token");
      const res = await fetch("/api/auth/change-password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      
      if (data.success) {
        toast.success("Password changed successfully");
        setShowChangePassword(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(data.message || "Failed to change password");
      }
    } catch (err) {
      toast.error("Failed to change password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const navItems = [
    { id: "inbox" as Tab, label: "Inbox", icon: Inbox },
    { id: "calls" as Tab, label: "Calls", icon: Phone },
    { id: "contacts" as Tab, label: "Contacts", icon: Users },
    { id: "routing" as Tab, label: "Routing", icon: Route },
    { id: "rules" as Tab, label: "Active Rules", icon: Zap },
    { id: "support" as Tab, label: "Support", icon: Headphones },
  ];

  // Render tab content - keep main data tabs mounted for smooth switching
  const renderTabContent = (tab: Tab, isActive: boolean) => {
    const baseStyle: React.CSSProperties = { display: isActive ? 'block' : 'none', height: '100%' };
    const paddedStyle: React.CSSProperties = { ...baseStyle, padding: '1.5rem' };
    
    switch (tab) {
      case "inbox":
        return (
          <div key="inbox" style={baseStyle}>
            <InboxView selectedContactPhone={selectedContactPhone} onClearSelection={() => setSelectedContactPhone(null)} />
          </div>
        );
      case "calls":
        return (
          <div key="calls" style={paddedStyle}>
            <CallsTab selectedContactPhone={selectedContactPhone} onClearSelection={() => setSelectedContactPhone(null)} />
          </div>
        );
      case "contacts":
        return (
          <div key="contacts" style={paddedStyle}>
            <ContactsTab onNavigate={handleNavigateFromContacts} />
          </div>
        );
      case "rules":
        return (
          <div key="rules" style={paddedStyle}>
            <ActiveRulesTab />
          </div>
        );
      case "support":
        return (
          <div key="support" style={paddedStyle}>
            <SupportTab />
          </div>
        );
      default:
        return null;
    }
  };

  // These tabs don't need to stay mounted
  const renderOnDemandContent = () => {
    switch (activeTab) {
      case "routing":
        return <RoutingPanel phoneNumber={phoneNumber} />;
      case "profile":
        return <ProfileTab />;
      default:
        return null;
    }
  };

  // Tabs that should stay mounted for smooth switching
  const persistentTabs: Tab[] = ["inbox", "calls", "contacts", "rules", "support"];

  return (
    <div className="dashboard-layout flex w-full h-screen h-[100dvh] overflow-hidden bg-white font-sans text-sm text-gray-700" style={{ backgroundColor: '#ffffff', color: '#374151' }}>
      {/* Left Sidebar */}
      <div
        className={cn(
          "fixed lg:static top-0 left-0 bottom-0 transform duration-300 lg:relative lg:translate-x-0",
          "bg-white flex flex-col flex-shrink-0 w-56 h-full border-r border-gray-100 lg:shadow-none overflow-hidden",
          showMenu ? "translate-x-0 ease-in shadow-xl z-50" : "-translate-x-full ease-out shadow-none z-0 pointer-events-none lg:pointer-events-auto lg:z-auto"
        )}
      >
        {/* Mobile close button */}
        <button
          className="flex-shrink-0 px-5 ml-2 lg:hidden h-14 focus:outline-none"
          onClick={() => setShowMenu(false)}
        >
          <Menu className="w-4 h-4 text-gray-500 hover:text-gray-800" />
        </button>

        {/* Top section */}
        <div className="flex flex-col flex-grow-0 flex-shrink-0 px-5 py-3">
          <div className="flex items-center justify-between">
            {/* Brand */}
            <div className="flex items-center p-2 pr-3 rounded cursor-pointer hover:bg-gray-100">
              <div className="flex text-sm items-center justify-center rounded-sm w-5 h-5 text-white bg-indigo-500 mr-2.5 font-semibold">
                C
              </div>
              <div className="text-sm font-medium text-gray-800">Comsierge</div>
            </div>
          </div>

          {/* Phone number */}
          {user?.phoneNumber ? (
            <button
              onClick={copyPhoneNumber}
              className="inline-flex items-center px-2 py-2 mt-3 bg-white border border-gray-200 rounded hover:bg-gray-50 focus:outline-none h-8 text-xs group"
            >
              <Copy className="w-3.5 h-3.5 mr-2 text-gray-400 group-hover:text-gray-600" />
              <span className="font-mono text-gray-600">{phoneNumber}</span>
            </button>
          ) : (
            <div className="inline-flex items-center px-2 py-2 mt-3 bg-gray-50 border border-gray-200 rounded h-8 text-xs">
              <Phone className="w-3.5 h-3.5 mr-2 text-gray-400" />
              <span className="text-gray-500">No number assigned</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex flex-col flex-shrink flex-grow overflow-y-auto mb-0.5 px-4 pb-4">
          {/* Nav items */}
          <nav className="mt-4 space-y-0.5">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "group relative w-full py-2 px-2 h-8 flex items-center rounded cursor-pointer transition-colors",
                  activeTab === item.id
                    ? "bg-gray-100 text-gray-900"
                    : "hover:bg-gray-100 text-gray-600"
                )}
              >
                <item.icon className={cn(
                  "w-4 h-4 mr-3",
                  activeTab === item.id ? "text-gray-700" : "text-gray-500 group-hover:text-gray-600"
                )} />
                <span className="text-sm">{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Bottom user area */}
          <div className="mt-auto pt-3 border-t border-gray-100 relative" ref={userMenuRef}>
            <div className="flex items-center gap-1 px-2 py-1.5">
              {/* User button with dropdown */}
              <button
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 flex-1 min-w-0 rounded px-1.5 py-1 hover:bg-gray-100"
              >
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-medium flex-shrink-0">
                  {user?.name?.charAt(0) || "U"}
                </div>
                <span className="text-sm text-gray-700 truncate">{user?.name || "Demo User"}</span>
                <ChevronUp className={cn("w-3.5 h-3.5 text-gray-400 transition-transform", showUserMenu ? "" : "rotate-180")} />
              </button>

              {/* Logout button */}
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center justify-center w-7 h-7 rounded text-gray-400 hover:bg-red-50 hover:text-red-500"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Dropdown menu */}
            {showUserMenu && (
              <div className="absolute bottom-full left-2 right-2 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
                <div className="px-3 py-2 border-b border-gray-100">
                  <div className="text-sm font-medium text-gray-900">{user?.name || "User"}</div>
                  <div className="text-xs text-gray-500 truncate">{user?.email || "No email"}</div>
                </div>
                <div className="px-3 py-2 border-b border-gray-100">
                  <div className="text-xs text-gray-500">Current plan</div>
                  <div className="text-sm font-medium text-gray-800">Free plan</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowChangePassword(true);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Lock className="w-3.5 h-3.5 text-gray-400" />
                  Change Password
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-col flex-grow min-w-0 min-h-0 h-full bg-white overflow-hidden">
        {/* Top bar */}
        <div className="flex justify-between flex-shrink-0 pl-2 pr-6 border-b border-gray-200 h-14 lg:pl-6 bg-white">
          {/* Left section */}
          <div className="flex items-center">
            <button
              className="flex-shrink-0 h-full px-4 focus:outline-none lg:hidden"
              onClick={() => setShowMenu(true)}
            >
              <Menu className="w-4 h-4 text-gray-500 hover:text-gray-800" />
            </button>

            <div className="p-1 font-semibold text-gray-800">
              {navItems.find((n) => n.id === activeTab)?.label}
            </div>
          </div>
        </div>

        {/* Content */}
        <div 
          className={cn(
            "flex-1 min-h-0 bg-white",
            activeTab === "inbox" ? "overflow-hidden" : "overflow-y-auto"
          )}
          style={activeTab !== "inbox" ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : undefined}
        >
          <div className="h-full">
            {/* Keep persistent tabs mounted for smooth switching */}
            {persistentTabs.map(tab => renderTabContent(tab, activeTab === tab))}
            {/* Render on-demand tabs normally */}
            {!persistentTabs.includes(activeTab) && (
              <div className="p-6 h-full">
                {renderOnDemandContent()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile overlay */}
      {showMenu && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={() => setShowMenu(false)}
        />
      )}

      {/* Change Password Modal */}
      {showChangePassword && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Change Password</h3>
              <button
                onClick={() => {
                  setShowChangePassword(false);
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrentPw ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm [&::-ms-reveal]:hidden [&::-webkit-credentials-auto-fill-button]:hidden"
                    placeholder="Enter current password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPw ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm [&::-ms-reveal]:hidden [&::-webkit-credentials-auto-fill-button]:hidden"
                    placeholder="Enter new password (min 6 characters)"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm [&::-ms-reveal]:hidden [&::-webkit-credentials-auto-fill-button]:hidden"
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-4 py-3 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowChangePassword(false);
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleChangePassword}
                disabled={isChangingPassword}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isChangingPassword ? "Changing..." : "Change Password"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
