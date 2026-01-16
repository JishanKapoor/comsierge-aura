import { ChatOpenAI } from "@langchain/openai";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import mongoose from "mongoose";
import twilio from "twilio";
import Rule from "../models/Rule.js";
import Contact from "../models/Contact.js";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import Reminder from "../models/Reminder.js";
import ScheduledMessage from "../models/ScheduledMessage.js";
import User from "../models/User.js";
import TwilioAccount from "../models/TwilioAccount.js";
import AICall from "../models/AICall.js";
import { initiateAICall as startAICall } from "./aiCallService.js";

// Initialize OpenAI with GPT-5.2 for complex analysis
const llm = new ChatOpenAI({
  modelName: "gpt-5.2",
  temperature: 0.2,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// ==================== HELPER FUNCTIONS ====================

// Sanitize AI response - fix common AI mistakes
function sanitizeAIResponse(text) {
  if (!text || typeof text !== 'string') return text;
  
  // Fix "Concierge" -> "Comsierge" (case-insensitive variations)
  let result = text
    .replace(/\bConcierge\b/gi, 'Comsierge')
    .replace(/\bConceirge\b/gi, 'Comsierge')
    .replace(/\bConciege\b/gi, 'Comsierge');
  
  // Remove any mention of "bank routing number" - replace with forwarding context
  result = result
    .replace(/\bbank routing number\b/gi, 'forwarding number')
    .replace(/\bbank routing\b/gi, 'call forwarding')
    .replace(/\brouting number at your bank\b/gi, 'forwarding number')
    .replace(/\bI don't have your bank routing number\b/gi, "I can show you your Comsierge forwarding number")
    .replace(/\bdon't have access to.{0,20}bank\b/gi, "can help with your Comsierge phone settings")
    .replace(/\bbanking information\b/gi, 'phone settings')
    .replace(/\bbank account\b/gi, 'phone account')
    .replace(/\bfinancial institution\b/gi, 'phone service');
  
  return result;
}

// Normalize phone number to E.164 format
function normalizePhoneForSms(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  if (digits.length > 10) return '+' + digits;
  return phone;
}

// Format date in user's timezone
function formatInTimezone(date, timezone = "America/New_York") {
  try {
    return new Date(date).toLocaleString("en-US", {
      timeZone: timezone,
      weekday: "short",
      month: "short", 
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  } catch (e) {
    // Fallback if timezone is invalid
    return new Date(date).toLocaleString("en-US", {
      weekday: "short",
      month: "short", 
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  }
}

// Parse natural language time to Date
function parseNaturalTime(timeStr, referenceDate = new Date()) {
  const now = referenceDate;
  const lower = timeStr.toLowerCase().trim();
  
  // Handle "now" or immediate
  if (lower === "now" || lower === "immediately" || lower === "right now" || lower === "asap") {
    return new Date(now.getTime() + 5000); // 5 seconds from now
  }
  
  // Relative times
  if (lower.includes("in ")) {
    const match = lower.match(/in\s+(\d+)\s*(sec|second|min|minute|hour|hr|day|week)/i);
    if (match) {
      const amount = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      const result = new Date(now);
      if (unit.startsWith("sec")) result.setSeconds(result.getSeconds() + amount);
      else if (unit.startsWith("min")) result.setMinutes(result.getMinutes() + amount);
      else if (unit.startsWith("hour") || unit === "hr") result.setHours(result.getHours() + amount);
      else if (unit.startsWith("day")) result.setDate(result.getDate() + amount);
      else if (unit.startsWith("week")) result.setDate(result.getDate() + amount * 7);
      return result;
    }
  }
  
  // Tomorrow
  if (lower.includes("tomorrow")) {
    const result = new Date(now);
    result.setDate(result.getDate() + 1);
    // Check for time
    const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      const ampm = timeMatch[3]?.toLowerCase();
      if (ampm === "pm" && hours < 12) hours += 12;
      if (ampm === "am" && hours === 12) hours = 0;
      result.setHours(hours, minutes, 0, 0);
    } else {
      result.setHours(9, 0, 0, 0); // Default to 9 AM
    }
    return result;
  }
  
  // Today with time
  if (lower.includes("today") || lower.match(/at\s+\d/)) {
    const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      const ampm = timeMatch[3]?.toLowerCase();
      if (ampm === "pm" && hours < 12) hours += 12;
      if (ampm === "am" && hours === 12) hours = 0;
      const result = new Date(now);
      result.setHours(hours, minutes, 0, 0);
      return result;
    }
  }
  
  // Specific day of week
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  for (let i = 0; i < days.length; i++) {
    if (lower.includes(days[i])) {
      const result = new Date(now);
      const currentDay = result.getDay();
      let daysToAdd = i - currentDay;
      if (daysToAdd <= 0) daysToAdd += 7;
      result.setDate(result.getDate() + daysToAdd);
      
      const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
        const ampm = timeMatch[3]?.toLowerCase();
        if (ampm === "pm" && hours < 12) hours += 12;
        if (ampm === "am" && hours === 12) hours = 0;
        result.setHours(hours, minutes, 0, 0);
      } else {
        result.setHours(9, 0, 0, 0);
      }
      return result;
    }
  }
  
  // Default: try to parse as date
  const parsed = new Date(timeStr);
  if (!isNaN(parsed.getTime())) return parsed;
  
  return null;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function startOfWeek(d, weekStartsOn = 1) {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = (day - weekStartsOn + 7) % 7;
  x.setDate(x.getDate() - diff);
  return x;
}

function endOfWeek(d, weekStartsOn = 1) {
  const s = startOfWeek(d, weekStartsOn);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  return endOfDay(e);
}

function startOfMonth(d) {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

function endOfMonth(d) {
  const x = startOfMonth(d);
  x.setMonth(x.getMonth() + 1);
  x.setDate(0);
  return endOfDay(x);
}

function parseNaturalDateRange(input, referenceDate = new Date()) {
  if (!input) return null;
  const now = new Date(referenceDate);
  const lower = String(input).toLowerCase().trim();

  // Explicit ranges: "from X to Y" / "between X and Y"
  const fromTo = lower.match(/\bfrom\s+(.+?)\s+to\s+(.+)$/i);
  if (fromTo?.[1] && fromTo?.[2]) {
    const start = parseNaturalTime(fromTo[1], now) || new Date(fromTo[1]);
    const end = parseNaturalTime(fromTo[2], now) || new Date(fromTo[2]);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      return { start: startOfDay(start), end: endOfDay(end) };
    }
  }

  const betweenAnd = lower.match(/\bbetween\s+(.+?)\s+and\s+(.+)$/i);
  if (betweenAnd?.[1] && betweenAnd?.[2]) {
    const start = parseNaturalTime(betweenAnd[1], now) || new Date(betweenAnd[1]);
    const end = parseNaturalTime(betweenAnd[2], now) || new Date(betweenAnd[2]);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      return { start: startOfDay(start), end: endOfDay(end) };
    }
  }

  // Common shortcuts
  if (lower === "today") return { start: startOfDay(now), end: endOfDay(now) };
  if (lower === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { start: startOfDay(y), end: endOfDay(y) };
  }

  if (lower === "this week") return { start: startOfWeek(now), end: endOfDay(now) };
  if (lower === "last week") {
    const lastWeekRef = new Date(now);
    lastWeekRef.setDate(lastWeekRef.getDate() - 7);
    return { start: startOfWeek(lastWeekRef), end: endOfWeek(lastWeekRef) };
  }

  if (lower === "this month") return { start: startOfMonth(now), end: endOfDay(now) };
  if (lower === "last month") {
    const lastMonthRef = new Date(now);
    lastMonthRef.setMonth(lastMonthRef.getMonth() - 1);
    return { start: startOfMonth(lastMonthRef), end: endOfMonth(lastMonthRef) };
  }

  const lastNDays = lower.match(/\blast\s+(\d+)\s+days\b/);
  if (lastNDays?.[1]) {
    const n = parseInt(lastNDays[1]);
    if (!isNaN(n) && n > 0) {
      const start = new Date(now);
      start.setDate(start.getDate() - n);
      return { start: startOfDay(start), end: endOfDay(now) };
    }
  }

  return null;
}

// AI-powered contact resolution - uses LLM for intelligent matching
async function resolveContactWithAI(userId, nameOrPhone) {
  if (!nameOrPhone) return null;
  
  // Get all contacts for this user
  const allContacts = await Contact.find({ userId }).limit(500);
  
  if (allContacts.length === 0) return null;
  
  // If it looks like a phone number (mostly digits), try direct match first
  const digits = nameOrPhone.replace(/\D/g, '');
  if (digits.length >= 7) {
    const phoneMatch = allContacts.find(c => 
      c.phone && c.phone.replace(/\D/g, '').includes(digits.slice(-10))
    );
    if (phoneMatch) return phoneMatch;
  }
  
  // Use AI to find the best match
  const contactList = allContacts.map(c => `${c.name} (${c.phone})`).join('\n');
  
  const matchResponse = await llm.invoke([
    new SystemMessage(`You are matching a user's input to their contact list.
Find the contact that best matches the input. Return ONLY the exact name from the list, nothing else.
If no good match exists, return "NO_MATCH".
Be flexible with nicknames, typos, partial names (e.g. "jk" matches "JK F", "mom" matches "Mom", "john" matches "John Smith").`),
    new HumanMessage(`Input: "${nameOrPhone}"

Contact list:
${contactList}

Best matching contact name:`)
  ]);
  
  const matchedName = matchResponse.content.trim();
  
  if (matchedName === "NO_MATCH") return null;
  
  // Find the contact with that name
  return allContacts.find(c => c.name === matchedName) || 
         allContacts.find(c => c.name.toLowerCase() === matchedName.toLowerCase());
}

// Alias for backward compatibility
const resolveContact = resolveContactWithAI;

// ==================== TOOLS ====================

// Tool: Create Transfer/Forward Rule
const createTransferRuleTool = tool(
  async ({ userId, targetName, targetPhone, sourceContact, sourcePhone, mode }) => {
    try {
      console.log("Creating/updating transfer rule:", { userId, targetName, sourceContact, mode });
      
      // Look up target contact in database to get their phone number
      let resolvedPhone = targetPhone;
      let resolvedName = targetName;
      
      if (!targetPhone || targetPhone === "TBD") {
        // Use AI to find the contact
        const targetContact = await resolveContactWithAI(userId, targetName);
        
        if (targetContact) {
          resolvedPhone = targetContact.phone;
          resolvedName = targetContact.name; // Use exact name from DB
          console.log(`Found target contact: ${resolvedName} - ${resolvedPhone}`);
        } else {
          console.log(`Contact "${targetName}" not found in database`);
          return `I couldn't find a contact named "${targetName}" in your contacts. Please provide their phone number or save them as a contact first.`;
        }
      }
      
      // Look up source contact's phone if not provided
      let resolvedSourcePhone = sourcePhone;
      let resolvedSourceName = sourceContact;
      
      if (!sourcePhone && sourceContact) {
        const srcContact = await resolveContactWithAI(userId, sourceContact);
        if (srcContact) {
          resolvedSourcePhone = srcContact.phone;
          resolvedSourceName = srcContact.name;
          console.log(`Found source contact: ${resolvedSourceName} - ${resolvedSourcePhone}`);
        }
      }
      
      // Normalize phone for comparison
      const normalizePhone = (p) => {
        if (!p) return null;
        const digits = String(p).replace(/\D/g, "").slice(-10);
        return digits.length === 10 ? digits : null;
      };
      
      const sourceDigits = normalizePhone(resolvedSourcePhone);
      
      // Check for existing transfer rules from this source contact
      const existingRules = await Rule.find({
        userId,
        type: "transfer",
        active: true
      });
      
      let existingRule = null;
      for (const rule of existingRules) {
        const ruleSourcePhone = rule.conditions?.sourceContactPhone;
        const ruleSourceName = rule.conditions?.sourceContactName?.toLowerCase();
        const ruleSourceDigits = normalizePhone(ruleSourcePhone);
        
        // Match by phone number (most reliable) or by name if no phone
        if (sourceDigits && ruleSourceDigits && sourceDigits === ruleSourceDigits) {
          existingRule = rule;
          console.log(`Found existing rule by phone match: ${rule.rule}`);
          break;
        } else if (!sourceDigits && ruleSourceName && resolvedSourceName?.toLowerCase() === ruleSourceName) {
          existingRule = rule;
          console.log(`Found existing rule by name match: ${rule.rule}`);
          break;
        }
      }
      
      const ruleDescription = `Forward ${mode || "both"} from ${resolvedSourceName} to ${resolvedName}`;
      
      if (existingRule) {
        // Update existing rule instead of creating duplicate
        existingRule.rule = ruleDescription;
        existingRule.transferDetails = {
          mode: mode || "both",
          priority: "all",
          contactName: resolvedName,
          contactPhone: resolvedPhone,
        };
        existingRule.conditions = {
          ...existingRule.conditions,
          sourceContactPhone: resolvedSourcePhone || null,
          sourceContactName: resolvedSourceName,
        };
        await existingRule.save();
        console.log(`Updated existing rule: ${existingRule._id}`);
        return `Done. Updated existing rule to forward ${mode || "all communications"} from ${resolvedSourceName} to ${resolvedName} (${resolvedPhone}).`;
      } else {
        // Create new rule
        const newRule = await Rule.create({
          userId,
          rule: ruleDescription,
          type: "transfer",
          active: true,
          conditions: {
            sourceContactPhone: resolvedSourcePhone || null,
            sourceContactName: resolvedSourceName,
          },
          transferDetails: {
            mode: mode || "both",
            priority: "all",
            contactName: resolvedName,
            contactPhone: resolvedPhone,
          }
        });
        console.log(`Created new rule: ${newRule._id}`);
        return `Done. Created rule to forward ${mode || "all communications"} from ${resolvedSourceName} to ${resolvedName} (${resolvedPhone}).`;
      }
    } catch (error) {
      console.error("Transfer rule error:", error);
      return `Error creating rule: ${error.message}`;
    }
  },
  {
    name: "create_transfer_rule",
    description: "Forward/transfer messages or calls from current contact to another person. Use when user says: transfer, forward, redirect, send to someone else.",
    schema: z.object({
      userId: z.string().describe("User ID - REQUIRED"),
      targetName: z.string().describe("Name of person to forward TO"),
      targetPhone: z.string().optional().describe("Phone of target if known"),
      sourceContact: z.string().describe("Current contact name (forwarding FROM)"),
      sourcePhone: z.string().optional().describe("Current contact phone"),
      mode: z.enum(["calls", "messages", "both"]).optional().describe("What to forward"),
    }),
  }
);

// Tool: Create Auto-Reply Rule
const createAutoReplyTool = tool(
  async ({ userId, sourceContact, sourcePhone, replyMessage }) => {
    try {
      console.log("Creating auto-reply:", { userId, sourceContact, replyMessage });
      await Rule.create({
        userId,
        rule: `Auto-reply to ${sourceContact}: "${replyMessage}"`,
        type: "auto-reply",
        active: true,
        transferDetails: {
          sourceContact,
          sourcePhone,
          autoReplyMessage: replyMessage,
        }
      });
      return `Done. Auto-reply set for ${sourceContact}. They'll receive: "${replyMessage}"`;
    } catch (error) {
      console.error("Auto-reply error:", error);
      return `Error: ${error.message}`;
    }
  },
  {
    name: "create_auto_reply",
    description: "Set up automatic reply for current contact. Use when user wants auto-response, auto-reply, automatic message.",
    schema: z.object({
      userId: z.string().describe("User ID - REQUIRED"),
      sourceContact: z.string().describe("Contact to auto-reply to"),
      sourcePhone: z.string().optional().describe("Contact phone"),
      replyMessage: z.string().describe("The auto-reply message text"),
    }),
  }
);

// Tool: Block Contact
const blockContactTool = tool(
  async ({ userId, sourceContact, sourcePhone, reason }) => {
    try {
      console.log("Blocking contact:", { userId, sourceContact, sourcePhone });
      
      // Resolve contact to get phone number if not provided
      let phone = sourcePhone;
      let contactName = sourceContact;
      
      if (!phone && sourceContact) {
        const resolved = await resolveContactWithAI(userId, sourceContact);
        if (resolved) {
          phone = resolved.phone;
          contactName = resolved.name;
          console.log("Resolved contact:", contactName, phone);
        }
      }
      
      // Also try to find in conversations if still no phone
      if (!phone && sourceContact) {
        const allConvos = await Conversation.find({ userId });
        const convoList = allConvos.map(c => `${c.contactName || 'Unknown'}: ${c.contactPhone}`).join('\n');
        const matchResponse = await llm.invoke([
          new SystemMessage(`Find the conversation that best matches the input name. Return ONLY the phone number, nothing else. If no match, return "NO_MATCH".`),
          new HumanMessage(`Input name: "${sourceContact}"\n\nConversations:\n${convoList}\n\nPhone number:`)
        ]);
        const matchedPhone = matchResponse.content.trim();
        if (matchedPhone !== "NO_MATCH" && matchedPhone.length > 5) {
          phone = matchedPhone;
          const convo = allConvos.find(c => c.contactPhone === matchedPhone);
          if (convo) contactName = convo.contactName || sourceContact;
        }
      }
      
      if (!phone) {
        return `Could not find contact "${sourceContact}". Please specify the phone number.`;
      }
      
      // Create a block rule
      await Rule.create({
        userId,
        rule: `Block ${contactName}${reason ? `: ${reason}` : ""}`,
        type: "block",
        active: true,
        transferDetails: { sourceContact: contactName, sourcePhone: phone }
      });

      // Set isBlocked on the Contact
      const normalizedPhone = phone.replace(/\D/g, '').slice(-10);
      const allContacts = await Contact.find({ userId });
      for (const c of allContacts) {
        const cDigits = (c.phone || '').replace(/\D/g, '').slice(-10);
        if (cDigits === normalizedPhone) {
          c.isBlocked = true;
          await c.save();
          console.log("Set isBlocked=true on contact:", c.name);
        }
      }

      // Set isBlocked on the conversation so it takes effect immediately
      const allConvos = await Conversation.find({ userId });
      const matchingConvos = allConvos.filter(c => {
        const convoDigits = (c.contactPhone || '').replace(/\D/g, '').slice(-10);
        return convoDigits === normalizedPhone;
      });
      for (const convo of matchingConvos) {
        convo.isBlocked = true;
        await convo.save();
      }
      console.log("Updated conversation isBlocked for phone:", normalizedPhone, "count:", matchingConvos.length);

      return `Done. Blocked ${contactName}. They won't be able to reach you.`;
    } catch (error) {
      console.error("Block error:", error);
      return `Error: ${error.message}`;
    }
  },
  {
    name: "block_contact",
    description: "Block a contact from messaging/calling. Use when user says: block, mute, ignore, stop messages from X.",
    schema: z.object({
      userId: z.string().describe("User ID - REQUIRED"),
      sourceContact: z.string().describe("Contact name to block"),
      sourcePhone: z.string().optional().describe("Contact phone (optional - will be looked up from name)"),
      reason: z.string().optional().describe("Reason for blocking"),
    }),
  }
);

// Tool: Unblock Contact
const unblockContactTool = tool(
  async ({ userId, sourceContact, sourcePhone }) => {
    try {
      console.log("Unblocking contact:", { userId, sourceContact, sourcePhone });
      
      // Resolve contact to get phone number if not provided
      let phone = sourcePhone;
      let contactName = sourceContact;
      
      if (!phone && sourceContact) {
        const resolved = await resolveContactWithAI(userId, sourceContact);
        if (resolved) {
          phone = resolved.phone;
          contactName = resolved.name;
          console.log("Resolved contact:", contactName, phone);
        }
      }
      
      // Also try to find in conversations if still no phone
      if (!phone && sourceContact) {
        const allConvos = await Conversation.find({ userId });
        const convoList = allConvos.map(c => `${c.contactName || 'Unknown'}: ${c.contactPhone}`).join('\n');
        const matchResponse = await llm.invoke([
          new SystemMessage(`Find the conversation that best matches the input name. Return ONLY the phone number, nothing else. If no match, return "NO_MATCH".`),
          new HumanMessage(`Input name: "${sourceContact}"\n\nConversations:\n${convoList}\n\nPhone number:`)
        ]);
        const matchedPhone = matchResponse.content.trim();
        if (matchedPhone !== "NO_MATCH" && matchedPhone.length > 5) {
          phone = matchedPhone;
          const convo = allConvos.find(c => c.contactPhone === matchedPhone);
          if (convo) contactName = convo.contactName || sourceContact;
        }
      }
      
      if (!phone) {
        return `Could not find contact "${sourceContact}". Please specify the phone number.`;
      }
      
      // Delete block rules for this contact
      await Rule.deleteMany({
        userId,
        type: "block",
        $or: [
          { "transferDetails.sourceContact": contactName },
          { "transferDetails.sourcePhone": phone }
        ]
      });

      // Set isBlocked to false on the Contact
      const normalizedPhone = phone.replace(/\D/g, '').slice(-10);
      const allContacts = await Contact.find({ userId });
      for (const c of allContacts) {
        const cDigits = (c.phone || '').replace(/\D/g, '').slice(-10);
        if (cDigits === normalizedPhone) {
          c.isBlocked = false;
          await c.save();
          console.log("Set isBlocked=false on contact:", c.name);
        }
      }

      // Set isBlocked to false on the conversation
      const allConvos = await Conversation.find({ userId });
      const matchingConvos = allConvos.filter(c => {
        const convoDigits = (c.contactPhone || '').replace(/\D/g, '').slice(-10);
        return convoDigits === normalizedPhone;
      });
      for (const convo of matchingConvos) {
        convo.isBlocked = false;
        await convo.save();
      }
      console.log("Updated conversation isBlocked=false for phone:", normalizedPhone, "count:", matchingConvos.length);

      return `Done. Unblocked ${contactName}. They can now message you again.`;
    } catch (error) {
      console.error("Unblock error:", error);
      return `Error: ${error.message}`;
    }
  },
  {
    name: "unblock_contact",
    description: "Unblock a blocked contact. Use when user says: unblock, allow again, remove block, let them message.",
    schema: z.object({
      userId: z.string().describe("User ID - REQUIRED"),
      sourceContact: z.string().describe("Contact name to unblock"),
      sourcePhone: z.string().optional().describe("Contact phone (optional - will be looked up from name)"),
    }),
  }
);

// ==================== CONVERSATION MANAGEMENT TOOLS ====================

// Tool: Pin/Unpin Conversation
const pinConversationTool = tool(
  async ({ userId, contactName, contactPhone, pin }) => {
    try {
      console.log("Pin conversation:", { userId, contactName, contactPhone, pin });
      
      // Resolve contact
      let phone = contactPhone;
      let name = contactName;
      
      if (contactName && !contactPhone) {
        const resolved = await resolveContactWithAI(userId, contactName);
        if (resolved) {
          phone = resolved.phone;
          name = resolved.name;
        }
      }
      
      if (!phone && contactName) {
        const allConvos = await Conversation.find({ userId });
        const convoList = allConvos.map(c => `${c.contactName || 'Unknown'}: ${c.contactPhone}`).join('\n');
        const matchResponse = await llm.invoke([
          new SystemMessage(`Find the conversation that best matches the input name. Return ONLY the phone number, nothing else. If no match, return "NO_MATCH".`),
          new HumanMessage(`Input name: "${contactName}"\n\nConversations:\n${convoList}\n\nPhone number:`)
        ]);
        const matchedPhone = matchResponse.content.trim();
        if (matchedPhone !== "NO_MATCH" && matchedPhone.length > 5) {
          phone = matchedPhone;
          const convo = allConvos.find(c => c.contactPhone === matchedPhone);
          if (convo) name = convo.contactName || contactName;
        }
      }
      
      if (!phone) {
        return `Could not find contact "${contactName}". Please specify the phone number.`;
      }
      
      // Update conversation
      const normalizedPhone = phone.replace(/\D/g, '').slice(-10);
      const allConvos = await Conversation.find({ userId });
      const matchingConvos = allConvos.filter(c => {
        const convoDigits = (c.contactPhone || '').replace(/\D/g, '').slice(-10);
        return convoDigits === normalizedPhone;
      });
      
      for (const convo of matchingConvos) {
        convo.isPinned = pin;
        await convo.save();
      }
      
      const action = pin ? "pinned" : "unpinned";
      return `Done. Conversation with ${name} is now ${action}.`;
    } catch (error) {
      console.error("Pin conversation error:", error);
      return `Error: ${error.message}`;
    }
  },
  {
    name: "pin_conversation",
    description: "Pin or unpin a conversation to keep it at the top of the inbox. Use when user says: pin, unpin, keep at top, remove from top.",
    schema: z.object({
      userId: z.string().describe("User ID - REQUIRED"),
      contactName: z.string().optional().describe("Contact name"),
      contactPhone: z.string().optional().describe("Contact phone"),
      pin: z.boolean().describe("true to pin, false to unpin"),
    }),
  }
);

// Tool: Mute/Unmute Conversation
const muteConversationTool = tool(
  async ({ userId, contactName, contactPhone, mute }) => {
    try {
      console.log("Mute conversation:", { userId, contactName, contactPhone, mute });
      
      // Resolve contact
      let phone = contactPhone;
      let name = contactName;
      
      if (contactName && !contactPhone) {
        const resolved = await resolveContactWithAI(userId, contactName);
        if (resolved) {
          phone = resolved.phone;
          name = resolved.name;
        }
      }
      
      if (!phone && contactName) {
        const allConvos = await Conversation.find({ userId });
        const convoList = allConvos.map(c => `${c.contactName || 'Unknown'}: ${c.contactPhone}`).join('\n');
        const matchResponse = await llm.invoke([
          new SystemMessage(`Find the conversation that best matches the input name. Return ONLY the phone number, nothing else. If no match, return "NO_MATCH".`),
          new HumanMessage(`Input name: "${contactName}"\n\nConversations:\n${convoList}\n\nPhone number:`)
        ]);
        const matchedPhone = matchResponse.content.trim();
        if (matchedPhone !== "NO_MATCH" && matchedPhone.length > 5) {
          phone = matchedPhone;
          const convo = allConvos.find(c => c.contactPhone === matchedPhone);
          if (convo) name = convo.contactName || contactName;
        }
      }
      
      if (!phone) {
        return `Could not find contact "${contactName}". Please specify the phone number.`;
      }
      
      // Update conversation
      const normalizedPhone = phone.replace(/\D/g, '').slice(-10);
      const allConvos = await Conversation.find({ userId });
      const matchingConvos = allConvos.filter(c => {
        const convoDigits = (c.contactPhone || '').replace(/\D/g, '').slice(-10);
        return convoDigits === normalizedPhone;
      });
      
      for (const convo of matchingConvos) {
        convo.isMuted = mute;
        await convo.save();
      }
      
      const action = mute ? "muted" : "unmuted";
      return `Done. Conversation with ${name} is now ${action}. ${mute ? "You won't get notifications for new messages." : "You'll now get notifications again."}`;
    } catch (error) {
      console.error("Mute conversation error:", error);
      return `Error: ${error.message}`;
    }
  },
  {
    name: "mute_conversation",
    description: "Mute or unmute a conversation to stop/start notifications. Use when user says: mute notifications, silence, unmute, get notifications again.",
    schema: z.object({
      userId: z.string().describe("User ID - REQUIRED"),
      contactName: z.string().optional().describe("Contact name"),
      contactPhone: z.string().optional().describe("Contact phone"),
      mute: z.boolean().describe("true to mute, false to unmute"),
    }),
  }
);

// Tool: Archive Conversation
const archiveConversationTool = tool(
  async ({ userId, contactName, contactPhone, archive }) => {
    try {
      console.log("Archive conversation:", { userId, contactName, contactPhone, archive });
      
      // Resolve contact
      let phone = contactPhone;
      let name = contactName;
      
      if (contactName && !contactPhone) {
        const resolved = await resolveContactWithAI(userId, contactName);
        if (resolved) {
          phone = resolved.phone;
          name = resolved.name;
        }
      }
      
      if (!phone && contactName) {
        const allConvos = await Conversation.find({ userId });
        const convoList = allConvos.map(c => `${c.contactName || 'Unknown'}: ${c.contactPhone}`).join('\n');
        const matchResponse = await llm.invoke([
          new SystemMessage(`Find the conversation that best matches the input name. Return ONLY the phone number, nothing else. If no match, return "NO_MATCH".`),
          new HumanMessage(`Input name: "${contactName}"\n\nConversations:\n${convoList}\n\nPhone number:`)
        ]);
        const matchedPhone = matchResponse.content.trim();
        if (matchedPhone !== "NO_MATCH" && matchedPhone.length > 5) {
          phone = matchedPhone;
          const convo = allConvos.find(c => c.contactPhone === matchedPhone);
          if (convo) name = convo.contactName || contactName;
        }
      }
      
      if (!phone) {
        return `Could not find contact "${contactName}". Please specify the phone number.`;
      }
      
      // Update conversation
      const normalizedPhone = phone.replace(/\D/g, '').slice(-10);
      const allConvos = await Conversation.find({ userId });
      const matchingConvos = allConvos.filter(c => {
        const convoDigits = (c.contactPhone || '').replace(/\D/g, '').slice(-10);
        return convoDigits === normalizedPhone;
      });
      
      for (const convo of matchingConvos) {
        convo.isArchived = archive;
        await convo.save();
      }
      
      const action = archive ? "archived" : "unarchived";
      return `Done. Conversation with ${name} is now ${action}.`;
    } catch (error) {
      console.error("Archive conversation error:", error);
      return `Error: ${error.message}`;
    }
  },
  {
    name: "archive_conversation",
    description: "Archive or unarchive a conversation. Use when user says: archive, hide, unarchive, bring back.",
    schema: z.object({
      userId: z.string().describe("User ID - REQUIRED"),
      contactName: z.string().optional().describe("Contact name"),
      contactPhone: z.string().optional().describe("Contact phone"),
      archive: z.boolean().describe("true to archive, false to unarchive"),
    }),
  }
);

// Tool: Mark Conversation Read/Unread
const markConversationReadTool = tool(
  async ({ userId, contactName, contactPhone, markRead }) => {
    try {
      console.log("Mark conversation read:", { userId, contactName, contactPhone, markRead });
      
      // Resolve contact
      let phone = contactPhone;
      let name = contactName;
      
      if (contactName && !contactPhone) {
        const resolved = await resolveContactWithAI(userId, contactName);
        if (resolved) {
          phone = resolved.phone;
          name = resolved.name;
        }
      }
      
      if (!phone && contactName) {
        const allConvos = await Conversation.find({ userId });
        const convoList = allConvos.map(c => `${c.contactName || 'Unknown'}: ${c.contactPhone}`).join('\n');
        const matchResponse = await llm.invoke([
          new SystemMessage(`Find the conversation that best matches the input name. Return ONLY the phone number, nothing else. If no match, return "NO_MATCH".`),
          new HumanMessage(`Input name: "${contactName}"\n\nConversations:\n${convoList}\n\nPhone number:`)
        ]);
        const matchedPhone = matchResponse.content.trim();
        if (matchedPhone !== "NO_MATCH" && matchedPhone.length > 5) {
          phone = matchedPhone;
          const convo = allConvos.find(c => c.contactPhone === matchedPhone);
          if (convo) name = convo.contactName || contactName;
        }
      }
      
      if (!phone) {
        return `Could not find contact "${contactName}". Please specify the phone number.`;
      }
      
      // Update conversation and messages
      const normalizedPhone = phone.replace(/\D/g, '').slice(-10);
      
      // Update conversation unread count
      const allConvos = await Conversation.find({ userId });
      const matchingConvos = allConvos.filter(c => {
        const convoDigits = (c.contactPhone || '').replace(/\D/g, '').slice(-10);
        return convoDigits === normalizedPhone;
      });
      
      for (const convo of matchingConvos) {
        convo.unreadCount = markRead ? 0 : (convo.unreadCount || 0) + 1;
        await convo.save();
      }
      
      // Update messages isRead
      const phoneVariations = [phone, normalizedPhone, `+1${normalizedPhone}`, `1${normalizedPhone}`];
      await Message.updateMany(
        { userId, contactPhone: { $in: phoneVariations }, direction: "incoming" },
        { isRead: markRead }
      );
      
      const action = markRead ? "marked as read" : "marked as unread";
      return `Done. Conversation with ${name} is now ${action}.`;
    } catch (error) {
      console.error("Mark read error:", error);
      return `Error: ${error.message}`;
    }
  },
  {
    name: "mark_conversation_read",
    description: "Mark a conversation as read or unread. Use when user says: mark as read, mark as unread, clear unread, I've read it.",
    schema: z.object({
      userId: z.string().describe("User ID - REQUIRED"),
      contactName: z.string().optional().describe("Contact name"),
      contactPhone: z.string().optional().describe("Contact phone"),
      markRead: z.boolean().describe("true to mark as read, false to mark as unread"),
    }),
  }
);

// Tool: Hold/Release Conversation
const holdConversationTool = tool(
  async ({ userId, contactName, contactPhone, hold }) => {
    try {
      console.log("Hold conversation:", { userId, contactName, contactPhone, hold });
      
      // Resolve contact
      let phone = contactPhone;
      let name = contactName;
      
      if (contactName && !contactPhone) {
        const resolved = await resolveContactWithAI(userId, contactName);
        if (resolved) {
          phone = resolved.phone;
          name = resolved.name;
        }
      }
      
      if (!phone && contactName) {
        const allConvos = await Conversation.find({ userId });
        const convoList = allConvos.map(c => `${c.contactName || 'Unknown'}: ${c.contactPhone}`).join('\n');
        const matchResponse = await llm.invoke([
          new SystemMessage(`Find the conversation that best matches the input name. Return ONLY the phone number, nothing else. If no match, return "NO_MATCH".`),
          new HumanMessage(`Input name: "${contactName}"\n\nConversations:\n${convoList}\n\nPhone number:`)
        ]);
        const matchedPhone = matchResponse.content.trim();
        if (matchedPhone !== "NO_MATCH" && matchedPhone.length > 5) {
          phone = matchedPhone;
          const convo = allConvos.find(c => c.contactPhone === matchedPhone);
          if (convo) name = convo.contactName || contactName;
        }
      }
      
      if (!phone) {
        return `Could not find contact "${contactName}". Please specify the phone number.`;
      }
      
      // Update conversation
      const normalizedPhone = phone.replace(/\D/g, '').slice(-10);
      const allConvos = await Conversation.find({ userId });
      const matchingConvos = allConvos.filter(c => {
        const convoDigits = (c.contactPhone || '').replace(/\D/g, '').slice(-10);
        return convoDigits === normalizedPhone;
      });
      
      for (const convo of matchingConvos) {
        convo.isHeld = hold;
        await convo.save();
      }
      
      const action = hold ? "moved to Held" : "released from Held";
      return `Done. Conversation with ${name} is now ${action}.`;
    } catch (error) {
      console.error("Hold conversation error:", error);
      return `Error: ${error.message}`;
    }
  },
  {
    name: "hold_conversation",
    description: "Move a conversation to Held or release it. Use when user says: hold, put on hold, release, unhold, move to held.",
    schema: z.object({
      userId: z.string().describe("User ID - REQUIRED"),
      contactName: z.string().optional().describe("Contact name"),
      contactPhone: z.string().optional().describe("Contact phone"),
      hold: z.boolean().describe("true to hold, false to release"),
    }),
  }
);

// Tool: Delete Conversation
const deleteConversationTool = tool(
  async ({ userId, contactName, contactPhone }) => {
    try {
      console.log("Delete conversation:", { userId, contactName, contactPhone });
      
      // Resolve contact
      let phone = contactPhone;
      let name = contactName;
      
      if (contactName && !contactPhone) {
        const resolved = await resolveContactWithAI(userId, contactName);
        if (resolved) {
          phone = resolved.phone;
          name = resolved.name;
        }
      }
      
      if (!phone && contactName) {
        const allConvos = await Conversation.find({ userId });
        const convoList = allConvos.map(c => `${c.contactName || 'Unknown'}: ${c.contactPhone}`).join('\n');
        const matchResponse = await llm.invoke([
          new SystemMessage(`Find the conversation that best matches the input name. Return ONLY the phone number, nothing else. If no match, return "NO_MATCH".`),
          new HumanMessage(`Input name: "${contactName}"\n\nConversations:\n${convoList}\n\nPhone number:`)
        ]);
        const matchedPhone = matchResponse.content.trim();
        if (matchedPhone !== "NO_MATCH" && matchedPhone.length > 5) {
          phone = matchedPhone;
          const convo = allConvos.find(c => c.contactPhone === matchedPhone);
          if (convo) name = convo.contactName || contactName;
        }
      }
      
      if (!phone) {
        return `Could not find contact "${contactName}". Please specify the phone number.`;
      }
      
      // Delete conversation and all messages
      const normalizedPhone = phone.replace(/\D/g, '').slice(-10);
      const phoneVariations = [phone, normalizedPhone, `+1${normalizedPhone}`, `1${normalizedPhone}`];
      
      // Delete messages
      const deletedMessages = await Message.deleteMany({
        userId,
        contactPhone: { $in: phoneVariations }
      });
      
      // Delete conversation
      const allConvos = await Conversation.find({ userId });
      const matchingConvos = allConvos.filter(c => {
        const convoDigits = (c.contactPhone || '').replace(/\D/g, '').slice(-10);
        return convoDigits === normalizedPhone;
      });
      
      for (const convo of matchingConvos) {
        await Conversation.deleteOne({ _id: convo._id });
      }
      
      return `Done. Deleted conversation with ${name} and ${deletedMessages.deletedCount} messages.`;
    } catch (error) {
      console.error("Delete conversation error:", error);
      return `Error: ${error.message}`;
    }
  },
  {
    name: "delete_conversation",
    description: "Delete a conversation and all its messages permanently. Use when user says: delete conversation, remove chat, clear messages with.",
    schema: z.object({
      userId: z.string().describe("User ID - REQUIRED"),
      contactName: z.string().optional().describe("Contact name"),
      contactPhone: z.string().optional().describe("Contact phone"),
    }),
  }
);

// Tool: Toggle Rule Active/Inactive
const toggleRuleTool = tool(
  async ({ userId, ruleDescription, active }) => {
    try {
      console.log("Toggle rule:", { userId, ruleDescription, active });
      
      // Find matching rule using AI
      const allRules = await Rule.find({ userId });
      if (allRules.length === 0) {
        return "You have no rules to toggle.";
      }
      
      const ruleList = allRules.map((r, i) => `${i}: ${r.rule} (${r.active ? "active" : "inactive"})`).join('\n');
      const matchResponse = await llm.invoke([
        new SystemMessage(`Find the rule that best matches the user's description. Return ONLY the index number (0, 1, 2, etc). If no match found, return "NO_MATCH".`),
        new HumanMessage(`User wants to ${active ? "enable" : "disable"}: "${ruleDescription}"\n\nRules:\n${ruleList}\n\nIndex:`)
      ]);
      
      const matchIndex = parseInt(matchResponse.content.trim());
      if (isNaN(matchIndex) || matchIndex < 0 || matchIndex >= allRules.length) {
        return `Could not find rule matching "${ruleDescription}".`;
      }
      
      const rule = allRules[matchIndex];
      rule.active = active;
      await rule.save();
      
      const status = active ? "enabled" : "disabled";
      return `Done. Rule "${rule.rule}" is now ${status}.`;
    } catch (error) {
      console.error("Toggle rule error:", error);
      return `Error: ${error.message}`;
    }
  },
  {
    name: "toggle_rule",
    description: "Enable or disable a rule without deleting it. Use when user says: disable rule, turn off, pause, enable, turn on, activate, deactivate.",
    schema: z.object({
      userId: z.string().describe("User ID - REQUIRED"),
      ruleDescription: z.string().describe("Part of rule description to match"),
      active: z.boolean().describe("true to enable, false to disable"),
    }),
  }
);

// Tool: Set Translation Settings
const setTranslationSettingsTool = tool(
  async ({ userId, receiveLanguage, sendLanguage, autoTranslateIncoming }) => {
    try {
      console.log("Set translation settings:", { userId, receiveLanguage, sendLanguage, autoTranslateIncoming });
      
      const user = await User.findById(userId);
      if (!user) {
        return "User not found.";
      }
      
      // Update translation settings
      if (!user.translationSettings) {
        user.translationSettings = {};
      }
      
      if (receiveLanguage !== undefined) {
        user.translationSettings.receiveLanguage = receiveLanguage;
      }
      if (sendLanguage !== undefined) {
        user.translationSettings.sendLanguage = sendLanguage;
      }
      if (autoTranslateIncoming !== undefined) {
        user.translationSettings.autoTranslateIncoming = autoTranslateIncoming;
      }
      
      await user.save();
      
      const parts = [];
      if (receiveLanguage) parts.push(`receive in ${receiveLanguage.toUpperCase()}`);
      if (sendLanguage) parts.push(`send in ${sendLanguage.toUpperCase()}`);
      if (autoTranslateIncoming !== undefined) parts.push(autoTranslateIncoming ? "auto-translate ON" : "auto-translate OFF");
      
      return `Done. Translation settings updated: ${parts.join(", ")}.`;
    } catch (error) {
      console.error("Set translation settings error:", error);
      return `Error: ${error.message}`;
    }
  },
  {
    name: "set_translation_settings",
    description: "Set translation language preferences. Use when user says: translate to Spanish, I speak French, auto-translate incoming messages, turn off translation.",
    schema: z.object({
      userId: z.string().describe("User ID - REQUIRED"),
      receiveLanguage: z.string().optional().describe("Language code for receiving messages (e.g., 'en', 'es', 'fr', 'zh')"),
      sendLanguage: z.string().optional().describe("Language code for sending messages (e.g., 'en', 'es', 'fr', 'zh')"),
      autoTranslateIncoming: z.boolean().optional().describe("Whether to automatically translate incoming messages"),
    }),
  }
);

// Tool: Update Contact Name
const updateContactTool = tool(
  async ({ userId, currentName, currentPhone, newName }) => {
    try {
      console.log("Updating contact:", { userId, currentName, currentPhone, newName });
      
      // Find contact using AI matching
      let contact = null;
      
      if (currentName) {
        contact = await resolveContactWithAI(userId, currentName);
      }
      
      if (!contact && currentPhone) {
        contact = await resolveContactWithAI(userId, currentPhone);
      }

      if (!contact) {
        return `Could not find contact "${currentName || currentPhone}". Check the name and try again.`;
      }

      const oldName = contact.name;
      contact.name = newName;
      await contact.save();

      // Update Conversation model to reflect the new name immediately
      const normalizedPhone = contact.phone.replace(/\D/g, '').slice(-10);
      
      // Update conversations using direct matching
      const allConvos = await Conversation.find({ userId });
      for (const convo of allConvos) {
        const convoDigits = (convo.contactPhone || '').replace(/\D/g, '').slice(-10);
        if (convoDigits === normalizedPhone) {
          convo.contactName = newName;
          await convo.save();
        }
      }
      
      // Update Messages using direct matching
      const allMessages = await Message.find({ userId });
      for (const msg of allMessages) {
        const msgDigits = (msg.contactPhone || '').replace(/\D/g, '').slice(-10);
        if (msgDigits === normalizedPhone) {
          msg.contactName = newName;
          await msg.save();
        }
      }
      
      // Update transfer rules that reference this contact
      const Rule = (await import("../models/Rule.js")).default;
      const allRules = await Rule.find({ userId });
      for (const rule of allRules) {
        const rulePhone = (rule.transferDetails?.contactPhone || '').replace(/\D/g, '').slice(-10);
        const sourcePhone = (rule.conditions?.sourceContactPhone || '').replace(/\D/g, '').slice(-10);
        if (rulePhone === normalizedPhone || sourcePhone === normalizedPhone) {
          if (rule.transferDetails?.contactPhone && rulePhone === normalizedPhone) {
            rule.transferDetails.contactName = newName;
          }
          if (rule.conditions?.sourceContactPhone && sourcePhone === normalizedPhone) {
            rule.conditions.sourceContactName = newName;
          }
          await rule.save();
        }
      }

      return `Done. Renamed "${oldName}" to "${newName}".`;
    } catch (error) {
      console.error("Update contact error:", error);
      return `Error: ${error.message}`;
    }
  },
  {
    name: "update_contact",
    description: "Rename a contact. Use when user says: change name, rename, update contact, set name as, call them X. Example: 'change jk f to jk k' or 'rename John to Johnny'. Can only change the name/label, NEVER the phone number.",
    schema: z.object({
      userId: z.string().describe("User ID - REQUIRED"),
      currentName: z.string().optional().describe("Current name of contact to rename"),
      currentPhone: z.string().optional().describe("Phone number of contact to update (if name not provided)"),
      newName: z.string().describe("New name for the contact"),
    }),
  }
);

// Tool: Manage Contact Details (tags, notes, email, company, favorite)
const manageContactDetailsTool = tool(
  async ({ userId, contactName, contactPhone, action, field, value }) => {
    try {
      console.log("Managing contact details:", { userId, contactName, contactPhone, action, field, value });
      
      // Find contact using AI matching
      let contact = null;
      
      if (contactName) {
        contact = await resolveContactWithAI(userId, contactName);
      }
      
      if (!contact && contactPhone) {
        contact = await resolveContactWithAI(userId, contactPhone);
      }

      if (!contact) {
        return `Could not find contact "${contactName || contactPhone}". Check the name and try again.`;
      }

      const contactDisplayName = contact.name;

      // Handle different fields and actions
      if (field === "tags" || field === "label" || field === "labels") {
        // Tags/labels are stored in the 'tags' array
        if (action === "add") {
          const tagsToAdd = value.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
          const existingTags = contact.tags || [];
          const newTags = [...new Set([...existingTags, ...tagsToAdd])];
          contact.tags = newTags;
          await contact.save();
          return `Added label(s) "${tagsToAdd.join(', ')}" to ${contactDisplayName}. Current labels: ${newTags.join(', ') || 'none'}.`;
        } else if (action === "remove") {
          const tagsToRemove = value.split(',').map(t => t.trim().toLowerCase());
          contact.tags = (contact.tags || []).filter(t => !tagsToRemove.includes(t.toLowerCase()));
          await contact.save();
          return `Removed label(s) "${tagsToRemove.join(', ')}" from ${contactDisplayName}. Current labels: ${contact.tags.join(', ') || 'none'}.`;
        } else if (action === "set") {
          const newTags = value.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
          contact.tags = newTags;
          await contact.save();
          return `Set labels for ${contactDisplayName} to: ${newTags.join(', ') || 'none'}.`;
        } else if (action === "clear") {
          contact.tags = [];
          await contact.save();
          return `Cleared all labels from ${contactDisplayName}.`;
        } else if (action === "get" || action === "list") {
          const tags = contact.tags || [];
          return tags.length > 0 
            ? `${contactDisplayName}'s labels: ${tags.join(', ')}.`
            : `${contactDisplayName} has no labels.`;
        }
      } else if (field === "notes" || field === "note") {
        if (action === "add" || action === "set") {
          const existingNotes = contact.notes || "";
          if (action === "add" && existingNotes) {
            contact.notes = existingNotes + "\n" + value;
          } else {
            contact.notes = value;
          }
          await contact.save();
          return `${action === "add" ? "Added to" : "Set"} notes for ${contactDisplayName}: "${value}".`;
        } else if (action === "clear" || action === "remove") {
          contact.notes = null;
          await contact.save();
          return `Cleared notes for ${contactDisplayName}.`;
        } else if (action === "get" || action === "list") {
          return contact.notes 
            ? `${contactDisplayName}'s notes: "${contact.notes}".`
            : `${contactDisplayName} has no notes.`;
        }
      } else if (field === "email") {
        if (action === "set" || action === "add") {
          contact.email = value;
          await contact.save();
          return `Set email for ${contactDisplayName}: ${value}.`;
        } else if (action === "clear" || action === "remove") {
          contact.email = null;
          await contact.save();
          return `Cleared email for ${contactDisplayName}.`;
        } else if (action === "get") {
          return contact.email 
            ? `${contactDisplayName}'s email: ${contact.email}.`
            : `${contactDisplayName} has no email.`;
        }
      } else if (field === "company" || field === "work") {
        if (action === "set" || action === "add") {
          contact.company = value;
          await contact.save();
          return `Set company for ${contactDisplayName}: ${value}.`;
        } else if (action === "clear" || action === "remove") {
          contact.company = null;
          await contact.save();
          return `Cleared company for ${contactDisplayName}.`;
        } else if (action === "get") {
          return contact.company 
            ? `${contactDisplayName}'s company: ${contact.company}.`
            : `${contactDisplayName} has no company.`;
        }
      } else if (field === "favorite" || field === "starred") {
        if (action === "set" || action === "add") {
          contact.isFavorite = true;
          await contact.save();
          return `Marked ${contactDisplayName} as favorite.`;
        } else if (action === "remove" || action === "clear") {
          contact.isFavorite = false;
          await contact.save();
          return `Removed ${contactDisplayName} from favorites.`;
        } else if (action === "get") {
          return contact.isFavorite 
            ? `${contactDisplayName} is a favorite.`
            : `${contactDisplayName} is not a favorite.`;
        }
      }

      return `Unknown field "${field}" or action "${action}". Supported fields: tags/labels, notes, email, company, favorite. Supported actions: add, remove, set, clear, get.`;
    } catch (error) {
      console.error("Manage contact details error:", error);
      return `Error: ${error.message}`;
    }
  },
  {
    name: "manage_contact_details",
    description: `Manage contact details like labels/tags, notes, email, company, and favorite status. Use for:
- "add label family to Dad" -> action=add, field=tags, value=family
- "remove work label from John" -> action=remove, field=tags, value=work
- "add note 'birthday Jan 15' to Mom" -> action=add, field=notes, value=birthday Jan 15
- "set email john@email.com for John" -> action=set, field=email, value=john@email.com
- "mark Dad as favorite" -> action=set, field=favorite
- "what labels does Dad have" -> action=get, field=tags
- "show Dad's notes" -> action=get, field=notes`,
    schema: z.object({
      userId: z.string().describe("User ID - REQUIRED"),
      contactName: z.string().optional().describe("Name of contact"),
      contactPhone: z.string().optional().describe("Phone number of contact"),
      action: z.enum(["add", "remove", "set", "clear", "get", "list"]).describe("Action to perform"),
      field: z.enum(["tags", "labels", "label", "notes", "note", "email", "company", "work", "favorite", "starred"]).describe("Field to manage"),
      value: z.string().optional().describe("Value for the action (not needed for get/clear/remove-favorite)"),
    }),
  }
);

// Tool: Get Contact Details (full info)
const getContactDetailsTool = tool(
  async ({ userId, contactName, contactPhone }) => {
    try {
      // Find contact using AI matching
      let contact = null;
      
      if (contactName) {
        contact = await resolveContactWithAI(userId, contactName);
      }
      
      if (!contact && contactPhone) {
        contact = await resolveContactWithAI(userId, contactPhone);
      }

      if (!contact) {
        return `Could not find contact "${contactName || contactPhone}".`;
      }

      let info = `Contact: ${contact.name}\nPhone: ${contact.phone}`;
      if (contact.email) info += `\nEmail: ${contact.email}`;
      if (contact.company) info += `\nCompany: ${contact.company}`;
      if (contact.tags && contact.tags.length > 0) info += `\nLabels: ${contact.tags.join(', ')}`;
      if (contact.notes) info += `\nNotes: ${contact.notes}`;
      if (contact.isFavorite) info += `\nFavorite: Yes`;
      if (contact.isBlocked) info += `\nBlocked: Yes`;
      
      return info;
    } catch (error) {
      console.error("Get contact details error:", error);
      return `Error: ${error.message}`;
    }
  },
  {
    name: "get_contact_details",
    description: "Get full details of a contact including phone, email, company, labels, notes, favorite status. Use when user says: 'show contact info', 'what's Dad's info', 'contact details for X'.",
    schema: z.object({
      userId: z.string().describe("User ID - REQUIRED"),
      contactName: z.string().optional().describe("Name of contact"),
      contactPhone: z.string().optional().describe("Phone number of contact"),
    }),
  }
);

// Tool: Add Contact
const addContactTool = tool(
  async ({ userId, name, phone, label }) => {
    try {
      console.log("Adding contact:", { userId, name, phone, label });
      
      // Strip all non-digits
      let digits = phone.replace(/\D/g, '');
      console.log("Raw digits:", digits, "length:", digits.length);
      
      // Handle various formats:
      // +14372392448 -> 14372392448 (11 digits) -> 4372392448 (10 digits)
      // 14372392448 -> 4372392448 (10 digits) 
      // 4372392448 -> 4372392448 (10 digits)
      // +1437239244 -> 1437239244 (10 digits) -> INVALID (starts with 1 but only 10 total)
      
      // If 11 digits starting with 1, strip the country code
      if (digits.length === 11 && digits.startsWith('1')) {
        digits = digits.slice(1);
      }
      // If 10 digits starting with 1, this is actually a 9-digit number with country code - INVALID
      else if (digits.length === 10 && digits.startsWith('1')) {
        return `Invalid phone number "${phone}". The number after +1 must be exactly 10 digits. You provided 9 digits (${digits.slice(1)}).`;
      }
      
      // Final check: must be exactly 10 digits
      if (digits.length !== 10) {
        return `Invalid phone number "${phone}". Must be exactly 10 digits (e.g., 4372392448 or +14372392448). You provided ${digits.length} digits.`;
      }
      
      // Normalize to +1XXXXXXXXXX format
      const normalized = '+1' + digits;
      console.log("Normalized phone:", normalized);
      
      // Check if contact with same phone already exists
      const existingContacts = await Contact.find({ userId });
      const duplicatePhone = existingContacts.find(c => {
        const cDigits = (c.phone || '').replace(/\D/g, '').slice(-10);
        return cDigits === digits;
      });
      
      if (duplicatePhone) {
        return `A contact with this number already exists: "${duplicatePhone.name}" (${duplicatePhone.phone}). Use update_contact to rename them.`;
      }
      
      // Check if contact with same name already exists (case-insensitive)
      const trimmedName = name.trim().toLowerCase();
      const duplicateName = existingContacts.find(c => 
        (c.name || '').toLowerCase() === trimmedName || 
        (c.customName || '').toLowerCase() === trimmedName
      );
      
      if (duplicateName) {
        return `A contact named "${duplicateName.name}" already exists with number ${duplicateName.phone}. Did you mean to update their number? If so, say "update ${duplicateName.name}'s number to ${phone}" or use a different name.`;
      }
      
      // Create the contact
      const contact = await Contact.create({
        userId,
        name: name.trim(),
        phone: normalized,
        label: label || null,
      });
      
      // Update existing conversations to use the new contact name
      const allConvos = await Conversation.find({ userId });
      let updatedConvos = 0;
      for (const convo of allConvos) {
        const convoDigits = (convo.contactPhone || '').replace(/\D/g, '').slice(-10);
        if (convoDigits === digits) {
          convo.contactName = name.trim();
          await convo.save();
          updatedConvos++;
        }
      }
      
      // Update existing messages to use the new contact name
      const allMessages = await Message.find({ userId });
      let updatedMessages = 0;
      for (const msg of allMessages) {
        const msgDigits = (msg.contactPhone || '').replace(/\D/g, '').slice(-10);
        if (msgDigits === digits) {
          msg.contactName = name.trim();
          await msg.save();
          updatedMessages++;
        }
      }
      
      let response = `Contact added: "${contact.name}" (${contact.phone})${label ? ` with label "${label}"` : ''}.`;
      if (updatedConvos > 0) {
        response += ` Updated ${updatedConvos} conversation(s) in your inbox.`;
      }
      
      return response;
    } catch (error) {
      console.error("Add contact error:", error);
      return `Error adding contact: ${error.message}`;
    }
  },
  {
    name: "add_contact",
    description: "Add a new contact. Use when user says: add contact, new contact, save contact, create contact. Requires name and phone number.",
    schema: z.object({
      userId: z.string().describe("User ID - REQUIRED"),
      name: z.string().describe("Name for the contact"),
      phone: z.string().describe("Phone number (must be exactly 10 digits, with or without +1 country code)"),
      label: z.string().optional().describe("Optional label like 'work', 'family', 'friend', etc."),
    }),
  }
);

// Tool: Delete Contact
const deleteContactTool = tool(
  async ({ userId, contactName, contactPhone }) => {
    try {
      console.log("Deleting contact:", { userId, contactName, contactPhone });
      
      // Get all contacts for this user
      const allContacts = await Contact.find({ userId });
      
      if (allContacts.length === 0) {
        return "You don't have any contacts to delete.";
      }
      
      let contact = null;
      
      // If phone number provided, use it for precise matching
      if (contactPhone) {
        const digits = contactPhone.replace(/\D/g, '').slice(-10);
        contact = allContacts.find(c => {
          const cDigits = (c.phone || '').replace(/\D/g, '').slice(-10);
          return cDigits === digits;
        });
        if (!contact) {
          return `Could not find contact with number "${contactPhone}".`;
        }
      } else if (contactName) {
        // Check for duplicates with same name
        const nameMatches = allContacts.filter(c => 
          (c.name || '').toLowerCase() === contactName.toLowerCase() ||
          (c.customName || '').toLowerCase() === contactName.toLowerCase()
        );
        
        if (nameMatches.length > 1) {
          // Multiple contacts with same name - ask user to specify by phone
          const list = nameMatches.map(c => `• ${c.name} (${c.phone})`).join('\n');
          return `Found ${nameMatches.length} contacts named "${contactName}":\n${list}\n\nPlease specify which one by saying "delete contact at [phone number]".`;
        } else if (nameMatches.length === 1) {
          contact = nameMatches[0];
        } else {
          // Try AI matching for partial/fuzzy names
          contact = await resolveContactWithAI(userId, contactName);
        }
      }
      
      if (!contact) {
        return `Could not find contact "${contactName || contactPhone}". Check the name and try again.`;
      }
      
      const deletedName = contact.name;
      const deletedPhone = contact.phone;
      const phoneDigits = deletedPhone.replace(/\D/g, '').slice(-10);
      
      // Delete the contact
      await Contact.deleteOne({ _id: contact._id });
      
      // Update conversations to show phone number instead of name
      const allConvos = await Conversation.find({ userId });
      let updatedConvos = 0;
      for (const convo of allConvos) {
        const convoDigits = (convo.contactPhone || '').replace(/\D/g, '').slice(-10);
        if (convoDigits === phoneDigits) {
          convo.contactName = convo.contactPhone; // Revert to phone number
          await convo.save();
          updatedConvos++;
        }
      }
      
      // Update messages to show phone number instead of name
      const allMessages = await Message.find({ userId });
      let updatedMessages = 0;
      for (const msg of allMessages) {
        const msgDigits = (msg.contactPhone || '').replace(/\D/g, '').slice(-10);
        if (msgDigits === phoneDigits) {
          msg.contactName = msg.contactPhone; // Revert to phone number
          await msg.save();
          updatedMessages++;
        }
      }
      
      let response = `Contact deleted: "${deletedName}" (${deletedPhone}).`;
      if (updatedConvos > 0) {
        response += ` Updated ${updatedConvos} conversation(s) in your inbox.`;
      }
      
      return response;
    } catch (error) {
      console.error("Delete contact error:", error);
      return `Error deleting contact: ${error.message}`;
    }
  },
  {
    name: "delete_contact",
    description: "Delete a contact by name or phone number. Use when user says: delete contact, remove contact, get rid of contact. If multiple contacts have same name, use phone to specify which one.",
    schema: z.object({
      userId: z.string().describe("User ID - REQUIRED"),
      contactName: z.string().optional().describe("Name of the contact to delete"),
      contactPhone: z.string().optional().describe("Phone number to identify contact (use when multiple have same name)"),
    }),
  }
);

// Tool: Delete All Contacts
const deleteAllContactsTool = tool(
  async ({ userId, confirmed }) => {
    try {
      if (!confirmed) {
        const count = await Contact.countDocuments({ userId });
        if (count === 0) {
          return "You don't have any contacts to delete.";
        }
        return `Are you sure you want to delete all ${count} contact(s)? Say "yes delete all contacts" to confirm.`;
      }
      
      // Get all contacts before deleting (need phone numbers to update inbox)
      const allContacts = await Contact.find({ userId });
      
      // Delete all contacts
      const result = await Contact.deleteMany({ userId });
      
      // Update ALL conversations and messages to revert names to phone numbers
      for (const contact of allContacts) {
        const phoneDigits = contact.phone.replace(/\D/g, '').slice(-10);
        
        // Find and update matching conversations
        const allConvos = await Conversation.find({ userId });
        for (const convo of allConvos) {
          const convoDigits = (convo.contactPhone || '').replace(/\D/g, '').slice(-10);
          if (convoDigits === phoneDigits) {
            convo.contactName = convo.contactPhone; // Revert to phone number
            await convo.save();
          }
        }
        
        // Update all messages from this contact
        const allMessages = await Message.find({ userId });
        for (const msg of allMessages) {
          const msgDigits = (msg.contactPhone || '').replace(/\D/g, '').slice(-10);
          if (msgDigits === phoneDigits) {
            msg.contactName = msg.contactPhone; // Revert to phone number
            await msg.save();
          }
        }
      }
      
      return `Deleted all ${result.deletedCount} contact(s). Inbox updated.`;
    } catch (error) {
      console.error("Delete all contacts error:", error);
      return `Error deleting contacts: ${error.message}`;
    }
  },
  {
    name: "delete_all_contacts",
    description: "Delete ALL contacts. Use when user says: delete all contacts, remove all contacts, clear contacts. Always ask for confirmation first unless user already said 'yes'.",
    schema: z.object({
      userId: z.string().describe("User ID - REQUIRED"),
      confirmed: z.boolean().describe("Whether user confirmed. Set to true if user explicitly said 'yes' or 'delete all'"),
    }),
  }
);

// Tool: Search Contacts (AI-powered)
const searchContactsTool = tool(
  async ({ userId, query }) => {
    try {
      // Get all contacts
      const allContacts = await Contact.find({ userId }).limit(200);
      
      if (allContacts.length === 0) return "No contacts found.";
      
      // Use AI to find matching contacts
      const contactList = allContacts.map(c => `${c.name}: ${c.phone}`).join('\n');
      
      const matchResponse = await llm.invoke([
        new SystemMessage(`Find contacts matching the user's search query. Return up to 5 matching contacts in the format "Name: Phone", one per line.
Be flexible - match partial names, nicknames, phone number fragments.
If no matches, return "No contacts found."`),
        new HumanMessage(`Search query: "${query}"

All contacts:
${contactList}

Matching contacts:`)
      ]);
      
      return matchResponse.content.trim();
    } catch (error) {
      return `Error: ${error.message}`;
    }
  },
  {
    name: "search_contacts",
    description: "Search contacts by name or phone. Use to find contact details before transferring.",
    schema: z.object({
      userId: z.string().describe("User ID"),
      query: z.string().describe("Name or phone to search"),
    }),
  }
);

// Tool: Mark as Priority
const markPriorityTool = tool(
  async ({ userId, sourceContact, sourcePhone }) => {
    try {
      await Rule.create({
        userId,
        rule: `High priority: ${sourceContact}`,
        type: "priority",
        active: true,
        transferDetails: { sourceContact, sourcePhone }
      });
      return `Done. ${sourceContact} marked as high priority. You'll get prominent alerts.`;
    } catch (error) {
      return `Error: ${error.message}`;
    }
  },
  {
    name: "mark_priority",
    description: "Mark contact as high priority. Use when user says: important, priority, urgent, VIP, alert me.",
    schema: z.object({
      userId: z.string().describe("User ID - REQUIRED"),
      sourceContact: z.string().describe("Contact to prioritize"),
      sourcePhone: z.string().optional(),
    }),
  }
);

// Tool: Get Last Message (AI-powered contact matching)
const getLastMessageTool = tool(
  async ({ userId, contactPhone, contactName }) => {
    try {
      let resolvedPhone = contactPhone;
      let resolvedName = contactName;

      if (contactName && !contactPhone) {
        const contact = await resolveContactWithAI(userId, contactName);
        if (contact) {
          resolvedPhone = contact.phone;
          resolvedName = contact.name;
        }
      }

      if (!resolvedPhone) {
        return `Could not find contact "${contactName}". Try using their exact name or provide a phone number.`;
      }

      // Get last message - use phone digit matching (simple string contains, not regex)
      const phoneDigits = resolvedPhone.replace(/\D/g, "").slice(-10);
      
      // Find messages for this contact
      const messages = await Message.find({ userId }).sort({ createdAt: -1 }).limit(500);
      const last = messages.find(m => m.contactPhone && m.contactPhone.replace(/\D/g, "").includes(phoneDigits));

      if (!last) {
        return `No messages found with ${resolvedName || resolvedPhone}.`;
      }

      const dt = new Date(last.createdAt);
      const when = `${dt.toLocaleDateString()} ${dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
      const displayName = resolvedName || last.contactName || resolvedPhone;
      const text = last.body || "";
      
      // Clearly indicate who sent it
      const whoSent = last.direction === "outgoing" 
        ? `You sent to ${displayName}` 
        : `${displayName} sent to you`;

      return `Last message with ${displayName}:\n[${when}] ${whoSent}: "${text}"`;
    } catch (error) {
      console.error("Get last message error:", error);
      return `Error getting last message: ${error.message}`;
    }
  },
  {
    name: "get_last_message",
    description: "Get the most recent message with a contact (could be from you or them). Use when user asks: last message from X, show last text from X, what did X say.",
    schema: z.object({
      userId: z.string().describe("User ID - REQUIRED"),
      contactPhone: z.string().optional().describe("Contact phone"),
      contactName: z.string().optional().describe("Contact name"),
    }),
  }
);

// Tool: Get Last Message FROM Contact (incoming only, AI-powered)
const getLastIncomingMessageTool = tool(
  async ({ userId, contactPhone, contactName }) => {
    try {
      let resolvedPhone = contactPhone;
      let resolvedName = contactName;

      if (contactName && !contactPhone) {
        const contact = await resolveContactWithAI(userId, contactName);
        if (contact) {
          resolvedPhone = contact.phone;
          resolvedName = contact.name;
        }
      }

      if (!resolvedPhone) {
        return `Could not find contact "${contactName}".`;
      }

      const phoneDigits = resolvedPhone.replace(/\D/g, "").slice(-10);

      // Only get INCOMING messages (from them to you)
      const messages = await Message.find({ userId, direction: "incoming" }).sort({ createdAt: -1 }).limit(500);
      const last = messages.find(m => m.contactPhone && m.contactPhone.replace(/\D/g, "").includes(phoneDigits));

      if (!last) {
        return `No messages received FROM ${resolvedName || resolvedPhone}. They haven't texted you.`;
      }

      const dt = new Date(last.createdAt);
      const when = `${dt.toLocaleDateString()} ${dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
      const displayName = resolvedName || last.contactName || resolvedPhone;

      return `Last message FROM ${displayName} (to you):\n[${when}] "${last.body}"`;
    } catch (error) {
      console.error("Get last incoming message error:", error);
      return `Error: ${error.message}`;
    }
  },
  {
    name: "get_last_incoming_message",
    description: "Get the last message RECEIVED FROM a contact (what THEY sent to you, not what you sent). Use when user asks: 'what did he say', 'his last message to me', 'what did they text me', 'their last message'.",
    schema: z.object({
      userId: z.string().describe("User ID"),
      contactPhone: z.string().optional().describe("Contact phone"),
      contactName: z.string().optional().describe("Contact name"),
    }),
  }
);

// Tool: Search Messages (AI-powered semantic search)
const searchMessagesTool = tool(
  async ({ userId, query, contactPhone }) => {
    try {
      console.log("AI searching messages for:", query);
      
      // Get recent messages
      let messages = await Message.find({ userId }).sort({ createdAt: -1 }).limit(200);
      
      // Filter by contact if specified
      if (contactPhone) {
        const phoneDigits = contactPhone.replace(/\D/g, "").slice(-10);
        messages = messages.filter(m => m.contactPhone && m.contactPhone.replace(/\D/g, "").includes(phoneDigits));
      }
      
      if (messages.length === 0) {
        return "No messages found.";
      }
      
      // Format messages for AI
      const msgList = messages.map(m => {
        const contact = m.contactName || m.contactPhone || "Unknown";
        const date = new Date(m.createdAt).toLocaleDateString();
        const sender = m.direction === "outgoing" ? "You" : contact;
        return `[${date}] ${sender}: ${m.body}`;
      }).join('\n');
      
      // Use AI to find relevant messages
      const searchResponse = await llm.invoke([
        new SystemMessage(`Search through the user's messages and find ones relevant to their query.
Return the matching messages in the same format they were given.
If nothing matches, say "No messages found matching your search."
Be smart - understand synonyms, context, and intent.`),
        new HumanMessage(`Search query: "${query}"

Messages:
${msgList}

Relevant messages:`)
      ]);
      
      return searchResponse.content.trim();
    } catch (error) {
      console.error("Search messages error:", error);
      return `Error searching: ${error.message}`;
    }
  },
  {
    name: "search_messages",
    description: "Search through all messages for keywords. Use when user asks about meetings, appointments, plans, events, or wants to find specific information in their messages.",
    schema: z.object({
      userId: z.string().describe("User ID - REQUIRED"),
      query: z.string().describe("Keywords to search for (e.g., meeting, appointment, lunch, dinner, call)"),
      contactPhone: z.string().optional().describe("Limit search to specific contact's phone"),
    }),
  }
);

// Tool: Search Messages by Date Range
const searchMessagesByDateTool = tool(
  async ({ userId, startDate, endDate, contactPhone }) => {
    try {
      console.log("Searching messages by date:", { userId, startDate, endDate, contactPhone });

      const now = new Date();

      // Accept natural language ranges like "last week" by putting it in startDate
      let range = null;
      if (typeof startDate === "string" && !endDate) {
        range = parseNaturalDateRange(startDate, now);
      }

      // Parse dates (supports ISO or natural-ish)
      const start = range?.start || startOfDay(parseNaturalTime(startDate, now) || new Date(startDate));
      const end = range?.end || endOfDay(parseNaturalTime(endDate || "", now) || (endDate ? new Date(endDate) : new Date()));

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return `Could not understand that date range. Try "last week", "yesterday", "this month", or "from Jan 5 to Jan 12".`;
      }
      
      // Get all messages in date range
      let messages = await Message.find({
        userId,
        createdAt: { $gte: start, $lte: end },
      }).sort({ createdAt: -1 }).limit(200);

      // Filter by phone if provided
      if (contactPhone && messages.length > 0) {
        const phoneDigits = contactPhone.replace(/\D/g, "").slice(-10);
        messages = messages.filter(m => {
          const msgDigits = (m.contactPhone || '').replace(/\D/g, '').slice(-10);
          return msgDigits === phoneDigits;
        });
      }
      
      // Limit to 50 after filtering
      messages = messages.slice(0, 50);
      
      if (messages.length === 0) {
        return `No messages found between ${start.toLocaleDateString()} and ${end.toLocaleDateString()}.`;
      }
      
      // Format results
      const results = messages.map(m => {
        const contact = m.contactName || m.contactPhone || "Unknown";
        const date = new Date(m.createdAt).toLocaleDateString();
        const time = new Date(m.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const direction = m.direction === 'outgoing' ? '→' : '←';
        return `[${date} ${time}] ${direction} ${contact}: ${m.body}`;
      });
      
      return `Found ${messages.length} messages:\n${results.join("\n")}`;
    } catch (error) {
      console.error("Search messages by date error:", error);
      return `Error searching: ${error.message}`;
    }
  },
  {
    name: "search_messages_by_date",
    description: "Search messages within a date range. Supports natural ranges like 'last week', 'yesterday', 'this month', or 'from Jan 5 to Jan 12'. Use when user asks 'what did we talk about on January 1', 'show messages from last week', 'messages between dates'.",
    schema: z.object({
      userId: z.string().describe("User ID - REQUIRED"),
      startDate: z.string().describe("Start date OR a natural date range like 'last week' or 'from Jan 5 to Jan 12'"),
      endDate: z.string().optional().describe("End date (optional if startDate is a range like 'last week')"),
      contactPhone: z.string().optional().describe("Filter to specific contact"),
    }),
  }
);

// Tool: Get All Rules
const getRulesTool = tool(
  async ({ userId, includeInactive }) => {
    try {
      console.log("Getting rules for user:", userId, "includeInactive:", includeInactive);
      
      if (includeInactive) {
        // Get inactive rules only
        const inactiveRules = await Rule.find({ userId, active: false });
        
        if (inactiveRules.length === 0) {
          return "You have no inactive (disabled) rules.";
        }
        
        const ruleList = inactiveRules.map((r, i) => {
          let details = `${i + 1}. [${r.type.toUpperCase()}] ${r.rule}`;
          if (r.transferDetails?.contactName) {
            details += ` (to: ${r.transferDetails.contactName})`;
          }
          return details;
        });
        
        return `Your inactive (disabled) rules:\n${ruleList.join("\n")}`;
      }
      
      // Default: active rules
      const rules = await Rule.find({ userId, active: true });
      
      if (rules.length === 0) {
        return "You have no active rules set up.";
      }
      
      const ruleList = rules.map((r, i) => {
        let details = `${i + 1}. [${r.type.toUpperCase()}] ${r.rule}`;
        if (r.transferDetails?.contactName) {
          details += ` (to: ${r.transferDetails.contactName})`;
        }
        return details;
      });
      
      return `Your active rules:\n${ruleList.join("\n")}`;
    } catch (error) {
      console.error("Get rules error:", error);
      return `Error getting rules: ${error.message}`;
    }
  },
  {
    name: "get_rules",
    description: "List rules for the user. Set includeInactive=true for inactive/disabled rules. Use when user asks 'what rules do I have', 'show my rules', 'inactive rules', 'disabled rules'.",
    schema: z.object({
      userId: z.string().describe("User ID - REQUIRED"),
      includeInactive: z.boolean().optional().describe("Set to true to show inactive/disabled rules instead of active ones"),
    }),
  }
);

// Tool: Delete Rule (AI-powered matching)
const deleteRuleTool = tool(
  async ({ userId, userRequest }) => {
    try {
      console.log("AI Delete Rule:", { userId, userRequest });
      
      // 1. Get all active rules
      const allRules = await Rule.find({ userId, active: true }).sort({ createdAt: -1 });
      
      if (allRules.length === 0) {
        return "You don't have any active rules to delete.";
      }
      
      // 2. If only one rule, just delete it
      if (allRules.length === 1) {
        const deleted = await Rule.findByIdAndDelete(allRules[0]._id);
        return `Deleted your only rule: "${deleted.rule}"`;
      }
      
      // 3. Use AI to match the user's request to the right rule
      const rulesDescription = allRules.map((r, i) => 
        `${i + 1}. [ID: ${r._id}] [${r.type.toUpperCase()}] ${r.rule}`
      ).join("\n");
      
      const matchResponse = await llm.invoke([
        new SystemMessage(`You are matching a user's delete request to one of their rules.
Given the user's request and the list of rules, return ONLY the ID of the rule they want to delete.
If user says "turn that off", "delete it", "the first one", etc - pick the most recently mentioned or first rule.
If user mentions a contact name, type (transfer/block/etc), or keywords - match to that rule.
Return ONLY the MongoDB ObjectId, nothing else.`),
        new HumanMessage(`User request: "${userRequest}"

Available rules:
${rulesDescription}

Return the ID of the rule to delete:`)
      ]);
      
      const ruleId = matchResponse.content.trim();
      console.log("AI matched rule ID:", ruleId);
      
      // 4. Delete the matched rule
      const deleted = await Rule.findOneAndDelete({ _id: ruleId, userId });
      
      if (deleted) {
        return `Done! Deleted rule: "${deleted.rule}"`;
      } else {
        // Fallback: delete the most recent rule
        const fallback = await Rule.findOneAndDelete({ userId, active: true }, { sort: { createdAt: -1 } });
        if (fallback) {
          return `Deleted most recent rule: "${fallback.rule}"`;
        }
        return "Could not find the rule to delete. Try 'show my rules' to see what's available.";
      }
    } catch (error) {
      console.error("Delete rule error:", error);
      // Fallback on error: just delete most recent
      try {
        const fallback = await Rule.findOneAndDelete({ userId, active: true }, { sort: { createdAt: -1 } });
        if (fallback) return `Deleted rule: "${fallback.rule}"`;
      } catch (e) {}
      return `Error deleting rule: ${error.message}`;
    }
  },
  {
    name: "delete_rule",
    description: "Delete/disable/turn off a rule. Use when user says 'stop forwarding', 'remove rule', 'delete the auto-reply', 'cancel transfer', 'turn that off', 'disable rule', 'delete it'.",
    schema: z.object({
      userId: z.string().describe("User ID"),
      userRequest: z.string().describe("The user's full request about which rule to delete - pass exactly what they said"),
    }),
  }
);

// Tool: Summarize Conversation (AI-powered)
const summarizeConversationTool = tool(
  async ({ userId, contactPhone, contactName, timeframe, maxMessages }) => {
    try {
      console.log("Summarizing conversation:", { userId, contactPhone, contactName, timeframe, maxMessages });
      
      // If we have a name but no phone, use AI to find contact
      let resolvedPhone = contactPhone;
      let resolvedName = contactName;
      
      if (contactName && !contactPhone) {
        const contact = await resolveContactWithAI(userId, contactName);
        if (contact) {
          resolvedPhone = contact.phone;
          resolvedName = contact.name;
          console.log("Found contact:", resolvedName, resolvedPhone);
        }
      }
      
      if (!resolvedPhone) {
        return `Could not find contact "${contactName}". Try using their exact name.`;
      }

      const now = new Date();
      const range = timeframe ? parseNaturalDateRange(timeframe, now) : null;
      
      // Get messages using phone digit matching
      const phoneDigits = resolvedPhone.replace(/\D/g, '').slice(-10);

      const query = { userId };
      if (range?.start && range?.end) {
        query.createdAt = { $gte: range.start, $lte: range.end };
      }

      const hardLimit = Math.max(30, Math.min(400, Number(maxMessages) || 30));

      // Fetch a generous window then filter by digits (phone formats vary)
      const allMessages = await Message.find(query).sort({ createdAt: -1 }).limit(800);
      let messages = allMessages.filter(m =>
        m.contactPhone && m.contactPhone.replace(/\D/g, '').includes(phoneDigits)
      );

      // If user asked for "old" or "older" and no explicit range, bias toward older messages
      if (!range && typeof timeframe === "string" && /\bold\b|\bolder\b|\bearlier\b/i.test(timeframe)) {
        messages = messages.reverse().slice(0, hardLimit).reverse();
      } else {
        messages = messages.slice(0, hardLimit);
      }
      
      if (messages.length === 0) {
        const rangeHint = timeframe ? ` in ${timeframe}` : "";
        return `No messages found with ${resolvedName || resolvedPhone}${rangeHint}.`;
      }
      
      // Build conversation text for summarization
      const msgText = messages.reverse().map(m => {
        const dir = m.direction === 'outgoing' ? 'You' : (resolvedName || resolvedPhone);
        return `${dir}: ${m.body}`;
      }).join("\n");
      
      // Use LLM to summarize
      const summaryResponse = await llm.invoke([
        new SystemMessage("Summarize this conversation concisely. Highlight key points, action items, and any scheduled meetings. Use plain text only - NO markdown, NO emojis, NO asterisks."),
        new HumanMessage(msgText)
      ]);
      
      return `Summary with ${resolvedName || resolvedPhone}:\n${sanitizeAIResponse(summaryResponse.content)}`;
    } catch (error) {
      console.error("Summarize conversation error:", error);
      return `Error summarizing: ${error.message}`;
    }
  },
  {
    name: "summarize_conversation",
    description: "Summarize chat history with a contact. Supports timeframe like 'last week', 'yesterday', 'this month', or 'old'. Use for: 'summarize my chats from X', 'what did X and I talk about', 'summary with X', 'summarize our conversation last week'.",
    schema: z.object({
      userId: z.string().describe("User ID - REQUIRED"),
      contactPhone: z.string().optional().describe("Phone of contact"),
      contactName: z.string().optional().describe("Name of contact to summarize chats with"),
      timeframe: z.string().optional().describe("Optional timeframe or range like 'last week', 'yesterday', 'this month', 'from Jan 5 to Jan 12', or 'old'"),
      maxMessages: z.number().optional().describe("Optional cap for how many messages to include (default 30, max 400)"),
    }),
  }
);

// All conversation tools
const conversationTools = [
  createTransferRuleTool,
  createAutoReplyTool,
  blockContactTool,
  unblockContactTool,
  addContactTool,
  updateContactTool,
  deleteContactTool,
  searchContactsTool,
  markPriorityTool,
  getLastMessageTool,
  getLastIncomingMessageTool,
  searchMessagesTool,
  searchMessagesByDateTool,
  getRulesTool,
  deleteRuleTool,
  summarizeConversationTool,
];

// Create LLM with tools bound
const llmWithTools = llm.bindTools(conversationTools);

// Tool execution map
const toolMap = {
  create_transfer_rule: createTransferRuleTool,
  create_auto_reply: createAutoReplyTool,
  block_contact: blockContactTool,
  unblock_contact: unblockContactTool,
  add_contact: addContactTool,
  update_contact: updateContactTool,
  delete_contact: deleteContactTool,
  search_contacts: searchContactsTool,
  mark_priority: markPriorityTool,
  get_last_message: getLastMessageTool,
  get_last_incoming_message: getLastIncomingMessageTool,
  search_messages: searchMessagesTool,
  search_messages_by_date: searchMessagesByDateTool,
  get_rules: getRulesTool,
  delete_rule: deleteRuleTool,
  summarize_conversation: summarizeConversationTool,
};

// ==================== MAIN FUNCTION ====================

export async function conversationChat(userId, message, contactName, contactPhone, conversationContext) {
  try {
    console.log("=== ConversationChat ===");
    console.log("userId:", userId);
    console.log("contactName:", contactName);
    console.log("contactPhone:", contactPhone);
    console.log("message:", message);
    
    if (!userId) {
      return "Error: User not authenticated.";
    }

    const systemPrompt = `You are Comsierge AI, an intelligent NLP-powered assistant for managing communications.

=== CURRENT CONTEXT ===
User ID: ${userId}
Current Contact: ${contactName}
Contact Phone: ${contactPhone || "unknown"}

=== YOUR TOOLS ===
You have these tools - USE THEM when the user's intent matches:

1. create_transfer_rule - Forward messages/calls to someone
   Triggers: "transfer", "forward", "redirect", "send to X", "route to"
   
2. create_auto_reply - Set automatic responses  
   Triggers: "auto reply", "automatic response", "respond automatically"
   
3. block_contact - Block current contact
   Triggers: "block", "mute", "ignore", "stop messages", "don't want to hear"
   
4. update_contact - Rename the contact
   Triggers: "rename", "change name", "call them X", "name is", "update name", "change contact"
   
5. search_contacts - Find contacts by name/phone
   Triggers: Looking up someone before transferring
   
6. mark_priority - Mark as high priority
   Triggers: "important", "priority", "VIP", "urgent", "alert me"

7. search_messages - Search ALL messages for keywords
   Triggers: "do I have a meeting", "any appointments", "find messages about", "when did they say", "search for", "look for"
   ALWAYS USE THIS when user asks about meetings, appointments, plans, events, dates, times, lunch, dinner, calls scheduled

8. search_messages_by_date - Search messages in a date range
   Triggers: "what did we talk about on [date]", "messages from January", "show messages from last week", "conversations on March 5"

9. get_rules - List all active rules
   Triggers: "show my rules", "what rules do I have", "list my transfers", "my auto-replies"

10. delete_rule - Remove a rule
    Triggers: "stop forwarding", "remove rule", "delete auto-reply", "cancel transfer to X"

11. summarize_conversation - Summarize chat with contact
    Triggers: "summarize", "what did we talk about", "give me a summary", "recap our conversation"

12. unblock_contact - Unblock a blocked contact
    Triggers: "unblock", "allow again", "remove block", "let them message"

=== CRITICAL RULES FOR UNDERSTANDING INTENT ===
1. READ THE AI CHAT HISTORY CAREFULLY - it contains important context from previous messages
2. When user provides info like "X is +1234567890" - they're giving you a phone number for X, NOT asking to rename something
3. "forward calls to Mark" then "Mark is +123..." means: use +123 as the target for the forward rule
4. "change it back" or "undo" - refer to the chat history to see what was changed
5. When user says "[Name] is [phone]" after asking for a forward/transfer - they're providing the TARGET phone number

=== INTERPRETING MULTI-STEP CONVERSATIONS ===
- If user said "forward to Mark" and you asked for Mark's number, and they reply "+1234567890" or "Mark is +1234567890"
  → Complete the forward rule with targetPhone=+1234567890
- If user gives a second number like "[Name] is [another number]" - they might be adding an alternative number, ask for clarification
- Always use chat history to understand what the user is trying to accomplish

=== TOOL CALL RULES ===
1. BE ACTION-ORIENTED - Execute immediately, don't ask unnecessary questions
2. ALWAYS include these in tool calls:
   - userId: "${userId}"
   - sourceContact: "${contactName}"  
   - sourcePhone: "${contactPhone}"
3. When user says "transfer to X" → call create_transfer_rule with targetName=X
4. When user says "change name to X" or "rename to X" or "change contact to X" → call update_contact with newName=X, currentPhone="${contactPhone}"
5. When user asks about meetings/appointments/events → call search_messages with query="meeting" or relevant keywords
6. When user asks about messages on a specific date → use search_messages_by_date
7. When user asks "summarize" with no specific contact → use summarize_conversation with current contact
8. When user says "unblock" → call unblock_contact with sourceContact and sourcePhone
9. If no tool matches, analyze the conversation or answer the question

=== CONVERSATION HISTORY (IMPORTANT - READ THIS) ===
${conversationContext || "No history available."}`;

    const response = await llmWithTools.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(message),
    ]);

    console.log("LLM Response:", response.content);
    console.log("Tool calls:", response.tool_calls);

    // Execute tool calls if present
    if (response.tool_calls && response.tool_calls.length > 0) {
      const results = [];
      
      for (const toolCall of response.tool_calls) {
        console.log(`Executing tool: ${toolCall.name}`, toolCall.args);
        
        const selectedTool = toolMap[toolCall.name];
        if (selectedTool) {
          try {
            const result = await selectedTool.invoke(toolCall.args);
            results.push({ toolName: toolCall.name, result });
          } catch (toolError) {
            console.error(`Tool ${toolCall.name} error:`, toolError);
            results.push({ toolName: toolCall.name, result: `Error: ${toolError.message}` });
          }
        }
      }
      
      // Send tool results back to LLM for natural language interpretation
      const toolResultsText = results.map(r => `Tool ${r.toolName} result:\n${r.result}`).join("\n\n");
      
      const finalResponse = await llm.invoke([
        new SystemMessage(`You are a helpful assistant. The user asked: "${message}"
        
Based on the tool results below, provide a natural, conversational response. 
- Do NOT just repeat the raw data
- Interpret the results and answer the user's question directly
- Be concise and friendly
- Do NOT use markdown formatting (no ** or * or #) or emojis
- If they asked about meetings/appointments, tell them clearly if they have one or not, and the details

Tool results:
${toolResultsText}`),
        new HumanMessage("Please provide a natural response based on these results."),
      ]);
      
      return sanitizeAIResponse(finalResponse.content) || toolResultsText;
    }
    
    // No tool calls - return text response
    return sanitizeAIResponse(response.content) || "I understood your request but couldn't determine the appropriate action.";
    
  } catch (error) {
    console.error("ConversationChat Error:", error);
    return `I encountered an error: ${error.message}. Please try again.`;
  }
}

// Export for rules tab (simpler version)
export async function chatWithAI(userId, message, history = []) {
  return conversationChat(userId, message, "General", null, "");
}
// ==================== FULL AGENT FOR RULES TAB ====================
// This agent can do EVERYTHING - call, message, create rules, search, etc.

// Tool: Make a phone call
const makeCallTool = tool(
  async ({ userId, contactName, contactPhone }) => {
    try {
      console.log("📞 Make call request:", { userId, contactName, contactPhone });
      
      // Resolve contact phone using AI
      let phone = contactPhone;
      let resolvedName = contactName;
      
      if (!phone && contactName) {
        // Use AI to find the contact
        const contact = await resolveContactWithAI(userId, contactName);
        
        if (contact && contact.phone) {
          phone = contact.phone;
          resolvedName = contact.name || contactName;
          console.log("Found contact:", resolvedName, phone);
        } else {
          // Also try in Conversations
          const allConvos = await Conversation.find({ userId }).limit(200);
          
          if (allConvos.length > 0) {
            const convoList = allConvos.map(c => `${c.contactName || 'Unknown'}: ${c.contactPhone}`).join('\n');
            
            const matchResponse = await llm.invoke([
              new SystemMessage(`Find the conversation that best matches the user's input. Return ONLY the phone number, nothing else. If no match, return "NO_MATCH".`),
              new HumanMessage(`Input: "${contactName}"\n\nConversations:\n${convoList}\n\nPhone number:`)
            ]);
            
            const matchedPhone = matchResponse.content.trim();
            if (matchedPhone !== "NO_MATCH") {
              const convo = allConvos.find(c => c.contactPhone === matchedPhone);
              if (convo) {
                phone = convo.contactPhone;
                resolvedName = convo.contactName || contactName;
              }
            }
          }
        }
        
        if (!phone) {
          return `I couldn't find "${contactName}" in your contacts. Please provide their phone number.`;
        }
      }
      
      if (!phone) {
        return "I need either a contact name or phone number to make a call.";
      }
      
      // Get user to find their assigned phone number
      const user = await User.findById(userId);
      if (!user?.phoneNumber) {
        return "You don't have a phone number set up yet. Go to Settings to configure your Comsierge number.";
      }
      
      // Return confirmation with call details - frontend will handle the actual call
      return JSON.stringify({
        action: "call",
        confirm: true,
        contactName: resolvedName || phone,
        contactPhone: phone,
        fromNumber: user.phoneNumber,
        message: `Ready to call ${resolvedName || phone}. Choose a calling method: Browser Call (VoIP) or Call via My Phone.`
      });
    } catch (error) {
      console.error("Make call error:", error);
      return `Error: ${error.message}`;
    }
  },
  {
    name: "make_call",
    description: "Initiate a phone call to a contact. Use when user says: call, phone, dial, ring",
    schema: z.object({
      userId: z.string().describe("User ID"),
      contactName: z.string().optional().describe("Name of contact to call"),
      contactPhone: z.string().optional().describe("Phone number to call"),
    }),
  }
);

