import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import Rule from "../models/Rule.js";
import Contact from "../models/Contact.js";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";

// Initialize OpenAI with GPT-4o (GPT-5.2 compatible)
const llm = new ChatOpenAI({
  modelName: "gpt-4o",
  temperature: 0.3,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

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
        const targetContact = await Contact.findOne({
          userId,
          name: { $regex: targetName, $options: "i" }
        });
        
        if (targetContact) {
          resolvedPhone = targetContact.phone;
          resolvedName = targetContact.name; // Use exact name from DB
          console.log(`Found contact: ${resolvedName} - ${resolvedPhone}`);
        } else {
          console.log(`Contact "${targetName}" not found in database`);
          return `⚠️ I couldn't find a contact named "${targetName}" in your contacts. Please save their contact first, or provide their phone number.`;
        }
      }
      
      const newRule = await Rule.create({
        userId,
        rule: `Forward ${mode || "both"} from ${sourceContact} to ${resolvedName}`,
        type: "transfer",
        active: true,
        transferDetails: {
          mode: mode || "both",
          priority: "all",
          contactName: resolvedName,
          contactPhone: resolvedPhone,
          sourceContact,
          sourcePhone,
        }
      });
      return `✅ Done! Created rule to forward ${mode || "all communications"} from ${sourceContact} to ${resolvedName} (${resolvedPhone}). Manage in Active Rules.`;
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
      return `✅ Done! Auto-reply set for ${sourceContact}. They'll receive: "${replyMessage}"`;
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
      console.log("Blocking contact:", { userId, sourceContact });
      await Rule.create({
        userId,
        rule: `Block ${sourceContact}${reason ? `: ${reason}` : ""}`,
        type: "block",
        active: true,
        transferDetails: { sourceContact, sourcePhone }
      });
      return `✅ Done! Blocked ${sourceContact}. They won't be able to reach you.`;
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

// Tool: Update Contact Name
const updateContactTool = tool(
  async ({ userId, currentPhone, newName }) => {
    try {
      console.log("Updating contact:", { userId, currentPhone, newName });
      const normalizedPhone = currentPhone.replace(/\D/g, '');
      const contact = await Contact.findOneAndUpdate(
        { userId, phone: { $regex: normalizedPhone } },
        { name: newName },
        { new: true, upsert: true }
      );
      return `✅ Done! Contact renamed to "${newName}"`;
    } catch (error) {
      console.error("Update contact error:", error);
      return `Error: ${error.message}`;
    }
  },
  {
    name: "update_contact",
    description: "Rename/update a contact. Use when user says: change name, rename, update contact, set name as, call them X.",
    schema: z.object({
      userId: z.string().describe("User ID - REQUIRED"),
      currentPhone: z.string().describe("Phone number of contact to update"),
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
      return `✅ Done! ${sourceContact} marked as high priority. You'll get prominent alerts.`;
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
      
      // Search messages in those conversations
      const messages = await Message.find({
        conversationId: { $in: conversationIds },
        content: { $regex: searchRegex }
      }).sort({ timestamp: -1 }).limit(20);
      
      if (messages.length === 0) {
        return `No messages found containing "${query}".`;
      }
      
      // Format results
      const results = messages.map(m => {
        const conv = conversations.find(c => c._id.toString() === m.conversationId.toString());
        const contact = conv?.contactName || "Unknown";
        const date = new Date(m.timestamp).toLocaleDateString();
        return `[${date}] ${contact}: ${m.content}`;
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

// All conversation tools
const conversationTools = [
  createTransferRuleTool,
  createAutoReplyTool,
  blockContactTool,
  updateContactTool,
  searchContactsTool,
  markPriorityTool,
  searchMessagesTool,
];

// Create LLM with tools bound
const llmWithTools = llm.bindTools(conversationTools);

// Tool execution map
const toolMap = {
  create_transfer_rule: createTransferRuleTool,
  create_auto_reply: createAutoReplyTool,
  block_contact: blockContactTool,
  update_contact: updateContactTool,
  search_contacts: searchContactsTool,
  mark_priority: markPriorityTool,
  search_messages: searchMessagesTool,
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

=== CRITICAL RULES ===
1. BE ACTION-ORIENTED - Execute immediately, don't ask unnecessary questions
2. ALWAYS include these in tool calls:
   - userId: "${userId}"
   - sourceContact: "${contactName}"  
   - sourcePhone: "${contactPhone}"
3. When user says "transfer to X" → call create_transfer_rule with targetName=X
4. When user says "change name to X" or "rename to X" or "change contact to X" → call update_contact with newName=X, currentPhone="${contactPhone}"
5. When user asks about meetings/appointments/events → call search_messages with query="meeting" or relevant keywords
6. If no tool matches, analyze the conversation or answer the question

=== CONVERSATION HISTORY ===
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
            results.push(result);
          } catch (toolError) {
            console.error(`Tool ${toolCall.name} error:`, toolError);
            results.push(`Error executing ${toolCall.name}: ${toolError.message}`);
          }
        }
      }
      
      return results.join("\n");
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
