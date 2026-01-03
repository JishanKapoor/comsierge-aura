// API-based admin store (replaces localStorage)

export interface TwilioAccount {
  id: string;
  accountSid: string;
  authToken?: string; // Only returned when creating
  phoneNumbers: string[];
  friendlyName?: string;
  isActive: boolean;
  phoneAssignments?: {
    phoneNumber: string;
    userId: string;
    userName?: string;
    assignedAt: string;
  }[];
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  phoneNumber: string | null;
  plan: string;
  isActive: boolean;
  createdAt: string;
}

const getAuthHeaders = () => {
  const token = localStorage.getItem("comsierge_token");
  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };
};

// ============ Twilio Accounts ============

export const fetchTwilioAccounts = async (): Promise<TwilioAccount[]> => {
  try {
    const response = await fetch("/api/admin/twilio-accounts", {
      headers: getAuthHeaders(),
    });
    const data = await response.json();
    if (data.success) {
      return data.data.map((a: any) => ({
        id: a._id,
        accountSid: a.accountSid,
        phoneNumbers: a.phoneNumbers || [],
        friendlyName: a.friendlyName,
        isActive: a.isActive,
        phoneAssignments: a.phoneAssignments?.map((p: any) => ({
          phoneNumber: p.phoneNumber,
          userId: p.userId?._id || p.userId,
          userName: p.userId?.name,
          assignedAt: p.assignedAt,
        })),
      }));
    }
    return [];
  } catch (error) {
    console.error("Fetch Twilio accounts error:", error);
    return [];
  }
};

export const addTwilioAccount = async (accountSid: string, authToken: string, friendlyName?: string): Promise<TwilioAccount | null> => {
  try {
    const response = await fetch("/api/admin/twilio-accounts", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ accountSid, authToken, friendlyName }),
    });
    const data = await response.json();
    if (data.success) {
      return {
        id: data.data._id,
        accountSid: data.data.accountSid,
        phoneNumbers: data.data.phoneNumbers || [],
        friendlyName: data.data.friendlyName,
        isActive: data.data.isActive,
      };
    }
    throw new Error(data.message || "Failed to add account");
  } catch (error) {
    console.error("Add Twilio account error:", error);
    throw error;
  }
};

export const removeTwilioAccount = async (id: string): Promise<boolean> => {
  try {
    const response = await fetch(`/api/admin/twilio-accounts/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error("Remove Twilio account error:", error);
    return false;
  }
};

export const refreshTwilioNumbers = async (): Promise<boolean> => {
  try {
    const response = await fetch("/api/admin/refresh-twilio-numbers", {
      method: "POST",
      headers: getAuthHeaders(),
    });
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error("Refresh Twilio numbers error:", error);
    return false;
  }
};

// ============ Users ============

export const fetchUsers = async (): Promise<AppUser[]> => {
  try {
    const response = await fetch("/api/admin/users", {
      headers: getAuthHeaders(),
    });
    const data = await response.json();
    if (data.success) {
      return data.data.map((u: any) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        phoneNumber: u.phoneNumber,
        plan: u.plan,
        isActive: u.isActive,
        createdAt: u.createdAt,
      }));
    }
    return [];
  } catch (error) {
    console.error("Fetch users error:", error);
    return [];
  }
};

export const assignPhoneToUser = async (userId: string, phoneNumber: string | null): Promise<boolean> => {
  try {
    const response = await fetch(`/api/admin/users/${userId}/assign-phone`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ phoneNumber }),
    });
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error("Assign phone error:", error);
    return false;
  }
};

export const updateUserRole = async (userId: string, role: "user" | "admin"): Promise<boolean> => {
  try {
    const response = await fetch(`/api/admin/users/${userId}/role`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ role }),
    });
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error("Update role error:", error);
    return false;
  }
};

export const fetchAvailablePhones = async (): Promise<{ all: string[]; assigned: string[]; available: string[] }> => {
  try {
    const response = await fetch("/api/admin/available-phones", {
      headers: getAuthHeaders(),
    });
    const data = await response.json();
    if (data.success) {
      return data.data;
    }
    return { all: [], assigned: [], available: [] };
  } catch (error) {
    console.error("Fetch available phones error:", error);
    return { all: [], assigned: [], available: [] };
  }
};

// ============ Legacy compatibility ============
// These functions maintain backward compatibility but now use API

export const loadTwilioAccounts = async (): Promise<TwilioAccount[]> => {
  return fetchTwilioAccounts();
};

export const saveTwilioAccounts = async (accounts: TwilioAccount[]): Promise<void> => {
  console.warn("saveTwilioAccounts is deprecated - use addTwilioAccount/removeTwilioAccount");
};

export const loadAppUsers = async (): Promise<AppUser[]> => {
  return fetchUsers();
};

export const saveAppUsers = async (users: AppUser[]): Promise<void> => {
  console.warn("saveAppUsers is deprecated - use assignPhoneToUser/updateUserRole");
};

// Get all phone numbers that are currently assigned
export const getAssignedPhones = async (): Promise<string[]> => {
  const data = await fetchAvailablePhones();
  return data.assigned;
};

// Get available phone numbers (not assigned to any user)
export const getAvailablePhones = async (): Promise<string[]> => {
  const data = await fetchAvailablePhones();
  return data.available;
};

// Mask auth token for display (show first 4 and last 4 chars)
export const maskAuthToken = (token: string): string => {
  if (token.length <= 8) return "****";
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
};