// Tool: Send SMS message
const sendMessageTool = tool(
  async ({ userId, contactName, contactPhone, messageText }) => {
    try {
      console.log("💬 Send message request:", { userId, contactName, messageText });
      
      // Resolve contact
      let phone = contactPhone;
      let name = contactName;
      
      if (!phone && contactName) {
        // Use AI to find contact
        const contact = await resolveContactWithAI(userId, contactName);
        
        if (contact && contact.phone) {
          phone = contact.phone;
          name = contact.name || contactName;
        } else {
          // Try Conversations with AI
          const allConvos = await Conversation.find({ userId }).limit(200);
          if (allConvos.length > 0) {
            const convoList = allConvos.map(c => `${c.contactName || 'Unknown'}: ${c.contactPhone}`).join('\n');
            const matchResponse = await llm.invoke([
              new SystemMessage(`Find the conversation that best matches the input. Return ONLY the phone number, nothing else. If no match, return "NO_MATCH".`),
              new HumanMessage(`Input: "${contactName}"\n\nConversations:\n${convoList}\n\nPhone number:`)
            ]);
            const matchedPhone = matchResponse.content.trim();
            if (matchedPhone !== "NO_MATCH") {
              const convo = allConvos.find(c => c.contactPhone === matchedPhone);
              if (convo) {
                phone = convo.contactPhone;
                name = convo.contactName || contactName;
              }
            }
          }
        }
        
        if (!phone) {
          return `I couldn't find "${contactName}" in your contacts. Please provide their phone number.`;
        }
      }
      
      if (!phone) {
        return "I need either a contact name or phone number to send a message.";
      }
      
      if (!messageText) {
        return `What would you like to say to ${name || phone}?`;
      }
      
      // Return confirmation - frontend will handle actual sending
      return JSON.stringify({
        action: "send_message",
        confirm: true,
        contactName: name || phone,
        contactPhone: phone,
        messageText,
        message: `Ready to send to ${name || phone}:\n\n"${messageText}"\n\nReply "yes" to send or tell me what changes to make.`
      });
    } catch (error) {
      console.error("Send message error:", error);
      return `Error: ${error.message}`;
    }
  },
  {
    name: "send_message",
    description: "Send an SMS message to a contact. Use when user says: text, message, send, tell them, say to",
    schema: z.object({
      userId: z.string().describe("User ID"),
      contactName: z.string().optional().describe("Name of contact"),
      contactPhone: z.string().optional().describe("Phone number"),
      messageText: z.string().optional().describe("The message to send"),
    }),
  }
);

