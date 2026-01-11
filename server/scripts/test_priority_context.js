import assert from "node:assert/strict";
import {
  detectPriorityContext,
  isPriorityActiveForList,
  shouldClearPriorityOnRead,
  shouldClearPriorityOnReply,
} from "../utils/priorityContext.js";

const NOW = new Date("2026-01-10T12:00:00.000Z");

function test(name, fn) {
  try {
    fn();
    process.stdout.write(`✓ ${name}\n`);
  } catch (e) {
    process.stdout.write(`✗ ${name}\n`);
    throw e;
  }
}

test("empty text returns null", () => {
  assert.equal(detectPriorityContext({ text: "   ", now: NOW }), null);
});

test("emergency detected regardless of AI priority", () => {
  const ctx = detectPriorityContext({ text: "Help me ASAP!", aiPriority: "low", now: NOW });
  assert.ok(ctx);
  assert.equal(ctx.kind, "emergency");
  assert.equal(ctx.expiresAt, null);
  // Emergency stays active until user replies
  assert.equal(isPriorityActiveForList(ctx, { unreadCount: 0, userHasReplied: false, now: NOW }), true);
  // Emergency clears once user replies
  assert.equal(isPriorityActiveForList(ctx, { unreadCount: 0, userHasReplied: true, now: NOW }), false);
  assert.equal(shouldClearPriorityOnRead(ctx, { now: NOW }), false);
  assert.equal(shouldClearPriorityOnReply(ctx), true);
});

test("important detected when AI high (no time words)", () => {
  const ctx = detectPriorityContext({ text: "Please review the proposal when you can", aiPriority: "high", now: NOW });
  assert.ok(ctx);
  assert.equal(ctx.kind, "important");
  assert.equal(isPriorityActiveForList(ctx, { unreadCount: 1, userHasReplied: false, now: NOW }), true);
  assert.equal(isPriorityActiveForList(ctx, { unreadCount: 0, userHasReplied: false, now: NOW }), false);
  assert.equal(shouldClearPriorityOnRead(ctx, { now: NOW }), true);
});

test("meeting: parses time and expires 2h after start", () => {
  const ctx = detectPriorityContext({ text: "Meeting tomorrow at 2pm", aiPriority: "high", now: NOW });
  assert.ok(ctx);
  assert.equal(ctx.kind, "meeting");
  assert.ok(ctx.eventAt instanceof Date);
  assert.ok(ctx.expiresAt instanceof Date);
  assert.equal(ctx.expiresAt.getTime() - ctx.eventAt.getTime(), 2 * 60 * 60 * 1000);

  // active before expiry
  const justBeforeExpiry = new Date(ctx.expiresAt.getTime() - 1);
  assert.equal(isPriorityActiveForList(ctx, { unreadCount: 0, userHasReplied: false, now: justBeforeExpiry }), true);

  // inactive after expiry when read
  const justAfterExpiry = new Date(ctx.expiresAt.getTime() + 1);
  assert.equal(isPriorityActiveForList(ctx, { unreadCount: 0, userHasReplied: false, now: justAfterExpiry }), false);
  assert.equal(shouldClearPriorityOnRead(ctx, { now: justAfterExpiry }), true);

  // still active if unread even after expiry
  assert.equal(isPriorityActiveForList(ctx, { unreadCount: 2, userHasReplied: false, now: justAfterExpiry }), true);
});

test("meeting: no parse falls back to 6h expiry", () => {
  const ctx = detectPriorityContext({ text: "Meeting soon", aiPriority: "high", now: NOW });
  assert.ok(ctx);
  assert.equal(ctx.kind, "meeting");
  assert.equal(ctx.eventAt, null);
  assert.ok(ctx.expiresAt instanceof Date);
  assert.equal(ctx.expiresAt.getTime() - NOW.getTime(), 6 * 60 * 60 * 1000);
});

test("deadline: EOD sets end-of-day when no explicit date", () => {
  const ctx = detectPriorityContext({ text: "Invoice payment due EOD", aiPriority: "high", now: NOW });
  assert.ok(ctx);
  assert.equal(ctx.kind, "deadline");
  assert.ok(ctx.eventAt instanceof Date);
  assert.ok(ctx.expiresAt instanceof Date);

  const expectedEod = new Date(NOW);
  expectedEod.setHours(23, 59, 59, 999);
  assert.equal(ctx.eventAt.getTime(), expectedEod.getTime());
  assert.equal(ctx.expiresAt.getTime() - ctx.eventAt.getTime(), 12 * 60 * 60 * 1000);
});

test("deadline: no parse falls back to 24h expiry", () => {
  const ctx = detectPriorityContext({ text: "Deadline soon", aiPriority: "high", now: NOW });
  assert.ok(ctx);
  assert.equal(ctx.kind, "deadline");
  assert.equal(ctx.eventAt, null);
  assert.ok(ctx.expiresAt instanceof Date);
  assert.equal(ctx.expiresAt.getTime() - NOW.getTime(), 24 * 60 * 60 * 1000);
});

process.stdout.write("\nAll priorityContext edge-case tests passed.\n");
