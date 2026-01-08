// API-based store for call records (replaces localStorage)
import { API_BASE_URL } from "@/config";

export interface CallRecord {
  id: string;
  contactPhone: string;
  contactName: string;
  direction: "incoming" | "outgoing";
  type: "incoming" | "outgoing" | "missed";
  status: string;
  twilioSid?: string;
  fromNumber: string;
  toNumber: string;
  duration: number;
  startTime?: string;
  endTime?: string;
  recordingUrl?: string;
  transcription?: string;
  createdAt: string;
  // Voicemail fields
  hasVoicemail?: boolean;
  voicemailUrl?: string;
  voicemailDuration?: number;
  voicemailTranscript?: string;
  // Routing fields
  forwardedTo?: string;
  matchedRule?: string;
  reason?: string;
}

const getAuthHeaders = () => {
  const token = localStorage.getItem("comsierge_token");
  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };
};

// Fetch call history
export const fetchCalls = async (type?: string, limit = 50): Promise<CallRecord[]> => {
  try {
    const params = new URLSearchParams({ limit: String(limit) });
    if (type && type !== "all") params.append("type", type);
    
    const response = await fetch(`${API_BASE_URL}/api/calls?${params}`, {
      headers: getAuthHeaders(),
    });
    const data = await response.json();
    if (data.success) {
      return data.data.map((c: any) => ({
        id: c._id,
        contactPhone: c.contactPhone,
        contactName: c.contactName,
        direction: c.direction,
        type: c.type,
        status: c.status,
        twilioSid: c.twilioSid,
        fromNumber: c.fromNumber,
        toNumber: c.toNumber,
        duration: c.duration,
        startTime: c.startTime,
        endTime: c.endTime,
        recordingUrl: c.recordingUrl,
        transcription: c.transcription,
        createdAt: c.createdAt,
        hasVoicemail: c.hasVoicemail,
        voicemailUrl: c.voicemailUrl,
        voicemailDuration: c.voicemailDuration,
        voicemailTranscript: c.voicemailTranscript,
        // Routing fields
        forwardedTo: c.forwardedTo,
        matchedRule: c.matchedRule,
        reason: c.reason,
      }));
    }
    return [];
  } catch (error) {
    console.error("Fetch calls error:", error);
    return [];
  }
};

// Save a call record
export const saveCallRecord = async (call: {
  contactPhone: string;
  contactName?: string;
  direction?: "incoming" | "outgoing";
  type: "incoming" | "outgoing" | "missed";
  status?: string;
  twilioSid?: string;
  fromNumber?: string;
  toNumber?: string;
  duration?: number;
  startTime?: string;
  endTime?: string;
}): Promise<CallRecord | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/calls`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(call),
    });
    const data = await response.json();
    if (data.success) {
      return {
        id: data.data._id,
        contactPhone: data.data.contactPhone,
        contactName: data.data.contactName,
        direction: data.data.direction,
        type: data.data.type,
        status: data.data.status,
        twilioSid: data.data.twilioSid,
        fromNumber: data.data.fromNumber,
        toNumber: data.data.toNumber,
        duration: data.data.duration,
        startTime: data.data.startTime,
        endTime: data.data.endTime,
        recordingUrl: data.data.recordingUrl,
        transcription: data.data.transcription,
        createdAt: data.data.createdAt,
      };
    }
    return null;
  } catch (error) {
    console.error("Save call error:", error);
    return null;
  }
};

// Update a call record
export const updateCallRecord = async (
  id: string,
  updates: Partial<Pick<CallRecord, "status" | "duration" | "endTime" | "recordingUrl" | "transcription">>
): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/calls/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error("Update call error:", error);
    return false;
  }
};

// Delete a call record
export const deleteCallRecord = async (id: string): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/calls/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error("Delete call error:", error);
    return false;
  }
};

// Fetch calls for a specific contact phone number
export const fetchCallsForContact = async (phone: string, limit = 50): Promise<CallRecord[]> => {
  try {
    const encodedPhone = encodeURIComponent(phone);
    const response = await fetch(`${API_BASE_URL}/api/calls/contact/${encodedPhone}?limit=${limit}`, {
      headers: getAuthHeaders(),
    });
    const data = await response.json();
    if (data.success) {
      return data.data.map((c: any) => ({
        id: c._id,
        contactPhone: c.contactPhone,
        contactName: c.contactName,
        direction: c.direction,
        type: c.type,
        status: c.status,
        twilioSid: c.twilioSid,
        fromNumber: c.fromNumber,
        toNumber: c.toNumber,
        duration: c.duration,
        startTime: c.startTime,
        endTime: c.endTime,
        recordingUrl: c.recordingUrl,
        transcription: c.transcription,
        createdAt: c.createdAt,
      }));
    }
    return [];
  } catch (error) {
    console.error("Fetch calls for contact error:", error);
    return [];
  }
};

// Fetch call statistics
export interface CallStats {
  total: number;
  incoming: number;
  outgoing: number;
  missed: number;
  totalDuration: number;
  todayCalls: number;
}

export const fetchCallStats = async (): Promise<CallStats | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/calls/stats`, {
      headers: getAuthHeaders(),
    });
    const data = await response.json();
    if (data.success) {
      return data.data;
    }
    return null;
  } catch (error) {
    console.error("Fetch call stats error:", error);
    return null;
  }
};
