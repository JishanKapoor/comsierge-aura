import * as chrono from "chrono-node";

const EMERGENCY_RE = /(\bemergency\b|\burgent\b|\basap\b|\bimmediately\b|\bright\s+now\b|\b911\b|\bhelp\s+me\b|\bsos\b|\b(mom|dad|grandma|grandpa|grandmother|grandfather|mother|father|wife|husband|son|daughter|brother|sister|baby|child|kid)\s+(is|got|has|had|was|were|been)\s*(very\s+)?(ill|sick|hurt|injured|hospitalized|hospital|accident|fell|passed|died|dying|critical)\b|\b(ill|sick|hurt|injured|hospitalized)\s+(mom|dad|grandma|grandpa|mother|father)\b)/i;
// Deadline must have actual due date context, not just the word
const DEADLINE_RE = /(\bdeadline\s+(is|by|on|at)\b|\bdue\s+(by|on|at|today|tomorrow|friday|monday|tuesday|wednesday|thursday|saturday|sunday)\b|\bdue\s+date\b|\bsubmit\s+by\b|\bpayment\s+due\b)/i;
// Meeting must have time context or action words, not just the word "meeting"
const MEETING_RE = /(\bmeeting\s+(at|@|is|for)\s*\d|\bappointment\s+(at|@|is|for|on)\b|\bschedule[d]?\s+(call|meeting|appointment)\b|\breschedule\b|\bcall\s+(at|@)\s*\d|\bzoom\s+(at|@|call|meeting)\b|\binterview\s+(at|@|is|on)\b)/i;

// Generic short messages that should NEVER be priority
const NEVER_PRIORITY_RE = /^(spam|spam message|test|testing|hello|hi|hey|important|check|checking)[!?.\s]*$/i;

/**
 * Returns a small, deterministic priority context derived from message text.
 * This is used to make "priority" time-aware (meeting/deadline expiry) and keep emergencies sticky.
 */
export function detectPriorityContext({
  text,
  category,
  aiPriority,
  now: nowOverride,
} = {}) {
  const now = nowOverride instanceof Date ? nowOverride : new Date();
  const raw = String(text || "").trim();
  if (!raw) return null;
  
  // Short generic messages are NEVER priority, even if they contain trigger words
  if (raw.length <= 25 && NEVER_PRIORITY_RE.test(raw)) {
    return null;
  }

  let kind = null;

  if (EMERGENCY_RE.test(raw)) {
    // Make sure it's not just someone saying "spam" with "help" nearby
    if (/spam/i.test(raw)) return null;
    kind = "emergency";
  } else if (DEADLINE_RE.test(raw)) {
    kind = "deadline";
  } else if (MEETING_RE.test(raw) || String(category || "").toLowerCase() === "meeting") {
    // For category-based detection, require actual meeting context
    if (String(category || "").toLowerCase() === "meeting" && !MEETING_RE.test(raw)) {
      // AI said meeting category but no time context - treat as important instead
      if (String(aiPriority || "").toLowerCase() === "high") {
        kind = "important";
      } else {
        return null;
      }
    } else {
      kind = "meeting";
    }
  } else if (String(aiPriority || "").toLowerCase() === "high") {
    // High priority without a clear time signal (often "important")
    kind = "important";
  } else {
    return null;
  }

  let eventAt = null;
  if (kind === "meeting" || kind === "deadline") {
    // Prefer future dates if ambiguous (e.g., "Friday")
    const parsed = chrono.parseDate(raw, now, { forwardDate: true });
    if (parsed && !Number.isNaN(parsed.getTime())) {
      eventAt = parsed;
    }
  }

  // Special-case common deadline shorthand when chrono can't extract a date.
  // Keep this minimal + deterministic.
  if (kind === "deadline" && !eventAt) {
    const lowered = raw.toLowerCase();
    if (/(\beod\b|\bend\s+of\s+day\b)/i.test(lowered)) {
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      eventAt = endOfDay;
    }
  }

  let expiresAt = null;
  if (kind === "meeting") {
    // If we can parse a meeting time, keep it until a bit after the meeting starts.
    // If we can't parse, keep it for a short window.
    expiresAt = eventAt
      ? new Date(eventAt.getTime() + 2 * 60 * 60 * 1000)
      : new Date(now.getTime() + 6 * 60 * 60 * 1000);
  } else if (kind === "deadline") {
    // Deadlines linger longer; if unknown, give it a day.
    expiresAt = eventAt
      ? new Date(eventAt.getTime() + 12 * 60 * 60 * 1000)
      : new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }

  return {
    kind,
    eventAt,
    expiresAt,
    detectedAt: now,
    source: "heuristic",
  };
}

export function isPriorityActiveForList(priorityContext, { unreadCount = 0, userHasReplied = false, now = new Date() } = {}) {
  if (!priorityContext || !priorityContext.kind) return false;

  // Emergency clears after user sends a reply (acknowledges it)
  if (priorityContext.kind === "emergency") return !userHasReplied;

  // "Important" should not stick around after read.
  if (priorityContext.kind === "important") return unreadCount > 0;

  const expiresAt = priorityContext.expiresAt ? new Date(priorityContext.expiresAt) : null;
  if (!expiresAt || Number.isNaN(expiresAt.getTime())) {
    return unreadCount > 0;
  }

  return expiresAt.getTime() > now.getTime() || unreadCount > 0;
}

export function shouldClearPriorityOnRead(priorityContext, { now = new Date() } = {}) {
  if (!priorityContext || !priorityContext.kind) return false;
  // Emergency doesn't clear on read alone, only on reply
  if (priorityContext.kind === "emergency") return false;

  if (priorityContext.kind === "important") return true;

  // Meetings/deadlines: clear if expired
  const expiresAt = priorityContext.expiresAt ? new Date(priorityContext.expiresAt) : null;
  if (expiresAt && !Number.isNaN(expiresAt.getTime())) {
    return expiresAt.getTime() <= now.getTime();
  }

  return false;
}

export function shouldClearPriorityOnReply(priorityContext) {
  if (!priorityContext || !priorityContext.kind) return false;
  // Emergency clears once user acknowledges by replying
  return priorityContext.kind === "emergency";
}
