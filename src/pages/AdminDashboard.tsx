import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE_URL } from "@/config";
import {
  Phone,
  Users,
  LogOut,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  PhoneCall,
  Server,
  Loader2,
  CheckCircle2,
  CheckCircle,
  AlertCircle,
  X,
  RefreshCw,
  Headphones,
  Clock,
  Send,
  ChevronLeft,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  TwilioAccount,
  AppUser,
  loadTwilioAccounts,
  saveTwilioAccounts,
  loadAppUsers,
  saveAppUsers,
  getAvailablePhones,
  getAssignedPhones,
  maskAuthToken,
} from "@/components/dashboard/adminStore";
import {
  SupportTicket,
  loadTicketsAsync,
  addReplyAsync,
  updateTicketStatusAsync,
  getTicketCountsAsync,
} from "@/components/dashboard/supportStore";
import Logo from "@/components/Logo";

// API base URL - uses env var in production, proxy in dev
const API_URL = `${API_BASE_URL}/api`;

type Tab = "phones" | "users" | "tickets";

// Confirmation Dialog Component
interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog = ({ isOpen, title, message, confirmLabel = "Confirm", onConfirm, onCancel }: ConfirmDialogProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-medium text-gray-800">{title}</h3>
          <button
            onClick={onCancel}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-gray-600">{message}</p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onCancel}
            className="h-8 px-4 text-sm border border-gray-200 rounded-md text-gray-600 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <Button
            onClick={onConfirm}
            className="h-8 px-4 text-sm bg-indigo-500 hover:bg-indigo-600 text-white"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, logout, isAdmin, isLoading } = useAuth();

  // Redirect if not admin
  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) {
      navigate("/auth", { replace: true });
    }
  }, [user, isAdmin, isLoading, navigate]);

  // Show loading while checking auth
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

  // Show redirect message if not authenticated
  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-gray-300 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting...</p>
        </div>
      </div>
    );
  }

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>("phones");

  // Twilio accounts state
  const [twilioAccounts, setTwilioAccounts] = useState<TwilioAccount[]>([]);
  const [newPhoneNumber, setNewPhoneNumber] = useState("");
  const [newAccountSid, setNewAccountSid] = useState("");
  const [newAuthToken, setNewAuthToken] = useState("");
  const [showNewAuthToken, setShowNewAuthToken] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<"idle" | "success" | "error">("idle");
  const [verificationMessage, setVerificationMessage] = useState("");

  // Users state - now fetched from backend
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [selectedPhones, setSelectedPhones] = useState<Record<string, string>>({});
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Support tickets state
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketReplyMessage, setTicketReplyMessage] = useState("");
  const [ticketCounts, setTicketCounts] = useState({ total: 0, open: 0, inProgress: 0, resolved: 0 });
  const [ticketFilter, setTicketFilter] = useState<"all" | "in-progress" | "resolved">("all");
  const ticketMessagesEndRef = useRef<HTMLDivElement>(null);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    confirmLabel: "Confirm",
    onConfirm: () => {},
  });

  const showConfirm = (title: string, message: string, confirmLabel: string, onConfirm: () => void) => {
    setConfirmDialog({ isOpen: true, title, message, confirmLabel, onConfirm });
  };

  const hideConfirm = () => {
    setConfirmDialog({ ...confirmDialog, isOpen: false });
  };

  // Fetch users from backend
  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const response = await fetch(`${API_URL}/auth/users`);
      const data = await response.json();
      if (data.success) {
        // Map backend users to AppUser format
        const users: AppUser[] = data.data
          .filter((u: any) => u.role !== "admin") // Don't show admins in user list
          .map((u: any) => ({
            id: u._id,
            username: u.name,
            personalPhone: u.email, // Using email as identifier
            assignedPhone: u.phoneNumber || null,
          }));
        setAppUsers(users);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
      toast.error("Failed to load users");
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);
  // Fetch Twilio accounts from backend (source of truth)
  const fetchTwilioAccounts = useCallback(async () => {
    try {
      const token = localStorage.getItem("comsierge_token");
      if (!token) {
        // Fall back to local storage (legacy)
        setTwilioAccounts(loadTwilioAccounts());
        return;
      }

      const resp = await fetch(`${API_URL}/admin/twilio-accounts`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await resp.json();
      if (!resp.ok || !data.success) {
        setTwilioAccounts(loadTwilioAccounts());
        return;
      }

      const local = loadTwilioAccounts();
      const mapped: TwilioAccount[] = (data.data || []).map((acc: any) => {
        const localMatch = local.find((l) => l.accountSid === acc.accountSid);
        return {
          id: acc._id || acc.id || acc.accountSid,
          accountSid: acc.accountSid,
          authToken: localMatch?.authToken || "",
          phoneNumbers: acc.phoneNumbers || [],
        };
      });

      setTwilioAccounts(mapped);
      // Keep legacy localStorage in sync so the rest of this page stays consistent
      saveTwilioAccounts(mapped);
    } catch (error) {
      console.error("Failed to fetch Twilio accounts:", error);
      setTwilioAccounts(loadTwilioAccounts());
    }
  }, []);

  // Fetch tickets from backend
  const fetchTickets = useCallback(async () => {
    try {
      const loadedTickets = await loadTicketsAsync();
      setTickets(loadedTickets);
      const counts = await getTicketCountsAsync();
      setTicketCounts(counts);
      
      // Update selected ticket if one is currently selected (to get new replies)
      setSelectedTicket((current) => {
        if (!current) return null;
        const updated = loadedTickets.find((t) => t.id === current.id);
        return updated || current;
      });
    } catch (error) {
      console.error("Failed to fetch tickets:", error);
    }
  }, []);

  // Manual refresh function
  const handleRefresh = useCallback(async () => {
    await fetchTwilioAccounts();
    fetchUsers();
    await fetchTickets();
    toast.success("Data refreshed");
  }, [fetchUsers, fetchTickets]);

  // Load data on mount and refresh periodically
  useEffect(() => {
    fetchTwilioAccounts();
    fetchUsers();
    // Load tickets from API
    fetchTickets();
    
    // Refresh users every 10 seconds, tickets every 5 seconds for faster updates
    const userInterval = setInterval(() => {
      fetchUsers();
    }, 10000);
    
    const ticketInterval = setInterval(() => {
      fetchTickets();
    }, 5000);
    
    // Also refresh when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchTwilioAccounts();
        fetchUsers();
        fetchTickets();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(userInterval);
      clearInterval(ticketInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Auto-scroll to bottom of ticket messages when selected ticket changes or new replies
  useEffect(() => {
    if (ticketMessagesEndRef.current && selectedTicket) {
      ticketMessagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedTicket, selectedTicket?.replies.length]);

  const handleLogout = () => {
    logout();
    navigate("/auth");
  };

  const handleAddPhoneNumber = async () => {
    if (!newPhoneNumber.trim()) {
      toast.error("Please enter a phone number");
      return;
    }
    if (!newAccountSid.trim()) {
      toast.error("Please enter Account SID");
      return;
    }
    if (!newAuthToken.trim()) {
      toast.error("Please enter Auth Token");
      return;
    }

    // Validate phone format (basic check for +1 format)
    const phoneRegex = /^\+1\d{10}$/;
    if (!phoneRegex.test(newPhoneNumber.trim())) {
      toast.error("Phone number must be in format +1XXXXXXXXXX");
      return;
    }

    // Check if phone already exists locally
    const existingAccount = twilioAccounts.find(
      (acc) => acc.accountSid === newAccountSid.trim()
    );
    if (existingAccount?.phoneNumbers.includes(newPhoneNumber.trim())) {
      toast.error("This phone number already exists in this account");
      return;
    }

    // Verify with Twilio API
    setIsVerifying(true);
    setVerificationStatus("idle");
    setVerificationMessage("");

    try {
      const response = await fetch(`${API_URL}/twilio/verify-credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountSid: newAccountSid.trim(),
          authToken: newAuthToken.trim(),
          phoneNumber: newPhoneNumber.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setVerificationStatus("error");
        setVerificationMessage(data.message || "Verification failed");
        toast.error(data.message || "Twilio verification failed");
        setIsVerifying(false);
        return;
      }

      // Verification successful
      setVerificationStatus("success");
      setVerificationMessage(`Verified: ${data.data.phoneNumber?.friendlyName || "Phone number"} (SMS: ${data.data.phoneNumber?.smsEnabled ? "✓" : "✗"}, Voice: ${data.data.phoneNumber?.voiceEnabled ? "✓" : "✗"})`);

      // Sync to backend (MongoDB) so all users can see available numbers
      const token = localStorage.getItem("comsierge_token");
      if (!token) {
        setVerificationStatus("error");
        setVerificationMessage("Missing session token. Please log in again.");
        toast.error("Please log in again");
        setIsVerifying(false);
        return;
      }

      const syncResp = await fetch(`${API_URL}/admin/twilio-accounts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          accountSid: newAccountSid.trim(),
          authToken: newAuthToken.trim(),
          friendlyName: data.data.account?.friendlyName,
          phoneNumber: newPhoneNumber.trim(), // Only add this specific number
        }),
      });

      const syncData = await syncResp.json();
      if (!syncResp.ok || !syncData.success) {
        setVerificationStatus("error");
        setVerificationMessage(syncData.message || "Failed to sync Twilio account to server");
        toast.error(syncData.message || "Failed to save numbers to server");
        setIsVerifying(false);
        return;
      }


      toast.success("Phone number added");

      // Refresh accounts from server so UI matches DB
      await fetchTwilioAccounts();

      // Clear form after brief delay to show success
      setTimeout(() => {
        setNewPhoneNumber("");
        setNewAccountSid("");
        setNewAuthToken("");
        setVerificationStatus("idle");
        setVerificationMessage("");
      }, 2000);

    } catch (error) {
      console.error("Verification error:", error);
      setVerificationStatus("error");
      setVerificationMessage("Unable to connect to verification server");
      toast.error("Unable to connect to server. Please ensure the backend is running.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDeleteAccount = (accountId: string) => {
    const account = twilioAccounts.find((acc) => acc.id === accountId);
    const phonesToUnassign = account?.phoneNumbers || [];
    
    showConfirm(
      "Delete Account",
      "Are you sure you want to delete this Twilio account? All phone numbers will be unassigned from users.",
      "Delete",
      async () => {
        try {
          const token = localStorage.getItem("comsierge_token");
          if (!token) throw new Error("Missing session token");

          // Unassign all phone numbers from users via backend
          const usersWithThesePhones = appUsers.filter((u) => 
            u.assignedPhone && phonesToUnassign.includes(u.assignedPhone)
          );
          
          for (const user of usersWithThesePhones) {
            await fetch(`${API_URL}/auth/users/${user.id}/phone`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ phoneNumber: null }),
            });
          }

          // Delete account in backend (DB) by SID (reliable)
          if (!account?.accountSid) {
            throw new Error("Missing Account SID for deletion");
          }

          const deleteResp = await fetch(
            `${API_URL}/admin/twilio-accounts/by-sid/${encodeURIComponent(account.accountSid)}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          const deleteData = await deleteResp.json().catch(() => null);
          if (!deleteResp.ok || !deleteData?.success) {
            throw new Error(deleteData?.message || "Failed to delete Twilio account");
          }

          // Refresh accounts/users from server so UI matches DB
          await fetchTwilioAccounts();
          fetchUsers();

          toast.success("Twilio account deleted");
        } catch (error) {
          console.error("Delete account error:", error);
          toast.error(error instanceof Error ? error.message : "Failed to fully delete account");
        }
        hideConfirm();
      }
    );
  };

  const handleDeletePhoneFromAccount = (accountId: string, phone: string) => {
    const account = twilioAccounts.find((acc) => acc.id === accountId);
    if (!account) {
      toast.error("Account not found");
      return;
    }

    showConfirm(
      "Remove Phone Number",
      `Are you sure you want to remove ${phone}? This will also unassign it from any user.`,
      "Remove",
      async () => {
        try {
          const token = localStorage.getItem("comsierge_token");
          if (!token) {
            toast.error("Please log in again");
            hideConfirm();
            return;
          }

          // Call backend to remove phone from TwilioAccount in MongoDB
          const response = await fetch(
            `${API_URL}/admin/twilio-accounts/${encodeURIComponent(account.accountSid)}/phones/${encodeURIComponent(phone)}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          const data = await response.json();
          if (!response.ok || !data.success) {
            throw new Error(data.message || "Failed to remove phone number");
          }
          
          // Update local accounts state
          const updatedAccounts = twilioAccounts.map((acc) => {
            if (acc.id === accountId) {
              const updatedPhones = acc.phoneNumbers.filter((p) => p !== phone);
              return { ...acc, phoneNumbers: updatedPhones };
            }
            return acc;
          }).filter((acc) => acc.phoneNumbers.length > 0); // Remove accounts with no phones
          
          setTwilioAccounts(updatedAccounts);
          saveTwilioAccounts(updatedAccounts);
          
          // Update local user state
          const updatedUsers = appUsers.map((user) =>
            user.assignedPhone === phone ? { ...user, assignedPhone: null } : user
          );
          setAppUsers(updatedUsers);
          
          toast.success(data.accountDeleted ? "Phone removed. Account deleted (no remaining numbers)." : "Phone number removed");

          // Refresh accounts from server so UI matches DB
          await fetchTwilioAccounts();
        } catch (error: any) {
          console.error("Delete phone error:", error);
          toast.error(error.message || "Failed to remove phone number");
        }
        hideConfirm();
      }
    );
  };

  const handleAssignPhone = (userId: string) => {
    const phone = selectedPhones[userId];
    if (!phone) {
      toast.error("Please select a phone number");
      return;
    }

    const userName = appUsers.find((u) => u.id === userId)?.username || "this user";
    showConfirm(
      "Assign Phone Number",
      `Are you sure you want to assign ${phone} to ${userName}?`,
      "Assign",
      async () => {
        try {
          // Update in backend
          const response = await fetch(`${API_URL}/auth/users/${userId}/phone`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phoneNumber: phone }),
          });
          
          if (!response.ok) {
            throw new Error("Failed to assign phone");
          }
          
          // Update local state
          const updatedUsers = appUsers.map((user) =>
            user.id === userId ? { ...user, assignedPhone: phone } : user
          );
          setAppUsers(updatedUsers);
          setSelectedPhones({ ...selectedPhones, [userId]: "" });
          toast.success("Phone number assigned");
        } catch (error) {
          console.error("Assign phone error:", error);
          toast.error("Failed to assign phone number");
        }
        hideConfirm();
      }
    );
  };

  const handleUnassignPhone = (userId: string) => {
    const userName = appUsers.find((u) => u.id === userId)?.username || "this user";
    const userPhone = appUsers.find((u) => u.id === userId)?.assignedPhone || "";
    showConfirm(
      "Unassign Phone Number",
      `Are you sure you want to unassign ${userPhone} from ${userName}? This will also clear their messages.`,
      "Unassign",
      async () => {
        try {
          // Update in backend
          const response = await fetch(`${API_URL}/auth/users/${userId}/phone`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phoneNumber: null }),
          });
          
          if (!response.ok) {
            throw new Error("Failed to unassign phone");
          }
          
          // Update local state
          const updatedUsers = appUsers.map((user) =>
            user.id === userId ? { ...user, assignedPhone: null } : user
          );
          setAppUsers(updatedUsers);
          toast.success("Phone number unassigned");
        } catch (error) {
          console.error("Unassign phone error:", error);
          toast.error("Failed to unassign phone number");
        }
        hideConfirm();
      }
    );
  };

  const handleDeleteUser = (userId: string) => {
    const userName = appUsers.find((u) => u.id === userId)?.username || "this user";
    showConfirm(
      "Delete User",
      `Are you sure you want to delete ${userName}? This action cannot be undone.`,
      "Delete",
      async () => {
        try {
          // Delete from backend
          const response = await fetch(`${API_URL}/auth/users/${userId}`, {
            method: "DELETE",
          });
          
          if (!response.ok) {
            throw new Error("Failed to delete user");
          }
          
          // Update local state
          const updatedUsers = appUsers.filter((user) => user.id !== userId);
          setAppUsers(updatedUsers);
          toast.success("User deleted from database");
        } catch (error) {
          console.error("Delete user error:", error);
          toast.error("Failed to delete user");
        }
        hideConfirm();
      }
    );
  };

  const availablePhones = getAvailablePhones(twilioAccounts, appUsers);
  const assignedPhones = appUsers
    .filter((u) => u.assignedPhone)
    .map((u) => ({ phone: u.assignedPhone!, user: u.username }));

  const sidebarItems = [
    { id: "phones" as Tab, icon: Phone, label: "Phone Numbers" },
    { id: "users" as Tab, icon: Users, label: "User Management" },
    { id: "tickets" as Tab, icon: Headphones, label: "Support Tickets", badge: ticketCounts.open > 0 ? ticketCounts.open : undefined },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "phones":
        return (
          <div className="space-y-6">
            {/* Add Phone Number Section */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-medium text-gray-800 mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4" /> Add Phone Number
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={newPhoneNumber}
                    onChange={(e) => setNewPhoneNumber(e.target.value)}
                    placeholder="+12025550123"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 text-sm focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Twilio Account SID</label>
                  <input
                    type="text"
                    value={newAccountSid}
                    onChange={(e) => setNewAccountSid(e.target.value)}
                    placeholder="ACxxxxxxxxxx"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 text-sm focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Twilio Auth Token</label>
                  <div className="relative">
                    <input
                      type={showNewAuthToken ? "text" : "password"}
                      value={newAuthToken}
                      onChange={(e) => setNewAuthToken(e.target.value)}
                      placeholder="Auth token"
                      className="w-full px-3 py-2 pr-10 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 text-sm focus:outline-none focus:border-indigo-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewAuthToken(!showNewAuthToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showNewAuthToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleAddPhoneNumber}
                    disabled={isVerifying}
                    className={cn(
                      "w-full h-[38px] text-white text-sm",
                      verificationStatus === "success"
                        ? "bg-green-500 hover:bg-green-600"
                        : verificationStatus === "error"
                        ? "bg-red-500 hover:bg-red-600"
                        : "bg-indigo-500 hover:bg-indigo-600"
                    )}
                  >
                    {isVerifying ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying...</>
                    ) : verificationStatus === "success" ? (
                      <><CheckCircle2 className="w-4 h-4 mr-2" /> Verified!</>
                    ) : verificationStatus === "error" ? (
                      <><AlertCircle className="w-4 h-4 mr-2" /> Failed</>
                    ) : (
                      "Verify & Add"
                    )}
                  </Button>
                </div>
              </div>
              {verificationMessage && (
                <div className={cn(
                  "mt-3 px-3 py-2 rounded-lg text-xs",
                  verificationStatus === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                )}>
                  {verificationMessage}
                </div>
              )}
            </div>

            {/* All Twilio Accounts Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-medium text-gray-800 flex items-center gap-2">
                  <Server className="w-4 h-4" /> All Twilio Accounts
                </h3>
              </div>
              {twilioAccounts.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  No Twilio accounts added yet
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Account SID</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Auth Token</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Phone Numbers</th>
                        <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {twilioAccounts.map((account) => (
                        <tr key={account.id} className="hover:bg-gray-50">
                          <td className="px-5 py-3 text-sm text-gray-700 font-mono">{account.accountSid}</td>
                          <td className="px-5 py-3 text-sm text-gray-500 font-mono">{maskAuthToken(account.authToken || "")}</td>
                          <td className="px-5 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              {account.phoneNumbers.map((phone) => {
                                const assignedTo = appUsers.find((u) => u.assignedPhone === phone);
                                const isAssigned = !!assignedTo;
                                return (
                                  <span
                                    key={phone}
                                    className={cn(
                                      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs",
                                      isAssigned
                                        ? "bg-indigo-50 text-indigo-700"
                                        : "bg-green-50 text-green-700"
                                    )}
                                    title={isAssigned ? `Assigned to ${assignedTo.username}` : "Available"}
                                  >
                                    {phone}
                                    {isAssigned ? (
                                      <span className="text-[10px] text-indigo-500">({assignedTo.username})</span>
                                    ) : (
                                      <span className="text-[10px] text-green-500">(available)</span>
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeletePhoneFromAccount(account.id, phone);
                                      }}
                                      className="ml-1 p-0.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                                      title="Remove this phone number"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button
                              onClick={() => handleDeleteAccount(account.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                              title="Delete account"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Available Phone Numbers */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-medium text-gray-800 flex items-center gap-2">
                  <PhoneCall className="w-4 h-4" /> Available Phone Numbers
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">Phone numbers not assigned to any user</p>
              </div>
              {availablePhones.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  No available phone numbers
                </div>
              ) : (
                <div className="p-5">
                  <div className="flex flex-wrap gap-2">
                    {availablePhones.map((phone) => (
                      <span
                        key={phone}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        {phone}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Assigned Phone Numbers */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-medium text-gray-800 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Assigned Phone Numbers
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">Phone numbers currently assigned to users</p>
              </div>
              {assignedPhones.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  No phone numbers assigned yet
                </div>
              ) : (
                <div className="p-5">
                  <div className="flex flex-wrap gap-2">
                    {assignedPhones.map(({ phone, user }) => (
                      <span
                        key={phone}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        {phone}
                        <span className="text-indigo-400">-&gt;</span>
                        <span className="font-medium">{user}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case "users":
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-medium text-gray-800 flex items-center gap-2">
                  <Users className="w-4 h-4" /> User Management
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">Manage users and assign phone numbers</p>
              </div>
              {appUsers.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  No users found
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Username</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Personal Phone</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Assigned Phone</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {appUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-medium">
                                {user.username.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-sm text-gray-700 font-medium">{user.username}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-sm text-gray-600">{user.personalPhone}</td>
                          <td className="px-5 py-3">
                            {user.assignedPhone ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 rounded text-xs">
                                <Phone className="w-3 h-3" />
                                {user.assignedPhone}
                              </span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <select
                                  value={selectedPhones[user.id] || ""}
                                  onChange={(e) => setSelectedPhones({ ...selectedPhones, [user.id]: e.target.value })}
                                  className="px-2 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs text-gray-700 focus:outline-none focus:border-indigo-400 min-w-[150px]"
                                >
                                  <option value="">Select phone...</option>
                                  {availablePhones.map((phone) => (
                                    <option key={phone} value={phone}>{phone}</option>
                                  ))}
                                </select>
                                <Button
                                  onClick={() => handleAssignPhone(user.id)}
                                  disabled={!selectedPhones[user.id]}
                                  className="h-7 px-2.5 text-xs bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50"
                                >
                                  Assign
                                </Button>
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1">
                              {user.assignedPhone && (
                                <Button
                                  variant="outline"
                                  onClick={() => handleUnassignPhone(user.id)}
                                  className="h-7 px-2.5 text-xs bg-indigo-100 border-indigo-200 text-gray-900 hover:bg-indigo-100 hover:border-indigo-200"
                                >
                                  Unassign
                                </Button>
                              )}
                              <button
                                onClick={() => handleDeleteUser(user.id)}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                title="Delete user"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );

      case "tickets":
        // Filter tickets by status
        const baseFilteredTickets = ticketFilter === "all" 
          ? tickets 
          : tickets.filter(t => t.status === ticketFilter);
        
        // Sort tickets: unread (no support reply yet) first, then by date (newest first)
        const filteredTickets = [...baseFilteredTickets].sort((a, b) => {
          // Check if ticket is "unread" (status not resolved and no support replies)
          const aHasSupportReply = a.replies.some(r => r.isSupport);
          const bHasSupportReply = b.replies.some(r => r.isSupport);
          const aIsUnread = a.status !== "resolved" && !aHasSupportReply;
          const bIsUnread = b.status !== "resolved" && !bHasSupportReply;
          
          // Unread tickets come first
          if (aIsUnread && !bIsUnread) return -1;
          if (!aIsUnread && bIsUnread) return 1;
          
          // Then sort by date (newest first)
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        return (
          <div className="space-y-6">
            {/* Ticket Stats */}
            <div className="grid grid-cols-3 gap-4">
              <button 
                onClick={() => setTicketFilter("all")}
                className={cn(
                  "bg-white rounded-xl border p-4 text-left transition-colors",
                  ticketFilter === "all" ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"
                )}
              >
                <div className="text-2xl font-bold text-gray-800">{ticketCounts.total}</div>
                <div className="text-xs text-gray-500">Total Tickets</div>
              </button>
              <button 
                onClick={() => setTicketFilter("in-progress")}
                className={cn(
                  "bg-white rounded-xl border p-4 text-left transition-colors",
                  ticketFilter === "in-progress" ? "border-yellow-500 bg-yellow-50" : "border-gray-200 hover:border-gray-300"
                )}
              >
                <div className="text-2xl font-bold text-yellow-600">{ticketCounts.inProgress}</div>
                <div className="text-xs text-gray-500">In Progress</div>
              </button>
              <button 
                onClick={() => setTicketFilter("resolved")}
                className={cn(
                  "bg-white rounded-xl border p-4 text-left transition-colors",
                  ticketFilter === "resolved" ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-gray-300"
                )}
              >
                <div className="text-2xl font-bold text-green-600">{ticketCounts.resolved}</div>
                <div className="text-xs text-gray-500">Resolved</div>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Tickets List */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50">
                  <h3 className="text-sm font-medium text-gray-800">
                    {ticketFilter === "all" ? "All Tickets" : `${ticketFilter.charAt(0).toUpperCase() + ticketFilter.slice(1)} Tickets`}
                  </h3>
                </div>
                <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                  {filteredTickets.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <Headphones className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No {ticketFilter === "all" ? "" : ticketFilter + " "}tickets found</p>
                    </div>
                  ) : (
                    filteredTickets.map((ticket) => (
                      <button
                        key={ticket.id}
                        onClick={() => setSelectedTicket(ticket)}
                        className={cn(
                          "w-full p-4 text-left hover:bg-gray-50 transition-colors",
                          selectedTicket?.id === ticket.id && "bg-indigo-50 border-l-2 border-indigo-500"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={cn(
                                "px-2 py-0.5 rounded text-xs font-medium",
                                ticket.status === "open" && "bg-red-100 text-red-700",
                                ticket.status === "in-progress" && "bg-yellow-100 text-yellow-700",
                                ticket.status === "resolved" && "bg-green-100 text-green-700"
                              )}>
                                {ticket.status}
                              </span>
                            </div>
                            <h4 className="text-sm font-medium text-gray-800 truncate">{ticket.subject}</h4>
                            <p className="text-xs text-gray-500 truncate">{ticket.message}</p>
                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                              <span>{ticket.userName}</span>
                              <span>•</span>
                              <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                          {ticket.replies.length > 0 && (
                            <span className="px-2 py-1 bg-indigo-100 text-indigo-600 rounded text-xs">
                              {ticket.replies.length} replies
                            </span>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Ticket Detail */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {selectedTicket ? (
                  <div className="flex flex-col h-[600px]">
                    {/* Ticket Header */}
                    <div className="p-4 border-b border-gray-100 bg-gray-50">
                      <div className="flex items-center justify-between mb-2">
                        <button 
                          onClick={() => setSelectedTicket(null)}
                          className="text-gray-500 hover:text-gray-700 lg:hidden"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className={cn(
                          "px-2 py-0.5 rounded text-xs font-medium",
                          selectedTicket.status === "open" && "bg-red-100 text-red-700",
                          selectedTicket.status === "in-progress" && "bg-yellow-100 text-yellow-700",
                          selectedTicket.status === "resolved" && "bg-green-100 text-green-700"
                        )}>
                          {selectedTicket.status}
                        </span>
                      </div>
                      <h3 className="text-sm font-medium text-gray-800">{selectedTicket.subject}</h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <span>{selectedTicket.userName}</span>
                        <span>({selectedTicket.userEmail})</span>
                        <span>•</span>
                        <span>{selectedTicket.category}</span>
                      </div>
                    </div>

                    {/* Conversation */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {/* Original Message */}
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-medium">
                            {selectedTicket.userName.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs font-medium text-gray-700">{selectedTicket.userName}</span>
                          <span className="text-xs text-gray-400">
                            {new Date(selectedTicket.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedTicket.message}</p>
                      </div>

                      {/* Replies - skip first one since it's the original message */}
                      {selectedTicket.replies.slice(1).map((reply, index) => (
                        <div 
                          key={index}
                          className={cn(
                            "rounded-lg p-3",
                            reply.isSupport ? "bg-indigo-50 ml-4" : "bg-gray-50"
                          )}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                              reply.isSupport ? "bg-indigo-200 text-indigo-700" : "bg-gray-200 text-gray-700"
                            )}>
                              {(reply.authorName || "U").charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs font-medium text-gray-700">
                              {reply.authorName || "User"}
                              {reply.isSupport && <span className="ml-1 text-indigo-600">(Support)</span>}
                            </span>
                            <span className="text-xs text-gray-400">
                              {new Date(reply.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{reply.message}</p>
                        </div>
                      ))}
                      <div ref={ticketMessagesEndRef} />
                    </div>

                    {/* Reply Input - only show for non-resolved tickets */}
                    {selectedTicket.status !== "resolved" ? (
                    <div className="p-4 border-t border-gray-100 bg-gray-50">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={ticketReplyMessage}
                          onChange={(e) => setTicketReplyMessage(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key === "Enter" && ticketReplyMessage.trim()) {
                              const updated = await addReplyAsync(selectedTicket.id, ticketReplyMessage);
                              setTicketReplyMessage("");
                              if (updated) {
                                setSelectedTicket(updated);
                                await fetchTickets();
                              }
                            }
                          }}
                          placeholder="Type your reply..."
                          className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
                        />
                        <Button
                          onClick={async () => {
                            if (ticketReplyMessage.trim()) {
                              const updated = await addReplyAsync(selectedTicket.id, ticketReplyMessage);
                              setTicketReplyMessage("");
                              if (updated) {
                                setSelectedTicket(updated);
                                await fetchTickets();
                              }
                            }
                          }}
                          className="px-4 bg-indigo-500 hover:bg-indigo-600 text-white"
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button
                          onClick={() => {
                            showConfirm(
                              "Mark Ticket as Resolved",
                              "Are you sure you want to mark this ticket as resolved? The user will be notified and won't be able to reply anymore.",
                              "Mark Resolved",
                              async () => {
                                const updated = await updateTicketStatusAsync(selectedTicket.id, "resolved");
                                if (updated) {
                                  setSelectedTicket(updated);
                                  await fetchTickets();
                                  toast.success("Ticket marked as resolved");
                                }
                                hideConfirm();
                              }
                            );
                          }}
                          variant="outline"
                          className="text-xs px-3 py-1 h-auto border-green-300 text-green-700 hover:bg-green-50"
                        >
                          <CheckCircle className="w-3 h-3 mr-1" /> Mark Resolved
                        </Button>
                      </div>
                    </div>
                    ) : (
                      <div className="p-4 border-t border-gray-100 bg-green-50 text-center">
                        <div className="flex items-center justify-center gap-2 text-green-700">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-sm font-medium">This ticket has been resolved</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-[600px] flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <Headphones className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-sm">Select a ticket to view details</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        onConfirm={confirmDialog.onConfirm}
        onCancel={hideConfirm}
      />
      <div className="dashboard-layout h-screen bg-gray-100 flex overflow-hidden" style={{ backgroundColor: '#ffffff', color: '#374151' }}>
        {/* Sidebar */}
        <aside className="w-56 h-full bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <Logo className="text-gray-800" />
          </div>

          <nav className="flex-1 p-2 space-y-0.5 overflow-auto">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                  activeTab === item.id
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-600 hover:bg-gray-100"
                )}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="p-2 border-t border-gray-100">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 h-full flex flex-col overflow-hidden">
          {/* Header */}
          <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
            <h1 className="text-sm font-medium text-gray-800">
              {activeTab === "phones" && "Phone Numbers"}
              {activeTab === "users" && "User Management"}
              {activeTab === "tickets" && "Support Tickets"}
            </h1>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <button
                onClick={handleRefresh}
                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                title="Refresh data"
              >
                <RefreshCw className={cn("w-4 h-4", isLoadingUsers && "animate-spin")} />
              </button>
              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-medium">
                A
              </div>
              <span>admin</span>
            </div>
          </header>

          {/* Content */}
          <div className="flex-1 p-6 overflow-auto">
            {renderContent()}
          </div>
        </main>
      </div>
    </>
  );
};

export default AdminDashboard;
