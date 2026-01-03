const API_BASE = '/api';

export interface Reminder {
  id: string;
  type: 'personal' | 'call' | 'message';
  title: string;
  description?: string;
  datetime: string;
  scheduledAt: string;
  contactId?: string;
  contactName?: string;
  contactPhone?: string;
  isCompleted: boolean;
  completedAt?: string;
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly';
  createdAt: string;
}

export interface CreateReminderData {
  userId: string;
  type: 'personal' | 'call' | 'message';
  title: string;
  description?: string;
  scheduledAt: string;
  contactId?: string;
  contactPhone?: string;
  contactName?: string;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
}

// Get all reminders for a user
export const fetchReminders = async (userId: string, options?: { completed?: boolean; upcoming?: boolean }): Promise<Reminder[]> => {
  try {
    const params = new URLSearchParams({ userId });
    if (options?.completed !== undefined) {
      params.append('completed', String(options.completed));
    }
    if (options?.upcoming !== undefined) {
      params.append('upcoming', String(options.upcoming));
    }
    
    const res = await fetch(`${API_BASE}/reminders?${params}`);
    if (!res.ok) throw new Error('Failed to fetch reminders');
    return res.json();
  } catch (error) {
    console.error('Error fetching reminders:', error);
    return [];
  }
};

// Create a new reminder
export const createReminder = async (data: CreateReminderData): Promise<Reminder | null> => {
  try {
    const res = await fetch(`${API_BASE}/reminders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create reminder');
    return res.json();
  } catch (error) {
    console.error('Error creating reminder:', error);
    return null;
  }
};

// Update a reminder
export const updateReminder = async (id: string, updates: Partial<Reminder>): Promise<Reminder | null> => {
  try {
    const res = await fetch(`${API_BASE}/reminders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update reminder');
    return res.json();
  } catch (error) {
    console.error('Error updating reminder:', error);
    return null;
  }
};

// Delete a reminder
export const deleteReminder = async (id: string): Promise<boolean> => {
  try {
    const res = await fetch(`${API_BASE}/reminders/${id}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (error) {
    console.error('Error deleting reminder:', error);
    return false;
  }
};

// Mark reminder as completed
export const completeReminder = async (id: string): Promise<boolean> => {
  try {
    const res = await fetch(`${API_BASE}/reminders/${id}/complete`, {
      method: 'POST',
    });
    return res.ok;
  } catch (error) {
    console.error('Error completing reminder:', error);
    return false;
  }
};

// Get due reminders (for notifications)
export const getDueReminders = async (): Promise<Reminder[]> => {
  try {
    const res = await fetch(`${API_BASE}/reminders/due`);
    if (!res.ok) throw new Error('Failed to fetch due reminders');
    return res.json();
  } catch (error) {
    console.error('Error fetching due reminders:', error);
    return [];
  }
};

// Mark notification as sent
export const markNotificationSent = async (id: string): Promise<boolean> => {
  try {
    const res = await fetch(`${API_BASE}/reminders/${id}/notified`, {
      method: 'POST',
    });
    return res.ok;
  } catch (error) {
    console.error('Error marking notification:', error);
    return false;
  }
};