// Tool: Execute Send Message (actually sends the SMS via Twilio)
const executeSendMessageTool = tool(
  async ({ userId, contactPhone, messageText, contactName }) => {
    try {
      console.log("🚀 Executing SMS send:", { userId, contactPhone, messageText });
      
      // Get user's Twilio account
      const user = await User.findById(userId);
      if (!user?.phoneNumber) {
        return "You don't have a phone number configured. Please set one up in Settings first.";
      }
      
      // Normalize phone numbers
      const fromNumber = normalizePhoneForSms(user.phoneNumber);
      const toNumber = normalizePhoneForSms(contactPhone);
      
      // Look up Twilio account by the user's phone number (not userId)
      let twilioAccount = await TwilioAccount.findOne({ 
        phoneNumbers: user.phoneNumber 
      });
      
      // Try normalized version
      if (!twilioAccount && fromNumber) {
        twilioAccount = await TwilioAccount.findOne({ 
          phoneNumbers: fromNumber 
        });
      }
      
      // Try phone assignments
      if (!twilioAccount) {
        twilioAccount = await TwilioAccount.findOne({
          "phoneAssignments.phoneNumber": { $in: [user.phoneNumber, fromNumber] }
        });
      }
      
      // Fallback: search all accounts for matching phone
      if (!twilioAccount) {
        const allAccounts = await TwilioAccount.find({});
        const phoneDigits = fromNumber.replace(/\D/g, '').slice(-10);
        for (const acc of allAccounts) {
          const normalizedPhones = (acc.phoneNumbers || []).map(p => p.replace(/\D/g, '').slice(-10));
          if (normalizedPhones.includes(phoneDigits)) {
            twilioAccount = acc;
            break;
          }
        }
      }
      
      if (!twilioAccount) {
        console.log("No Twilio account found for phone:", user.phoneNumber);
        return "No Twilio account found for your phone number. Please contact support.";
      }
      
      // Decrypt credentials
      const accountSid = twilioAccount.accountSid;
      const authToken = twilioAccount.authToken;
      
      if (!accountSid || !authToken) {
        return "Twilio credentials not properly configured.";
      }
      
      console.log("Found Twilio account:", accountSid.slice(0, 8) + "...");
      
      // Initialize Twilio client
      const client = twilio(accountSid, authToken);
      
      // Send the message
      const twilioMessage = await client.messages.create({
        body: messageText,
        from: fromNumber,
        to: toNumber,
      });
      
      console.log("✅ SMS sent via Twilio:", twilioMessage.sid);
      
      // Save to database
      try {
        const savedMessage = new Message({
          userId,
          contactPhone: toNumber,
          contactName: contactName || toNumber,
          direction: "outgoing",
          body: messageText,
          status: "sent",
          twilioSid: twilioMessage.sid,
          fromNumber,
          toNumber,
          isRead: true,
        });
        await savedMessage.save();
        
        // Update or create conversation
        const phoneDigits = toNumber.replace(/\D/g, '').slice(-10);
        const allConvos = await Conversation.find({ userId });
        const matchingConvo = allConvos.find(c => {
          const convoDigits = (c.contactPhone || '').replace(/\D/g, '').slice(-10);
          return convoDigits === phoneDigits;
        });
        
        if (matchingConvo) {
          matchingConvo.lastMessage = messageText;
          matchingConvo.lastMessageAt = new Date();
          matchingConvo.messageCount = (matchingConvo.messageCount || 0) + 1;
          await matchingConvo.save();
        } else {
          // Create new conversation
          await Conversation.create({
            userId,
            contactPhone: toNumber,
            contactName: contactName || toNumber,
            lastMessage: messageText,
            lastMessageAt: new Date(),
            messageCount: 1,
            isRead: true,
            status: "active",
          });
          console.log("Created new conversation for:", toNumber);
        }
      } catch (dbError) {
        console.error("DB save error (message still sent):", dbError);
      }
      
      return `Message sent to ${contactName || contactPhone}: "${messageText}"`;
    } catch (error) {
      console.error("Execute send message error:", error);
      return `Failed to send message: ${error.message}`;
    }
  },
  {
    name: "execute_send_message",
    description: "Actually send an SMS after user confirmation. Use when user says 'yes', 'send it', 'confirm', 'do it' after being asked to confirm sending a message.",
    schema: z.object({
      userId: z.string().describe("User ID"),
      contactPhone: z.string().describe("Phone number to send to"),
      messageText: z.string().describe("Message text to send"),
      contactName: z.string().optional().describe("Contact name for records"),
    }),
  }
);

