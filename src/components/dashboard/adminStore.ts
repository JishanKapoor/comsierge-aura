// Admin store for Twilio accounts and user management

export interface TwilioAccount {
  id: string;
  accountSid: string;
  authToken: string;
  phoneNumbers: string[];
}

export interface AppUser {
  id: string;
  username: string;
  personalPhone: string;
  assignedPhone: string | null;
}

const TWILIO_ACCOUNTS_KEY = "admin_twilio_accounts";
const APP_USERS_KEY = "admin_app_users";

// Load Twilio accounts from localStorage
export function loadTwilioAccounts(): TwilioAccount[] {
  try {
    const saved = localStorage.getItem(TWILIO_ACCOUNTS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

// Save Twilio accounts to localStorage
export function saveTwilioAccounts(accounts: TwilioAccount[]): void {
  localStorage.setItem(TWILIO_ACCOUNTS_KEY, JSON.stringify(accounts));
}

// Load app users from localStorage
export function loadAppUsers(): AppUser[] {
  try {
    const saved = localStorage.getItem(APP_USERS_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
    // Return empty array - no demo users
    return [];
  } catch {
    return [];
  }
}

// Save app users to localStorage
export function saveAppUsers(users: AppUser[]): void {
  localStorage.setItem(APP_USERS_KEY, JSON.stringify(users));
}

// Get all phone numbers that are currently assigned
export function getAssignedPhones(users: AppUser[]): string[] {
  return users
    .filter((u) => u.assignedPhone !== null)
    .map((u) => u.assignedPhone as string);
}

// Get available phone numbers (not assigned to any user)
export function getAvailablePhones(accounts: TwilioAccount[], users: AppUser[]): string[] {
  const allPhones = accounts.flatMap((acc) => acc.phoneNumbers);
  const assignedPhones = getAssignedPhones(users);
  return allPhones.filter((phone) => !assignedPhones.includes(phone));
}

// Mask auth token for display (show first 4 and last 4 chars)
export function maskAuthToken(token: string): string {
  if (token.length <= 8) return "****";
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}
