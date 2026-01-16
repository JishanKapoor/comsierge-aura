// Quick sanity check for the urgent follow-up window behavior.
// Run with: node server/scripts/test_urgent_followup_window.js
// This does NOT hit Twilio; it only validates the burst-window predicate.

function shouldForwardUrgentFollowup({
  priorityFilter,
  messagePriority,
  isSpamOrHeld,
  now,
  urgentFollowupWindowMs,
  normalizedDest,
  anchorAt,
  anchorTo,
}) {
  if (priorityFilter !== "urgent") return false;
  if (isSpamOrHeld) return false;
  if (messagePriority === "high") return false; // direct urgent path, not follow-up
  if (!normalizedDest || !anchorTo || !anchorAt) return false;

  const t = anchorAt instanceof Date ? anchorAt.getTime() : new Date(anchorAt).getTime();
  if (Number.isNaN(t)) return false;

  return anchorTo === normalizedDest && now.getTime() - t <= urgentFollowupWindowMs;
}

const now = new Date("2026-01-16T16:36:10.000Z");
const anchorAt = new Date("2026-01-16T16:36:00.000Z");

const cases = [
  {
    name: "Follow-up in window forwards",
    input: {
      priorityFilter: "urgent",
      messagePriority: "medium",
      isSpamOrHeld: false,
      now,
      urgentFollowupWindowMs: 45_000,
      normalizedDest: "+15551234567",
      anchorAt,
      anchorTo: "+15551234567",
    },
    expected: true,
  },
  {
    name: "Wrong destination does not forward",
    input: {
      priorityFilter: "urgent",
      messagePriority: "low",
      isSpamOrHeld: false,
      now,
      urgentFollowupWindowMs: 45_000,
      normalizedDest: "+15551234567",
      anchorAt,
      anchorTo: "+15557654321",
    },
    expected: false,
  },
  {
    name: "Out of window does not forward",
    input: {
      priorityFilter: "urgent",
      messagePriority: "medium",
      isSpamOrHeld: false,
      now: new Date("2026-01-16T16:37:10.000Z"),
      urgentFollowupWindowMs: 45_000,
      normalizedDest: "+15551234567",
      anchorAt,
      anchorTo: "+15551234567",
    },
    expected: false,
  },
];

for (const c of cases) {
  const got = shouldForwardUrgentFollowup(c.input);
  if (got !== c.expected) {
    console.error(`FAIL: ${c.name} (expected ${c.expected}, got ${got})`);
    process.exitCode = 1;
  } else {
    console.log(`OK: ${c.name}`);
  }
}