// Tool: List all labels/tags
const listLabelsTool = tool(
  async ({ userId }) => {
    try {
      const contacts = await Contact.find({ userId });
      
      // Collect all unique tags from all contacts
      const tagMap = new Map(); // tag -> list of contacts with that tag
      
      for (const contact of contacts) {
        if (contact.tags && contact.tags.length > 0) {
          for (const tag of contact.tags) {
            if (!tagMap.has(tag)) {
              tagMap.set(tag, []);
            }
            tagMap.get(tag).push(contact.name);
          }
        }
      }
      
      if (tagMap.size === 0) {
        return "No labels/tags found on any contacts. You can add labels like 'family', 'work', 'friend' to your contacts using: add label [labelname] to [contactname]";
      }
      
      let result = `Labels in your contacts (${tagMap.size}):\n`;
      for (const [tag, contactNames] of tagMap) {
        result += `- "${tag}": ${contactNames.join(', ')}\n`;
      }
      
      return result;
    } catch (error) {
      console.error("List labels error:", error);
      return `Error: ${error.message}`;
    }
  },
  {
    name: "list_labels",
    description: "List all labels/tags used across contacts. Use when user says: 'show all labels', 'list my labels', 'what labels do I have', 'show me all my tags'.",
    schema: z.object({
      userId: z.string().describe("User ID - REQUIRED"),
    }),
  }
);

// Tool: List all contacts
const listContactsTool = tool(
  async ({ userId, filter }) => {
    try {
      let query = { userId };
      if (filter === "favorites") query.isFavorite = true;
      if (filter === "blocked") query.isBlocked = true;
      
      const contacts = await Contact.find(query).sort({ name: 1 }).limit(50);
      
      if (contacts.length === 0) {
        return "No contacts found.";
      }
      
      const list = contacts.map(c => {
        let status = [];
        if (c.isFavorite) status.push("[fav]");
        if (c.isBlocked) status.push("[blocked]");
        return `- ${c.name} (${c.phone})${status.length ? " " + status.join(" ") : ""}`;
      }).join("\n");
      
      return `Your contacts (${contacts.length}):\n${list}`;
    } catch (error) {
      console.error("List contacts error:", error);
      return `Error: ${error.message}`;
    }
  },
  {
    name: "list_contacts",
    description: "List all contacts, favorites, or blocked contacts",
    schema: z.object({
      userId: z.string().describe("User ID"),
      filter: z.enum(["all", "favorites", "blocked"]).optional().describe("Filter contacts"),
    }),
  }
);

// Tool: Get user's phone info
const getPhoneInfoTool = tool(
  async ({ userId }) => {
    try {
      const user = await User.findById(userId);
      
      let info = [];
      if (user?.phoneNumber) {
        info.push(`Your Comsierge Number: ${user.phoneNumber}`);
      }
      if (user?.forwardingNumber) {
        info.push(`Forwarding to: ${user.forwardingNumber}`);
      }
      
      const rulesCount = await Rule.countDocuments({ userId, active: true });
      info.push(`Active Rules: ${rulesCount}`);
      
      const contactsCount = await Contact.countDocuments({ userId });
      info.push(`Contacts: ${contactsCount}`);
      
      return info.join("\n");
    } catch (error) {
      return `Error: ${error.message}`;
    }
  },
  {
    name: "get_phone_info",
    description: "Get user's phone numbers, forwarding setup, and stats",
    schema: z.object({
      userId: z.string().describe("User ID"),
    }),
  }
);

// Tool: Update Forwarding Number
const updateForwardingNumberTool = tool(
  async ({ userId, newForwardingNumber }) => {
    try {
      console.log("Updating forwarding number:", { userId, newForwardingNumber });
      
      // Strip all non-digits
      let digits = newForwardingNumber.replace(/\D/g, '');
      console.log("Raw digits:", digits, "length:", digits.length);
      
      // If 11 digits starting with 1, strip the country code to get base 10 digits
      if (digits.length === 11 && digits.startsWith('1')) {
        digits = digits.slice(1);
      }
      // If 10 digits but starts with 1, it's actually a 9-digit number (invalid)
      else if (digits.length === 10 && digits.startsWith('1')) {
        return `Invalid phone number. "${newForwardingNumber}" appears to be only 9 digits. US phone numbers must be exactly 10 digits (e.g., 437-239-2448).`;
      }
      
      // Must be exactly 10 digits
      if (digits.length !== 10) {
        return `Invalid phone number. US phone numbers must be exactly 10 digits. You provided ${digits.length} digits.`;
      }
      
      // Normalize to +1XXXXXXXXXX format
      const normalized = '+1' + digits;
      console.log("Normalized phone:", normalized);
      
      // Get user to check their Comsierge number
      const user = await User.findById(userId);
      if (!user) {
        return "User not found.";
      }
      
      // Prevent setting forwarding number to user's own Comsierge number
      if (user.phoneNumber) {
        const comsiergeDigits = user.phoneNumber.replace(/\D/g, '').slice(-10);
        if (digits === comsiergeDigits) {
          return `You can't forward to your own Comsierge number (${user.phoneNumber}). That would create a loop! Please provide a different phone number where you'd like calls and messages forwarded to (like your personal cell phone).`;
        }
      }
      
      // Update user's forwarding number
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { forwardingNumber: normalized },
        { new: true }
      );
      
      return `Done! Your forwarding number has been updated to ${normalized}. All incoming calls and messages to your Comsierge number will now forward there.`;
    } catch (error) {
      console.error("Update forwarding number error:", error);
      return `Error updating forwarding number: ${error.message}`;
    }
  },
  {
    name: "update_forwarding_number",
    description: "Update the user's forwarding number where calls/messages are forwarded to. Use when user says: 'change my forwarding number', 'forward to this number', 'set forwarding to', 'change where my calls go'",
    schema: z.object({
      userId: z.string().describe("User ID"),
      newForwardingNumber: z.string().describe("The new phone number to forward calls/messages to"),
    }),
  }
);

// Tool: Create Support Ticket
import SupportTicket from "../models/SupportTicket.js";

const createSupportTicketTool = tool(
  async ({ userId, subject, category, message }) => {
    try {
      console.log("Creating support ticket:", { userId, subject, category, message });
      
      const user = await User.findById(userId);
      if (!user) {
        return "User not found.";
      }
      
      const now = new Date();
      const timestamp = now.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
      
      const ticket = await SupportTicket.create({
        userId: user._id,
        userName: user.name,
        userEmail: user.email,
        subject: subject || category,
        category: category || "general",
        message,
        status: "open",
        priority: "medium",
        replies: [
          {
            message,
            isSupport: false,
            timestamp,
            authorName: user.name,
          },
        ],
      });
      
      return `Support ticket created! Ticket ID: ${ticket._id}. Our team will review it shortly. You can check the status in the Support section.`;
    } catch (error) {
      console.error("Create support ticket error:", error);
      return `Error creating ticket: ${error.message}`;
    }
  },
  {
    name: "create_support_ticket",
    description: "Create a support ticket for the user. Use when user says: 'raise a ticket', 'support ticket', 'report an issue', 'need help', 'file a complaint', 'contact support'",
    schema: z.object({
      userId: z.string().describe("User ID"),
      subject: z.string().describe("Brief subject/title for the ticket"),
      category: z.string().optional().describe("Category: billing, technical, feature-request, bug, general"),
      message: z.string().describe("Detailed description of the issue or request"),
    }),
  }
);

// Tool: List Support Tickets
const listSupportTicketsTool = tool(
  async ({ userId, status }) => {
    try {
      console.log("Listing support tickets:", { userId, status });
      
      let query = { userId };
      if (status && status !== "all") {
        query.status = status;
      }
      
      const tickets = await SupportTicket.find(query).sort({ createdAt: -1 }).limit(10);
      
      if (tickets.length === 0) {
        return "You don't have any support tickets yet.";
      }
      
      const ticketList = tickets.map((t, i) => {
        const date = new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const statusIcon = t.status === "resolved" ? "[RESOLVED]" : t.status === "in-progress" ? "[IN PROGRESS]" : "[OPEN]";
        return `${i + 1}. ${statusIcon} ${t.subject} (${date}) - ${t.message.substring(0, 50)}${t.message.length > 50 ? '...' : ''}`;
      });
      
      return `Your support tickets:\n${ticketList.join("\n")}`;
    } catch (error) {
      console.error("List support tickets error:", error);
      return `Error listing tickets: ${error.message}`;
    }
  },
  {
    name: "list_support_tickets",
    description: "List user's support tickets. Use when user says: 'show my tickets', 'my support tickets', 'ticket status', 'check my tickets'",
    schema: z.object({
      userId: z.string().describe("User ID"),
      status: z.string().optional().describe("Filter by status: open, in-progress, resolved, or all"),
    }),
  }
);

