import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Menu,
  Inbox,
  Users,
  HelpCircle,
  UserPlus,
  ChevronDown,
  Settings,
  LogOut,
  Copy,
  Phone,
  Clock,
  Route,
  Headphones,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import InboxView from "@/components/dashboard/InboxView";
import CallsTab from "@/components/dashboard/CallsTab";
import ContactsTab from "@/components/dashboard/ContactsTab";
import SettingsTab from "@/components/dashboard/SettingsTab";
import RemindersTab from "@/components/dashboard/RemindersTab";
import SupportTab from "@/components/dashboard/SupportTab";
import RoutingPanel from "@/components/dashboard/RoutingPanel";
import InviteModal from "@/components/dashboard/InviteModal";
import HelpModal from "@/components/dashboard/HelpModal";

type Tab = "inbox" | "calls" | "contacts" | "routing" | "reminders" | "support" | "settings";

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("inbox");
  const [selectedContactPhone, setSelectedContactPhone] = useState<string | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const phoneNumber = "+1 (437) 239-2448";

  // Handle navigation from contacts
  const handleNavigateFromContacts = (tab: string, contactPhone?: string) => {
    setActiveTab(tab as Tab);
    if (contactPhone) {
      setSelectedContactPhone(contactPhone);
    }
  };

  // Close menu on tab change (mobile)
  useEffect(() => {
    setShowMenu(false);
  }, [activeTab]);

  // Close profile menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
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

  const navItems = [
    { id: "inbox" as Tab, label: "Inbox", icon: Inbox },
    { id: "calls" as Tab, label: "Calls", icon: Phone },
    { id: "contacts" as Tab, label: "Contacts", icon: Users },
    { id: "routing" as Tab, label: "Routing", icon: Route },
    { id: "reminders" as Tab, label: "Reminders", icon: Clock },
    { id: "support" as Tab, label: "Support", icon: Headphones },
    { id: "settings" as Tab, label: "Settings", icon: Settings },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "inbox":
        return <InboxView selectedContactPhone={selectedContactPhone} onClearSelection={() => setSelectedContactPhone(null)} />;
      case "calls":
        return <CallsTab selectedContactPhone={selectedContactPhone} onClearSelection={() => setSelectedContactPhone(null)} />;
      case "contacts":
        return <ContactsTab onNavigate={handleNavigateFromContacts} />;
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
    <div className="dashboard-layout flex w-full h-screen overflow-hidden bg-white font-sans text-sm text-gray-700">
      {/* Left Sidebar */}
      <div
        className={cn(
          "absolute lg:static inset-0 transform duration-300 lg:relative lg:translate-x-0",
          "bg-white flex flex-col flex-shrink-0 w-56 border-r border-gray-100 lg:shadow-none z-50",
          showMenu ? "translate-x-0 ease-in shadow-xl" : "-translate-x-full ease-out shadow-none"
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

            {/* User avatar dropdown */}
            <div className="relative" ref={profileMenuRef}>
              <button
                className="flex items-center justify-center p-2 rounded cursor-pointer hover:bg-gray-100"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
              >
                <div className="relative w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-medium">
                  {user?.name?.charAt(0) || "U"}
                  <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 border border-white rounded-full" />
                </div>
                <ChevronDown className="w-3 h-3 ml-1 text-gray-500" />
              </button>

              {/* Profile dropdown */}
              {showProfileMenu && (
                <div className="absolute left-0 top-10 w-52 bg-[#F9F9F9] border border-gray-200 rounded-lg shadow-lg py-1 z-50">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-800 truncate">{user?.name || "User"}</p>
                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={() => { setActiveTab("settings"); setShowProfileMenu(false); }}
                    className="flex items-center w-full px-3 h-8 hover:bg-gray-100 text-gray-700"
                  >
                    <Settings className="w-3.5 h-3.5 mr-2 text-gray-500" />
                    Settings
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-3 h-8 hover:bg-gray-100 text-gray-700"
                  >
                    <LogOut className="w-3.5 h-3.5 mr-2 text-gray-500" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Phone number */}
          <button
            onClick={copyPhoneNumber}
            className="inline-flex items-center px-2 py-2 mt-3 bg-white border border-gray-200 rounded hover:bg-gray-50 focus:outline-none h-8 text-xs group"
          >
            <Copy className="w-3.5 h-3.5 mr-2 text-gray-400 group-hover:text-gray-600" />
            <span className="font-mono text-gray-600">{phoneNumber}</span>
          </button>
        </div>

        {/* Navigation */}
        <div className="flex flex-col flex-shrink flex-grow overflow-y-auto mb-0.5 px-4">
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

          {/* Spacer */}
          <div className="flex-grow" />

          {/* Bottom links */}
          <div className="px-2 pb-4 text-gray-500 space-y-1">
            <button 
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center text-sm hover:text-gray-700 focus:outline-none"
            >
              <UserPlus className="w-3.5 h-3.5 mr-2" /> Invite people
            </button>
            <button 
              onClick={() => setShowHelpModal(true)}
              className="inline-flex items-center text-sm hover:text-gray-700 focus:outline-none"
            >
              <HelpCircle className="w-3.5 h-3.5 mr-2" /> Help & Feedback
            </button>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-col flex-grow min-w-0 bg-white">
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
            <button className="px-2 py-1 ml-3 border border-gray-300 border-dashed rounded text-gray-500 hover:border-gray-400 focus:outline-none hover:text-gray-700 text-xs">
              + Filter
            </button>
          </div>
        </div>

        {/* Content */}
        <div className={cn(
          "flex-1 bg-white",
          activeTab === "inbox" ? "overflow-hidden" : "overflow-y-auto"
        )}>
          <div className={cn("h-full", activeTab === "inbox" ? "" : "p-6")}>
            {renderContent()}
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

      {/* Modals */}
      <InviteModal 
        isOpen={showInviteModal} 
        onClose={() => setShowInviteModal(false)} 
      />
      <HelpModal 
        isOpen={showHelpModal} 
        onClose={() => setShowHelpModal(false)}
        onOpenSupport={() => {
          setShowHelpModal(false);
          setActiveTab("support");
        }}
      />
    </div>
  );
};

export default Dashboard;
