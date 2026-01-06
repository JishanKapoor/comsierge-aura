import express from "express";
import {
  analyzeIncomingMessage,
  classifyMessageAsSpam,
  quickPriorityCheck,
  batchAnalyzeMessages,
  generateAutoResponse,
  shouldHoldMessage,
  generateReplySuggestions,
  rewriteMessage,
} from "../services/aiService.js";
import { conversationChat, rulesAgentChat } from "../services/aiAgentService.js";
import Contact from "../models/Contact.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { authMiddleware } from "./auth.js";

const router = express.Router();

// Helper to build sender context from database
async function buildSenderContext(userId, senderPhone) {
  const context = {
    isSavedContact: false,
    isFavorite: false,
    tags: [],
    hasConversationHistory: false,
    messageCount: 0,
    userHasReplied: false,
    isBlocked: false,
  };
  
  try {
    // Check if sender is a saved contact
    const contact = await Contact.findOne({ userId, phone: senderPhone });
    if (contact) {
      context.isSavedContact = true;
      context.isFavorite = contact.isFavorite || false;
      context.tags = contact.tags || [];
      context.isBlocked = contact.isBlocked || false;
    }
    
    // Check conversation history
    const conversation = await Conversation.findOne({ userId, contactPhone: senderPhone });
    if (conversation) {
      context.hasConversationHistory = true;
      context.isBlocked = context.isBlocked || conversation.isBlocked || false;
    }
    
    // Count messages and check if user has replied
    const messages = await Message.find({ userId, contactPhone: senderPhone }).limit(50);
    context.messageCount = messages.length;
    context.userHasReplied = messages.some(m => m.direction === 'outgoing');
    
  } catch (error) {
    console.error("Error building sender context:", error);
  }
  
  return context;
}

// @route   POST /api/ai/analyze
// @desc    Analyze a single message with multi-factor spam classification
// @access  Private
router.post("/analyze", authMiddleware, async (req, res) => {
  try {
    const { message, senderPhone, senderName, conversationHistory, senderContext: providedContext } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message content is required",
      });
    }

    // Build sender context from database if not provided
    let senderContext = providedContext;
    if (!senderContext && senderPhone && req.user) {
      senderContext = await buildSenderContext(req.user._id, senderPhone);
    }

    const analysis = await analyzeIncomingMessage(
      message,
      senderPhone || "",
      senderName || "",
      conversationHistory || [],
      senderContext
    );

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error("AI analyze error:", error);
    res.status(500).json({
      success: false,
      message: "AI analysis failed",
      error: error.message,
    });
  }
});

// @route   POST /api/ai/classify-spam
// @desc    Multi-factor spam classification for a message
// @access  Private
router.post("/classify-spam", authMiddleware, async (req, res) => {
  try {
    const { message, senderPhone, senderName, conversationHistory, senderContext: providedContext } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message content is required",
      });
    }

    // Build sender context from database if not provided
    let senderContext = providedContext;
    if (!senderContext && senderPhone && req.user) {
      senderContext = await buildSenderContext(req.user._id, senderPhone);
    }

    const spamAnalysis = await classifyMessageAsSpam(
      message,
      senderPhone || "",
      senderName || "",
      senderContext,
      conversationHistory || []
    );

    res.json({
      success: true,
      data: {
        ...spamAnalysis,
        senderContext, // Include context used for transparency
      },
    });
  } catch (error) {
    console.error("Spam classification error:", error);
    res.status(500).json({
      success: false,
      message: "Spam classification failed",
      error: error.message,
    });
  }
});

// @route   POST /api/ai/priority
// @desc    Quick priority check for a message
// @access  Private
router.post("/priority", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message content is required",
      });
    }

    const priority = await quickPriorityCheck(message);

    res.json({
      success: true,
      data: { priority },
    });
  } catch (error) {
    console.error("Priority check error:", error);
    res.status(500).json({
      success: false,
      message: "Priority check failed",
      error: error.message,
    });
  }
});

// @route   POST /api/ai/batch-analyze
// @desc    Analyze multiple messages at once
// @access  Private
router.post("/batch-analyze", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        message: "Messages array is required",
      });
    }

    const results = await batchAnalyzeMessages(messages);

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Batch analyze error:", error);
    res.status(500).json({
      success: false,
      message: "Batch analysis failed",
      error: error.message,
    });
  }
});

// @route   POST /api/ai/auto-response
// @desc    Generate an auto-response for a message
// @access  Private
router.post("/auto-response", async (req, res) => {
  try {
    const { message, senderName, rules } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message content is required",
      });
    }

    const response = await generateAutoResponse(message, senderName, rules || []);

    res.json({
      success: true,
      data: { response },
    });
  } catch (error) {
    console.error("Auto-response error:", error);
    res.status(500).json({
            message: "Auto-response failed",
      error: error.message,
    });
  }
});

