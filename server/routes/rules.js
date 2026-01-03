import express from "express";
import Rule from "../models/Rule.js";
import { authMiddleware } from "./auth.js";

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// @route   GET /api/rules
// @desc    Get all rules for current user
// @access  Private
router.get("/", async (req, res) => {
  try {
    const rules = await Rule.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({
      success: true,
      count: rules.length,
      data: rules,
    });
  } catch (error) {
    console.error("Get rules error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   POST /api/rules
// @desc    Create a new rule
// @access  Private
router.post("/", async (req, res) => {
  try {
    const { rule, type, active, schedule, transferDetails, conditions, actions } = req.body;

    if (!rule) {
      return res.status(400).json({
        success: false,
        message: "Rule description is required",
      });
    }

    const newRule = await Rule.create({
      userId: req.user._id,
      rule,
      type: type || "custom",
      active: active !== false,
      schedule: schedule || { mode: "always" },
      transferDetails,
      conditions,
      actions,
    });

    res.status(201).json({
      success: true,
      message: "Rule created",
      data: newRule,
    });
  } catch (error) {
    console.error("Create rule error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   PUT /api/rules/:id
// @desc    Update a rule
// @access  Private
router.put("/:id", async (req, res) => {
  try {
    const existingRule = await Rule.findOne({ _id: req.params.id, userId: req.user._id });
    
    if (!existingRule) {
      return res.status(404).json({
        success: false,
        message: "Rule not found",
      });
    }

    const { rule, type, active, schedule, transferDetails, conditions, actions } = req.body;
    
    if (rule !== undefined) existingRule.rule = rule;
    if (type !== undefined) existingRule.type = type;
    if (active !== undefined) existingRule.active = active;
    if (schedule !== undefined) existingRule.schedule = schedule;
    if (transferDetails !== undefined) existingRule.transferDetails = transferDetails;
    if (conditions !== undefined) existingRule.conditions = conditions;
    if (actions !== undefined) existingRule.actions = actions;

    await existingRule.save();

    res.json({
      success: true,
      message: "Rule updated",
      data: existingRule,
    });
  } catch (error) {
    console.error("Update rule error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   DELETE /api/rules/:id
// @desc    Delete a rule
// @access  Private
router.delete("/:id", async (req, res) => {
  try {
    const rule = await Rule.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    
    if (!rule) {
      return res.status(404).json({
        success: false,
        message: "Rule not found",
      });
    }

    res.json({
      success: true,
      message: "Rule deleted",
    });
  } catch (error) {
    console.error("Delete rule error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   PUT /api/rules/:id/toggle
// @desc    Toggle rule active status
// @access  Private
router.put("/:id/toggle", async (req, res) => {
  try {
    const rule = await Rule.findOne({ _id: req.params.id, userId: req.user._id });
    
    if (!rule) {
      return res.status(404).json({
        success: false,
        message: "Rule not found",
      });
    }

    rule.active = !rule.active;
    await rule.save();

    res.json({
      success: true,
      message: `Rule ${rule.active ? "activated" : "deactivated"}`,
      data: rule,
    });
  } catch (error) {
    console.error("Toggle rule error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

export default router;
