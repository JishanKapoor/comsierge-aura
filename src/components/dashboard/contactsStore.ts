import type { Contact } from "./types";

const CONTACTS_STORAGE_KEY = "comsierge.contacts";

const safeParseJson = <T,>(value: string | null): T | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

export const loadContacts = (fallback: Contact[]): Contact[] => {
  if (typeof window === "undefined") return fallback;
  const saved = safeParseJson<Contact[]>(window.localStorage.getItem(CONTACTS_STORAGE_KEY));
  return Array.isArray(saved) && saved.length > 0 ? saved : fallback;
};

export const saveContacts = (contacts: Contact[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contacts));
};