// Tool: Set Call Filter (which calls ring user's phone)
const setCallFilterTool = tool(
  async ({ userId, mode, tags }) => {
    try {
      console.log("Setting call filter:", { userId, mode, tags });
      
      const user = await User.findById(userId);
      if (!user) return "User not found.";
      
      // Delete any existing forward rules for calls
      await Rule.deleteMany({ 
        userId, 
        type: "forward",
        active: true
      });
      
      if (mode === "none") {
        // No forwarding - all calls go to AI
        return "Call forwarding disabled. All incoming calls will be handled by AI.";
      }
      
      // Get forwarding number
      const forwardingNumber = user.forwardingNumber;
      if (!forwardingNumber) {
        return "You need to set a forwarding number first in Settings. Currently all calls will be handled by AI.";
      }
      
      // Create forward rule with the appropriate mode
      let ruleDescription;
      let conditions = { mode };
      
      switch (mode) {
        case "all":
          ruleDescription = "Forward all calls to my phone";
          break;
        case "favorites":
          ruleDescription = "Forward calls from favorites only";
          break;
        case "saved":
        case "contacts":
          conditions.mode = "saved";
          ruleDescription = "Forward calls from saved contacts only";
          break;
        case "tags":
          if (!tags || tags.length === 0) {
            return "Please specify which tags. Example: 'only ring for family and work tags'";
          }
          conditions.tags = tags;
          ruleDescription = `Forward calls from contacts tagged: ${tags.join(", ")}`;
          break;
        default:
          return "Unknown mode. Use: all, favorites, contacts, or tags";
      }
      
      await Rule.create({
        userId,
        type: "forward",
        rule: ruleDescription,
        active: true,
        conditions,
        transferDetails: {
          mode: "calls",
          contactPhone: forwardingNumber
        }
      });
      
      let response = `${ruleDescription}\n`;
      if (mode === "saved" || mode === "contacts") {
        response += "\nUnknown numbers will NOT ring your phone - AI will handle them.";
      } else if (mode === "favorites") {
        response += "\nOnly favorites will ring your phone. Others go to AI.";
      } else if (mode === "tags") {
        response += `\nOnly contacts with tags [${tags.join(", ")}] will ring. Others go to AI.`;
      }
      
      return response;
    } catch (error) {
      console.error("Set call filter error:", error);
      return `Error: ${error.message}`;
    }
  },
  {
    name: "set_call_filter",
    description: "Set which incoming calls should ring user's phone vs be handled by AI. Use when user says: 'only saved contacts can call', 'block unknown callers', 'only favorites can ring', 'let everyone call', 'only family tag can call'. Mode: all=all calls ring, favorites=only favorites, saved/contacts=only saved contacts, tags=specific tags, none=all go to AI",
    schema: z.object({
      userId: z.string().describe("User ID"),
      mode: z.enum(["all", "favorites", "saved", "contacts", "tags", "none"]).describe("Who can ring: all, favorites, saved/contacts, tags, or none"),
      tags: z.array(z.string()).optional().describe("If mode=tags, which tags (e.g. ['family', 'work'])"),
    }),
  }
);

// Tool: Cleanup duplicate/old rules
const cleanupRulesTool = tool(
  async ({ userId, ruleType }) => {
    try {
      console.log("Cleaning up rules:", { userId, ruleType });
      
      const query = { userId };
      if (ruleType && ruleType !== "all") {
        query.type = ruleType;
      }
      
      const allRules = await Rule.find(query).sort({ createdAt: -1 });
      
      if (allRules.length === 0) {
        return "No rules found to cleanup.";
      }
      
      // Group rules by unique identifier (type + source contact for transfer rules)
      const seen = new Map();
      const duplicates = [];
      const oldInactive = [];
      
      for (const rule of allRules) {
        // Create a unique key for the rule
        let key = rule.type;
        
        // For transfer rules, include source contact in key to detect duplicates
        if (rule.type === "transfer") {
          const sourcePhone = rule.conditions?.sourceContactPhone;
          const sourceName = rule.conditions?.sourceContactName?.toLowerCase();
          if (sourcePhone) {
            const digits = String(sourcePhone).replace(/\D/g, "").slice(-10);
            key = `transfer:${digits}`;
          } else if (sourceName) {
            key = `transfer:${sourceName}`;
          }
        } else if (rule.type === "forward") {
          // For forward rules, include mode in key
          const mode = rule.conditions?.mode || "all";
          key = `forward:${mode}`;
        } else if (rule.type === "block") {
          const sourcePhone = rule.transferDetails?.sourcePhone;
          if (sourcePhone) {
            const digits = String(sourcePhone).replace(/\D/g, "").slice(-10);
            key = `block:${digits}`;
          }
        }
        
        // Mark as duplicate if we've seen this key before (keep newest = first in sorted list)
        if (seen.has(key)) {
          duplicates.push(rule._id);
          console.log(`Duplicate found: ${rule.rule} (key: ${key})`);
        } else {
          seen.set(key, rule);
        }
        
        // Mark old inactive rules for deletion
        if (!rule.active) {
          oldInactive.push(rule._id);
        }
      }
      
      // Delete duplicates and old inactive rules
      const toDelete = [...new Set([...duplicates, ...oldInactive])];
      
      if (toDelete.length === 0) {
        // List current rules
        let result = "No duplicates found. Your current rules:\n";
        for (const rule of allRules) {
          result += `- [${rule.type}] ${rule.rule} (${rule.active ? 'active' : 'inactive'})\n`;
        }
        return result;
      }
      
      await Rule.deleteMany({ _id: { $in: toDelete } });
      
      const remaining = await Rule.find({ userId, active: true });
      let result = `Cleaned up ${toDelete.length} duplicate/inactive rules.\n\nYour current active rules:\n`;
      for (const rule of remaining) {
        result += `- [${rule.type}] ${rule.rule}\n`;
      }
      
      if (remaining.length === 0) {
        result += "(No active rules)";
      }
      
      return result;
    } catch (error) {
      console.error("Cleanup rules error:", error);
      return `Error: ${error.message}`;
    }
  },
  {
    name: "cleanup_rules",
    description: "Remove duplicate and inactive rules. Use when: 'clean up my rules', 'remove old rules', 'why do I have duplicate rules', 'clear old rules'",
    schema: z.object({
      userId: z.string().describe("User ID"),
      ruleType: z.enum(["all", "block", "forward", "transfer", "auto-reply", "priority", "custom"]).optional().describe("Type of rules to cleanup, or 'all'"),
    }),
  }
);

// Tool: Set Routing Preferences (comprehensive call + message routing)
// This handles complex requests like "no calls and messages from 6pm-8pm", "only important messages, contacts only for calls"
// Tool: Set Routing Preferences (Personal Routing)
// Matches UI: Calls (all/favorites/saved/tags), Messages (all/important/urgent/none)
const setRoutingPreferencesTool = tool(
  async ({ userId, callsMode, callTags, messagesMode, schedule, isDefault }) => {
    try {
      console.log("Setting routing preferences:", { userId, callsMode, messagesMode, schedule, isDefault });
      
      const user = await User.findById(userId);
      if (!user) return "User not found.";
      
      const forwardingNumber = user.forwardingNumber;
      
      // Parse time if schedule provided
      let scheduleObj = null;
      let scheduleInfo = "";
      
      if (schedule && schedule.startTime && schedule.endTime) {
        const parseTime = (timeStr) => {
          if (!timeStr) return null;
          const str = timeStr.toLowerCase().trim();
          const pmMatch = str.match(/^(\d{1,2})(?::(\d{2}))?\s*(pm|am)?$/i);
          if (pmMatch) {
            let hours = parseInt(pmMatch[1]);
            const mins = pmMatch[2] ? parseInt(pmMatch[2]) : 0;
            const period = pmMatch[3]?.toLowerCase();
            if (period === 'pm' && hours < 12) hours += 12;
            if (period === 'am' && hours === 12) hours = 0;
            return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
          }
          const militaryMatch = str.match(/^(\d{1,2}):(\d{2})$/);
          if (militaryMatch) {
            return `${militaryMatch[1].padStart(2, '0')}:${militaryMatch[2]}`;
          }
          return null;
        };
        
        const startParsed = parseTime(schedule.startTime);
        const endParsed = parseTime(schedule.endTime);
        
        if (startParsed && endParsed) {
          scheduleObj = {
            start: startParsed,
            end: endParsed,
            days: schedule.days || ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
          };
          scheduleInfo = ` from ${schedule.startTime} to ${schedule.endTime}`;
        }
      }
      
      // If this is a scheduled rule (not default), keep existing default rules
      // If this is default, delete existing rules first
      if (isDefault) {
        await Rule.deleteMany({ 
          userId, 
          type: { $in: ["forward", "message-notify"] },
          "conditions.schedule": { $exists: false }
        });
      }
      
      // If scheduled, only delete conflicting scheduled rules
      if (scheduleObj) {
        await Rule.deleteMany({
          userId,
          type: { $in: ["forward", "message-notify"] },
          "conditions.schedule.start": scheduleObj.start,
          "conditions.schedule.end": scheduleObj.end
        });
      }
      
      let response = scheduleObj 
        ? `Routing set${scheduleInfo}:\n\n`
        : `Default routing set:\n\n`;
      
      // === CALL ROUTING ===
      if (callsMode) {
        let callRuleDesc;
        let callConditions = { mode: callsMode };
        
        switch (callsMode) {
          case "all":
            callRuleDesc = "All calls ring your phone";
            break;
          case "favorites":
            callRuleDesc = "Favorites only ring your phone";
            break;
          case "saved":
            callRuleDesc = "Saved contacts only ring your phone";
            break;
          case "tags":
            if (callTags && callTags.length > 0) {
              callConditions.tags = callTags;
              callRuleDesc = `Only ${callTags.join(", ")} contacts ring your phone`;
            } else {
              callRuleDesc = "Saved contacts only ring your phone";
              callConditions.mode = "saved";
            }
            break;
          case "none":
            callRuleDesc = "All calls go to AI (phone won't ring)";
            break;
        }
        
        if (callsMode !== "none" && forwardingNumber) {
          await Rule.create({
            userId,
            type: "forward",
            rule: callRuleDesc + (scheduleObj ? scheduleInfo : " (default)"),
            active: true,
            conditions: scheduleObj ? { ...callConditions, schedule: scheduleObj } : callConditions,
            transferDetails: { mode: "calls", contactPhone: forwardingNumber }
          });
        } else if (callsMode === "none") {
          // Create a "block all calls" rule
          await Rule.create({
            userId,
            type: "forward",
            rule: callRuleDesc + (scheduleObj ? scheduleInfo : " (default)"),
            active: true,
            conditions: scheduleObj ? { mode: "none", schedule: scheduleObj } : { mode: "none" },
            transferDetails: { mode: "calls" }
          });
        }
        
        response += `Calls: ${callRuleDesc}\n`;
      }
      
      // === MESSAGE ROUTING ===
      if (messagesMode) {
        let msgRuleDesc;
        
        switch (messagesMode) {
          case "all":
            msgRuleDesc = "All messages notify you";
            break;
          case "important":
            msgRuleDesc = "Important messages only (high + medium priority)";
            break;
          case "urgent":
            msgRuleDesc = "Urgent messages only (critical priority)";
            break;
          case "none":
            msgRuleDesc = "No message notifications";
            break;
        }
        
        await Rule.create({
          userId,
          type: "message-notify",
          rule: msgRuleDesc + (scheduleObj ? scheduleInfo : " (default)"),
          active: true,
          conditions: scheduleObj 
            ? { priorityFilter: messagesMode, schedule: scheduleObj }
            : { priorityFilter: messagesMode },
          transferDetails: { mode: "messages" }
        });
        
        response += `Messages: ${msgRuleDesc}\n`;
      }
      
      if (scheduleObj) {
        response += `\nThis applies${scheduleInfo}. Outside this time, your default routing applies.`;
      }
      
      return response;
    } catch (error) {
      console.error("Set routing preferences error:", error);
      return `Error: ${error.message}`;
    }
  },
  {
    name: "set_routing_preferences",
    description: `Set personal routing preferences. MUST match UI options:

CALLS (who rings your phone):
- "all" = Every incoming call
- "favorites" = Contacts marked as favorite only
- "saved" = Anyone in your contacts
- "tags" = Filter by contact tags (requires callTags array)
- "none" = All calls go to AI, phone doesn't ring

MESSAGES (what notifies you):
- "all" = Every incoming message
- "important" = High + medium priority only (no spam)
- "urgent" = Critical messages only (no spam)
- "none" = No notifications

SCHEDULE (optional time window):
- For time-based rules like "from 8pm to 9pm"
- Set schedule.startTime and schedule.endTime

EXAMPLES:
- "all calls, important messages only" -> callsMode="all", messagesMode="important"
- "favorites for calls, urgent only for messages" -> callsMode="favorites", messagesMode="urgent"
- "from 8pm-9pm block calls, no message notifications" -> callsMode="none", messagesMode="none", schedule={startTime:"8pm", endTime:"9pm"}

IMPORTANT: If user says DND or routing request WITHOUT specifying calls/messages, ASK:
"Do you want this for calls, messages, or both? And what settings for each?"`,
    schema: z.object({
      userId: z.string().describe("User ID"),
      callsMode: z.enum(["all", "favorites", "saved", "tags", "none"]).optional()
        .describe("Who can ring phone: all, favorites, saved, tags, none"),
      callTags: z.array(z.string()).optional()
        .describe("If callsMode=tags, which tags (e.g. ['family', 'work'])"),
      messagesMode: z.enum(["all", "important", "urgent", "none"]).optional()
        .describe("Which messages notify: all, important, urgent, none"),
      schedule: z.object({
        startTime: z.string().describe("Start time like '8pm', '20:00'"),
        endTime: z.string().describe("End time like '9pm', '21:00'"),
        days: z.array(z.string()).optional().describe("Days of week")
      }).optional().describe("Time window for this rule"),
      isDefault: z.boolean().optional().describe("True if setting default routing (no schedule)")
    }),
  }
);

// Tool: Set Do Not Disturb - ASK for clarification
const setDNDTool = tool(
  async ({ userId, enabled, startTime, endTime }) => {
    try {
      console.log("DND request:", { userId, enabled, startTime, endTime });
      
      if (!enabled) {
        // Turn off DND - delete DND-related rules
        await Rule.deleteMany({ 
          userId, 
          rule: { $regex: /dnd|do not disturb/i }
        });
        return "Do Not Disturb is OFF. Your default routing is now active.";
      }
      
      // DND requested - we need to ask what they want
      const timeInfo = startTime && endTime ? ` from ${startTime} to ${endTime}` : "";
      
      return `CLARIFICATION_NEEDED: Setting up Do Not Disturb${timeInfo}. Please tell me:

   **Calls**: What should happen to calls?
   - All calls ring your phone
   - Only favorites
   - Only saved contacts  
   - All calls go to AI (no ringing)

   **Messages**: What should notify you?
   - All messages
   - Important only (no spam)
   - Urgent only (critical)
   - No notifications

For example: "no calls, urgent messages only" or "favorites can call, no message notifications"`;
    } catch (error) {
      console.error("Set DND error:", error);
      return `Error: ${error.message}`;
    }
  },
  {
    name: "set_dnd",
    description: `Handle Do Not Disturb requests. ALWAYS asks for clarification about what user wants.

When user says "dnd" or "do not disturb":
1. If they specify a time (e.g., "dnd from 8pm to 9pm"), capture it
2. ALWAYS ask what they want for calls AND messages
3. After they clarify, use set_routing_preferences to create the actual rules

This tool ONLY asks the clarifying question. The actual rule creation happens via set_routing_preferences.`,
    schema: z.object({
      userId: z.string().describe("User ID"),
      enabled: z.boolean().describe("true to enable DND, false to disable"),
      startTime: z.string().optional().describe("Start time if specified (e.g. '8pm')"),
      endTime: z.string().optional().describe("End time if specified (e.g. '9pm')"),
    }),
  }
);

// ==================== AI CALL TOOLS ====================

// Tool: Make an autonomous AI call
const makeAICallTool = tool(
  async ({ userId, contactName, contactPhone, objective, scriptPoints, scheduledAt, voiceStyle }) => {
    try {
      console.log("Creating AI call:", { userId, contactName, contactPhone, objective });
      
      // Get user's timezone
      const user = await User.findById(userId);
      const timezone = user?.timezone || "America/New_York";
      
      // Resolve contact phone if only name provided
      let phone = contactPhone;
      let name = contactName;
      
      if (!phone && contactName) {
        const contact = await Contact.findOne({
          userId,
          $or: [
            { name: { $regex: new RegExp(contactName, "i") } },
            { customName: { $regex: new RegExp(contactName, "i") } },
          ]
        });
        if (contact) {
          phone = contact.phoneNumber;
          name = contact.customName || contact.name;
        }
      }
      
      if (!phone) {
        return `Could not find a phone number for ${contactName || "the contact"}. Please provide a phone number.`;
      }
      
      // Normalize phone
      phone = normalizePhoneForSms(phone);
      
      // Parse scheduled time if provided
      let scheduleDate = null;
      if (scheduledAt) {
        scheduleDate = parseNaturalTime(scheduledAt, new Date());
        if (scheduleDate <= new Date()) {
          scheduleDate = null; // If in past, make immediate
        }
      }
      
      // Create the AI call record
      const aiCall = await AICall.create({
        userId,
        contactPhone: phone,
        contactName: name || "Unknown",
        objective,
        scriptPoints: scriptPoints || [],
        scheduledAt: scheduleDate,
        voiceStyle: voiceStyle || "friendly",
        status: "pending"
      });
      
      // If no scheduled time, initiate immediately
      if (!scheduleDate) {
        try {
          await startAICall(aiCall._id);
          return `AI call initiated to ${name || phone}. Objective: "${objective}". I'll summarize the conversation for you when it's done.`;
        } catch (callError) {
          aiCall.status = "failed";
          aiCall.errorMessage = callError.message;
          await aiCall.save();
          return `Failed to initiate AI call: ${callError.message}`;
        }
      } else {
        const formattedTime = formatInTimezone(scheduleDate, timezone);
        return `AI call scheduled to ${name || phone} for ${formattedTime}. Objective: "${objective}". I'll make the call then and report back.`;
      }
    } catch (error) {
      console.error("Make AI call error:", error);
      return `Error creating AI call: ${error.message}`;
    }
  },
  {
    name: "make_ai_call",
    description: "Make an autonomous AI call where the AI has a conversation on behalf of the user. Use when user says: 'have AI call X', 'AI call X and ask about Y', 'call X and check on them', 'AI should call X'. The AI will make the call, follow the objective/script, and report back with a summary.",
    schema: z.object({
      userId: z.string().describe("User ID"),
      contactName: z.string().optional().describe("Contact name to call"),
      contactPhone: z.string().optional().describe("Phone number to call (if no contact name)"),
      objective: z.string().describe("What the AI should accomplish on the call. E.g. 'Check in and ask how his day is going'"),
      scriptPoints: z.array(z.string()).optional().describe("Specific points the AI should cover in order"),
      scheduledAt: z.string().optional().describe("When to make the call. E.g. 'in 1 hour', 'tomorrow at 3pm', 'now'"),
      voiceStyle: z.enum(["friendly", "professional", "casual", "formal"]).optional().describe("How the AI should sound"),
    }),
  }
);

// Tool: List AI calls
const listAICallsTool = tool(
  async ({ userId, status }) => {
    try {
      const user = await User.findById(userId);
      const timezone = user?.timezone || "America/New_York";
      
      const query = { userId };
      if (status) query.status = status;
      
      const aiCalls = await AICall.find(query)
        .sort({ createdAt: -1 })
        .limit(10);
      
      if (aiCalls.length === 0) {
        return status 
          ? `No ${status} AI calls found.`
          : "You don't have any AI calls yet. Would you like me to make one?";
      }
      
      const callList = aiCalls.map(c => {
        let info = `• ${c.contactName || c.contactPhone} - ${c.status}`;
        if (c.scheduledAt) {
          info += ` (scheduled for ${formatInTimezone(c.scheduledAt, timezone)})`;
        }
        if (c.objective) {
          info += `\n  Objective: "${c.objective.substring(0, 50)}${c.objective.length > 50 ? '...' : ''}"`;
        }
        if (c.summary && c.status === "completed") {
          info += `\n  Summary: "${c.summary.substring(0, 100)}${c.summary.length > 100 ? '...' : ''}"`;
        }
        return info;
      }).join("\n\n");
      
      return `Your AI calls:\n\n${callList}`;
    } catch (error) {
      return `Error listing AI calls: ${error.message}`;
    }
  },
  {
    name: "list_ai_calls",
    description: "List the user's AI calls. Shows status, objectives, and summaries.",
    schema: z.object({
      userId: z.string().describe("User ID"),
      status: z.enum(["pending", "in-progress", "completed", "failed", "cancelled", "no-answer"]).optional()
        .describe("Filter by status"),
    }),
  }
);

// Tool: Cancel an AI call
const cancelAICallTool = tool(
  async ({ userId, contactName, contactPhone }) => {
    try {
      const query = { userId, status: "pending" };
      
      if (contactName) {
        query.contactName = { $regex: new RegExp(contactName, "i") };
      } else if (contactPhone) {
        query.contactPhone = normalizePhoneForSms(contactPhone);
      } else {
        // Cancel the most recent pending call
        const recentCall = await AICall.findOne(query).sort({ createdAt: -1 });
        if (!recentCall) {
          return "No pending AI calls to cancel.";
        }
        recentCall.status = "cancelled";
        await recentCall.save();
        return `Cancelled AI call to ${recentCall.contactName || recentCall.contactPhone}.`;
      }
      
      const aiCall = await AICall.findOne(query);
      if (!aiCall) {
        return `No pending AI call found for ${contactName || contactPhone}.`;
      }
      
      aiCall.status = "cancelled";
      await aiCall.save();
      
      return `Cancelled AI call to ${aiCall.contactName || aiCall.contactPhone}.`;
    } catch (error) {
      return `Error cancelling AI call: ${error.message}`;
    }
  },
  {
    name: "cancel_ai_call",
    description: "Cancel a pending AI call. Can specify contact name or phone, or cancels the most recent pending call.",
    schema: z.object({
      userId: z.string().describe("User ID"),
      contactName: z.string().optional().describe("Contact name of the call to cancel"),
      contactPhone: z.string().optional().describe("Phone number of the call to cancel"),
    }),
  }
);

// Tool: Get AI call result/summary
const getAICallResultTool = tool(
  async ({ userId, contactName, contactPhone }) => {
    try {
      const user = await User.findById(userId);
      const timezone = user?.timezone || "America/New_York";
      
      const query = { userId, status: "completed" };
      
      if (contactName) {
        query.contactName = { $regex: new RegExp(contactName, "i") };
      } else if (contactPhone) {
        query.contactPhone = normalizePhoneForSms(contactPhone);
      }
      
      const aiCall = await AICall.findOne(query).sort({ completedAt: -1 });
      
      if (!aiCall) {
        return `No completed AI call found${contactName ? ` for ${contactName}` : contactPhone ? ` for ${contactPhone}` : ""}.`;
      }
      
      let result = `AI Call to ${aiCall.contactName || aiCall.contactPhone}\n`;
      result += `Completed: ${formatInTimezone(aiCall.completedAt, timezone)}\n`;
      result += `Objective: ${aiCall.objective}\n\n`;
      
      if (aiCall.summary) {
        result += `Summary: ${aiCall.summary}\n\n`;
      }
      
      if (aiCall.keyPoints && aiCall.keyPoints.length > 0) {
        result += `Key Points:\n${aiCall.keyPoints.map(p => `• ${p}`).join("\n")}\n\n`;
      }
      
      if (aiCall.actionItems && aiCall.actionItems.length > 0) {
        result += `Action Items:\n${aiCall.actionItems.map(a => `• ${a}`).join("\n")}\n\n`;
      }
      
      if (aiCall.transcript && aiCall.transcript.length > 0) {
        result += `Transcript:\n`;
        result += aiCall.transcript.map(t => 
          `${t.speaker === "ai" ? "AI" : aiCall.contactName || "Them"}: ${t.text}`
        ).join("\n");
      }
      
      return result;
    } catch (error) {
      return `Error getting AI call result: ${error.message}`;
    }
  },
  {
    name: "get_ai_call_result",
    description: "Get the summary and details of a completed AI call. Use when user asks: 'what did they say', 'how did the call go', 'what was the result of the call'",
    schema: z.object({
      userId: z.string().describe("User ID"),
      contactName: z.string().optional().describe("Contact name to get result for"),
      contactPhone: z.string().optional().describe("Phone number to get result for"),
    }),
  }
);

// ==================== TRANSLATION & FILTERING TOOLS ====================

// Tool: Translate text
const translateTextTool = tool(
  async ({ text, targetLang, sourceLang }) => {
    try {
      const sl = sourceLang || 'auto';
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Translation request failed');
      
      const data = await response.json();
      if (data && data[0] && Array.isArray(data[0])) {
        const translated = data[0].map(item => item?.[0]).filter(Boolean).join('');
        if (translated) {
          const detectedLang = data[2] || sl;
          return `Translation (${detectedLang} → ${targetLang}):\n"${translated}"`;
        }
      }
      return `Could not translate the text. Please try again.`;
    } catch (error) {
      return `Translation error: ${error.message}`;
    }
  },
  {
    name: "translate_text",
    description: "Translate text to another language. Use when user says: 'translate X to Spanish', 'what does X mean in English', 'say X in Italian'. Supported languages: en, es, fr, de, it, pt, zh, ja, ko, ar, ru, etc.",
    schema: z.object({
      text: z.string().describe("Text to translate"),
      targetLang: z.string().describe("Target language code (en, es, fr, de, it, pt, zh, ja, ko, ar, ru, etc.)"),
      sourceLang: z.string().optional().describe("Source language code (default: auto-detect)"),
    }),
  }
);

// Tool: Classify message (spam/priority/normal)
const classifyMessageTool = tool(
  async ({ userId, messageText, senderInfo }) => {
    try {
      // Use AI to classify the message
      const classificationPrompt = `Classify this message into one of these categories:
- SPAM: Unsolicited marketing, scams, car warranty offers, prize winnings, phishing attempts
- PRIORITY: Urgent/time-sensitive, from family/friends asking for help, important appointments, emergencies
- DELIVERY: Package/shipping notifications from FedEx, UPS, Amazon, etc.
- FINANCIAL: Account alerts, payment confirmations, fraud alerts
- NORMAL: Regular conversation, neither spam nor urgent

Message from ${senderInfo || 'unknown'}: "${messageText}"

Respond with JSON: {"category": "SPAM|PRIORITY|DELIVERY|FINANCIAL|NORMAL", "confidence": 0-100, "reason": "brief explanation", "suggestedAction": "block|notify|allow|forward"}`;

      const response = await llm.invoke([
        new SystemMessage("You are a message classifier. Analyze messages for spam, priority, and category. Respond only with valid JSON."),
        new HumanMessage(classificationPrompt)
      ]);
      
      // Parse the response
      const content = response.content.trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        let actionSuggestion = '';
        
        switch(result.category) {
          case 'SPAM':
            actionSuggestion = `\n\nSuggested: "Block messages like this" or "Create a spam filter rule"`;
            break;
          case 'PRIORITY':
            actionSuggestion = `\n\nSuggested: Mark sender as priority with "Mark ${senderInfo || 'them'} as priority"`;
            break;
          case 'DELIVERY':
            actionSuggestion = `\n\nSuggested: "Allow delivery notifications" or "Forward delivery updates to my email"`;
            break;
          case 'FINANCIAL':
            actionSuggestion = `\n\nSuggested: "Forward account alerts to my accountant" or "Mark as priority"`;
            break;
        }
        
        return `Message Classification:
• Category: ${result.category}
• Confidence: ${result.confidence}%
• Reason: ${result.reason}
• Suggested Action: ${result.suggestedAction}${actionSuggestion}`;
      }
      
      return "Could not classify the message. The format appears to be standard text.";
    } catch (error) {
      return `Classification error: ${error.message}`;
    }
  },
  {
    name: "classify_message",
    description: "Classify a message as spam, priority, delivery notification, financial alert, or normal. Use when user asks: 'is this spam?', 'should I respond to this?', 'what kind of message is this?', 'filter this message'",
    schema: z.object({
      userId: z.string().describe("User ID"),
      messageText: z.string().describe("The message text to classify"),
      senderInfo: z.string().optional().describe("Info about the sender (name, number, or 'unknown')"),
    }),
  }
);

