export const AURA_CLEAR_CHATS_EVENT = "comsierge:aura:clear-chats";

type AuraClearChatsDetail = { source?: string };

export function isClearChatCommand(text: string): boolean {
  const t = (text || "").trim().toLowerCase();
  if (!t) return false;

  // Common phrases users try
  if (t === "clear" || t === "clear chat" || t === "clear chats" || t === "clear the chat" || t === "clear the chats") {
    return true;
  }

  // Slightly broader matching, but still intent-specific
  return /^(clear|reset|wipe)\s+(the\s+)?(chat|chats|chat\s+history|history)$/i.test(t);
}

export function broadcastClearAuraChats(source?: string) {
  if (typeof window === "undefined") return;
  const detail: AuraClearChatsDetail = source ? { source } : {};
  window.dispatchEvent(new CustomEvent(AURA_CLEAR_CHATS_EVENT, { detail }));
}

export function onClearAuraChats(handler: (detail: AuraClearChatsDetail) => void) {
  if (typeof window === "undefined") return () => {};

  const listener = (event: Event) => {
    const custom = event as CustomEvent;
    handler((custom.detail || {}) as AuraClearChatsDetail);
  };

  window.addEventListener(AURA_CLEAR_CHATS_EVENT, listener as EventListener);
  return () => window.removeEventListener(AURA_CLEAR_CHATS_EVENT, listener as EventListener);
}

export function clearAuraRulesChatStorage() {
  try {
    localStorage.removeItem("aura_chat_history");
  } catch {
    // ignore
  }
}
