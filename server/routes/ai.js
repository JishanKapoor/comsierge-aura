import express from "express";
import {
  analyzeIncomingMessage,
  quickPriorityCheck,
  batchAnalyzeMessages,
  generateAutoResponse,
  shouldHoldMessage,
} from "../services/aiService.js";

const router = express.Router();

// @route   POST /api/ai/analyze
// @desc    Analyze a single message
// @access  Private
router.post("/analyze", async (req, res) => {
  try {
    const { message, senderPhone, senderName, conversationHistory } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message content is required",
      });
    }

    const analysis = await analyzeIncomingMessage(
      message,
      senderPhone || "",
      senderName || "",
      conversationHistory || []
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

export default router;
