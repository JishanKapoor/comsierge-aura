// Shared store for active rules across components

export interface ActiveRule {
  id: string;
  rule: string;
  active: boolean;
  createdAt: string;
  type?: "transfer" | "auto-reply" | "block" | "forward" | "priority" | "custom";
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

const STORAGE_KEY = "comsierge.activeRules";

const defaultRules: ActiveRule[] = [
  { 
    id: "1", 
    rule: "Auto-reply to delivery messages with 'Thanks, leave at door'", 
    active: true, 
    createdAt: "Dec 24",
    type: "auto-reply"
  },
  { 
    id: "2", 
    rule: "Forward urgent family messages to +1 (555) 999-8888", 
    active: true, 
    createdAt: "Dec 22",
    type: "forward"
  },
  { 
    id: "3", 
    rule: "Block messages containing 'car warranty'", 
    active: false, 
    createdAt: "Dec 20",
    type: "block"
  },
];

export const loadRules = (): ActiveRule[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore parse errors
  }
  return defaultRules;
};

export const saveRules = (rules: ActiveRule[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
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
