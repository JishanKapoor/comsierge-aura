// API-based store for rules (replaces localStorage)
import { API_BASE_URL } from "@/config";

// Event emitter for rules changes - allows components to subscribe to rule updates
type RulesChangeListener = () => void;
const rulesChangeListeners: Set<RulesChangeListener> = new Set();

export const onRulesChange = (listener: RulesChangeListener): (() => void) => {
  rulesChangeListeners.add(listener);
  return () => { rulesChangeListeners.delete(listener); };
};

const notifyRulesChange = () => {
  rulesChangeListeners.forEach(listener => listener());
};

export interface ActiveRule {
  id: string;
  rule: string;
  active: boolean;
  createdAt: string;
  type?: "transfer" | "auto-reply" | "block" | "forward" | "priority" | "custom" | "message-notify";
  conditions?: Record<string, any>;
  actions?: Record<string, any>;
  schedule?: {
    mode: "always" | "duration" | "custom";
    durationHours?: number;
    startTime?: string;
    endTime?: string;
  };
  transferDetails?: {
    mode: "calls" | "messages" | "both";
    priority: "all" | "high-priority";
    priorityFilter?: string;
    contactName: string;
    contactPhone: string;
  };
}

const getAuthHeaders = () => {
  const token = localStorage.getItem("comsierge_token");
  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };
};

// Fetch all rules from API
export const fetchRules = async (): Promise<ActiveRule[]> => {
  try {
    // First, clean up any duplicate transfer rules
    try {
      await fetch(`${API_BASE_URL}/api/rules/cleanup/transfers`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
    } catch {
      // Ignore cleanup errors
    }
    
    const response = await fetch(`${API_BASE_URL}/api/rules`, {
      headers: getAuthHeaders(),
    });
    const data = await response.json();
    console.log("Fetched rules:", data.count, "rules");
    if (data.success) {
      const rules = data.data.map((r: any) => ({
        id: r._id,
        rule: r.rule,
        active: r.active,
        createdAt: new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        type: r.type,
        conditions: r.conditions,
        actions: r.actions,
        schedule: r.schedule,
        transferDetails: r.transferDetails,
      }));
      console.log("Rules by type:", rules.reduce((acc: Record<string, number>, r: ActiveRule) => {
        acc[r.type || 'custom'] = (acc[r.type || 'custom'] || 0) + 1;
        return acc;
      }, {}));
      return rules;
    }
    console.error("Fetch rules failed:", data.message || "Unknown error");
    return [];
  } catch (error) {
    console.error("Fetch rules error:", error);
    return [];
  }
};

// Create a new rule
export const createRule = async (rule: Omit<ActiveRule, "id" | "createdAt">): Promise<ActiveRule | null> => {
  try {
    console.log("Creating rule:", JSON.stringify(rule, null, 2));
    const response = await fetch(`${API_BASE_URL}/api/rules`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(rule),
    });
    const data = await response.json();
    console.log("Create rule response:", data);
    if (data.success) {
      // Notify listeners that rules have changed
      notifyRulesChange();
      return {
        id: data.data._id,
        rule: data.data.rule,
        active: data.data.active,
        createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        type: data.data.type,
        conditions: data.data.conditions,
        actions: data.data.actions,
        schedule: data.data.schedule,
        transferDetails: data.data.transferDetails,
      };
    }
    console.error("Create rule failed:", data.message || "Unknown error");
    return null;
  } catch (error) {
    console.error("Create rule error:", error);
    return null;
  }
};

// Update a rule
export const updateRule = async (id: string, updates: Partial<ActiveRule>): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/rules/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    const data = await response.json();
    if (data.success) {
      notifyRulesChange();
    }
    return data.success;
  } catch (error) {
    console.error("Update rule error:", error);
    return false;
  }
};

// Delete a rule
export const deleteRule = async (id: string): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/rules/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    const data = await response.json();
    if (data.success) {
      notifyRulesChange();
    }
    return data.success;
  } catch (error) {
    console.error("Delete rule error:", error);
    return false;
  }
};

// Toggle rule active status
export const toggleRule = async (id: string): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/rules/${id}/toggle`, {
      method: "PUT",
      headers: getAuthHeaders(),
    });
    const data = await response.json();
    if (data.success) {
      notifyRulesChange();
    }
    return data.success;
  } catch (error) {
    console.error("Toggle rule error:", error);
    return false;
  }
};

// Legacy compatibility
export const loadRules = async (): Promise<ActiveRule[]> => {
  return fetchRules();
};

export const saveRules = async (rules: ActiveRule[]): Promise<void> => {
  console.warn("saveRules is deprecated - use createRule/updateRule/deleteRule");
};

// Helper to format schedule for display
export const formatSchedule = (schedule?: ActiveRule["schedule"]): string => {
  if (!schedule || schedule.mode === "always") return "Always active";
  if (schedule.mode === "duration" && schedule.durationHours) {
    return `For ${schedule.durationHours} hour${schedule.durationHours > 1 ? "s" : ""}`;
  }
  if (schedule.mode === "custom" && schedule.startTime && schedule.endTime) {
    const start = new Date(schedule.startTime);
    const end = new Date(schedule.endTime);
    const formatDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    return `${formatDate(start)} -> ${formatDate(end)}`;
  }
  return "Always active";
};
