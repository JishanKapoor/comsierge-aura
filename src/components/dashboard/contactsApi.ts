// API-based store for contacts (replaces localStorage)
import type { Contact } from "./types";
import { toE164UsPhoneNumber, isValidUsPhoneNumber } from "@/lib/validations";
import { API_BASE_URL } from "@/config";

interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

const getAuthHeaders = () => {
  const token = localStorage.getItem("comsierge_token");
  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };
};

// Fetch all contacts from API
export const fetchContacts = async (): Promise<Contact[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/contacts`, {
      headers: getAuthHeaders(),
    });
    const data = await response.json();
    if (data.success) {
      return data.data.map((c: any) => ({
        id: c._id,
        name: c.name,
        phone: c.phone,
        email: c.email || "",
        avatar: c.avatar || "",
        company: c.company || "",
        notes: c.notes || "",
        tags: c.tags || [],
        isFavorite: c.isFavorite || false,
        isBlocked: c.isBlocked || false,
      }));
    }
    return [];
  } catch (error) {
    console.error("Fetch contacts error:", error);
    return [];
  }
};

// Create a new contact - returns { contact, error }
export const createContact = async (contact: Omit<Contact, "id">): Promise<{ contact: Contact | null; error: string | null }> => {
  try {
    // Validate phone on client side first
    if (!isValidUsPhoneNumber(contact.phone)) {
      return { contact: null, error: "Invalid phone number. Enter 10 digits (with optional +1)." };
    }
    
    // Normalize phone to E.164 format
    const normalizedPhone = toE164UsPhoneNumber(contact.phone);
    if (!normalizedPhone) {
      return { contact: null, error: "Could not normalize phone number." };
    }
    
    const response = await fetch(`${API_BASE_URL}/api/contacts`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ ...contact, phone: normalizedPhone }),
    });
    const data: ApiResponse = await response.json();
    
    if (data.success && data.data) {
      return {
        contact: {
          id: data.data._id,
          name: data.data.name,
          phone: data.data.phone,
          email: data.data.email || "",
          avatar: data.data.avatar || "",
          company: data.data.company || "",
          notes: data.data.notes || "",
          tags: data.data.tags || [],
          isFavorite: data.data.isFavorite || false,
          isBlocked: data.data.isBlocked || false,
        },
        error: null,
      };
    }
    
    // Return specific error message from server
    return { contact: null, error: data.message || "Failed to create contact" };
  } catch (error) {
    console.error("Create contact error:", error);
    return { contact: null, error: "Network error. Please try again." };
  }
};

// Update a contact - returns { success, error }
export const updateContact = async (id: string, updates: Partial<Contact>): Promise<{ success: boolean; error: string | null }> => {
  try {
    // If updating phone, validate and normalize
    let normalizedUpdates = { ...updates };
    if (updates.phone) {
      if (!isValidUsPhoneNumber(updates.phone)) {
        return { success: false, error: "Invalid phone number. Enter 10 digits (with optional +1)." };
      }
      const normalizedPhone = toE164UsPhoneNumber(updates.phone);
      if (!normalizedPhone) {
        return { success: false, error: "Could not normalize phone number." };
      }
      normalizedUpdates.phone = normalizedPhone;
    }
    
    const response = await fetch(`${API_BASE_URL}/api/contacts/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(normalizedUpdates),
    });
    
    // Handle non-JSON responses (like 413 Payload Too Large)
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      if (response.status === 413) {
        return { success: false, error: "Image too large. Please use a smaller photo." };
      }
      return { success: false, error: `Server error: ${response.status} ${response.statusText}` };
    }
    
    const data: ApiResponse = await response.json();
    
    if (data.success) {
      return { success: true, error: null };
    }
    return { success: false, error: data.message || data.error || "Failed to update contact" };
  } catch (error) {
    console.error("Update contact error:", error);
    return { success: false, error: "Network error. Please try again." };
  }
};

// Delete a contact
export const deleteContact = async (id: string): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/contacts/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error("Delete contact error:", error);
    return false;
  }
};

// Legacy compatibility - load contacts (now fetches from API)
export const loadContacts = async (fallback: Contact[]): Promise<Contact[]> => {
  const contacts = await fetchContacts();
  return contacts.length > 0 ? contacts : fallback;
};

// Legacy compatibility - save contacts (now saves to API)
export const saveContacts = async (contacts: Contact[]): Promise<void> => {
  // This is a no-op now - individual operations use API
  console.warn("saveContacts is deprecated - use createContact/updateContact/deleteContact");
};