// @route   POST /api/ai/reply-suggestions
// @desc    Generate AI-powered reply suggestions based on conversation
// @access  Private
router.post("/reply-suggestions", authMiddleware, async (req, res) => {
  console.log("🔄 Reply suggestions endpoint called");
  try {
    const { conversationHistory, contactName } = req.body;
    console.log("📝 Contact:", contactName, "History length:", conversationHistory?.length);

    if (!conversationHistory || !Array.isArray(conversationHistory)) {
      return res.status(400).json({
        success: false,
        message: "Conversation history array is required",
      });
    }

    console.log("🤖 Calling generateReplySuggestions...");
    const suggestions = await generateReplySuggestions(conversationHistory, contactName);
    console.log("✅ Suggestions result:", suggestions);

    res.json({
      success: true,
      data: { suggestions },
    });
  } catch (error) {
    console.error("❌ Reply suggestions error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate suggestions",
      error: error.message,
    });
  }
});

// @route   POST /api/ai/rewrite
// @desc    Rewrite/improve a draft message using AI
// @access  Private
router.post("/rewrite", authMiddleware, async (req, res) => {
  console.log("🔄 Rewrite endpoint called");
  try {
    const { draftMessage, conversationHistory, contactName, style } = req.body;
    console.log("📝 Draft message:", draftMessage);

    if (!draftMessage) {
      return res.status(400).json({
        success: false,
        message: "Draft message is required",
      });
    }

    console.log("🤖 Calling rewriteMessage...");
    const rewritten = await rewriteMessage(
      draftMessage,
      conversationHistory || [],
      contactName,
      style || "professional"
    );
    console.log("✅ Rewrite result:", rewritten);

    res.json({
      success: true,
      data: { rewritten },
    });
  } catch (error) {
    console.error("❌ Rewrite error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to rewrite message",
      error: error.message,
    });
  }
});

// @route   POST /api/ai/chat
// @desc    Full-powered AI agent for Rules tab - can call, message, create rules, search, etc.
// @access  Private
router.post("/chat", authMiddleware, async (req, res) => {
  console.log("🤖 AI Rules Agent Chat endpoint called");
  try {
    const { message, chatHistory } = req.body;
    const userId = req.user._id.toString();
    
    console.log("📝 User:", userId, "Message:", message);

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    // Use the full-powered rules agent
    const response = await rulesAgentChat(userId, message, chatHistory || []);
    
    console.log("🤖 Agent response:", response);
    
    // Check if response is a JSON action (call/message confirmation)
    let actionData = null;
    try {
      actionData = JSON.parse(response);
    } catch (e) {
      // Not JSON, just a text response
    }
    
    res.json({
      success: true,
      response: actionData ? actionData.message : response,
      action: actionData,
    });
    
  } catch (error) {
    console.error("❌ AI Chat error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process request",
      error: error.message,
    });
  }
});

// @route   POST /api/ai/conversation-chat
// @desc    AI agent chat for conversation actions (transfer, block, rename, search, etc.)
// @access  Private
router.post("/conversation-chat", authMiddleware, async (req, res) => {
  console.log("🤖 Conversation chat endpoint called");
  try {
    const { message, contactName, contactPhone, conversationContext } = req.body;
    const userId = req.user._id.toString();
    
    console.log("📝 User:", userId, "Contact:", contactName, "Phone:", contactPhone);
    console.log("💬 Message:", message);

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    const response = await conversationChat(
      userId,
      message,
      contactName || "Unknown",
      contactPhone || "",
      conversationContext || ""
    );

    console.log("✅ AI Response:", response);

    res.json({
      success: true,
      data: { response },
    });
  } catch (error) {
    console.error("❌ Conversation chat error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process conversation chat",
      error: error.message,
    });
  }
});

// @route   POST /api/ai/analyze-transcript
// @desc    Ask AI questions about a call transcript
// @access  Private
router.post("/analyze-transcript", authMiddleware, async (req, res) => {
  try {
    const { transcript, contactName, question, conversationHistory } = req.body;

    if (!transcript || !question) {
      return res.status(400).json({
        success: false,
        message: "Transcript and question are required",
      });
    }

    console.log("🎙️ Analyzing transcript for:", contactName);
    console.log("   Question:", question);

    // Build the conversation context from history
    const historyContext = conversationHistory && conversationHistory.length > 0
      ? conversationHistory.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')
      : '';

    const systemPrompt = `You are an AI assistant helping analyze a phone call transcript. You have access to the full transcript of a call with "${contactName || 'a contact'}".

Be helpful, concise, and accurate. When summarizing or extracting information:
- Be specific and quote relevant parts when useful
- If asked about action items, be clear about who needs to do what
- For sentiment analysis, explain your reasoning
- If something isn't clear from the transcript, say so

Here is the call transcript:
---
${transcript}
---

${historyContext ? `Previous conversation:\n${historyContext}\n` : ''}`;

    // Use OpenAI to analyze
    const { ChatOpenAI } = await import("@langchain/openai");
    const { HumanMessage, SystemMessage } = await import("@langchain/core/messages");

    const llm = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0.3,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(question),
    ]);

    const aiResponse = response.content;
    console.log("   AI Response:", aiResponse.substring(0, 100) + "...");

    res.json({
      success: true,
      response: aiResponse,
    });
  } catch (error) {
    console.error("❌ Transcript analysis error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to analyze transcript",
      error: error.message,
    });
  }
});

export default router;