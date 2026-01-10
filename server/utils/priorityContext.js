import * as chrono from "chrono-node";

const EMERGENCY_RE = /(\bemergency\b|\burgent\b|\basap\b|\bimmediately\b|\bright\s+now\b|\b911\b|\bhelp\b|\bsos\b)/i;
const DEADLINE_RE = /(\bdeadline\b|\bdue\b|\bdue\s+by\b|\bby\s+end\s+of\s+day\b|\beod\b|\bsubmit\b|\bpayment\s+due\b|\binvoice\b)/i;
const MEETING_RE = /(\bmeeting\b|\bappointment\b|\bschedule\b|\breschedule\b|\bcall\b|\bzoom\b|\binterview\b|\bcalendar\b)/i;

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

  let kind = null;

  if (EMERGENCY_RE.test(raw)) {
    kind = "emergency";
  } else if (DEADLINE_RE.test(raw)) {
    kind = "deadline";
  } else if (MEETING_RE.test(raw) || String(category || "").toLowerCase() === "meeting") {
    kind = "meeting";
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

export function isPriorityActiveForList(priorityContext, { unreadCount = 0, now = new Date() } = {}) {
  if (!priorityContext || !priorityContext.kind) return false;

  if (priorityContext.kind === "emergency") return true;

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
  if (priorityContext.kind === "emergency") return false;

  if (priorityContext.kind === "important") return true;

  const expiresAt = priorityContext.expiresAt ? new Date(priorityContext.expiresAt) : null;
  if (expiresAt && !Number.isNaN(expiresAt.getTime())) {
    return expiresAt.getTime() <= now.getTime();
  }

  return false;
}
