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
import User from "../models/User.js";
import TwilioAccount from "../models/TwilioAccount.js";

// Initialize OpenAI with GPT-5.2 for complex analysis
const llm = new ChatOpenAI({
  modelName: "gpt-5.2",
  temperature: 0.2,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// ==================== HELPER FUNCTIONS ====================

// Normalize phone number to E.164 format
function normalizePhoneForSms(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  if (digits.length > 10) return '+' + digits;
  return phone;
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
      console.log("Creating transfer rule:", { userId, targetName, sourceContact, mode });
      
      // Look up target contact in database to get their phone number
      let resolvedPhone = targetPhone;
      let resolvedName = targetName;
      
      if (!targetPhone || targetPhone === "TBD") {
        // Use AI to find the contact
        const targetContact = await resolveContactWithAI(userId, targetName);
        
        if (targetContact) {
          resolvedPhone = targetContact.phone;
          resolvedName = targetContact.name; // Use exact name from DB
          console.log(`Found contact: ${resolvedName} - ${resolvedPhone}`);
        } else {
          console.log(`Contact "${targetName}" not found in database`);
          // If we can't find the contact, we can't create a forwarding rule effectively without a number.
          // But maybe the user meant to forward TO the current contact? No, "forward to jeremy".
          return `I couldn't find a contact named "${targetName}" in your contacts. Please provide their phone number or save them as a contact first.`;
        }
      }
      
      // First, look up source contact's phone if not provided
      let resolvedSourcePhone = sourcePhone;
      let resolvedSourceName = sourceContact;
      
      if (!sourcePhone && sourceContact) {
        const srcContact = await resolveContactWithAI(userId, sourceContact);
        if (srcContact) {
          resolvedSourcePhone = srcContact.phone;
          resolvedSourceName = srcContact.name;
        }
      }
      
      const newRule = await Rule.create({
        userId,
        rule: `Forward ${mode || "both"} from ${resolvedSourceName} to ${resolvedName}`,
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
      return `Done. Created rule to forward ${mode || "all communications"} from ${resolvedSourceName} to ${resolvedName} (${resolvedPhone}).`;
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
      
      // Create a block rule
      await Rule.create({
        userId,
        rule: `Block ${sourceContact}${reason ? `: ${reason}` : ""}`,
        type: "block",
        active: true,
        transferDetails: { sourceContact, sourcePhone }
      });

      // Also set isBlocked on the conversation so it takes effect immediately
      if (sourcePhone) {
        const normalizedPhone = sourcePhone.replace(/\D/g, '').slice(-10);
        // Find all conversations and use AI to match phone numbers
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
      }

      return `Done. Blocked ${sourceContact}. They won't be able to reach you.`;
    } catch (error) {
      console.error("Block error:", error);
      return `Error: ${error.message}`;
    }
  },
  {
    name: "block_contact",
    description: "Block current contact from messaging/calling. Use when user says: block, mute, ignore, stop messages.",
    schema: z.object({
      userId: z.string().describe("User ID - REQUIRED"),
      sourceContact: z.string().describe("Contact to block"),
      sourcePhone: z.string().optional().describe("Contact phone"),
      reason: z.string().optional().describe("Reason for blocking"),
    }),
  }
);

// Tool: Unblock Contact
const unblockContactTool = tool(
  async ({ userId, sourceContact, sourcePhone }) => {
    try {
      console.log("Unblocking contact:", { userId, sourceContact, sourcePhone });
      
      // Delete block rules for this contact
      await Rule.deleteMany({
        userId,
        type: "block",
        $or: [
          { "transferDetails.sourceContact": sourceContact },
          { "transferDetails.sourcePhone": sourcePhone }
        ]
      });

      // Set isBlocked to false on the conversation
      if (sourcePhone) {
        const normalizedPhone = sourcePhone.replace(/\D/g, '').slice(-10);
        // Find all conversations and match phone numbers directly
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
      }

      return `Done. Unblocked ${sourceContact}. They can now message you again.`;
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
      sourceContact: z.string().describe("Contact to unblock"),
      sourcePhone: z.string().optional().describe("Contact phone"),
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

// Tool: Add Contact
const addContactTool = tool(
  async ({ userId, name, phone, label }) => {
    try {
      console.log("Adding contact:", { userId, name, phone, label });
      
      // Validate phone number - must be at least 10 digits
      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length < 10) {
        return `Invalid phone number "${phone}". Please provide a valid phone number with at least 10 digits.`;
      }
      
      // Normalize phone number
      let normalized = cleanPhone;
      if (normalized.length === 10) {
        normalized = '1' + normalized;
      }
      if (!normalized.startsWith('+')) {
        normalized = '+' + normalized;
      }
      
      // Check if contact with same phone already exists
      const existingContacts = await Contact.find({ userId });
      const phoneDigits = normalized.replace(/\D/g, '').slice(-10);
      const duplicate = existingContacts.find(c => {
        const cDigits = (c.phone || '').replace(/\D/g, '').slice(-10);
        return cDigits === phoneDigits;
      });
      
      if (duplicate) {
        return `A contact with this number already exists: "${duplicate.name}" (${duplicate.phone}). Use update_contact to rename them.`;
      }
      
      // Create the contact
      const contact = await Contact.create({
        userId,
        name: name.trim(),
        phone: normalized,
        label: label || null,
      });
      
      return `Contact added: "${contact.name}" (${contact.phone})${label ? ` with label "${label}"` : ''}.`;
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
      phone: z.string().describe("Phone number (must be at least 10 digits)"),
      label: z.string().optional().describe("Optional label like 'work', 'family', 'friend', etc."),
    }),
  }
);

// Tool: Delete Contact
const deleteContactTool = tool(
  async ({ userId, contactName }) => {
    try {
      console.log("Deleting contact:", { userId, contactName });
      
      // Find contact using AI matching
      const contact = await resolveContactWithAI(userId, contactName);
      
      if (!contact) {
        return `Could not find contact "${contactName}". Check the name and try again.`;
      }
      
      const deletedName = contact.name;
      const deletedPhone = contact.phone;
      
      await Contact.deleteOne({ _id: contact._id });
      
      return `Contact deleted: "${deletedName}" (${deletedPhone}).`;
    } catch (error) {
      console.error("Delete contact error:", error);
      return `Error deleting contact: ${error.message}`;
    }
  },
  {
    name: "delete_contact",
    description: "Delete a contact by name. Use when user says: delete contact, remove contact, get rid of contact.",
    schema: z.object({
      userId: z.string().describe("User ID - REQUIRED"),
      contactName: z.string().describe("Name of the contact to delete"),
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
      
      // Parse dates
      const start = new Date(startDate);
      const end = endDate ? new Date(endDate) : new Date();
      end.setHours(23, 59, 59, 999); // End of day
      
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
    description: "Search messages within a date range. Use when user asks 'what did we talk about on January 1', 'show messages from last week', 'summarize conversations from March'.",
    schema: z.object({
      userId: z.string().describe("User ID - REQUIRED"),
      startDate: z.string().describe("Start date in ISO format or natural language (e.g., 2024-01-01, January 1 2024)"),
      endDate: z.string().optional().describe("End date - defaults to today"),
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
  async ({ userId, contactPhone, contactName }) => {
    try {
      console.log("Summarizing conversation:", { userId, contactPhone, contactName });
      
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
      
      // Get messages using phone digit matching
      const phoneDigits = resolvedPhone.replace(/\D/g, '').slice(-10);
      
      const allMessages = await Message.find({ userId }).sort({ createdAt: -1 }).limit(500);
      const messages = allMessages.filter(m => 
        m.contactPhone && m.contactPhone.replace(/\D/g, '').includes(phoneDigits)
      ).slice(0, 30);
      
      if (messages.length === 0) {
        return `No messages found with ${resolvedName || resolvedPhone}.`;
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
      
      return `Summary with ${resolvedName || resolvedPhone}:\n${summaryResponse.content}`;
    } catch (error) {
      console.error("Summarize conversation error:", error);
      return `Error summarizing: ${error.message}`;
    }
  },
  {
    name: "summarize_conversation",
    description: "Summarize chat history with a contact. Use for: 'summarize my chats from X', 'what did X and I talk about', 'summary with X'.",
    schema: z.object({
      userId: z.string().describe("User ID - REQUIRED"),
      contactPhone: z.string().optional().describe("Phone of contact"),
      contactName: z.string().optional().describe("Name of contact to summarize chats with"),
    }),
  }
);

// All conversation tools
const conversationTools = [
  createTransferRuleTool,
  createAutoReplyTool,
  blockContactTool,
  unblockContactTool,
  updateContactTool,
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
  update_contact: updateContactTool,
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
      
      return finalResponse.content || toolResultsText;
    }
    
    // No tool calls - return text response
    return response.content || "I understood your request but couldn't determine the appropriate action.";
    
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
        
        // Update conversation
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
      
      // Normalize the phone number
      let normalized = newForwardingNumber.replace(/\D/g, '');
      if (normalized.length === 10) normalized = '1' + normalized;
      if (!normalized.startsWith('+')) normalized = '+' + normalized;
      
      // Update user's forwarding number
      const user = await User.findByIdAndUpdate(
        userId,
        { forwardingNumber: normalized },
        { new: true }
      );
      
      if (!user) {
        return "User not found.";
      }
      
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

// Tool: Set Do Not Disturb (Comsierge DND)
const setDNDTool = tool(
  async ({ userId, enabled, autoReplyMessage, startTime, endTime }) => {
    try {
      console.log("Setting DND:", { userId, enabled, autoReplyMessage, startTime, endTime });
      
      if (!enabled) {
        // Disable DND - delete any DND rules
        await Rule.deleteMany({ 
          userId, 
          type: "auto-reply",
          rule: { $regex: /do not disturb|dnd/i }
        });
        return "Do Not Disturb has been turned off. You'll receive all notifications normally.";
      }
      
      // Create DND auto-reply rule
      const dndMessage = autoReplyMessage || "I'm currently unavailable. I'll get back to you as soon as possible.";
      
      const ruleDesc = startTime && endTime 
        ? `Do Not Disturb auto-reply from ${startTime} to ${endTime}`
        : "Do Not Disturb - auto-reply to all messages";
      
      await Rule.create({
        userId,
        type: "auto-reply",
        rule: ruleDesc,
        active: true,
        autoReplyDetails: {
          message: dndMessage,
          startTime: startTime || null,
          endTime: endTime || null,
          allContacts: true
        }
      });
      
      const timeInfo = startTime && endTime ? ` from ${startTime} to ${endTime}` : "";
      return `Do Not Disturb is now ON${timeInfo}. Auto-reply message: "${dndMessage}"`;
    } catch (error) {
      console.error("Set DND error:", error);
      return `Error setting DND: ${error.message}`;
    }
  },
  {
    name: "set_dnd",
    description: "Set Comsierge Do Not Disturb mode. Creates auto-reply for all contacts. Use when user says: 'do not disturb', 'DND', 'turn on dnd', 'mute notifications'",
    schema: z.object({
      userId: z.string().describe("User ID"),
      enabled: z.boolean().describe("true to enable DND, false to disable"),
      autoReplyMessage: z.string().optional().describe("Custom auto-reply message during DND"),
      startTime: z.string().optional().describe("Start time for scheduled DND (e.g. '10pm', '22:00')"),
      endTime: z.string().optional().describe("End time for scheduled DND (e.g. '7am', '07:00')"),
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
      
      const reminder = await Reminder.create({
        userId,
        title,
        description: description || null,
        type: reminderType,
        scheduledAt,
        contactPhone: resolvedPhone || null,
        contactName: resolvedName || null,
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
      } else if (diffMin < 1440) { // Less than 24 hours
        const hours = Math.floor(diffMin / 60);
        const mins = diffMin % 60;
        timeStr = `in ${hours} hour${hours > 1 ? 's' : ''}${mins > 0 ? ` ${mins} min` : ''}`;
      } else {
        timeStr = scheduledAt.toLocaleString("en-US", { 
          weekday: "short", month: "short", day: "numeric", 
          hour: "numeric", minute: "2-digit"
        });
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

// Tool: List Reminders
const listRemindersTool = tool(
  async ({ userId, filter }) => {
    try {
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
        const time = new Date(r.scheduledAt).toLocaleString("en-US", {
          weekday: "short", month: "short", day: "numeric",
          hour: "numeric", minute: "2-digit"
        });
        const status = r.isCompleted ? "[done]" : "";
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
  async ({ userId, contactName, contactPhone }) => {
    try {
      console.log("Extracting events from messages:", { userId, contactName });
      
      // Resolve contact using AI
      let phone = contactPhone;
      if (contactName && !contactPhone) {
        const contact = await resolveContactWithAI(userId, contactName);
        if (contact) phone = contact.phone;
      }
      
      // Get recent messages
      let messages = await Message.find({ userId })
        .sort({ createdAt: -1 })
        .limit(200);
      
      // Filter by phone if provided
      if (phone && messages.length > 0) {
        const digits = phone.replace(/\D/g, '').slice(-10);
        messages = messages.filter(m => {
          const msgDigits = (m.contactPhone || '').replace(/\D/g, '').slice(-10);
          return msgDigits === digits;
        });
      }
      
      messages = messages.slice(0, 50);
      
      if (messages.length === 0) {
        return "No messages found to analyze.";
      }
      
      // Build message text for analysis
      const msgText = messages.map(m => m.body).join("\n---\n");
      
      // Use LLM to extract events
      const response = await llm.invoke([
        new SystemMessage(`Extract any dates, meetings, appointments, deadlines, or commitments from these messages. Format each as:
- [DATE/TIME] Event description (from: sender)

If no events found, say "No events or appointments found."
Do NOT use emojis. Do NOT use markdown. Plain text only.`),
        new HumanMessage(msgText)
      ]);
      
      return response.content;
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
3. If they mention keywords (about bank, mentions money) - add to keywords array
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
      
      // Create the rule
      const rule = await Rule.create({
        userId,
        rule: parsed.summary || ruleDescription,
        type: parsed.type === "forward" ? "transfer" : parsed.type,
        active: true,
        conditions,
        actions: { exclusions },
        transferDetails: parsed.type === "forward" || parsed.type === "transfer" ? transferDetails : 
                        parsed.type === "auto_reply" ? { autoReplyMessage: parsed.action?.auto_reply_message } : null,
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
- Basic: "Forward bank messages to my accountant", "Mute spam", "Block unknown numbers"
- Time-based: "Forward to Alex during work hours", "Auto-reply after 6pm", "Mute after 9pm"  
- Multi-condition: "Forward bank messages except from family", "Forward urgent client messages about payments"
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
      
      // Get upcoming reminders (next 24 hours)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const upcomingReminders = await Reminder.find({
        userId,
        isCompleted: false,
        scheduledAt: { $gte: new Date(), $lte: tomorrow }
      }).sort({ scheduledAt: 1 }).limit(5);
      
      let response = `You have ${unreadConvs.length} conversation(s) with unread messages:\n${summaries.join("\n")}`;
      
      if (upcomingReminders.length > 0) {
        const reminderList = upcomingReminders.map(r => {
          const time = new Date(r.scheduledAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
          return `- ${time}: ${r.title}`;
        }).join("\n");
        response += `\n\nUpcoming reminders:\n${reminderList}`;
      }
      
      return response;
    } catch (error) {
      return `Error: ${error.message}`;
    }
  },
  {
    name: "get_unread_summary",
    description: "Get summary of unread messages and upcoming reminders. Use for: 'what did I miss', 'any new messages', 'catch me up', 'updates'",
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
      
      return `Analysis of conversation with ${name || phone}:\n${response.content}`;
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
      
      return `Reply suggestions for ${name || phone}:\n${response.content}`;
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
  searchContactsTool,
  addContactTool,
  updateContactTool,
  deleteContactTool,
  blockContactTool,
  unblockContactTool,
  // Rules
  createTransferRuleTool,
  createAutoReplyTool,
  markPriorityTool,
  getRulesTool,
  deleteRuleTool,
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
  // Reminders
  createReminderTool,
  listRemindersTool,
  completeReminderTool,
  // Proactive
  getUnreadSummaryTool,
  // Info
  getPhoneInfoTool,
  updateForwardingNumberTool,
  // Support
  createSupportTicketTool,
  listSupportTicketsTool,
  // DND
  setDNDTool,
];

const fullAgentToolMap = {
  make_call: makeCallTool,
  send_message: sendMessageTool,
  execute_send_message: executeSendMessageTool,
  confirm_action: confirmActionTool,
  list_contacts: listContactsTool,
  search_contacts: searchContactsTool,
  add_contact: addContactTool,
  update_contact: updateContactTool,
  delete_contact: deleteContactTool,
  block_contact: blockContactTool,
  unblock_contact: unblockContactTool,
  create_transfer_rule: createTransferRuleTool,
  create_auto_reply: createAutoReplyTool,
  mark_priority: markPriorityTool,
  get_rules: getRulesTool,
  delete_rule: deleteRuleTool,
  create_smart_rule: createSmartRuleTool,
  get_last_message: getLastMessageTool,
  get_last_incoming_message: getLastIncomingMessageTool,
  search_messages: searchMessagesTool,
  search_messages_by_date: searchMessagesByDateTool,
  summarize_conversation: summarizeConversationTool,
  analyze_conversation: analyzeConversationTool,
  suggest_reply: suggestReplyTool,
  extract_events: extractEventsTool,
  create_reminder: createReminderTool,
  list_reminders: listRemindersTool,
  complete_reminder: completeReminderTool,
  get_unread_summary: getUnreadSummaryTool,
  get_phone_info: getPhoneInfoTool,
  update_forwarding_number: updateForwardingNumberTool,
  create_support_ticket: createSupportTicketTool,
  list_support_tickets: listSupportTicketsTool,
  set_dnd: setDNDTool,
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
    
    // Check for pending clarification in chat history
    let pendingClarification = null;
    for (let i = chatHistory.length - 1; i >= 0; i--) {
      const msg = chatHistory[i];
      if (msg.role === "assistant" && msg.text && msg.text.startsWith("CLARIFICATION_NEEDED|")) {
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
      if (msg.role === "assistant" && msg.text && (
        msg.text.includes("Who should these messages be forwarded to?") ||
        msg.text.includes("Which contact should receive") ||
        msg.text.includes("Please provide a contact name or phone")
      )) {
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
- The product name is "Comsierge" (NOT "concierge", NOT "Concierge") - always spell it correctly
- NEVER use emojis
- NEVER use markdown (no **, no ##, no *)
- Use plain text only
- Be concise and direct
- ABSOLUTELY NEVER mention iPhone, Android, iOS, device settings, or suggest the user go to their phone settings
- This is Comsierge - a standalone cloud phone service. All features are built-in.
- When user says "do not disturb" or "DND", use set_dnd tool - do NOT tell them about phone settings
- For support tickets: ALWAYS ask clarifying questions first before creating the ticket
- If a feature isn't available, say "That's not available in Comsierge yet" - never suggest external solutions
- "routing number" ALWAYS means phone forwarding number (where calls/SMS route to), NEVER bank routing number
- EVERYTHING is in context of Comsierge phone service - never interpret anything as banking, external apps, or other services

TOOLS BY CATEGORY:

CONTACTS:
- list_contacts: Show all contacts
- search_contacts: Find contact by name
- add_contact: Add a new contact (name + phone number required)
- update_contact: Rename contact (currentName + newName) - can change name/label but NEVER the phone number
- delete_contact: Delete a contact by name
- block_contact / unblock_contact: Block/unblock

RULES & AUTOMATION:
- create_transfer_rule: Forward calls/messages from a specific contact to another
- create_auto_reply: Set auto-reply message
- mark_priority: Mark as high priority
- get_rules: List rules (use includeInactive=true for inactive/disabled rules)
- delete_rule: Remove/disable/turn off a rule (supports matching by description, type, or contact)
- create_smart_rule: Natural language rule creation for complex rules like:
  * "if I receive a message about X, forward to Y"
  * "forward messages containing 'urgent' to my assistant"
  * "if Mark calls and I don't answer, forward to John"
  * Time-based: "auto-reply after 6pm"

MESSAGES & ANALYSIS:
- get_last_message: Get the most recent message with a contact
- search_messages: Search ALL messages for keywords
- search_messages_by_date: Search messages in date range
- summarize_conversation: Summarize chat with a specific contact
- analyze_conversation: Analyze sentiment, topics, patterns with a contact
- suggest_reply: Get reply suggestions for a conversation
- extract_events: Find events, dates, appointments from messages

REMINDERS:
- create_reminder: Set reminder (supports "in 30 min", "tomorrow 3pm", "monday 9am")
- list_reminders: View upcoming reminders
- complete_reminder: Mark done or delete reminder

PROACTIVE:
- get_unread_summary: Get briefing on unread messages + upcoming reminders

PHONE SETTINGS:
- get_phone_info: Get user's Comsierge number and current forwarding number
- update_forwarding_number: Change where calls/messages forward to (use this when user says "change my forwarding number to X" or "forward to X number")

SUPPORT:
- create_support_ticket: Create a support ticket - BUT FIRST ask: 1) What exactly is happening? 2) When did it start? 3) Any error messages? Only create after getting details.
- list_support_tickets: Show user's support tickets (use when user says "show my tickets", "my support tickets", "ticket status")

DND (DO NOT DISTURB):
- set_dnd: Turn on/off Comsierge Do Not Disturb (auto-reply to all contacts). Use when user says "do not disturb", "DND", "turn on dnd"

ACTIONS:
- make_call: Call someone (if user says "call me", first get_phone_info to get their forwarding number, then call that)
- send_message: Prepare to send SMS (shows confirmation first)
- execute_send_message: Actually send the SMS after user confirms with "yes"

SPECIAL CASES:
- "call me" = call the user's forwarding number (use get_phone_info first to find it)
- "text me" = send SMS to the user's forwarding number

CONFIRMATION FLOW FOR SENDING MESSAGES:
1. User says "send hey to John" -> use send_message tool -> shows "Ready to send... Reply yes to send"
2. User says "yes" -> use execute_send_message tool with the contact and message

IMPORTANT FOR RULE DELETION:
- "turn that off" or "disable it" after showing a rule -> use delete_rule
- Can match by: rule description text, rule type (transfer/block/auto-reply), or contact name involved

CHOOSING THE RIGHT TOOL - EXAMPLES:
- "do I have any meetings" -> search_messages with query="meeting"
- "any emergency messages" -> search_messages with query="emergency"
- "summarize my chats from jk" -> summarize_conversation with contactName="jk"
- "what did jk say" -> summarize_conversation with contactName="jk"
- "show me the last message from jk" -> get_last_message with contactName="jk"
- "change jk to john" -> update_contact with currentName="jk", newName="john"
- "forward calls from jk to bob" -> create_transfer_rule
- "remind me to call mom in 30 min" -> create_reminder
- "forward messages about baig to jeremy" -> create_smart_rule
- "if mark texts me, notify jeremy" -> create_smart_rule  
- "what did I miss" -> get_unread_summary
- "analyze my chat with john" -> analyze_conversation
- "what should I say to sarah" -> suggest_reply
- "turn that off" or "disable the transfer rule" -> delete_rule
- "yes" after "Ready to send..." -> execute_send_message
- "change my forwarding number to 555-1234" -> update_forwarding_number
- "what number are calls forwarded to" -> get_phone_info
- "what is my comsierge number" -> get_phone_info
- "show me my routing number" -> get_phone_info (routing = forwarding in this phone context)
- "where do my calls go" -> get_phone_info
- "show my inactive rules" -> get_rules with includeInactive=true
- "disabled rules" -> get_rules with includeInactive=true

IMPORTANT CONTEXT: This is a PHONE/SMS management app. When user says "routing number" they mean their PHONE forwarding/routing number, NOT a bank routing number. Use get_phone_info for any routing/forwarding questions.

Be direct. Execute tools immediately. No confirmation needed for read operations.
For complex rules described in natural language, use create_smart_rule.
Always resolve contacts by name when user provides a name.

User ID: ${userId}`;

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
      
      for (const toolCall of response.tool_calls) {
        console.log(`Executing tool: ${toolCall.name}`, toolCall.args);
        
        // Auto-inject userId
        const args = { ...toolCall.args, userId };
        
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
        return humanized.content || toolOutput;
      } catch (humanizeError) {
        console.error("Humanize error:", humanizeError);
        return toolOutput;
      }
    }
    
    return response.content || "I'm ready to help! You can ask me to call someone, send a message, create rules, search your messages, and more.";
    
  } catch (error) {
    console.error("Rules Agent Error:", error);
    return `I encountered an error: ${error.message}. Please try again.`;
  }
}