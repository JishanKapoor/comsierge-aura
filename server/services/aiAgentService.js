import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import mongoose from "mongoose";
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

// Parse natural language time to Date
function parseNaturalTime(timeStr, referenceDate = new Date()) {
  const now = referenceDate;
  const lower = timeStr.toLowerCase().trim();
  
  // Relative times
  if (lower.includes("in ")) {
    const match = lower.match(/in\s+(\d+)\s*(min|minute|hour|hr|day|week)/i);
    if (match) {
      const amount = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      const result = new Date(now);
      if (unit.startsWith("min")) result.setMinutes(result.getMinutes() + amount);
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

// Resolve contact by name or phone
async function resolveContact(userId, nameOrPhone) {
  if (!nameOrPhone) return null;
  
  // Try by name first (exact, then partial)
  let contact = await Contact.findOne({
    userId,
    name: { $regex: `^${nameOrPhone}$`, $options: "i" }
  });
  
  if (!contact) {
    contact = await Contact.findOne({
      userId,
      name: { $regex: nameOrPhone, $options: "i" }
    });
  }
  
  // Try by phone
  if (!contact) {
    const digits = nameOrPhone.replace(/\D/g, '');
    if (digits.length >= 7) {
      contact = await Contact.findOne({
        userId,
        phone: { $regex: digits.slice(-10) }
      });
    }
  }
  
  return contact;
}

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
        // Try exact match first
        let targetContact = await Contact.findOne({
          userId,
          name: { $regex: `^${targetName}$`, $options: "i" }
        });
        
        // If not found, try partial match
        if (!targetContact) {
           targetContact = await Contact.findOne({
            userId,
            name: { $regex: targetName, $options: "i" }
          });
        }
        
        if (targetContact) {
          resolvedPhone = targetContact.phone;
          resolvedName = targetContact.name; // Use exact name from DB
          console.log(`Found contact: ${resolvedName} - ${resolvedPhone}`);
        } else {
          console.log(`Contact "${targetName}" not found in database`);
          // If we can't find the contact, we can't create a forwarding rule effectively without a number.
          // But maybe the user meant to forward TO the current contact? No, "forward to jeremy".
          return `⚠️ I couldn't find a contact named "${targetName}" in your contacts. Please provide their phone number or save them as a contact first.`;
        }
      }
      
      // First, look up source contact's phone if not provided
      let resolvedSourcePhone = sourcePhone;
      let resolvedSourceName = sourceContact;
      
      if (!sourcePhone) {
        const srcContact = await Contact.findOne({
          userId,
          name: { $regex: sourceContact, $options: "i" }
        });
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
        const normalizedPhone = sourcePhone.replace(/\D/g, '');
        await Conversation.updateMany(
          { userId, contactPhone: { $regex: normalizedPhone } },
          { isBlocked: true }
        );
        console.log("Updated conversation isBlocked for phone:", normalizedPhone);
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
        const normalizedPhone = sourcePhone.replace(/\D/g, '');
        await Conversation.updateMany(
          { userId, contactPhone: { $regex: normalizedPhone } },
          { isBlocked: false }
        );
        console.log("Updated conversation isBlocked=false for phone:", normalizedPhone);
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
      
      // Find contact by name OR phone
      let contact = null;
      
      if (currentName) {
        contact = await Contact.findOne({ 
          userId, 
          name: { $regex: `^${currentName}$`, $options: "i" }
        });
        // Try partial match if exact didn't work
        if (!contact) {
          contact = await Contact.findOne({ 
            userId, 
            name: { $regex: currentName, $options: "i" }
          });
        }
      }
      
      if (!contact && currentPhone) {
        const normalizedPhone = currentPhone.replace(/\D/g, '');
        contact = await Contact.findOne({ 
          userId, 
          phone: { $regex: normalizedPhone } 
        });
      }

      if (!contact) {
        return `Could not find contact "${currentName || currentPhone}". Check the name and try again.`;
      }

      const oldName = contact.name;
      contact.name = newName;
      await contact.save();

      // Update Conversation model to reflect the new name immediately
      const normalizedPhone = contact.phone.replace(/\D/g, '');
      await Conversation.updateMany(
        { userId, contactPhone: { $regex: normalizedPhone } },
        { contactName: newName }
      );
      
      // Update Message contactName
      await Message.updateMany(
        { userId, contactPhone: { $regex: normalizedPhone } },
        { contactName: newName }
      );
      
      // Update transfer rules that reference this contact
      const Rule = (await import("../models/Rule.js")).default;
      await Rule.updateMany(
        { userId, "transferDetails.contactPhone": { $regex: normalizedPhone } },
        { $set: { "transferDetails.contactName": newName } }
      );
      await Rule.updateMany(
        { userId, "conditions.sourceContactPhone": { $regex: normalizedPhone } },
        { $set: { "conditions.sourceContactName": newName } }
      );

      return `Done. Renamed "${oldName}" to "${newName}".`;
    } catch (error) {
      console.error("Update contact error:", error);
      return `Error: ${error.message}`;
    }
  },
  {
    name: "update_contact",
    description: "Rename a contact. Use when user says: change name, rename, update contact, set name as, call them X. Example: 'change jk f to jk k' or 'rename John to Johnny'.",
    schema: z.object({
      userId: z.string().describe("User ID - REQUIRED"),
      currentName: z.string().optional().describe("Current name of contact to rename"),
      currentPhone: z.string().optional().describe("Phone number of contact to update (if name not provided)"),
      newName: z.string().describe("New name for the contact"),
    }),
  }
);

