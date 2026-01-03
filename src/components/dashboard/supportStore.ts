// Support ticket store - API-based (shared between user and admin via MongoDB)

export interface TicketReply {
  message: string;
  isSupport: boolean;
  timestamp: string;
  authorName?: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  subject: string;
  category: string;
  message: string;
  status: "open" | "in-progress" | "resolved";
  priority: "low" | "medium" | "high";
  createdAt: string;
  updatedAt: string;
  replies: TicketReply[];
}

const getAuthHeaders = () => {
  const token = localStorage.getItem("comsierge_token");
  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };
};

// Load all tickets from API
export function loadTickets(): SupportTicket[] {
  // This is sync for backwards compat - use loadTicketsAsync for new code
  return [];
}

// Async version - use this one
export async function loadTicketsAsync(status?: string): Promise<SupportTicket[]> {
  try {
    const url = status && status !== "all" 
      ? `/api/support/tickets?status=${status}`
      : "/api/support/tickets";
    const response = await fetch(url, {
      headers: getAuthHeaders(),
    });
    const data = await response.json();
    if (data.success) {
      return data.data;
    }
    return [];
  } catch (error) {
    console.error("Load tickets error:", error);
    return [];
  }
}

// Save all tickets - no longer needed, API handles this
export function saveTickets(tickets: SupportTicket[]): void {
  // No-op - API handles persistence
}

// Create a new ticket
export async function createTicketAsync(
  category: string,
  message: string,
  subject?: string
): Promise<SupportTicket | null> {
  try {
    const response = await fetch("/api/support/tickets", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ category, message, subject }),
    });
    const data = await response.json();
    if (data.success) {
      return data.data;
    }
    return null;
  } catch (error) {
    console.error("Create ticket error:", error);
    return null;
  }
}

// Sync version for backwards compat
export function createTicket(
  userId: string,
  userName: string,
  userEmail: string,
  category: string,
  message: string
): SupportTicket {
  // Create a placeholder - caller should use createTicketAsync
  const now = new Date();
  return {
    id: `ticket-${Date.now()}`,
    userId,
    userName,
    userEmail,
    subject: category,
    category,
    message,
    status: "open",
    priority: "medium",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    replies: [],
  };
}

// Add a reply to a ticket
export async function addReplyAsync(
  ticketId: string,
  message: string
): Promise<SupportTicket | null> {
  try {
    const response = await fetch(`/api/support/tickets/${ticketId}/reply`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ message }),
    });
    const data = await response.json();
    if (data.success) {
      return data.data;
    }
    return null;
  } catch (error) {
    console.error("Add reply error:", error);
    return null;
  }
}

// Sync version for backwards compat
export function addReply(
  ticketId: string,
  message: string,
  isSupport: boolean,
  authorName: string
): SupportTicket | null {
  // No-op - use addReplyAsync
  return null;
}

// Update ticket status
export async function updateTicketStatusAsync(
  ticketId: string,
  status: SupportTicket["status"]
): Promise<SupportTicket | null> {
  try {
    const response = await fetch(`/api/support/tickets/${ticketId}/status`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ status }),
    });
    const data = await response.json();
    if (data.success) {
      return data.data;
    }
    return null;
  } catch (error) {
    console.error("Update status error:", error);
    return null;
  }
}

// Sync version for backwards compat
export function updateTicketStatus(
  ticketId: string,
  status: SupportTicket["status"]
): SupportTicket | null {
  // No-op - use updateTicketStatusAsync
  return null;
}

// Update ticket priority
export async function updateTicketPriorityAsync(
  ticketId: string,
  priority: SupportTicket["priority"]
): Promise<SupportTicket | null> {
  try {
    const response = await fetch(`/api/support/tickets/${ticketId}/priority`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ priority }),
    });
    const data = await response.json();
    if (data.success) {
      return data.data;
    }
    return null;
  } catch (error) {
    console.error("Update priority error:", error);
    return null;
  }
}

// Sync version for backwards compat
export function updateTicketPriority(
  ticketId: string,
  priority: SupportTicket["priority"]
): SupportTicket | null {
  // No-op - use updateTicketPriorityAsync
  return null;
}

// Get tickets for a specific user - use loadTicketsAsync instead
export function getUserTickets(userId: string): SupportTicket[] {
  return [];
}

// Get ticket counts by status
export async function getTicketCountsAsync(): Promise<{
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
}> {
  try {
    const response = await fetch("/api/support/tickets/counts", {
      headers: getAuthHeaders(),
    });
    const data = await response.json();
    if (data.success) {
      return data.data;
    }
    return { total: 0, open: 0, inProgress: 0, resolved: 0 };
  } catch (error) {
    console.error("Get counts error:", error);
    return { total: 0, open: 0, inProgress: 0, resolved: 0 };
  }
}

// Sync version for backwards compat
export function getTicketCounts(): {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
} {
  return { total: 0, open: 0, inProgress: 0, resolved: 0 };
}

// Delete a ticket (admin only)
export async function deleteTicketAsync(ticketId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/support/tickets/${ticketId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error("Delete ticket error:", error);
    return false;
  }
}

// Sync version for backwards compat
export function deleteTicket(ticketId: string): boolean {
  // No-op - use deleteTicketAsync
  return false;
}

