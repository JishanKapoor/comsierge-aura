export const AURA_CLEAR_CHATS_EVENT = "comsierge:aura:clear-chats";

type AuraClearChatsDetail = { source?: string };

export function isClearChatCommand(text: string): boolean {
  const t = (text || "").trim().toLowerCase();
  if (!t) return false;

  // If the user specifies a contact name (e.g., "delete chat of jeremy", "delete jeremy's chat"),
  // this is NOT a clear-AI-chat command - it's a request to delete a specific conversation
  // Check for patterns like "chat of X", "chat with X", "chat from X", "X's chat", "conversation with X"
  const hasContactTarget = /\b(chat|convo|conversation|thread|messages?)\s+(of|with|from|for)\s+\w+/i.test(t) ||
                           /\b\w+'s\s+(chat|convo|conversation|thread|messages?)\b/i.test(t) ||
                           /\b(delete|remove|clear)\s+\w+('s)?\s*(chat|convo|conversation)?\s*$/i.test(t);
  if (hasContactTarget) {
    return false;
  }

  // Intent-based detection: does the user want to clear/delete/reset the chat/conversation/history?
  // Action words
  const actionWords = /\b(clear|delete|remove|reset|wipe|erase|clean|empty|flush|nuke|start\s*over|fresh\s*start)\b/;
  // Target words - "this" refers to the AI chat itself
  const targetWords = /\b(chat|chats|convo|conversation|conversations|history|messages|thread|threads|this|everything|all)\b/;
  
  // If both an action word and target word are present, it's likely a clear intent
  if (actionWords.test(t) && targetWords.test(t)) {
    return true;
  }

  // Direct phrases that clearly mean clear
  if (/\b(start\s*(over|fresh)|fresh\s*start|new\s*chat|begin\s*again)\b/.test(t)) {
    return true;
  }

  return false;
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
