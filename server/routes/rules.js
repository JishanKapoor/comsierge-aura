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

    // Clean up duplicate transfer rules (caused by repeated submits / network retries).
    // Keep the newest one (rules are sorted newest-first) and delete older duplicates.
    const seen = new Set();
    const deduped = [];
    const duplicateIds = [];

    for (const r of rules) {
      if (r.type !== "transfer") {
        deduped.push(r);
        continue;
      }

      // Key is just the SOURCE contact phone - only one transfer rule per source
      // When user creates transfer FROM X, it replaces any existing transfer FROM X
      const key = `transfer:${r.conditions?.sourceContactPhone || 'global'}`;

      if (seen.has(key)) {
        duplicateIds.push(r._id);
        continue;
      }

      seen.add(key);
      deduped.push(r);
      
      // NOTE: Removed auto-activation - it was re-enabling rules that users intentionally disabled
      // The original bug (rules created inactive) is now fixed in the POST handler
    }

    if (duplicateIds.length) {
      await Rule.deleteMany({ userId: req.user._id, _id: { $in: duplicateIds } });
    }

    res.json({
      success: true,
      count: deduped.length,
      data: deduped,
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

    // For transfer rules, avoid creating duplicates by reusing an existing identical rule.
    if ((type || "custom") === "transfer") {
      const src = conditions?.sourceContactPhone || null;
      const tgt = transferDetails?.contactPhone || null;
      const mode = transferDetails?.mode || "both";
      const priority = transferDetails?.priority || "all";
      const priorityFilter = transferDetails?.priorityFilter || null;

      if (tgt) {
        // Find ANY existing transfer rule for the same SOURCE contact
        // When user sets up transfer FROM X, it should replace any existing transfer FROM X
        // regardless of the previous target
        const existing = await Rule.findOne({
          userId: req.user._id,
          type: "transfer",
          ...(src 
            ? { "conditions.sourceContactPhone": src } 
            : { "conditions.sourceContactPhone": { $exists: false } }),
        }).sort({ createdAt: -1 });

        if (existing) {
          existing.rule = rule;
          existing.active = active !== false;  // Ensure active status is updated
          existing.schedule = schedule || { mode: "always" };
          existing.transferDetails = transferDetails;
          existing.conditions = conditions;
          existing.actions = actions;
          await existing.save();

          return res.status(200).json({
            success: true,
            message: "Rule updated",
            data: existing,
          });
        }
      }
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

// @route   DELETE /api/rules/cleanup/transfers
// @desc    Delete all duplicate transfer rules (one-time cleanup)
// @access  Private
router.delete("/cleanup/transfers", async (req, res) => {
  try {
    const rules = await Rule.find({ userId: req.user._id, type: "transfer" }).sort({ createdAt: -1 });
    
    const seen = new Set();
    const duplicateIds = [];
    
    for (const r of rules) {
      // Key is just the SOURCE - only one transfer rule per source contact
      const key = `transfer:${r.conditions?.sourceContactPhone || 'global'}`;
      
      if (seen.has(key)) {
        duplicateIds.push(r._id);
      } else {
        seen.add(key);
      }
    }
    
    if (duplicateIds.length > 0) {
      await Rule.deleteMany({ _id: { $in: duplicateIds } });
    }
    
    res.json({
      success: true,
      message: `Deleted ${duplicateIds.length} duplicate transfer rules`,
      deletedCount: duplicateIds.length,
    });
  } catch (error) {
    console.error("Cleanup transfer rules error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

export default router;