// Tool: Create spam filter rule
const createSpamFilterTool = tool(
  async ({ userId, filterType, keywords }) => {
    try {
      let ruleDescription = "";
      let ruleConditions = {};
      
      switch(filterType) {
        case "car_warranty":
          ruleDescription = "Block car warranty spam messages";
          ruleConditions = { keyword: "car warranty,vehicle warranty,auto warranty,extended warranty" };
          break;
        case "prize_scam":
          ruleDescription = "Block prize/lottery scam messages";
          ruleConditions = { keyword: "you've won,winner,lottery,prize,congratulations winner,claim your" };
          break;
        case "unknown_numbers":
          ruleDescription = "Block messages from unknown numbers";
          ruleConditions = { fromUnknown: true };
          break;
        case "custom":
          if (!keywords || keywords.length === 0) {
            return "Please specify keywords to filter. Example: 'block messages containing warranty, prize, winner'";
          }
          ruleDescription = `Block messages containing: ${keywords.join(', ')}`;
          ruleConditions = { keyword: keywords.join(',') };
          break;
        default:
          return "Unknown filter type. Try: 'block car warranty spam', 'block prize scams', or 'block unknown numbers'";
      }
      
      await Rule.create({
        userId,
        rule: ruleDescription,
        type: "block",
        active: true,
        conditions: {
          ...ruleConditions,
          priority: "all"
        }
      });
      
      return `Spam filter created: "${ruleDescription}"\n\nMessages matching this rule will be automatically blocked.`;
    } catch (error) {
      return `Error creating spam filter: ${error.message}`;
    }
  },
  {
    name: "create_spam_filter",
    description: "Create a rule to automatically block spam messages. Use when user says: 'block spam', 'filter out car warranty messages', 'stop prize scam texts', 'block unknown numbers'",
    schema: z.object({
      userId: z.string().describe("User ID"),
      filterType: z.enum(["car_warranty", "prize_scam", "unknown_numbers", "custom"]).describe("Type of spam to filter"),
      keywords: z.array(z.string()).optional().describe("Custom keywords to block (for custom filter type)"),
    }),
  }
);

// Tool: Get message triage/overview
const getMessageTriageTool = tool(
  async ({ userId }) => {
    try {
      // Get recent messages
      const messages = await Message.find({ 
        userId, 
        direction: 'incoming',
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      }).sort({ createdAt: -1 }).limit(20);
      
      if (messages.length === 0) {
        return "No incoming messages in the last 24 hours. You're all clear.";
      }
      
      // Classify each message using AI
      const triagePrompt = `Triage these messages into categories. For each, determine:
1. Category: SPAM, PRIORITY, DELIVERY, FINANCIAL, or NORMAL
2. Should block: yes/no

Messages:
${messages.map((m, i) => `${i+1}. From ${m.contactName || m.contactPhone}: "${m.body.substring(0, 100)}"`).join('\n')}

Respond with JSON array: [{"index": 1, "category": "...", "shouldBlock": true/false}, ...]`;

      const response = await llm.invoke([
        new SystemMessage("You are a message triage assistant. Classify messages for priority and spam detection. Return only valid JSON array."),
        new HumanMessage(triagePrompt)
      ]);
      
      const content = response.content.trim();
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      
      let spam = [], priority = [], delivery = [], financial = [], normal = [];
      
      if (jsonMatch) {
        const results = JSON.parse(jsonMatch[0]);
        results.forEach((r, i) => {
          const msg = messages[i];
          if (!msg) return;
          const item = `• ${msg.contactName || msg.contactPhone}: "${msg.body.substring(0, 50)}${msg.body.length > 50 ? '...' : ''}"`;
          switch(r.category) {
            case 'SPAM': spam.push(item); break;
            case 'PRIORITY': priority.push(item); break;
            case 'DELIVERY': delivery.push(item); break;
            case 'FINANCIAL': financial.push(item); break;
            default: normal.push(item);
          }
        });
      }
      
      let result = `Message Triage (last 24 hours):\n`;
      
      if (priority.length > 0) {
        result += `\nPRIORITY (${priority.length}):\n${priority.join('\n')}\n`;
      }
      if (delivery.length > 0) {
        result += `\nDELIVERY (${delivery.length}):\n${delivery.join('\n')}\n`;
      }
      if (financial.length > 0) {
        result += `\nFINANCIAL (${financial.length}):\n${financial.join('\n')}\n`;
      }
      if (spam.length > 0) {
        result += `\nSPAM (${spam.length}):\n${spam.join('\n')}\n`;
        result += `\nTip: Say "block spam" to auto-filter these\n`;
      }
      if (normal.length > 0) {
        result += `\nNORMAL (${normal.length}):\n${normal.join('\n')}\n`;
      }
      
      const totalBlocked = spam.length;
      const totalPriority = priority.length;
      result += `\nSummary: ${totalPriority} priority, ${totalBlocked} potential spam, ${messages.length - totalBlocked - totalPriority} normal`;
      
      return result;
    } catch (error) {
      return `Error triaging messages: ${error.message}`;
    }
  },
  {
    name: "get_message_triage",
    description: "Get an intelligent triage/overview of recent messages, categorized by priority, spam, deliveries, and financial alerts. Use when user says: 'triage my messages', 'what's important', 'filter my inbox', 'show me what I should read', 'any spam?'",
    schema: z.object({
      userId: z.string().describe("User ID"),
    }),
  }
);

// Tool: Confirm action
const confirmActionTool = tool(
  async ({ userId, action, confirmed, actionData }) => {
    try {
      if (!confirmed) {
        return "Action cancelled.";
      }
      
      // Handle confirmed actions
      if (action === "call") {
        // Get user's phone number
        const user = await User.findById(userId);
        if (!user?.phoneNumber) return "No phone configured.";
        
        // This would integrate with Twilio to make the call
        // For now, return success message - frontend handles actual call
        return JSON.stringify({
          action: "execute_call",
          ...JSON.parse(actionData)
        });
      }
      
      if (action === "send_message") {
        // Send actual message
        return JSON.stringify({
          action: "execute_message",
          ...JSON.parse(actionData)
        });
      }
      
      return "Unknown action type.";
    } catch (error) {
      return `Error: ${error.message}`;
    }
  },
  {
    name: "confirm_action",
    description: "Confirm and execute a pending action (call or message)",
    schema: z.object({
      userId: z.string().describe("User ID"),
      action: z.enum(["call", "send_message"]).describe("Action type"),
      confirmed: z.boolean().describe("Whether user confirmed"),
      actionData: z.string().optional().describe("JSON data for action"),
    }),
  }
);

// ==================== NEW ADVANCED TOOLS ====================

// Tool: Create Reminder (with actual call/SMS notification)
const createReminderTool = tool(
  async ({ userId, title, when, contactName, contactPhone, type, description }) => {
    try {
      console.log("Creating reminder:", { userId, title, when, type, contactName });
      
      // Parse the time
      const scheduledAt = parseNaturalTime(when);
      if (!scheduledAt) {
        return `Could not understand the time "${when}". Try "in 30 seconds", "in 5 minutes", "tomorrow at 3pm", or "Monday 9am".`;
      }
      
      // Resolve contact if provided
      let resolvedContact = null;
      let resolvedPhone = contactPhone;
      let resolvedName = contactName;
      
      if (contactName && !contactPhone) {
        resolvedContact = await resolveContactWithAI(userId, contactName);
        if (resolvedContact) {
          resolvedPhone = resolvedContact.phone;
          resolvedName = resolvedContact.name;
        }
      }
      
      // Determine notification method based on type
      const reminderType = type || "message"; // Default to SMS
      
      // Get user's timezone for display
      const user = await User.findById(userId);
      const timezone = user?.timezone || "America/New_York";
      
      const reminder = await Reminder.create({
        userId,
        title,
        description: description || null,
        type: reminderType,
        scheduledAt,
        contactPhone: resolvedPhone || null,
        contactName: resolvedName || null,
      });
      
      console.log("Created reminder:", reminder._id, "scheduledAt:", scheduledAt.toISOString());
      
      // Calculate relative time for display
      const now = new Date();
      const diffMs = scheduledAt.getTime() - now.getTime();
      const diffSec = Math.round(diffMs / 1000);
      const diffMin = Math.round(diffMs / 60000);
      
      let timeStr;
      if (diffSec < 60) {
        timeStr = `in ${diffSec} seconds`;
      } else if (diffMin < 60) {
        timeStr = `in ${diffMin} minute${diffMin > 1 ? 's' : ''}`;
      } else if (diffMin < 1440) { // Less than 24 hours
        const hours = Math.floor(diffMin / 60);
        const mins = diffMin % 60;
        timeStr = `in ${hours} hour${hours > 1 ? 's' : ''}${mins > 0 ? ` ${mins} min` : ''}`;
      } else {
        timeStr = formatInTimezone(scheduledAt, timezone);
      }
      
      const notifyMethod = reminderType === "call" ? "I'll call you" : "I'll text you";
      return `Got it! ${notifyMethod} ${timeStr} to remind you: "${title}"${resolvedName ? ` (regarding ${resolvedName})` : ""}`;
    } catch (error) {
      console.error("Create reminder error:", error);
      return `Error creating reminder: ${error.message}`;
    }
  },
  {
    name: "create_reminder",
    description: "Schedule a reminder that will CALL or TEXT the user at the specified time. Use for: 'call me in 30 seconds', 'text me in 5 min', 'remind me to...', 'don't let me forget'. Use type='call' when user says 'call me', use type='message' when user says 'text me' or just 'remind me'.",
    schema: z.object({
      userId: z.string().describe("User ID"),
      title: z.string().describe("What to remind about - the message content"),
      when: z.string().describe("When to remind - e.g. 'in 30 seconds', 'in 5 minutes', 'tomorrow 3pm', 'in 1 hour'"),
      contactName: z.string().optional().describe("Related contact name if any"),
      contactPhone: z.string().optional().describe("Related contact phone if any"),
      type: z.enum(["personal", "call", "message"]).optional().describe("'call' = phone call notification, 'message' = SMS notification (default)"),
      description: z.string().optional().describe("Additional details"),
    }),
  }
);

// Tool: Schedule Message to Contact
const scheduleMessageTool = tool(
  async ({ userId, contactName, contactPhone, messageText, when }) => {
    try {
      console.log("Scheduling message:", { userId, contactName, contactPhone, messageText, when });
      
      // Parse the time
      const scheduledAt = parseNaturalTime(when);
      if (!scheduledAt) {
        return `Could not understand the time "${when}". Try "in 30 seconds", "in 5 minutes", "tomorrow at 3pm".`;
      }
      
      // Resolve contact if only name provided
      let resolvedPhone = contactPhone;
      let resolvedName = contactName;
      
      if (contactName && !contactPhone) {
        const resolvedContact = await resolveContactWithAI(userId, contactName);
        if (resolvedContact) {
          resolvedPhone = resolvedContact.phone;
          resolvedName = resolvedContact.name;
        } else {
          return `Could not find contact "${contactName}". Please add them first or provide their phone number.`;
        }
      }
      
      if (!resolvedPhone) {
        return "Please specify a contact name or phone number to send the message to.";
      }
      
      // Normalize phone number
      const normalizedPhone = normalizePhoneForSms(resolvedPhone);
      
      // Create the scheduled message
      const scheduled = await ScheduledMessage.create({
        userId,
        contactPhone: normalizedPhone,
        contactName: resolvedName || normalizedPhone,
        messageBody: messageText,
        scheduledAt,
        status: 'pending'
      });
      
      // Calculate relative time for display
      const now = new Date();
      const diffMs = scheduledAt.getTime() - now.getTime();
      const diffSec = Math.round(diffMs / 1000);
      const diffMin = Math.round(diffMs / 60000);
      
      let timeStr;
      if (diffSec < 60) {
        timeStr = `in ${diffSec} seconds`;
      } else if (diffMin < 60) {
        timeStr = `in ${diffMin} minute${diffMin > 1 ? 's' : ''}`;
      } else if (diffMin < 1440) {
        const hours = Math.floor(diffMin / 60);
        const mins = diffMin % 60;
        timeStr = `in ${hours} hour${hours > 1 ? 's' : ''}${mins > 0 ? ` ${mins} min` : ''}`;
      } else {
        timeStr = scheduledAt.toLocaleString("en-US", { 
          weekday: "short", month: "short", day: "numeric", 
          hour: "numeric", minute: "2-digit"
        });
      }
      
      return `Scheduled! I'll send "${messageText}" to ${resolvedName || normalizedPhone} ${timeStr}.`;
    } catch (error) {
      console.error("Schedule message error:", error);
      return `Error scheduling message: ${error.message}`;
    }
  },
  {
    name: "schedule_message",
    description: "Schedule a message to be sent to a contact at a future time. Use for: 'send hi to John in 30 seconds', 'text mom happy birthday tomorrow at 8am', 'message Sarah in 5 minutes saying I'm on my way'",
    schema: z.object({
      userId: z.string().describe("User ID"),
      contactName: z.string().optional().describe("Name of contact to message"),
      contactPhone: z.string().optional().describe("Phone number to message (if no contact name)"),
      messageText: z.string().describe("The message content to send"),
      when: z.string().describe("When to send - e.g. 'in 30 seconds', 'in 5 minutes', 'tomorrow 3pm'"),
    }),
  }
);

// Tool: List Scheduled Messages
const listScheduledMessagesTool = tool(
  async ({ userId, filter }) => {
    try {
      let query = { userId };
      
      if (filter === "pending") {
        query.status = 'pending';
        query.scheduledAt = { $gte: new Date() };
      } else if (filter === "sent") {
        query.status = 'sent';
      } else if (filter === "failed") {
        query.status = 'failed';
      }
      
      const messages = await ScheduledMessage.find(query)
        .sort({ scheduledAt: 1 })
        .limit(20);
      
      if (messages.length === 0) {
        return filter === "pending" ? "No scheduled messages pending." : "No scheduled messages found.";
      }
      
      const list = messages.map(m => {
        const time = new Date(m.scheduledAt).toLocaleString("en-US", {
          weekday: "short", month: "short", day: "numeric",
          hour: "numeric", minute: "2-digit"
        });
        const status = m.status === 'sent' ? '[sent]' : m.status === 'failed' ? '[failed]' : '';
        return `- ${time} to ${m.contactName}: "${m.messageBody}" ${status}`;
      }).join("\n");
      
      return `Scheduled messages (${messages.length}):\n${list}`;
    } catch (error) {
      return `Error: ${error.message}`;
    }
  },
  {
    name: "list_scheduled_messages",
    description: "List scheduled messages. Use for: 'show my scheduled messages', 'what messages are queued'",
    schema: z.object({
      userId: z.string().describe("User ID"),
      filter: z.enum(["all", "pending", "sent", "failed"]).optional().describe("Filter messages"),
    }),
  }
);

// Tool: Cancel Scheduled Message
const cancelScheduledMessageTool = tool(
  async ({ userId, contactName }) => {
    try {
      // Find pending scheduled messages to this contact
      const query = { 
        userId, 
        status: 'pending',
        scheduledAt: { $gte: new Date() }
      };
      
      if (contactName) {
        query.contactName = { $regex: new RegExp(contactName, 'i') };
      }
      
      const pending = await ScheduledMessage.find(query).sort({ scheduledAt: 1 });
      
      if (pending.length === 0) {
        return contactName 
          ? `No pending scheduled messages to "${contactName}" found.`
          : "No pending scheduled messages found.";
      }
      
      // Cancel the first matching message (most recent)
      const toCancel = pending[0];
      await ScheduledMessage.findByIdAndUpdate(toCancel._id, { status: 'cancelled' });
      
      return `Cancelled scheduled message to ${toCancel.contactName}: "${toCancel.messageBody}"`;
    } catch (error) {
      return `Error: ${error.message}`;
    }
  },
  {
    name: "cancel_scheduled_message",
    description: "Cancel a pending scheduled message. Use for: 'cancel the message to John', 'don't send that message', 'cancel scheduled messages'",
    schema: z.object({
      userId: z.string().describe("User ID"),
      contactName: z.string().optional().describe("Contact name to filter by"),
    }),
  }
);

// Tool: List Reminders
const listRemindersTool = tool(
  async ({ userId, filter }) => {
    try {
      // Get user's timezone
      const user = await User.findById(userId);
      const timezone = user?.timezone || "America/New_York";
      
      let query = { userId };
      
      if (filter === "upcoming") {
        query.isCompleted = false;
        query.scheduledAt = { $gte: new Date() };
      } else if (filter === "completed") {
        query.isCompleted = true;
      } else if (filter === "today") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        query.scheduledAt = { $gte: today, $lt: tomorrow };
      }
      
      const reminders = await Reminder.find(query).sort({ scheduledAt: 1 }).limit(20);
      
      if (reminders.length === 0) {
        return filter === "upcoming" ? "No upcoming reminders." : "No reminders found.";
      }
      
      const list = reminders.map(r => {
        const time = formatInTimezone(r.scheduledAt, timezone);
        const status = r.isCompleted ? "[done]" : r.notificationSent ? "[sent]" : "";
        return `- ${time}: ${r.title} ${status}`;
      }).join("\n");
      
      return `Reminders (${reminders.length}):\n${list}`;
    } catch (error) {
      return `Error: ${error.message}`;
    }
  },
  {
    name: "list_reminders",
    description: "List reminders. Use for: 'show my reminders', 'what reminders do I have', 'upcoming reminders'",
    schema: z.object({
      userId: z.string().describe("User ID"),
      filter: z.enum(["all", "upcoming", "completed", "today"]).optional().describe("Filter reminders"),
    }),
  }
);

// Tool: Delete/Complete Reminder
const completeReminderTool = tool(
  async ({ userId, reminderTitle, action }) => {
    try {
      // Get all active reminders and use AI to find the best match
      const allReminders = await Reminder.find({
        userId,
        isCompleted: false
      });
      
      if (allReminders.length === 0) {
        return "You have no active reminders.";
      }
      
      // Use AI to find the best matching reminder
      const reminderList = allReminders.map((r, i) => `${i}: ${r.title}`).join('\n');
      const matchResponse = await llm.invoke([
        new SystemMessage(`Find the reminder that best matches the user's input. Return ONLY the index number (0, 1, 2, etc). If no match found, return "NO_MATCH".`),
        new HumanMessage(`User wants to ${action}: "${reminderTitle}"\n\nReminders:\n${reminderList}\n\nIndex:`)
      ]);
      
      const matchIndex = parseInt(matchResponse.content.trim());
      if (isNaN(matchIndex) || matchIndex < 0 || matchIndex >= allReminders.length) {
        return `Could not find reminder matching "${reminderTitle}".`;
      }
      
      const reminder = allReminders[matchIndex];
      
      if (action === "complete") {
        reminder.isCompleted = true;
        reminder.completedAt = new Date();
        await reminder.save();
        return `Marked as complete: "${reminder.title}"`;
      } else if (action === "delete") {
        await Reminder.deleteOne({ _id: reminder._id });
        return `Deleted reminder: "${reminder.title}"`;
      }
      
      return "Unknown action.";
    } catch (error) {
      return `Error: ${error.message}`;
    }
  },
  {
    name: "complete_reminder",
    description: "Mark a reminder as complete or delete it",
    schema: z.object({
      userId: z.string().describe("User ID"),
      reminderTitle: z.string().describe("Part of reminder title to match"),
      action: z.enum(["complete", "delete"]).describe("What to do with reminder"),
    }),
  }
);

// Tool: Extract Events from Messages
const extractEventsTool = tool(
  async ({ userId, contactName, contactPhone, timeframe }) => {
    try {
      console.log("Extracting events from messages:", { userId, contactName, timeframe });
      
      // Resolve contact using AI
      let phone = contactPhone;
      if (contactName && !contactPhone) {
        const contact = await resolveContactWithAI(userId, contactName);
        if (contact) phone = contact.phone;
      }
      
      const now = new Date();

      // Get messages (optionally time-filtered)
      const query = { userId };
      const range = parseNaturalDateRange(timeframe, now);
      if (range?.start && range?.end) {
        query.createdAt = { $gte: range.start, $lte: range.end };
      }

      let messages = await Message.find(query)
        .sort({ createdAt: -1 })
        .limit(500);
      
      // Filter by phone if provided
      if (phone && messages.length > 0) {
        const digits = phone.replace(/\D/g, '').slice(-10);
        messages = messages.filter(m => {
          const msgDigits = (m.contactPhone || '').replace(/\D/g, '').slice(-10);
          return msgDigits === digits;
        });
      }
      
      messages = messages.slice(0, 80);
      
      if (messages.length === 0) {
        return "No messages found to analyze.";
      }
      
      // Build message text for analysis WITH timestamps
      const msgText = messages.map(m => {
        const msgTime = new Date(m.createdAt);
        const minutesAgo = Math.round((now - msgTime) / 60000);
        const timeLabel = minutesAgo < 1 ? "just now" : 
                         minutesAgo < 60 ? `${minutesAgo} min ago` :
                         minutesAgo < 1440 ? `${Math.round(minutesAgo/60)} hours ago` :
                         `${Math.round(minutesAgo/1440)} days ago`;
        return `[Sent ${timeLabel}] ${m.body}`;
      }).join("\n---\n");
      
      // Use LLM to extract events
      const response = await llm.invoke([
        new SystemMessage(`Extract any dates, meetings, appointments, deadlines, or commitments from these messages.
CRITICAL: Consider WHEN each message was sent (shown in brackets). 
- If a message says "meeting in 30 seconds" but was sent 2 hours ago, that meeting has ALREADY HAPPENED - mark it as PAST.
- Only show UPCOMING events that haven't happened yet.
- Current time is: ${now.toLocaleString()}${range?.start && range?.end ? `\n- Only consider messages from: ${range.start.toLocaleString()} to ${range.end.toLocaleString()}` : ''}

Format each as:
- [STATUS] Event description (from message sent X ago)
  STATUS = UPCOMING if it hasn't happened yet, PAST if it already happened

If no UPCOMING events found, say "No upcoming events - all mentioned events have already passed or none were found."
Do NOT use emojis. Do NOT use markdown. Plain text only.`),
        new HumanMessage(msgText)
      ]);
      
      return sanitizeAIResponse(response.content);
    } catch (error) {
      console.error("Extract events error:", error);
      return `Error: ${error.message}`;
    }
  },
  {
    name: "extract_events",
    description: "Find dates, meetings, appointments, deadlines in messages. Use for: 'any upcoming meetings', 'what appointments do I have', 'extract events from my messages'",
    schema: z.object({
      userId: z.string().describe("User ID"),
      contactName: z.string().optional().describe("Limit to specific contact"),
      contactPhone: z.string().optional().describe("Contact phone"),
      timeframe: z.string().optional().describe("Optional timeframe like 'today', 'yesterday', 'this week', 'last week', 'this month', 'last 7 days', or 'from Jan 1 to Jan 5'"),
    }),
  }
);

// ==================== ADVANCED RULE PARSING SYSTEM ====================

/**
 * Advanced Rule Parser - Handles complex multi-condition rules
 * Uses a state-machine like approach for clarification flows
 */
const RULE_PARSE_SCHEMA = `
{
  "type": "forward" | "mute" | "block" | "hold" | "auto_reply" | "prioritize" | "pause",
  "action": {
    "forward_to": "contact name or phone (if forwarding)",
    "forward_to_email": "email address (if forwarding to email)",
    "auto_reply_message": "message text (if auto-replying)",
    "silent": false // true if user doesn't want notifications
  },
  "filters": {
    "from_contact": "specific sender name or null for all",
    "from_unknown": false, // true if only unknown numbers
    "keywords": ["list", "of", "keywords"], // message content must contain one of these
    "exclude_keywords": ["spam", "promo"], // exclude if contains these
    "priority": "all" | "high" | "urgent" | "emergency",
    "has_attachment": false,
    "sentiment": null | "angry" | "stressful" | "important" // AI analysis required
  },
  "exclusions": {
    "contacts": ["mom", "family"], // never apply to these
    "groups": ["family", "work"], // conceptual groups
    "time_exclude": null | "night" | "weekend" // don't apply during these times
  },
  "conditions": {
    "time_window": { "start": "09:00", "end": "17:00", "days": ["Mon","Tue","Wed","Thu","Fri"] } | null,
    "only_when": null | "offline" | "traveling" | "asleep" | "not_active",
    "delay_minutes": 0, // forward only if no reply in X minutes
    "unread_only": false, // only if message is unread
    "stop_on_reply": false, // disable rule once user replies
    "rate_limit": null | "1_per_person_per_day"
  },
  "duration": {
    "type": "permanent" | "temporary" | "until_cancelled",
    "hours": null, // for temporary rules
    "end_time": null // specific end date/time
  },
  "needs_ai_analysis": false, // true if rule requires sentiment/importance analysis
  "missing_info": ["recipient", "time"], // what we still need to ask user
  "confidence": 0.95, // how confident we are in parsing (0-1)
  "summary": "Human readable rule description"
}`;

