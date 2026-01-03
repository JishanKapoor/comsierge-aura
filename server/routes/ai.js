import express from "express";
import {
  analyzeIncomingMessage,
  classifyMessageAsSpam,
  quickPriorityCheck,
  batchAnalyzeMessages,
  generateAutoResponse,
  shouldHoldMessage,
} from "../services/aiService.js";
import { chatWithAI, conversationChat } from "../services/aiAgentService.js";
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
      success: false,
      message: "Auto-response generation failed",
      error: error.message,
    });
  }
});

// @route   POST /api/ai/should-hold
// @desc    Check if a message should be held
// @access  Private
router.post("/should-hold", async (req, res) => {
  try {
    const { message, senderName, rules } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message content is required",
      });
    }

    const result = await shouldHoldMessage(message, senderName, rules || []);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Hold check error:", error);
    res.status(500).json({
      success: false,
      message: "Hold check failed",
      error: error.message,
    });
  }
});

// @route   POST /api/ai/process-incoming
// @desc    Process an incoming message (analyze + decide hold + generate response)
// @access  Private
router.post("/process-incoming", async (req, res) => {
  try {
    const { message, senderPhone, senderName, conversationHistory, rules } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message content is required",
      });
    }

    // Full analysis
    const analysis = await analyzeIncomingMessage(
      message,
      senderPhone || "",
      senderName || "",
      conversationHistory || []
    );

    // Check hold status based on rules
    let holdStatus = { shouldHold: analysis.shouldHold, reason: analysis.holdReason };
    if (rules && rules.length > 0) {
      const ruleCheck = await shouldHoldMessage(message, senderName, rules);
      if (ruleCheck.shouldHold) {
        holdStatus = ruleCheck;
      }
    }

    res.json({
      success: true,
      data: {
        analysis,
        holdStatus,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Process incoming error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process incoming message",
      error: error.message,
    });
  }
});

// AI Agent Chat Endpoint (for rules)
router.post("/chat", authMiddleware, async (req, res) => {
  try {
    const { message, history } = req.body;
    const userId = req.user.userId;
    
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const response = await chatWithAI(userId, message, history);
    
    res.json({ response });
  } catch (error) {
    console.error("Error in AI chat:", error);
    res.status(500).json({ error: "Failed to process chat request" });
  }
});

// AI Conversation Chat Endpoint (for inbox assistant)
router.post("/conversation-chat", authMiddleware, async (req, res) => {
  try {
    const { message, context, contactName, contactPhone } = req.body;
    const userId = req.user?.userId || req.user?.id || req.user?._id;
    
    console.log("Conversation chat - userId:", userId, "contactName:", contactName);
    
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Use the new LangChain-powered service
    const response = await conversationChat(
      userId.toString(),
      message,
      contactName || "Unknown Contact",
      contactPhone,
      context
    );
    
    res.json({ response });
  } catch (error) {
    console.error("Error in conversation chat:", error);
    res.status(500).json({ error: "Failed to process conversation chat" });
  }
});

export default router;