// Tool: Search Contacts
const searchContactsTool = tool(
  async ({ userId, query }) => {
    try {
      const contacts = await Contact.find({
        userId,
        $or: [
          { name: { $regex: query, $options: "i" } },
          { phone: { $regex: query.replace(/\D/g, '') } },
        ]
      }).limit(5);
      if (contacts.length === 0) return "No contacts found.";
      return contacts.map(c => `${c.name}: ${c.phone}`).join(", ");
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

// Tool: Search Messages
const searchMessagesTool = tool(
  async ({ userId, query, contactPhone }) => {
    try {
      console.log("Searching messages for:", query);
      
      // Build search criteria
      const searchRegex = new RegExp(query, "i");
      
      // Find conversations for this user
      let conversationFilter = { userId };
      if (contactPhone) {
        conversationFilter.contactPhone = contactPhone;
      }
      
      const conversations = await Conversation.find(conversationFilter).select('_id contactPhone contactName');
      const conversationIds = conversations.map(c => c._id);
      
      // Search messages - try by conversationId first
      let messages = await Message.find({
        conversationId: { $in: conversationIds },
        body: { $regex: searchRegex }
      }).sort({ createdAt: -1 }).limit(20);
      
      // Fallback: search by userId and contactPhone if no results
      if (messages.length === 0 && contactPhone) {
        const normalizedPhone = contactPhone.replace(/\D/g, '');
        messages = await Message.find({
          userId,
          contactPhone: { $regex: normalizedPhone },
          body: { $regex: searchRegex }
        }).sort({ createdAt: -1 }).limit(20);
      }
      
      if (messages.length === 0) {
        return `No messages found containing "${query}".`;
      }
      
      // Format results
      const results = messages.map(m => {
        const conv = conversations.find(c => c._id.toString() === m.conversationId?.toString());
        const contact = conv?.contactName || m.contactName || "Unknown";
        const date = new Date(m.createdAt).toLocaleDateString();
        return `[${date}] ${contact}: ${m.body}`;
      });
      
      return `Found ${messages.length} messages:\n${results.join("\n")}`;
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
      
      // Find conversations for this user
      let conversationFilter = { userId };
      if (contactPhone) {
        conversationFilter.contactPhone = contactPhone;
      }
      
      const conversations = await Conversation.find(conversationFilter).select('_id contactPhone contactName');
      const conversationIds = conversations.map(c => c._id);
      
      // Search messages in date range
      const messages = await Message.find({
        conversationId: { $in: conversationIds },
        timestamp: { $gte: start, $lte: end }
      }).sort({ timestamp: -1 }).limit(50);
      
      if (messages.length === 0) {
        return `No messages found between ${start.toLocaleDateString()} and ${end.toLocaleDateString()}.`;
      }
      
      // Format results
      const results = messages.map(m => {
        const conv = conversations.find(c => c._id.toString() === m.conversationId.toString());
        const contact = conv?.contactName || conv?.contactPhone || "Unknown";
        const date = new Date(m.timestamp).toLocaleDateString();
        const time = new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const direction = m.direction === 'outgoing' ? '→' : '←';
        return `[${date} ${time}] ${direction} ${contact}: ${m.content}`;
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
  async ({ userId }) => {
    try {
      console.log("Getting rules for user:", userId);
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
    description: "List all active rules for the user. Use when user asks 'what rules do I have', 'show my rules', 'list transfers'.",
    schema: z.object({
      userId: z.string().describe("User ID - REQUIRED"),
    }),
  }
);

// Tool: Delete Rule
const deleteRuleTool = tool(
  async ({ userId, ruleDescription }) => {
    try {
      console.log("Deleting rule:", { userId, ruleDescription });
      
      // Find and delete rule matching description
      const result = await Rule.findOneAndDelete({
        userId,
        rule: { $regex: ruleDescription, $options: "i" }
      });
      
      if (result) {
        return `Rule deleted: "${result.rule}"`;
      } else {
        return `Could not find a rule matching "${ruleDescription}". Use "show my rules" to see your active rules.`;
      }
    } catch (error) {
      console.error("Delete rule error:", error);
      return `Error deleting rule: ${error.message}`;
    }
  },
  {
    name: "delete_rule",
    description: "Delete a specific rule. Use when user says 'stop forwarding', 'remove rule', 'delete the auto-reply', 'cancel transfer'.",
    schema: z.object({
      userId: z.string().describe("User ID - REQUIRED"),
      ruleDescription: z.string().describe("Part of rule description to match"),
    }),
  }
);

// Tool: Summarize Conversation
const summarizeConversationTool = tool(
  async ({ userId, contactPhone, contactName }) => {
    try {
      console.log("Summarizing conversation:", { userId, contactPhone, contactName });
      
      // If we have a name but no phone, look up the contact first
      let resolvedPhone = contactPhone;
      let resolvedName = contactName;
      
      if (contactName && !contactPhone) {
        const contact = await Contact.findOne({
          userId,
          name: { $regex: contactName, $options: "i" }
        });
        if (contact) {
          resolvedPhone = contact.phone;
          resolvedName = contact.name;
          console.log("Found contact:", resolvedName, resolvedPhone);
        }
      }
      
      if (!resolvedPhone) {
        return `Could not find contact "${contactName}". Try using their exact name.`;
      }
      
      // Normalize phone for matching
      const phoneDigits = resolvedPhone.replace(/\D/g, '');
      const phoneRegex = new RegExp(phoneDigits.slice(-10));
      
      // Get messages directly by phone
      const messages = await Message.find({
        userId,
        contactPhone: { $regex: phoneRegex }
      }).sort({ createdAt: -1 }).limit(30);
      
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
      
      // Resolve contact phone if not provided
      let phone = contactPhone;
      let resolvedName = contactName;
      
      if (!phone && contactName) {
        // Convert userId to ObjectId for proper query
        const userObjectId = new mongoose.Types.ObjectId(userId);
        
        // First try Contacts collection
        let contact = await Contact.findOne({
          userId: userObjectId,
          name: { $regex: contactName, $options: "i" }
        });
        
        // If not found, also try by phone field having the name
        if (!contact) {
          contact = await Contact.findOne({
            userId: userObjectId,
            phone: { $regex: contactName, $options: "i" }
          });
        }
        
        if (contact && contact.phone) {
          phone = contact.phone;
          resolvedName = contact.name || contactName;
          console.log("Found in Contacts:", resolvedName, phone);
        } else {
          // Try Conversations collection
          const conversation = await Conversation.findOne({
            userId: userObjectId,
            contactName: { $regex: contactName, $options: "i" }
          });
          
          if (conversation && conversation.contactPhone) {
            phone = conversation.contactPhone;
            resolvedName = conversation.contactName || contactName;
            console.log("Found in Conversations:", resolvedName, phone);
          }
        }
        
        if (!phone) {
          return `⚠️ I couldn't find "${contactName}" in your contacts. Please provide their phone number.`;
        }
      }
      
      if (!phone) {
        return "⚠️ I need either a contact name or phone number to make a call.";
      }
      
      // Get user to find their assigned phone number
      const user = await User.findById(userId);
      if (!user?.phoneNumber) {
        return "⚠️ You don't have a phone number set up yet. Go to Settings to configure your Twilio number.";
      }
      
      // Return confirmation with call details - frontend will handle the actual call
      return JSON.stringify({
        action: "call",
        confirm: true,
        contactName: resolvedName || phone,
        contactPhone: phone,
        fromNumber: user.phoneNumber,
        message: `📞 Ready to call ${resolvedName || phone}. How would you like to call?\n\n1. **VoIP** - Call through the app\n2. **SIP** - Call via your desk phone\n3. **Callback** - Have me call your phone first, then connect`
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
        // Convert userId to ObjectId
        const userObjectId = new mongoose.Types.ObjectId(userId);
        
        // Try Contacts first
        let contact = await Contact.findOne({
          userId: userObjectId,
          name: { $regex: contactName, $options: "i" }
        });
        
        if (contact && contact.phone) {
          phone = contact.phone;
          name = contact.name || contactName;
        } else {
          // Try Conversations
          const conversation = await Conversation.findOne({
            userId: userObjectId,
            contactName: { $regex: contactName, $options: "i" }
          });
          
          if (conversation && conversation.contactPhone) {
            phone = conversation.contactPhone;
            name = conversation.contactName || contactName;
          }
        }
        
        if (!phone) {
          return `⚠️ I couldn't find "${contactName}" in your contacts. Please provide their phone number.`;
        }
      }
      
      if (!phone) {
        return "⚠️ I need either a contact name or phone number to send a message.";
      }
      
      if (!messageText) {
        return `📝 What would you like to say to ${name || phone}?`;
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

// Tool: Create Reminder
const createReminderTool = tool(
  async ({ userId, title, when, contactName, contactPhone, type, description }) => {
    try {
      console.log("Creating reminder:", { userId, title, when, contactName });
      
      // Parse the time
      const scheduledAt = parseNaturalTime(when);
      if (!scheduledAt) {
        return `Could not understand the time "${when}". Try "in 30 minutes", "tomorrow at 3pm", or "Monday 9am".`;
      }
      
      // Resolve contact if provided
      let resolvedContact = null;
      let resolvedPhone = contactPhone;
      let resolvedName = contactName;
      
      if (contactName && !contactPhone) {
        resolvedContact = await resolveContact(userId, contactName);
        if (resolvedContact) {
          resolvedPhone = resolvedContact.phone;
          resolvedName = resolvedContact.name;
        }
      }
      
      const reminder = await Reminder.create({
        userId,
        title,
        description: description || null,
        type: type || "personal",
        scheduledAt,
        contactPhone: resolvedPhone || null,
        contactName: resolvedName || null,
      });
      
      const timeStr = scheduledAt.toLocaleString("en-US", { 
        weekday: "short", month: "short", day: "numeric", 
        hour: "numeric", minute: "2-digit" 
      });
      
      return `Done. Reminder set for ${timeStr}: "${title}"${resolvedName ? ` (re: ${resolvedName})` : ""}`;
    } catch (error) {
      console.error("Create reminder error:", error);
      return `Error creating reminder: ${error.message}`;
    }
  },
  {
    name: "create_reminder",
    description: "Create a reminder. Use for: 'remind me to...', 'set a reminder', 'don't let me forget', 'follow up with X in 30 min'",
    schema: z.object({
      userId: z.string().describe("User ID"),
      title: z.string().describe("What to remind about"),
      when: z.string().describe("When to remind - e.g. 'in 30 minutes', 'tomorrow 3pm', 'Monday 9am'"),
      contactName: z.string().optional().describe("Related contact name if any"),
      contactPhone: z.string().optional().describe("Related contact phone if any"),
      type: z.enum(["personal", "call", "message"]).optional().describe("Reminder type"),
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
      const reminder = await Reminder.findOne({
        userId,
        title: { $regex: reminderTitle, $options: "i" },
        isCompleted: false
      });
      
      if (!reminder) {
        return `Could not find reminder matching "${reminderTitle}".`;
      }
      
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
      
      // Resolve contact
      let phone = contactPhone;
      if (contactName && !contactPhone) {
        const contact = await resolveContact(userId, contactName);
        if (contact) phone = contact.phone;
      }
      
      // Get recent messages
      let query = { userId };
      if (phone) {
        const digits = phone.replace(/\D/g, '');
        query.contactPhone = { $regex: digits.slice(-10) };
      }
      
      const messages = await Message.find(query)
        .sort({ createdAt: -1 })
        .limit(50);
      
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

// Tool: Create Smart Rule from Natural Language
const createSmartRuleTool = tool(
  async ({ userId, ruleDescription }) => {
    try {
      console.log("Creating smart rule:", { userId, ruleDescription });
      
      // Use LLM to parse the rule intent
      const parseResponse = await llm.invoke([
        new SystemMessage(`Parse this rule request and return JSON with:
{
  "type": "transfer" | "auto-reply" | "block" | "priority" | "hold",
  "sourceKeyword": "keyword to match in messages (if any)",
  "sourceContactName": "specific contact name (if mentioned)",
  "targetContactName": "contact to forward to (for transfer rules)",
  "mode": "calls" | "messages" | "both",
  "autoReplyMessage": "message text (for auto-reply)",
  "schedule": { "startTime": "HH:MM", "endTime": "HH:MM", "days": ["Monday"...] } or null,
  "priority": "all" | "high-priority",
  "summary": "brief description of what this rule does"
}
Only return valid JSON, nothing else.`),
        new HumanMessage(ruleDescription)
      ]);
      
      let parsed;
      try {
        parsed = JSON.parse(parseResponse.content);
      } catch (e) {
        return `Could not understand the rule. Try being more specific, like "forward bank messages to John" or "auto-reply to work contacts after 6pm".`;
      }
      
      // Resolve target contact for transfer rules
      let targetPhone = null;
      let targetName = parsed.targetContactName;
      if (parsed.type === "transfer" && targetName) {
        const target = await resolveContact(userId, targetName);
        if (target) {
          targetPhone = target.phone;
          targetName = target.name;
        } else {
          return `Could not find contact "${targetName}". Save them as a contact first.`;
        }
      }
      
      // Resolve source contact if specified
      let sourcePhone = null;
      let sourceName = parsed.sourceContactName;
      if (sourceName) {
        const source = await resolveContact(userId, sourceName);
        if (source) {
          sourcePhone = source.phone;
          sourceName = source.name;
        }
      }
      
      // Create the rule
      const rule = await Rule.create({
        userId,
        rule: parsed.summary || ruleDescription,
        type: parsed.type,
        active: true,
        conditions: {
          keyword: parsed.sourceKeyword || null,
          sourceContactPhone: sourcePhone,
          sourceContactName: sourceName,
          schedule: parsed.schedule,
        },
        transferDetails: parsed.type === "transfer" ? {
          mode: parsed.mode || "both",
          priority: parsed.priority || "all",
          contactName: targetName,
          contactPhone: targetPhone,
        } : parsed.type === "auto-reply" ? {
          autoReplyMessage: parsed.autoReplyMessage,
          sourceContact: sourceName,
          sourcePhone: sourcePhone,
        } : null,
      });
      
      return `Done. Created rule: "${parsed.summary || ruleDescription}"`;
    } catch (error) {
      console.error("Smart rule error:", error);
      return `Error creating rule: ${error.message}`;
    }
  },
  {
    name: "create_smart_rule",
    description: "Create any type of rule from natural language. Use for complex rules like: 'forward bank messages to accountant', 'hold spam messages', 'auto-reply after 6pm', 'block messages with crypto'",
    schema: z.object({
      userId: z.string().describe("User ID"),
      ruleDescription: z.string().describe("Natural language description of the rule"),
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
      // Resolve contact
      let phone = contactPhone;
      let name = contactName;
      if (contactName && !contactPhone) {
        const contact = await resolveContact(userId, contactName);
        if (contact) {
          phone = contact.phone;
          name = contact.name;
        }
      }
      
      if (!phone) {
        return `Could not find contact "${contactName}".`;
      }
      
      const digits = phone.replace(/\D/g, '');
      const messages = await Message.find({
        userId,
        contactPhone: { $regex: digits.slice(-10) }
      }).sort({ createdAt: -1 }).limit(50);
      
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
      // Resolve contact
      let phone = contactPhone;
      let name = contactName;
      if (contactName && !contactPhone) {
        const contact = await resolveContact(userId, contactName);
        if (contact) {
          phone = contact.phone;
          name = contact.name;
        }
      }
      
      if (!phone) {
        return `Could not find contact "${contactName}".`;
      }
      
      const digits = phone.replace(/\D/g, '');
      const messages = await Message.find({
        userId,
        contactPhone: { $regex: digits.slice(-10) }
      }).sort({ createdAt: -1 }).limit(10);
      
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
  confirmActionTool,
  // Contacts
  listContactsTool,
  searchContactsTool,
  updateContactTool,
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
];

const fullAgentToolMap = {
  make_call: makeCallTool,
  send_message: sendMessageTool,
  confirm_action: confirmActionTool,
  list_contacts: listContactsTool,
  search_contacts: searchContactsTool,
  update_contact: updateContactTool,
  block_contact: blockContactTool,
  unblock_contact: unblockContactTool,
  create_transfer_rule: createTransferRuleTool,
  create_auto_reply: createAutoReplyTool,
  mark_priority: markPriorityTool,
  get_rules: getRulesTool,
  delete_rule: deleteRuleTool,
  create_smart_rule: createSmartRuleTool,
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
    
    const systemPrompt = `You are Aura, a powerful AI assistant for Comsierge SMS/call management.

CRITICAL FORMATTING RULES:
- NEVER use emojis
- NEVER use markdown (no **, no ##, no *)
- Use plain text only
- Be concise and direct

TOOLS BY CATEGORY:

CONTACTS:
- list_contacts: Show all contacts
- search_contacts: Find contact by name
- update_contact: Rename contact (currentName + newName)
- block_contact / unblock_contact: Block/unblock

RULES & AUTOMATION:
- create_transfer_rule: Forward calls/messages (must specify source contact)
- create_auto_reply: Set auto-reply message
- mark_priority: Mark as high priority
- get_rules: List active rules  
- delete_rule: Remove a rule
- create_smart_rule: Natural language rule creation (e.g. "forward bank messages to my accountant")

MESSAGES & ANALYSIS:
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

ACTIONS:
- make_call: Call someone
- send_message: Send SMS

CHOOSING THE RIGHT TOOL - EXAMPLES:
- "do I have any meetings" -> search_messages with query="meeting"
- "any emergency messages" -> search_messages with query="emergency"
- "summarize my chats from jk" -> summarize_conversation with contactName="jk"
- "what did jk say" -> summarize_conversation with contactName="jk"
- "change jk to john" -> update_contact with currentName="jk", newName="john"
- "forward calls from jk to bob" -> create_transfer_rule
- "remind me to call mom in 30 min" -> create_reminder
- "forward bank messages to accountant" -> create_smart_rule
- "what did I miss" -> get_unread_summary
- "analyze my chat with john" -> analyze_conversation
- "what should I say to sarah" -> suggest_reply
- "any appointments from yesterday" -> extract_events OR search_messages_by_date

Be direct. Execute tools immediately. No confirmation needed for read operations.
For complex rules described in natural language, use create_smart_rule.
Always resolve contacts by name when user provides a name.

User ID: ${userId}`;

    const messages = [
      new SystemMessage(systemPrompt),
      ...chatHistory.map(h => h.role === "user" ? new HumanMessage(h.text) : new SystemMessage(h.text)),
      new HumanMessage(message)
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
      
      return results.join("\n\n");
    }
    
    return response.content || "I'm ready to help! You can ask me to call someone, send a message, create rules, search your messages, and more.";
    
  } catch (error) {
    console.error("Rules Agent Error:", error);
    return `I encountered an error: ${error.message}. Please try again.`;
  }
}