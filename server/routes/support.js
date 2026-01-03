import express from "express";
import SupportTicket from "../models/SupportTicket.js";
import { authMiddleware, adminMiddleware } from "./auth.js";

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// @route   GET /api/support/tickets
// @desc    Get tickets (user gets their own, admin gets all)
// @access  Private
router.get("/tickets", async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = {};
    
    // Non-admin users can only see their own tickets
    if (req.user.role !== "admin") {
      query.userId = req.user._id;
    }
    
    // Filter by status if provided
    if (status && status !== "all") {
      query.status = status;
    }

    const tickets = await SupportTicket.find(query).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: tickets.length,
      data: tickets.map((t) => ({
        id: t._id,
        userId: t.userId,
        userName: t.userName,
        userEmail: t.userEmail,
        subject: t.subject,
        category: t.category,
        message: t.message,
        status: t.status,
        priority: t.priority,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        replies: t.replies,
      })),
    });
  } catch (error) {
    console.error("Get tickets error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   GET /api/support/tickets/counts
// @desc    Get ticket counts by status (admin only)
// @access  Private (admin)
router.get("/tickets/counts", async (req, res) => {
  try {
    let matchQuery = {};
    
    // Non-admin users only see counts for their own tickets
    if (req.user.role !== "admin") {
      matchQuery.userId = req.user._id;
    }

    const [total, open, inProgress, resolved] = await Promise.all([
      SupportTicket.countDocuments(matchQuery),
      SupportTicket.countDocuments({ ...matchQuery, status: "open" }),
      SupportTicket.countDocuments({ ...matchQuery, status: "in-progress" }),
      SupportTicket.countDocuments({ ...matchQuery, status: "resolved" }),
    ]);

    res.json({
      success: true,
      data: { total, open, inProgress, resolved },
    });
  } catch (error) {
    console.error("Get ticket counts error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   POST /api/support/tickets
// @desc    Create a new support ticket
// @access  Private
router.post("/tickets", async (req, res) => {
  try {
    const { category, message, subject } = req.body;

    if (!category || !message) {
      return res.status(400).json({
        success: false,
        message: "Category and message are required",
      });
    }

    const now = new Date();
    const timestamp = now.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    const ticket = await SupportTicket.create({
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      subject: subject || category,
      category,
      message,
      status: "open",
      priority: "medium",
      replies: [
        {
          message,
          isSupport: false,
          timestamp,
          authorName: req.user.name,
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: "Ticket created successfully",
      data: {
        id: ticket._id,
        userId: ticket.userId,
        userName: ticket.userName,
        userEmail: ticket.userEmail,
        subject: ticket.subject,
        category: ticket.category,
        message: ticket.message,
        status: ticket.status,
        priority: ticket.priority,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        replies: ticket.replies,
      },
    });
  } catch (error) {
    console.error("Create ticket error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   POST /api/support/tickets/:id/reply
// @desc    Add a reply to a ticket
// @access  Private
router.post("/tickets/:id/reply", async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    const ticket = await SupportTicket.findById(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    // Check permission - user can only reply to their own tickets, admin can reply to any
    if (req.user.role !== "admin" && ticket.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to reply to this ticket",
      });
    }

    const isSupport = req.user.role === "admin";
    const now = new Date();
    const timestamp = now.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    ticket.replies.push({
      message,
      isSupport,
      timestamp,
      authorName: isSupport ? "Support Team" : req.user.name,
    });

    // If support replies to an open ticket, mark as in-progress
    if (isSupport && ticket.status === "open") {
      ticket.status = "in-progress";
    }

    await ticket.save();

    res.json({
      success: true,
      message: "Reply added successfully",
      data: {
        id: ticket._id,
        userId: ticket.userId,
        userName: ticket.userName,
        userEmail: ticket.userEmail,
        subject: ticket.subject,
        category: ticket.category,
        message: ticket.message,
        status: ticket.status,
        priority: ticket.priority,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        replies: ticket.replies,
      },
    });
  } catch (error) {
    console.error("Add reply error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   PUT /api/support/tickets/:id/status
// @desc    Update ticket status (admin only)
// @access  Private (admin)
router.put("/tickets/:id/status", adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !["open", "in-progress", "resolved"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Valid status is required (open, in-progress, resolved)",
      });
    }

    const ticket = await SupportTicket.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    res.json({
      success: true,
      message: "Status updated",
      data: {
        id: ticket._id,
        userId: ticket.userId,
        userName: ticket.userName,
        userEmail: ticket.userEmail,
        subject: ticket.subject,
        category: ticket.category,
        message: ticket.message,
        status: ticket.status,
        priority: ticket.priority,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        replies: ticket.replies,
      },
    });
  } catch (error) {
    console.error("Update status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   PUT /api/support/tickets/:id/priority
// @desc    Update ticket priority (admin only)
// @access  Private (admin)
router.put("/tickets/:id/priority", adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { priority } = req.body;

    if (!priority || !["low", "medium", "high"].includes(priority)) {
      return res.status(400).json({
        success: false,
        message: "Valid priority is required (low, medium, high)",
      });
    }

    const ticket = await SupportTicket.findByIdAndUpdate(
      id,
      { priority },
      { new: true }
    );

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    res.json({
      success: true,
      message: "Priority updated",
      data: {
        id: ticket._id,
        userId: ticket.userId,
        userName: ticket.userName,
        userEmail: ticket.userEmail,
        subject: ticket.subject,
        category: ticket.category,
        message: ticket.message,
        status: ticket.status,
        priority: ticket.priority,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        replies: ticket.replies,
      },
    });
  } catch (error) {
    console.error("Update priority error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   DELETE /api/support/tickets/:id
// @desc    Delete a ticket (admin only)
// @access  Private (admin)
router.delete("/tickets/:id", adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const ticket = await SupportTicket.findByIdAndDelete(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    res.json({
      success: true,
      message: "Ticket deleted",
    });
  } catch (error) {
    console.error("Delete ticket error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

export default router;