async function parseAdvancedRule(ruleDescription) {
  const parsePrompt = `You are an expert at parsing natural language into structured rules.
Parse this rule request and identify ALL conditions, filters, and requirements.

RULE REQUEST: "${ruleDescription}"

Return JSON matching this schema:
${RULE_PARSE_SCHEMA}

PARSING GUIDELINES:
1. If the user says "forward" or "send to" - type is "forward", extract recipient
2. If they mention specific people (from Mom, from boss) - set from_contact
3. If they mention keywords (about payments, account alerts, invoices) - add to keywords array
4. If they say "except" or "but not" - add to exclusions
5. If they mention times (after 6pm, during work hours) - set time_window
6. If they say "urgent" or "important" - set priority filter
7. If they say words like "feel", "sound", "seem", "would care" - needs_ai_analysis = true
8. If the rule needs AI judgment - needs_ai_analysis = true
9. If we need more info (no recipient specified) - add to missing_info
10. For "forward intelligently" - set needs_ai_analysis = true and type = "forward"

IMPORTANT: 
- Set missing_info = ["recipient"] if forwarding but no recipient specified
- Set confidence based on how clear the request is
- Always provide a summary

Return ONLY valid JSON.`;

  const response = await llm.invoke([
    new SystemMessage(parsePrompt),
    new HumanMessage(ruleDescription)
  ]);
  
  let content = response.content.trim();
  if (content.startsWith('```json')) content = content.slice(7);
  if (content.startsWith('```')) content = content.slice(3);
  if (content.endsWith('```')) content = content.slice(0, -3);
  
  return JSON.parse(content.trim());
}

function generateClarificationQuestion(parsed) {
  const missing = parsed.missing_info || [];
  
  if (missing.includes("recipient")) {
    return "Who should these messages be forwarded to? Please provide a contact name or phone number.";
  }
  if (missing.includes("time")) {
    return "What time window should this rule apply? (e.g., 'work hours 9-5', 'after 6pm', 'always')";
  }
  if (missing.includes("keywords")) {
    return "What keywords or topics should trigger this rule?";
  }
  if (missing.includes("duration")) {
    return "How long should this rule be active? (e.g., 'permanently', 'for 2 hours', 'until tomorrow')";
  }
  if (missing.includes("from_contact")) {
    return "Which contacts should this rule apply to? (e.g., 'everyone', 'unknown numbers', a specific name)";
  }
  
  return null;
}

// Tool: Create Smart Rule from Natural Language
const createSmartRuleTool = tool(
  async ({ userId, ruleDescription, clarificationResponse }) => {
    try {
      console.log("Creating smart rule:", { userId, ruleDescription, clarificationResponse });
      
      // Parse the rule using advanced AI
      const parsed = await parseAdvancedRule(ruleDescription);
      console.log("Parsed rule:", JSON.stringify(parsed, null, 2));
      
      // Check for clarification needs
      if (parsed.missing_info && parsed.missing_info.length > 0 && !clarificationResponse) {
        const question = generateClarificationQuestion(parsed);
        if (question) {
          // Store partial parse for continuation
          return `CLARIFICATION_NEEDED|${JSON.stringify(parsed)}|${question}`;
        }
      }
      
      // Merge clarification response if provided
      if (clarificationResponse && parsed.missing_info) {
        if (parsed.missing_info.includes("recipient")) {
          parsed.action = parsed.action || {};
          parsed.action.forward_to = clarificationResponse;
          parsed.missing_info = parsed.missing_info.filter(i => i !== "recipient");
        }
      }
      
      // Resolve contacts
      let targetPhone = null;
      let targetName = parsed.action?.forward_to;
      
      if (targetName && parsed.type === "forward") {
        // Check if it's already a phone number
        const isPhone = /^\+?\d{10,}$/.test(targetName.replace(/[\s\-\(\)]/g, ''));
        if (isPhone) {
          targetPhone = targetName.startsWith('+') ? targetName : `+1${targetName.replace(/\D/g, '')}`;
          targetName = targetPhone;
        } else {
          const target = await resolveContactWithAI(userId, targetName);
          if (target) {
            targetPhone = target.phone;
            targetName = target.name;
          } else {
            return `Could not find "${targetName}" in your contacts. Please save them first or provide a phone number.`;
          }
        }
      }
      
      // Resolve source contact if specified
      let sourcePhone = null;
      let sourceName = parsed.filters?.from_contact;
      if (sourceName) {
        const source = await resolveContactWithAI(userId, sourceName);
        if (source) {
          sourcePhone = source.phone;
          sourceName = source.name;
        }
      }
      
      // Build conditions object
      // Normalize priority to match schema enum: "all" or "high-priority"
      let priorityValue = parsed.filters?.priority || "all";
      if (priorityValue === "high" || priorityValue === "important" || priorityValue === "urgent") {
        priorityValue = "high-priority";
      }
      if (priorityValue !== "all" && priorityValue !== "high-priority") {
        priorityValue = "all"; // Default to "all" for invalid values
      }
      
      const conditions = {
        keyword: parsed.filters?.keywords?.join(',') || null,
        excludeKeywords: parsed.filters?.exclude_keywords || [],
        sourceContactPhone: sourcePhone,
        sourceContactName: sourceName,
        fromUnknown: parsed.filters?.from_unknown || false,
        priority: priorityValue,
        hasAttachment: parsed.filters?.has_attachment || false,
        sentiment: parsed.filters?.sentiment || null,
        schedule: parsed.conditions?.time_window || null,
        triggerCondition: parsed.conditions?.only_when || "always",
        delayMinutes: parsed.conditions?.delay_minutes || 0,
        unreadOnly: parsed.conditions?.unread_only || false,
        stopOnReply: parsed.conditions?.stop_on_reply || false,
        rateLimit: parsed.conditions?.rate_limit || null,
        needsAIAnalysis: parsed.needs_ai_analysis || false,
      };
      
      // Build exclusions
      const exclusions = {
        contacts: parsed.exclusions?.contacts || [],
        groups: parsed.exclusions?.groups || [],
        timeExclude: parsed.exclusions?.time_exclude || null,
      };
      
      // Build transfer details
      const transferDetails = {
        mode: "messages", // default
        priority: priorityValue, // Use normalized priority
        contactName: targetName,
        contactPhone: targetPhone,
        forwardToEmail: parsed.action?.forward_to_email || null,
        autoReplyMessage: parsed.action?.auto_reply_message || null,
        silent: parsed.action?.silent || false,
      };
      
      // Determine mode from context
      if (ruleDescription.toLowerCase().includes('call')) {
        transferDetails.mode = ruleDescription.toLowerCase().includes('message') ? 'both' : 'calls';
      }
      
      // Map parsed type to valid database enum values
      // Database accepts: "transfer", "auto-reply", "block", "forward", "priority", "custom", "message-notify"
      let ruleType = parsed.type;
      if (ruleType === "forward") ruleType = "transfer";
      if (ruleType === "auto_reply") ruleType = "auto-reply";
      if (ruleType === "mute" || ruleType === "hold" || ruleType === "pause") ruleType = "block";
      if (ruleType === "prioritize") ruleType = "priority";
      // Validate against allowed types
      const validTypes = ["transfer", "auto-reply", "block", "forward", "priority", "custom", "message-notify"];
      if (!validTypes.includes(ruleType)) ruleType = "custom";
      
      // Create the rule
      const rule = await Rule.create({
        userId,
        rule: parsed.summary || ruleDescription,
        type: ruleType,
        active: true,
        conditions,
        actions: { exclusions },
        transferDetails: ruleType === "transfer" || ruleType === "forward" ? transferDetails : 
                        ruleType === "auto-reply" ? { autoReplyMessage: parsed.action?.auto_reply_message } : null,
        schedule: {
          mode: parsed.duration?.type === "temporary" ? "duration" : "always",
          durationHours: parsed.duration?.hours || null,
          endTime: parsed.duration?.end_time ? new Date(parsed.duration.end_time) : null,
        }
      });
      
      // Build confirmation message
      let confirmMsg = `Done. Created rule: "${parsed.summary}"`;
      
      if (parsed.needs_ai_analysis) {
        confirmMsg += "\n(This rule uses AI analysis to determine message importance/sentiment)";
      }
      
      if (conditions.schedule) {
        confirmMsg += `\nActive: ${conditions.schedule.start || ''}${conditions.schedule.end ? ' to ' + conditions.schedule.end : ''}`;
      }
      
      if (exclusions.contacts?.length > 0) {
        confirmMsg += `\nExcluding: ${exclusions.contacts.join(', ')}`;
      }
      
      return confirmMsg;
    } catch (error) {
      console.error("Smart rule error:", error);
      return `Error creating rule: ${error.message}`;
    }
  },
  {
    name: "create_smart_rule",
    description: `Create sophisticated rules from natural language. Handles:
- Basic: "Forward account alerts to my accountant", "Mute spam", "Block unknown numbers"
- Time-based: "Forward to Alex during work hours", "Auto-reply after 6pm", "Mute after 9pm"  
- Multi-condition: "Forward account alerts except from family", "Forward urgent client messages about payments"
- Advanced: "Forward if I don't reply in 10 minutes", "Forward intelligently", "Forward messages that sound angry"
- With exclusions: "Forward everything except from mom", "Mute spam but notify if urgent"

Use this for ANY rule creation request - it handles clarification automatically.`,
    schema: z.object({
      userId: z.string().describe("User ID"),
      ruleDescription: z.string().describe("Natural language description of the rule"),
      clarificationResponse: z.string().optional().describe("User's response to clarification question"),
    }),
  }
);

// Tool: Get Unread Summary / Proactive Updates
const getUnreadSummaryTool = tool(
  async ({ userId }) => {
    try {
      // Get unread conversations
      const unreadConvs = await Conversation.find({
        userId,
        unreadCount: { $gt: 0 }
      }).sort({ lastMessageAt: -1 }).limit(10);
      
      if (unreadConvs.length === 0) {
        return "You're all caught up - no unread messages.";
      }
      
      // Get the messages
      const summaries = [];
      for (const conv of unreadConvs) {
        const messages = await Message.find({
          userId,
          contactPhone: conv.contactPhone,
          isRead: false
        }).sort({ createdAt: -1 }).limit(3);
        
        if (messages.length > 0) {
          const preview = messages[0].body.substring(0, 80);
          summaries.push(`- ${conv.contactName || conv.contactPhone} (${conv.unreadCount} unread): "${preview}${messages[0].body.length > 80 ? '...' : ''}"`);
        }
      }

      let response = `You have ${unreadConvs.length} conversation(s) with unread messages:\n${summaries.join("\n")}`;
      
      return response;
    } catch (error) {
      return `Error: ${error.message}`;
    }
  },
  {
    name: "get_unread_summary",
    description: "Get summary of unread messages. Use for: 'what did I miss', 'any new messages', 'catch me up', 'updates'",
    schema: z.object({
      userId: z.string().describe("User ID"),
    }),
  }
);

// Tool: Analyze Conversation Sentiment/Topics
const analyzeConversationTool = tool(
  async ({ userId, contactName, contactPhone }) => {
    try {
      // Resolve contact using AI
      let phone = contactPhone;
      let name = contactName;
      if (contactName && !contactPhone) {
        const contact = await resolveContactWithAI(userId, contactName);
        if (contact) {
          phone = contact.phone;
          name = contact.name;
        }
      }
      
      if (!phone) {
        return `Could not find contact "${contactName}".`;
      }
      
      const digits = phone.replace(/\D/g, '').slice(-10);
      // Get all messages and filter by phone
      let allMessages = await Message.find({ userId }).sort({ createdAt: -1 }).limit(200);
      const messages = allMessages.filter(m => {
        const msgDigits = (m.contactPhone || '').replace(/\D/g, '').slice(-10);
        return msgDigits === digits;
      }).slice(0, 50);
      
      if (messages.length === 0) {
        return `No messages found with ${name || phone}.`;
      }
      
      const msgText = messages.reverse().map(m => {
        const dir = m.direction === 'outgoing' ? 'You' : name;
        return `${dir}: ${m.body}`;
      }).join("\n");
      
      const response = await llm.invoke([
        new SystemMessage(`Analyze this conversation and provide:
1. Overall sentiment (positive/neutral/negative)
2. Main topics discussed
3. Any pending action items or commitments
4. Communication pattern (who initiates more, response times)

Be concise. Use plain text only, no markdown or emojis.`),
        new HumanMessage(msgText)
      ]);
      
      return `Analysis of conversation with ${name || phone}:\n${sanitizeAIResponse(response.content)}`;
    } catch (error) {
      return `Error: ${error.message}`;
    }
  },
  {
    name: "analyze_conversation",
    description: "Analyze conversation sentiment, topics, and patterns. Use for: 'analyze my chat with X', 'what's the vibe with X', 'how's my relationship with X'",
    schema: z.object({
      userId: z.string().describe("User ID"),
      contactName: z.string().optional().describe("Contact name"),
      contactPhone: z.string().optional().describe("Contact phone"),
    }),
  }
);

// Tool: Quick Reply Suggestion
const suggestReplyTool = tool(
  async ({ userId, contactName, contactPhone, context }) => {
    try {
      // Resolve contact using AI
      let phone = contactPhone;
      let name = contactName;
      if (contactName && !contactPhone) {
        const contact = await resolveContactWithAI(userId, contactName);
        if (contact) {
          phone = contact.phone;
          name = contact.name;
        }
      }
      
      if (!phone) {
        return `Could not find contact "${contactName}".`;
      }
      
      const digits = phone.replace(/\D/g, '').slice(-10);
      // Get all messages and filter by phone
      let allMessages = await Message.find({ userId }).sort({ createdAt: -1 }).limit(100);
      const messages = allMessages.filter(m => {
        const msgDigits = (m.contactPhone || '').replace(/\D/g, '').slice(-10);
        return msgDigits === digits;
      }).slice(0, 10);
      
      if (messages.length === 0) {
        return "No conversation history to base suggestions on.";
      }
      
      const msgText = messages.reverse().map(m => {
        const dir = m.direction === 'outgoing' ? 'You' : name;
        return `${dir}: ${m.body}`;
      }).join("\n");
      
      const response = await llm.invoke([
        new SystemMessage(`Based on this conversation, suggest 3 appropriate reply options. ${context ? `Additional context: ${context}` : ""}

Format as:
1. [short reply for quick response]
2. [medium reply with more detail]
3. [longer reply if needed]

Keep replies natural and conversational. No markdown or emojis.`),
        new HumanMessage(msgText)
      ]);
      
      return `Reply suggestions for ${name || phone}:\n${sanitizeAIResponse(response.content)}`;
    } catch (error) {
      return `Error: ${error.message}`;
    }
  },
  {
    name: "suggest_reply",
    description: "Suggest reply options for a conversation. Use for: 'what should I say to X', 'help me reply to X', 'suggest a response'",
    schema: z.object({
      userId: z.string().describe("User ID"),
      contactName: z.string().optional().describe("Contact name"),
      contactPhone: z.string().optional().describe("Contact phone"),
      context: z.string().optional().describe("Additional context like 'be professional' or 'apologize'"),
    }),
  }
);

// All tools for the full agent
const fullAgentTools = [
  // Actions
  makeCallTool,
  sendMessageTool,
  executeSendMessageTool,
  confirmActionTool,
  // Contacts
  listContactsTool,
  listLabelsTool,
  searchContactsTool,
  addContactTool,
  updateContactTool,
  manageContactDetailsTool,
  getContactDetailsTool,
  deleteContactTool,
  deleteAllContactsTool,
  blockContactTool,
  unblockContactTool,
  // Conversation Management
  pinConversationTool,
  muteConversationTool,
  archiveConversationTool,
  markConversationReadTool,
  holdConversationTool,
  deleteConversationTool,
  // Rules
  createTransferRuleTool,
  createAutoReplyTool,
  markPriorityTool,
  getRulesTool,
  deleteRuleTool,
  toggleRuleTool,
  createSmartRuleTool,
  // Messages
  getLastMessageTool,
  getLastIncomingMessageTool,
  searchMessagesTool,
  searchMessagesByDateTool,
  summarizeConversationTool,
  analyzeConversationTool,
  suggestReplyTool,
  extractEventsTool,
  // Proactive
  getUnreadSummaryTool,
  // Info
  getPhoneInfoTool,
  updateForwardingNumberTool,
  // Support
  createSupportTicketTool,
  listSupportTicketsTool,
  // DND & Call Filtering & Routing
  setDNDTool,
  setCallFilterTool,
  setRoutingPreferencesTool,
  cleanupRulesTool,
  // AI Calls
  makeAICallTool,
  listAICallsTool,
  cancelAICallTool,
  getAICallResultTool,
  // Translation & Filtering
  translateTextTool,
  setTranslationSettingsTool,
  classifyMessageTool,
  createSpamFilterTool,
  getMessageTriageTool,
];

const fullAgentToolMap = {
  make_call: makeCallTool,
  send_message: sendMessageTool,
  execute_send_message: executeSendMessageTool,
  confirm_action: confirmActionTool,
  list_contacts: listContactsTool,
  list_labels: listLabelsTool,
  search_contacts: searchContactsTool,
  add_contact: addContactTool,
  update_contact: updateContactTool,
  manage_contact_details: manageContactDetailsTool,
  get_contact_details: getContactDetailsTool,
  delete_contact: deleteContactTool,
  delete_all_contacts: deleteAllContactsTool,
  block_contact: blockContactTool,
  unblock_contact: unblockContactTool,
  // Conversation Management
  pin_conversation: pinConversationTool,
  mute_conversation: muteConversationTool,
  archive_conversation: archiveConversationTool,
  mark_conversation_read: markConversationReadTool,
  hold_conversation: holdConversationTool,
  delete_conversation: deleteConversationTool,
  // Rules
  create_transfer_rule: createTransferRuleTool,
  create_auto_reply: createAutoReplyTool,
  mark_priority: markPriorityTool,
  get_rules: getRulesTool,
  delete_rule: deleteRuleTool,
  toggle_rule: toggleRuleTool,
  create_smart_rule: createSmartRuleTool,
  get_last_message: getLastMessageTool,
  get_last_incoming_message: getLastIncomingMessageTool,
  search_messages: searchMessagesTool,
  search_messages_by_date: searchMessagesByDateTool,
  summarize_conversation: summarizeConversationTool,
  analyze_conversation: analyzeConversationTool,
  suggest_reply: suggestReplyTool,
  extract_events: extractEventsTool,
  get_unread_summary: getUnreadSummaryTool,
  get_phone_info: getPhoneInfoTool,
  update_forwarding_number: updateForwardingNumberTool,
  create_support_ticket: createSupportTicketTool,
  list_support_tickets: listSupportTicketsTool,
  set_dnd: setDNDTool,
  set_call_filter: setCallFilterTool,
  set_routing_preferences: setRoutingPreferencesTool,
  cleanup_rules: cleanupRulesTool,
  make_ai_call: makeAICallTool,
  list_ai_calls: listAICallsTool,
  cancel_ai_call: cancelAICallTool,
  get_ai_call_result: getAICallResultTool,
  translate_text: translateTextTool,
  set_translation_settings: setTranslationSettingsTool,
  classify_message: classifyMessageTool,
  create_spam_filter: createSpamFilterTool,
  get_message_triage: getMessageTriageTool,
};

// Full Agent LLM
const fullAgentLLM = new ChatOpenAI({
  modelName: "gpt-5.2",
  temperature: 0.3,
  openAIApiKey: process.env.OPENAI_API_KEY,
}).bindTools(fullAgentTools);

/**
 * Full-powered Rules Agent Chat
 * Can make calls, send messages, create rules, search everything
 */
export async function rulesAgentChat(userId, message, chatHistory = []) {
  try {
    console.log("Rules Agent Chat:", { userId, message });

    const trimmedMessage = (message || "").trim();
    const lowerMessage = trimmedMessage.toLowerCase();

    // Fast-path: last message requests (fixes "show me his last message" loops)
    if (lowerMessage.includes("last message")) {
      const fromMatch = trimmedMessage.match(/last message\s+from\s+(.+)$/i);
      if (fromMatch && fromMatch[1]) {
        return await getLastMessageTool.invoke({ userId, contactName: fromMatch[1].trim() });
      }

      if (/(his|her|their)\s+last message/i.test(trimmedMessage)) {
        for (let i = chatHistory.length - 1; i >= 0; i--) {
          const t = chatHistory[i]?.text;
          if (typeof t === "string") {
            const m = t.match(/([^:\n]+):\s*(\+\d{7,})/);
            if (m) {
              return await getLastMessageTool.invoke({ userId, contactName: m[1].trim(), contactPhone: m[2].trim() });
            }
          }
        }
      }
    }

    // Fast-path: meeting/appointment questions -> extract_events (with optional timeframe)
    const looksLikeMeetingQuestion = /(do i have|any|what).{0,40}\b(meeting|meetings|appointment|appointments|interview|deadline|due)\b/i;
    if (looksLikeMeetingQuestion.test(trimmedMessage)) {
      const inferred = inferContactFromChatHistory(chatHistory) || {};
      const timeframeMatch = trimmedMessage.match(/\b(today|yesterday|this week|last week|this month|last month|last\s+\d+\s+days|from\s+.+\s+to\s+.+|between\s+.+\s+and\s+.+)\b/i);
      const timeframe = timeframeMatch?.[0] || "this week";
      return await extractEventsTool.invoke({ userId, ...inferred, timeframe });
    }
    
    // Check for pending clarification in chat history
    let pendingClarification = null;
    let pendingDNDClarification = null;
    
    for (let i = chatHistory.length - 1; i >= 0; i--) {
      const msg = chatHistory[i];
      if (msg.role === "assistant" && msg.text) {
        const txt = msg.text.toLowerCase();
        
        // Check for DND/routing clarification - detect by content patterns
        // The AI asks about calls AND messages for DND/routing setup
        const isDNDContext = (
          // Explicit DND or routing mentions
          (txt.includes("do not disturb") || txt.includes("dnd") || txt.includes("routing")) &&
          // AND asks about calls/messages preferences
          ((txt.includes("call") && txt.includes("message")) || 
           txt.includes("what should happen to calls") ||
           txt.includes("what message notifications"))
        ) || (
          // Or asking specifically about call routing options
          (txt.includes("all calls") || txt.includes("favorites") || txt.includes("saved contacts") || txt.includes("go to ai")) &&
          (txt.includes("ring") || txt.includes("notification"))
        ) || (
          // Check for raw CLARIFICATION_NEEDED prefix (in case it wasn't stripped)
          msg.text.includes("CLARIFICATION_NEEDED:") && msg.text.includes("Do Not Disturb")
        );
        
        if (isDNDContext) {
          // Extract time info if present
          const timeMatch = msg.text.match(/from\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+to\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
          pendingDNDClarification = {
            startTime: timeMatch?.[1] || null,
            endTime: timeMatch?.[2] || null,
          };
          console.log("Detected DND clarification context:", pendingDNDClarification);
          break;
        }
        
        // Check for smart rule clarification
        if (msg.text.startsWith("CLARIFICATION_NEEDED|")) {
          const parts = msg.text.split("|");
          if (parts.length >= 3) {
            pendingClarification = {
              parsedRule: JSON.parse(parts[1]),
              question: parts[2],
              originalDescription: msg.originalDescription
            };
          }
          break;
        }
        
        // Also check for clarification questions in normal text
        if (msg.text.includes("Who should these messages be forwarded to?") ||
            msg.text.includes("Which contact should receive") ||
            msg.text.includes("Please provide a contact name or phone")) {
          // Look back further for the original rule request
          for (let j = i - 1; j >= 0; j--) {
            if (chatHistory[j].role === "user") {
              pendingClarification = {
                originalDescription: chatHistory[j].text,
                question: msg.text
              };
              break;
            }
          }
          break;
        }
        
        // If we hit an assistant message that's not a clarification, stop looking
        // (don't look past the most recent AI response)
        break;
      }
    }
    
    // Handle DND clarification response - parse user's calls/messages preferences and execute
    if (pendingDNDClarification && message.toLowerCase() !== "cancel" && message.toLowerCase() !== "nevermind") {
      console.log("Handling DND clarification response:", message);
      const lowerMsg = message.toLowerCase();
      
      // Parse calls preference - more permissive patterns
      let callsMode = null;
      if (/\b(all\s*call(s|ers)?|every\s*call(er)?|let\s*(all|everyone)\s*(call|ring))\b/i.test(lowerMsg)) {
        callsMode = "all";
      } else if (/\b(favorite|favourites?)\b/i.test(lowerMsg)) {
        callsMode = "favorites";
      } else if (/\b(saved|contacts?\s*only|known)\b/i.test(lowerMsg)) {
        callsMode = "saved";
      } else if (/\b(no\s*calls?|block\s*calls?|no\s*ring|don'?t\s*ring|silent|calls?\s*to\s*ai)\b/i.test(lowerMsg)) {
        callsMode = "none";
      }
      
      // Parse messages preference - more permissive patterns
      let messagesMode = null;
      if (/\b(all\s*messages?|every\s*message|all\s*notifications?)\b/i.test(lowerMsg)) {
        messagesMode = "all";
      } else if (/\b(important)\b/i.test(lowerMsg) && !/\bnot\s+important\b/i.test(lowerMsg)) {
        messagesMode = "important";
      } else if (/\b(urgent|critical|emergency)\b/i.test(lowerMsg)) {
        messagesMode = "urgent";
      } else if (/\b(no\s*messages?|no\s*notification|none|silent|mute)\b/i.test(lowerMsg)) {
        messagesMode = "none";
      }
      
      // If user only specified one (calls or messages), we still need to execute
      // Use defaults for unspecified: if they want calls, assume no messages (DND style)
      if (callsMode && !messagesMode) {
        messagesMode = "none"; // DND default
      }
      if (messagesMode && !callsMode) {
        callsMode = "none"; // DND default
      }
      
      // Only proceed if we parsed at least one preference
      if (callsMode || messagesMode) {
        console.log("Parsed DND preferences:", { callsMode, messagesMode, schedule: pendingDNDClarification });
        
        // Build schedule if times were specified
        const schedule = pendingDNDClarification.startTime && pendingDNDClarification.endTime
          ? { startTime: pendingDNDClarification.startTime, endTime: pendingDNDClarification.endTime }
          : null;
        
        // Execute set_routing_preferences directly
        const result = await setRoutingPreferencesTool.invoke({
          userId,
          callsMode: callsMode || "none",
          messagesMode: messagesMode || "none",
          schedule,
          isDefault: !schedule, // If no schedule, this is the default routing
        });
        
        return result;
      }
    }
    
    // If there's a pending clarification and user responded, complete the rule
    if (pendingClarification && message.toLowerCase() !== "cancel" && message.toLowerCase() !== "nevermind") {
      console.log("Completing clarification with response:", message);
      
      // Re-run smart rule creation with the clarification
      const fullDescription = pendingClarification.originalDescription 
        ? `${pendingClarification.originalDescription}. Forward to: ${message}`
        : `Forward messages to ${message}`;
      
      const result = await createSmartRuleTool.invoke({
        userId,
        ruleDescription: fullDescription,
        clarificationResponse: message
      });
      
      // Check if still needs clarification
      if (result.startsWith("CLARIFICATION_NEEDED|")) {
        const parts = result.split("|");
        return parts[2]; // Return the question
      }
      
      return result;
    }
    
    // Only attempt pending-send confirmation logic when user is actually confirming.
    const isConfirmation = ["yes", "send it", "confirm", "do it", "send", "yep", "yeah", "ok", "okay", "sure"].includes(lowerMessage);

    if (isConfirmation) {
      // Extract pending action from chat history for confirmation handling
      let pendingAction = null;
      for (let i = chatHistory.length - 1; i >= 0; i--) {
        const msg = chatHistory[i];
        if (msg.role === "assistant" && msg.text) {
          if (msg.text.includes("Ready to send to") && msg.text.includes('Reply "yes" to send')) {
            const lines = msg.text.split("\n");
            let contactInfo = null;
            let messageContent = null;

            for (const line of lines) {
              if (line.startsWith("Ready to send to ")) {
                contactInfo = line.replace("Ready to send to ", "").replace(":", "").trim();
                break;
              }
            }

            const quoteMatch = msg.text.match(/"([^"]+)"/);
            if (quoteMatch) {
              messageContent = quoteMatch[1];
            }

            if (contactInfo && messageContent) {
              pendingAction = {
                type: "send_message",
                contactName: contactInfo,
                messageText: messageContent,
              };
            }
            break;
          }
        }
      }

      if (pendingAction && pendingAction.type === "send_message") {
      console.log("User confirmed pending send_message action:", pendingAction);
      
      let phone = null;
      let name = pendingAction.contactName;
      
      // Check if contactName is already a phone number (starts with + or is all digits)
      const cleanedContact = pendingAction.contactName.replace(/[\s\-\(\)]/g, '');
      const isPhoneNumber = /^\+?\d{10,}$/.test(cleanedContact);
      
      if (isPhoneNumber) {
        // It's already a phone number, use it directly
        phone = cleanedContact.startsWith('+') ? cleanedContact : `+1${cleanedContact}`;
        name = phone;
        console.log("Contact is a phone number:", phone);
      } else {
        // Look up contact by name using AI-powered matching
        console.log("Looking up contact by name using AI:", name);
        
        const contact = await resolveContactWithAI(userId, name);
        
        if (contact && contact.phone) {
          phone = contact.phone;
          name = contact.name;
          console.log("Found contact via AI:", name, phone);
        } else {
          // Try Conversations with AI matching
          const allConvos = await Conversation.find({ userId }).limit(200);
          if (allConvos.length > 0) {
            const convoList = allConvos.map(c => `${c.contactName || 'Unknown'}: ${c.contactPhone}`).join('\n');
            const matchResponse = await llm.invoke([
              new SystemMessage(`Find the conversation that best matches the input name. Return ONLY the phone number, nothing else. If no match, return "NO_MATCH".`),
              new HumanMessage(`Input name: "${name}"\n\nConversations:\n${convoList}\n\nPhone number:`)
            ]);
            const matchedPhone = matchResponse.content.trim();
            if (matchedPhone !== "NO_MATCH" && matchedPhone.length > 5) {
              const convo = allConvos.find(c => c.contactPhone === matchedPhone);
              if (convo) {
                phone = convo.contactPhone;
                name = convo.contactName || name;
                console.log("Found in conversations via AI:", name, phone);
              }
            }
          }
        }
      }
      
      if (phone) {
        try {
          // Execute the send directly here instead of calling tool
          console.log("Sending SMS to:", phone, "Message:", pendingAction.messageText);
          
          const user = await User.findById(userId);
          if (!user?.phoneNumber) {
            return "You don't have a phone number configured. Please set one up in Settings first.";
          }
          
          const fromNumber = normalizePhoneForSms(user.phoneNumber);
          const toNumber = normalizePhoneForSms(phone);
          
          // Look up Twilio account by the user's phone number (not userId)
          let twilioAccount = await TwilioAccount.findOne({ 
            phoneNumbers: user.phoneNumber 
          });
          
          // Try normalized version
          if (!twilioAccount && fromNumber) {
            twilioAccount = await TwilioAccount.findOne({ 
              phoneNumbers: fromNumber 
            });
          }
          
          // Try phone assignments
          if (!twilioAccount) {
            twilioAccount = await TwilioAccount.findOne({
              "phoneAssignments.phoneNumber": { $in: [user.phoneNumber, fromNumber] }
            });
          }
          
          // Fallback: search all accounts for matching phone
          if (!twilioAccount) {
            const allAccounts = await TwilioAccount.find({});
            const phoneDigits = fromNumber.replace(/\D/g, '').slice(-10);
            for (const acc of allAccounts) {
              const normalizedPhones = (acc.phoneNumbers || []).map(p => p.replace(/\D/g, '').slice(-10));
              if (normalizedPhones.includes(phoneDigits)) {
                twilioAccount = acc;
                break;
              }
            }
          }
          
          if (!twilioAccount || !twilioAccount.accountSid || !twilioAccount.authToken) {
            console.log("No Twilio account found for phone:", user.phoneNumber);
            return "Twilio not configured for your phone number. Please contact support.";
          }
          
          console.log("Found Twilio account:", twilioAccount.accountSid.slice(0, 8) + "...");
          
          const client = twilio(twilioAccount.accountSid, twilioAccount.authToken);
          
          console.log("Twilio send - From:", fromNumber, "To:", toNumber);
          
          const twilioMessage = await client.messages.create({
            body: pendingAction.messageText,
            from: fromNumber,
            to: toNumber,
          });
          
          console.log("SMS sent! SID:", twilioMessage.sid);
          
          // Save to database
          const savedMessage = new Message({
            userId,
            contactPhone: toNumber,
            contactName: name,
            direction: "outgoing",
            body: pendingAction.messageText,
            status: "sent",
            twilioSid: twilioMessage.sid,
            fromNumber,
            toNumber,
            isRead: true,
          });
          await savedMessage.save();
          console.log("Message saved to DB");
          
          // Update conversation
          const phoneDigits = toNumber.replace(/\D/g, '').slice(-10);
          const allConvos = await Conversation.find({ userId });
          const matchingConvo = allConvos.find(c => {
            const convoDigits = (c.contactPhone || '').replace(/\D/g, '').slice(-10);
            return convoDigits === phoneDigits;
          });
          if (matchingConvo) {
            matchingConvo.lastMessage = pendingAction.messageText;
            matchingConvo.lastMessageAt = new Date();
            matchingConvo.messageCount = (matchingConvo.messageCount || 0) + 1;
            await matchingConvo.save();
          }
          
          return `Message sent to ${name}: "${pendingAction.messageText}"`;
        } catch (sendError) {
          console.error("Send error:", sendError);
          return `Failed to send message: ${sendError.message}`;
        }
      } else {
        return `Could not find phone number for "${pendingAction.contactName}". Please provide their number.`;
      }
      }
    }
    
    const systemPrompt = `You are Aura, a powerful AI assistant for Comsierge SMS/call management.

CRITICAL RULES - FOLLOW STRICTLY:
- The product name is "Comsierge" - NEVER write "Concierge", "concierge", "Conceirge", or any other spelling
- NEVER mention financial institutions in any response
- NEVER use emojis
- NEVER use markdown (no **, no ##, no *)
- Use plain text only
- Be concise and direct
- ABSOLUTELY NEVER mention iPhone, Android, iOS, device settings, or suggest the user go to their phone settings
- This is Comsierge - a standalone cloud phone service. All features are built-in.
- When user says "do not disturb" or "DND", use set_dnd tool - do NOT tell them about phone settings
- For support tickets: ALWAYS ask clarifying questions first before creating the ticket
- If a feature isn't available, say "That's not available in Comsierge yet" - never suggest external solutions
- "routing number" means phone forwarding number. When user asks "what's my routing number" -> use get_phone_info and tell them their forwarding number
- EVERYTHING is in context of Comsierge phone service

ROUTING NUMBER = FORWARDING NUMBER:
When user asks about "routing number", they mean their phone forwarding number. Use get_phone_info and respond with:
"Your Comsierge number is [number] and calls/messages forward to [forwarding number]."
Do NOT mention finances. Do NOT say "I don't have your routing number".

SPECIAL REQUESTS - NOT PHONE RELATED:
- For investor inquiries, pricing, business questions: Create a support ticket with category "investor" or "pricing" 
- For requests like "invest", "pricing", "business inquiry", "partnership": Ask for their contact info (name, email) and create a support ticket to route to the team

TOOLS BY CATEGORY:

CONTACTS:
- list_contacts: Show all contacts
- list_labels: Show all labels/tags across all contacts. Use when: "show all labels", "what labels do I have", "show me my labels", "list my tags"
- search_contacts: Find contact by name
- add_contact: Add a new contact (name + phone number required)
- update_contact: Rename contact (currentName + newName) - can change name but NEVER the phone number
- manage_contact_details: Add/remove labels, notes, email, company, favorite status. Use for:
  * "add label family to Dad" -> action=add, field=tags, value=family
  * "remove work label from John" -> action=remove, field=tags, value=work  
  * "add note 'birthday Jan 15' to Mom" -> action=add, field=notes, value=birthday Jan 15
  * "set Dad's email to dad@email.com" -> action=set, field=email, value=dad@email.com
  * "mark Dad as favorite" -> action=set, field=favorite
  * "what labels does Dad have" -> action=get, field=tags
- get_contact_details: Get full info (phone, email, company, labels, notes, favorite)
- delete_contact: Delete a contact by name
- block_contact / unblock_contact: Block/unblock

IMPORTANT - LABELS vs NAMES:
- Labels (tags) are category keywords like "family", "work", "friend" that you ADD to contacts
- A contact NAME is different from labels. "DAD" is a name, "family" could be a label ON that contact.
- "show all labels" -> use list_labels tool
- "add label family" -> use manage_contact_details with action=add, field=tags
- "rename to Dad" -> use update_contact with newName
- Labels/tags are SEPARATE from the name. Do NOT put labels in the name field!
- "family friend" as a label means a tag with value "family friend", NOT a contact named that

ROUTING PREFERENCES (calls + messages combined) - MATCHES ROUTING PAGE UI:
- set_routing_preferences: THE MAIN TOOL for configuring call AND message routing
  
  CALLS options (who rings your phone):
  * "all" = Every incoming call rings
  * "favorites" = Only contacts marked as favorite
  * "saved" = Anyone in your contacts
  * "tags" = Filter by contact tags (needs callTags array)
  * "none" = All calls go to AI, phone doesn't ring
  
  MESSAGES options (what notifies you):
  * "all" = Every incoming message
  * "important" = High + medium priority only (no spam)
  * "urgent" = Critical messages only (no spam)
  * "none" = No notifications
  
  TIME-BASED: Add schedule={startTime:"8pm", endTime:"9pm"} for time windows
  
  Examples:
  * "all calls, important messages" -> set_routing_preferences(callsMode="all", messagesMode="important")
  * "no calls from 8pm-9pm" -> set_routing_preferences(callsMode="none", schedule={startTime:"8pm", endTime:"9pm"})
  * "favorites only, urgent messages" -> set_routing_preferences(callsMode="favorites", messagesMode="urgent")

DND (DO NOT DISTURB) - ALWAYS ASK CLARIFYING QUESTIONS:
- set_dnd: When user says "dnd" or "do not disturb", ALWAYS ask what they want
  * "dnd" -> use set_dnd → it will ask for calls/messages preferences
  * "dnd from 8pm to 9pm" -> use set_dnd with times → it will ask for calls/messages preferences
  * After user clarifies (e.g., "no calls, urgent messages") -> use set_routing_preferences with their choices

ROUTING FLOW EXAMPLE:
1. User: "dnd from 8pm to 9pm"
2. AI: calls set_dnd(enabled=true, startTime="8pm", endTime="9pm") → asks clarifying question
3. User: "no calls, but I want urgent messages"
4. AI: calls set_routing_preferences(callsMode="none", messagesMode="urgent", schedule={startTime:"8pm", endTime:"9pm"})
5. User: "for other times, just normal - all calls, important messages"
6. AI: calls set_routing_preferences(callsMode="all", messagesMode="important", isDefault=true)

RULES & AUTOMATION:
- create_transfer_rule: Forward calls/messages from a specific contact to another number
- create_auto_reply: Set auto-reply for a contact. Use when: "if X replies say Y", "auto reply to X", "when X texts respond with Y", "if X messages say Y"
- mark_priority: Mark as high priority
- get_rules: List rules (use includeInactive=true for inactive/disabled rules)
- delete_rule: Remove a rule
- toggle_rule: Enable/disable a rule without deleting it. Use when: "disable the transfer rule", "turn off forwarding", "pause the auto-reply", "enable it again"
- cleanup_rules: Remove duplicate and inactive rules. Use when user asks "why do I have old rules", "clean up rules", "remove duplicates"
- create_smart_rule: Natural language rule creation for complex rules like:
  * "if I receive a message about X, forward to Y"
  * "forward messages containing 'urgent' to my assistant"
  * "if Mark calls and I don't answer, forward to John"
  * Time-based: "auto-reply after 6pm"

CONVERSATION MANAGEMENT:
- pin_conversation: Pin/unpin a conversation to keep it at top. Use when: "pin this chat", "keep John at top", "unpin mom"
- mute_conversation: Mute/unmute notifications for a conversation. Use when: "mute this", "stop notifications from John", "unmute mom"
- archive_conversation: Archive/unarchive a conversation. Use when: "archive this", "hide this chat", "unarchive John"
- mark_conversation_read: Mark as read/unread. Use when: "mark as read", "I've read it", "mark as unread"
- hold_conversation: Move to/from Held folder. Use when: "put on hold", "hold this", "release from hold"
- delete_conversation: Delete entire conversation and messages. Use when: "delete this conversation", "remove chat with John"

MESSAGES & ANALYSIS:
- get_last_message: Get the most recent message with a contact
- search_messages: Search ALL messages for keywords
- search_messages_by_date: Search messages in date range
- summarize_conversation: Summarize chat with a specific contact
- analyze_conversation: Analyze sentiment, topics, patterns with a contact
- suggest_reply: Get reply suggestions for a conversation
- extract_events: Find events, dates, appointments from messages

PROACTIVE:
- get_unread_summary: Get briefing on unread messages

PHONE SETTINGS:
- get_phone_info: Get user's Comsierge number and current forwarding number
- update_forwarding_number: Change where calls/messages forward to (use this when user says "change my forwarding number to X" or "forward to X number")

PERSONAL ROUTING (IMPORTANT - matches the Routing page UI):
- set_routing_preferences: THE main tool for routing. Creates rules that appear in Routing page.
  CALLS options: all, favorites, saved, tags, none
  MESSAGES options: all, important, urgent, none
  Can include schedule for time-based rules
  
- set_dnd: For "dnd" or "do not disturb" requests - ALWAYS asks clarifying questions first
  
ROUTING FLOW:
1. User says "dnd" or "do not disturb" → use set_dnd → it asks "calls, messages, or both?"
2. User says "dnd from 8pm to 9pm" → use set_dnd with times → it asks what for calls/messages
3. User clarifies "no calls, urgent messages only" → use set_routing_preferences with schedule
4. User says "for other times keep it normal - all calls, important messages" → use set_routing_preferences with isDefault=true

EXAMPLES:
- "dnd" → set_dnd(enabled=true) → asks clarifying question
- "dnd from 8pm to 9pm" → set_dnd(enabled=true, startTime="8pm", endTime="9pm") → asks what for calls/messages  
- "no calls, only urgent messages" (after dnd question) → set_routing_preferences(callsMode="none", messagesMode="urgent", schedule=...)
- "normal routing - all calls, important messages" → set_routing_preferences(callsMode="all", messagesMode="important", isDefault=true)
- "only favorites can call me" → set_routing_preferences(callsMode="favorites")
- "mute all notifications" → set_routing_preferences(callsMode="none", messagesMode="none")

SUPPORT:
- create_support_ticket: Create a support ticket - BUT FIRST ask: 1) What exactly is happening? 2) When did it start? 3) Any error messages? Only create after getting details.
- list_support_tickets: Show user's support tickets (use when user says "show my tickets", "my support tickets", "ticket status")

AI CALLS (AUTONOMOUS VOICE AGENT):
- make_ai_call: Have AI make a call on user's behalf with an objective. Use when: "AI call John and ask about meeting", "have AI check on mom"
- list_ai_calls: View AI calls and their status/summaries
- cancel_ai_call: Cancel a pending scheduled AI call
- get_ai_call_result: Get the summary/transcript of a completed AI call

TRANSLATION & FILTERING:
- translate_text: Translate text to another language. Use when: "translate X to Spanish", "what does X mean in French"
- set_translation_settings: Configure translation preferences. Use when: "translate incoming to English", "I speak Spanish", "auto-translate messages", "turn off translation"
- classify_message: Classify a message as spam, priority, delivery, financial, or normal. Use when: "is this spam?", "what kind of message is this?"
- create_spam_filter: Create automated spam blocking rules. Use when: "block spam", "filter car warranty messages", "block unknown numbers"
- get_message_triage: Get intelligent overview of messages by category (priority, spam, delivery, etc.). Use when: "triage my messages", "what's important?", "filter my inbox"

ACTIONS:
- make_call: Call someone
- send_message: Prepare to send SMS (shows confirmation first) - CAN send to ANY number including the user's own forwarding number
- execute_send_message: Actually send the SMS after user confirms with "yes"

CRITICAL - "TEXT ME" / "CALL ME" HANDLING:
When user says "text me" or "send me a message" or "call me":
1. First use get_phone_info to get their forwarding number
2. Then use send_message (for text) or make_call (for call) with that forwarding number as the destination
3. You CAN and SHOULD send messages/calls to the user - this is a core feature!

CONFIRMATION FLOW FOR SENDING MESSAGES:
1. User says "send hey to John" -> use send_message tool -> shows "Ready to send... Reply yes to send"
2. User says "yes" -> use execute_send_message tool with the contact and message

IMPORTANT FOR RULE MANAGEMENT:
- "turn that off" or "disable it" after showing a rule -> use toggle_rule with active=false
- "enable the rule" or "turn it back on" -> use toggle_rule with active=true
- "delete the rule" -> use delete_rule (permanent removal)

CHOOSING THE RIGHT TOOL - EXAMPLES:
- "if grandma replies say I'm busy" -> create_auto_reply with sourceContact="grandma", replyMessage="I'm busy"
- "auto reply to mom saying I'll call back" -> create_auto_reply
- "when John texts, auto respond that I'm in a meeting" -> create_auto_reply
- "do I have any meetings" -> search_messages with query="meeting"
- "any emergency messages" -> search_messages with query="emergency"
- "summarize my chats from jk" -> summarize_conversation with contactName="jk"
- "what did jk say" -> summarize_conversation with contactName="jk"
- "show me the last message from jk" -> get_last_message with contactName="jk"
- "change jk to john" -> update_contact with currentName="jk", newName="john"
- "forward calls from jk to bob" -> create_transfer_rule
- "forward messages about baig to jeremy" -> create_smart_rule
- "if mark texts me, notify jeremy" -> create_smart_rule
- "if i get a message from mark about a meeting, send it to jake" -> create_smart_rule (source + keyword + target)
- "forward urgent messages from boss to my wife" -> create_smart_rule (priority + source + target)
- "what did I miss" -> get_unread_summary
- "analyze my chat with john" -> analyze_conversation
- "what should I say to sarah" -> suggest_reply
- "turn that off" or "disable the transfer rule" -> toggle_rule with active=false
- "delete the rule" -> delete_rule
- "yes" after "Ready to send..." -> execute_send_message
- "change my forwarding number to 555-1234" -> update_forwarding_number
- "what number are calls forwarded to" -> get_phone_info
- "what is my comsierge number" -> get_phone_info
- "show me my routing number" -> get_phone_info (routing = forwarding in this phone context)
- "where do my calls go" -> get_phone_info
- "show my inactive rules" -> get_rules with includeInactive=true
- "disabled rules" -> get_rules with includeInactive=true
- "text me hi" -> get_phone_info (to get forwarding number) then send_message to that number
- "call me" -> get_phone_info (to get forwarding number) then make_call to that number
- "send me a test message" -> get_phone_info then send_message to forwarding number
- "AI call George and ask about his day" -> make_ai_call
- "have AI check on mom tomorrow at 3pm" -> make_ai_call with scheduledAt
- "what did the AI call find out" -> get_ai_call_result
- "translate hello to Spanish" -> translate_text
- "I speak Spanish" -> set_translation_settings with receiveLanguage="es"
- "auto translate incoming" -> set_translation_settings with autoTranslateIncoming=true
- "is this spam: you've won $5000" -> classify_message
- "block car warranty messages" -> create_spam_filter with filterType="car_warranty"
- "pin this conversation" -> pin_conversation with pin=true
- "unpin mom" -> pin_conversation with contactName="mom", pin=false
- "mute john" -> mute_conversation with contactName="john", mute=true
- "archive this chat" -> archive_conversation with archive=true
- "mark as read" -> mark_conversation_read with markRead=true
- "put this on hold" -> hold_conversation with hold=true
- "delete this conversation" -> delete_conversation
- "block unknown numbers" -> create_spam_filter with filterType="unknown_numbers"
- "triage my messages" -> get_message_triage
- "what's important in my inbox" -> get_message_triage
- "filter my messages" -> get_message_triage
- "forward account alerts to my accountant" -> create_smart_rule
- "route delivery messages to my email" -> create_smart_rule

IMPORTANT CONTEXT: This is a PHONE/SMS management app. When user says "routing number" they mean their PHONE forwarding/routing number, not something finance-related. Use get_phone_info for any routing/forwarding questions.

CLARIFICATION RULES:
- For "dnd" or "do not disturb" ALONE: ASK "Do you want to block calls, messages, or both?"
- For routing changes: ASK if user wants time-based schedule if not specified
- Don't assume - ask when the request is ambiguous

Be direct. Execute tools immediately. No confirmation needed for read operations.
For complex rules described in natural language, use create_smart_rule.
Always resolve contacts by name when user provides a name.

User ID: ${userId}`;

    function inferContactFromChatHistory(history) {
      for (let i = (history || []).length - 1; i >= 0; i--) {
        const text = history[i]?.text;
        if (typeof text !== "string") continue;

        // Common tool output formats
        const summaryMatch = text.match(/Summary with\s+([^:\n]+):/i);
        if (summaryMatch?.[1]) {
          return { contactName: summaryMatch[1].trim() };
        }

        const lastFromMatch = text.match(/Last message\s+FROM\s+([^\(\n]+)(?:\(|:|\n)/i);
        if (lastFromMatch?.[1]) {
          return { contactName: lastFromMatch[1].trim() };
        }

        // Pattern: "Name: +15551234567"
        const namePhoneMatch = text.match(/([^:\n]{1,80})\s*:\s*(\+\d{7,15})/);
        if (namePhoneMatch?.[2]) {
          return { contactName: namePhoneMatch[1]?.trim(), contactPhone: namePhoneMatch[2].trim() };
        }

        // Any phone number in the text
        const phoneMatch = text.match(/(\+\d{7,15})/);
        if (phoneMatch?.[1]) {
          return { contactPhone: phoneMatch[1].trim() };
        }
      }
      return null;
    }

    const messages = [
      new SystemMessage(systemPrompt),
      ...chatHistory.map((h) => (h.role === "user" ? new HumanMessage(h.text) : new AIMessage(h.text))),
      new HumanMessage(message),
    ];

    const response = await fullAgentLLM.invoke(messages);
    
    console.log("Full Agent Response:", response.content);
    console.log("Tool calls:", response.tool_calls);

    // Execute tool calls
    if (response.tool_calls && response.tool_calls.length > 0) {
      const results = [];

      const inferredContact = inferContactFromChatHistory(chatHistory);
      const injectContactArgs = (args) => {
        if (!inferredContact) return args;
        const next = { ...args };

        // Tools that use contactName/contactPhone
        if (!next.contactName && !next.contactPhone) {
          if (inferredContact.contactName) next.contactName = inferredContact.contactName;
          if (inferredContact.contactPhone) next.contactPhone = inferredContact.contactPhone;
        }

        // Tools that use sourceContact/sourcePhone
        if (!next.sourceContact && !next.sourcePhone) {
          if (inferredContact.contactName) next.sourceContact = inferredContact.contactName;
          if (inferredContact.contactPhone) next.sourcePhone = inferredContact.contactPhone;
        }

        return next;
      };
      
      for (const toolCall of response.tool_calls) {
        console.log(`Executing tool: ${toolCall.name}`, toolCall.args);
        
        // Auto-inject userId
        let args = { ...toolCall.args, userId };

        // If the user says "this conversation" / uses pronouns, some tool calls may omit contact info.
        // We defensively fill from the most recent referenced contact in chat history.
        const needsConversationContextTools = new Set([
          "summarize_conversation",
          "get_last_message",
          "get_last_incoming_message",
          "pin_conversation",
          "mute_conversation",
          "archive_conversation",
          "mark_conversation_read",
          "hold_conversation",
          "delete_conversation",
          "block_contact",
          "unblock_contact",
          "create_transfer_rule",
        ]);

        if (needsConversationContextTools.has(toolCall.name)) {
          args = injectContactArgs(args);
        }
        
        const selectedTool = fullAgentToolMap[toolCall.name];
        if (selectedTool) {
          try {
            const result = await selectedTool.invoke(args);
            results.push(result);
          } catch (toolError) {
            console.error(`Tool ${toolCall.name} error:`, toolError);
            results.push(`Error: ${toolError.message}`);
          }
        }
      }
      
      // Check if any result is a JSON action needing frontend handling
      for (const result of results) {
        // Check for clarification needed
        if (typeof result === 'string' && result.startsWith("CLARIFICATION_NEEDED|")) {
          const parts = result.split("|");
          // Return just the question to the user
          return parts[2];
        }
        
        try {
          const parsed = JSON.parse(result);
          if (parsed.action && parsed.confirm) {
            // Return the action for frontend to handle
            return result;
          }
        } catch (e) {
          // Not JSON, just a string response
        }
      }
      
      // Humanize the response - make it conversational
      const toolOutput = results.join("\n\n");
      const humanizePrompt = `You are Aura, a friendly AI assistant. The user asked: "${message}"

Tool output:
${toolOutput}

Respond conversationally in 1-2 sentences. Be direct and natural. NO emojis. NO markdown. Just plain friendly text.
If the output already contains good info, rephrase it naturally. Example:
- Instead of "Your Comsierge Number: +123" say "Your Comsierge number is +123"
- Instead of "Forwarding to: +456" say "and calls forward to +456"`;

      try {
        const humanized = await llm.invoke([new HumanMessage(humanizePrompt)]);
        return sanitizeAIResponse(humanized.content || toolOutput);
      } catch (humanizeError) {
        console.error("Humanize error:", humanizeError);
        return sanitizeAIResponse(toolOutput);
      }
    }
    
    return sanitizeAIResponse(response.content) || "I'm ready to help! You can ask me to call someone, send a message, create rules, search your messages, and more.";
    
  } catch (error) {
    console.error("Rules Agent Error:", error);
    return `I encountered an error: ${error.message}. Please try again.`;
  }
}