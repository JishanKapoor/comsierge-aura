import express from "express";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import Contact from "../models/Contact.js";
import { authMiddleware } from "./auth.js";

const router = express.Router();

function buildPhoneCandidates(...phones) {
  const set = new Set();
  for (const phone of phones) {
    if (!phone) continue;
    const raw = String(phone).trim();
    if (!raw) continue;

    set.add(raw);
    set.add(raw.replace(/[^\d+]/g, ""));

    const digits = raw.replace(/\D/g, "");
    if (digits) {
      set.add(digits);
      if (digits.length === 10) {
        set.add(`1${digits}`);
        set.add(`+1${digits}`);
      }
      if (digits.length === 11 && digits.startsWith("1")) {
        set.add(`+${digits}`);
        set.add(digits.slice(1));
      }
    }
  }
  return Array.from(set);
}

// All routes require authentication
router.use(authMiddleware);

// @route   GET /api/messages/search
// @desc    Search messages by text, contact, date range, sentiment, labels
// @access  Private
router.get("/search", async (req, res) => {
  try {
    const { 
      q,           // text search
      contact,     // contact phone or name
      sentiment,   // positive, neutral, negative
      urgency,     // low, medium, high, emergency
      category,    // personal, business, finance, meeting, promo, scam
      labels,      // comma-separated labels
      startDate,   // ISO date
      endDate,     // ISO date
      limit = 50,
      skip = 0,
    } = req.query;

    let query = { userId: req.user._id };

    // Text search
    if (q) {
      query.body = { $regex: q, $options: "i" };
    }

    // Contact filter (phone or name)
    if (contact) {
      query.$or = [
        { contactPhone: { $regex: contact, $options: "i" } },
        { contactName: { $regex: contact, $options: "i" } },
      ];
    }

    // Sentiment filter
    if (sentiment) {
      query["sentiment.score"] = sentiment;
    }

    // Urgency filter
    if (urgency) {
      query["urgency.level"] = urgency;
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Labels filter
    if (labels) {
      const labelArray = labels.split(",").map(l => l.trim());
      query.labels = { $in: labelArray };
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit));

    // Resolve latest contact names for consistent UI.
    const messageContactIds = Array.from(
      new Set(
        messages
          .map((m) => m.contactId)
          .filter(Boolean)
          .map((id) => String(id))
      )
    );

    const contactsById = new Map();
    if (messageContactIds.length) {
      const contacts = await Contact.find({
        userId: req.user._id,
        _id: { $in: messageContactIds },
      }).select("_id name");

      for (const contact of contacts) {
        contactsById.set(String(contact._id), contact);
      }
    }

    const responseMessages = messages.map((m) => {
      const obj = m.toObject();
      const c = obj.contactId ? contactsById.get(String(obj.contactId)) : null;
      if (c?.name) obj.contactName = c.name;
      return obj;
    });

    const total = await Message.countDocuments(query);

    res.json({
      success: true,
      count: responseMessages.length,
      total,
      data: responseMessages,
    });
  } catch (error) {
    console.error("Search messages error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   GET /api/messages/conversations
// @desc    Get all conversations for current user with optional filters
// @access  Private
router.get("/conversations", async (req, res) => {
  try {
    const { filter } = req.query; // all, unread, priority, held, blocked
    
    let query = { 
      userId: req.user._id,
      isArchived: { $ne: true },
    };
    
    // Apply filters
    if (filter === "unread") {
      query.unreadCount = { $gt: 0 };
      query.isBlocked = { $ne: true };
      query.isHeld = { $ne: true };
    } else if (filter === "priority") {
      query.isPriority = true;
    } else if (filter === "held") {
      query.isHeld = true;
    } else if (filter === "blocked") {
      query.isBlocked = true;
    } else {
      // "all" - exclude blocked and held
      query.isBlocked = { $ne: true };
      query.isHeld = { $ne: true };
    }

    const conversations = await Conversation.find(query).sort({ 
      isPinned: -1,
      lastMessageAt: -1 
    });

    // Resolve latest contact names for consistent UI.
    const conversationContactIds = Array.from(
      new Set(
        conversations
          .map((c) => c.contactId)
          .filter(Boolean)
          .map((id) => String(id))
      )
    );

    const contactsById = new Map();
    const contactsByPhone = new Map();
    if (conversationContactIds.length) {
      const contacts = await Contact.find({
        userId: req.user._id,
        _id: { $in: conversationContactIds },
      }).select("_id name");

      for (const contact of contacts) {
        contactsById.set(String(contact._id), contact);
      }
    }

    // Fallback: resolve by phone for legacy conversations missing contactId
    const convPhones = Array.from(
      new Set(conversations.map((c) => c.contactPhone).filter(Boolean).map((p) => String(p)))
    );
    if (convPhones.length) {
      const phoneCandidates = buildPhoneCandidates(...convPhones);
      const phoneContacts = await Contact.find({
        userId: req.user._id,
        phone: { $in: phoneCandidates },
      }).select("_id name phone");
      for (const contact of phoneContacts) {
        if (contact.phone) {
          for (const key of buildPhoneCandidates(contact.phone)) {
            contactsByPhone.set(String(key), contact);
          }
        }
      }
    }

    const responseConversations = conversations.map((conv) => {
      const obj = conv.toObject();
      const c = obj.contactId
        ? contactsById.get(String(obj.contactId))
        : (obj.contactPhone ? contactsByPhone.get(String(obj.contactPhone)) : null);
      if (c?.name) obj.contactName = c.name;
      return obj;
    });

    console.log(`Found ${conversations.length} conversations for user ${req.user._id}`);

    res.json({
      success: true,
      count: responseConversations.length,
      data: responseConversations,
    });
  } catch (error) {
    console.error("Get conversations error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// Helper to normalize phone numbers for comparison
function normalizePhone(phone) {
  if (!phone) return "";
  // Remove all non-digit characters except +
  const cleaned = String(phone).replace(/[^\d+]/g, "");
  // Ensure E.164-like format
  if (cleaned.startsWith("+")) return cleaned;
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return cleaned;
}

// @route   GET /api/messages/thread/:contactPhone
// @desc    Get message thread with a contact
// @access  Private
router.get("/thread/:contactPhone", async (req, res) => {
  try {
    const rawPhone = req.params.contactPhone;
    const normalizedPhone = normalizePhone(rawPhone);
    const { limit = 50, before } = req.query;

    // Build query with multiple possible phone formats
    const phoneVariations = [
      rawPhone,
      normalizedPhone,
      // Also try without +1 prefix for 10-digit numbers
      normalizedPhone.replace(/^\+1/, ""),
    ].filter(p => p); // Remove empty strings

    const query = {
      userId: req.user._id,
      contactPhone: { $in: phoneVariations },
    };

    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    // Sort messages by createdAt ascending (oldest first) to ensure correct order
    const sortedMessages = messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    // Mark as read - also handle phone variations
    await Message.updateMany(
      { userId: req.user._id, contactPhone: { $in: phoneVariations }, isRead: false, direction: "incoming" },
      { isRead: true }
    );

    // Update conversation unread count
    await Conversation.findOneAndUpdate(
      { userId: req.user._id, contactPhone: { $in: phoneVariations } },
      { unreadCount: 0 }
    );

    res.json({
      success: true,
      count: sortedMessages.length,
      data: sortedMessages, // Return in chronological order
    });
  } catch (error) {
    console.error("Get thread error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   POST /api/messages
// @desc    Save a new message (after sending via Twilio)
// @access  Private
router.post("/", async (req, res) => {
  try {
    const {
      contactPhone,
      contactName,
      direction,
      body,
      status,
      twilioSid,
      fromNumber,
      toNumber,
    } = req.body;

    if (!contactPhone || !body || !direction) {
      return res.status(400).json({
        success: false,
        message: "contactPhone, body, and direction are required",
      });
    }

    // Find or create contact
    let contact = await Contact.findOne({ userId: req.user._id, phone: contactPhone });
    
    // Create message
    const message = await Message.create({
      userId: req.user._id,
      contactId: contact?._id,
      contactPhone,
      contactName: contactName || contact?.name || "Unknown",
      direction,
      body,
      status: status || (direction === "outgoing" ? "sent" : "received"),
      twilioSid,
      fromNumber: fromNumber || req.user.phoneNumber,
      toNumber: toNumber || contactPhone,
      isRead: direction === "outgoing",
    });

    // Update or create conversation
    const conversationUpdate = {
      lastMessage: body.substring(0, 100),
      lastMessageAt: new Date(),
      contactName: contactName || contact?.name || "Unknown",
    };

    if (direction === "incoming") {
      conversationUpdate.$inc = { unreadCount: 1 };
    }

    await Conversation.findOneAndUpdate(
      { userId: req.user._id, contactPhone },
      {
        ...conversationUpdate,
        contactId: contact?._id,
      },
      { upsert: true, new: true }
    );

    res.status(201).json({
      success: true,
      message: "Message saved",
      data: message,
    });
  } catch (error) {
    console.error("Save message error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   PUT /api/messages/conversation/:contactPhone
// @desc    Update conversation settings (pin, mute, hold, block, priority, transfer prefs, language)
// @access  Private
router.put("/conversation/:contactPhone", async (req, res) => {
  try {
    const { contactPhone } = req.params;
    const { isPinned, isMuted, isArchived, isHeld, isBlocked, isPriority, priority, transferPrefs, language, contactName } = req.body;

    const update = {};
    if (isPinned !== undefined) update.isPinned = isPinned;
    if (isMuted !== undefined) update.isMuted = isMuted;
    if (isArchived !== undefined) update.isArchived = isArchived;
    if (isHeld !== undefined) update.isHeld = isHeld;
    if (isBlocked !== undefined) update.isBlocked = isBlocked;
    if (isPriority !== undefined) update.isPriority = isPriority;
    if (priority !== undefined) update.priority = priority;
    if (transferPrefs !== undefined) update.transferPrefs = transferPrefs;
    if (language !== undefined) update.language = language;
    if (contactName !== undefined) update.contactName = contactName;

    const conversation = await Conversation.findOneAndUpdate(
      { userId: req.user._id, contactPhone },
      update,
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      message: "Conversation updated",
      data: conversation,
    });
  } catch (error) {
    console.error("Update conversation error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   DELETE /api/messages/conversation/:contactPhone
// @desc    Delete a conversation and all its messages
// @access  Private
router.delete("/conversation/:contactPhone", async (req, res) => {
  try {
    const rawPhone = req.params.contactPhone;
    
    // Use buildPhoneCandidates for comprehensive phone matching
    const phoneVariations = buildPhoneCandidates(rawPhone);

    console.log(`Deleting conversation for phone: ${rawPhone}, variations:`, phoneVariations);

    const deleteResult = await Message.deleteMany({ 
      userId: req.user._id, 
      contactPhone: { $in: phoneVariations } 
    });
    
    const convResult = await Conversation.findOneAndDelete({ 
      userId: req.user._id, 
      contactPhone: { $in: phoneVariations } 
    });

    console.log(`Deleted ${deleteResult.deletedCount} messages, conversation: ${convResult ? 'yes' : 'no'}`);

    res.json({
      success: true,
      message: "Conversation deleted",
      deletedMessages: deleteResult.deletedCount,
      deletedConversation: !!convResult,
    });
  } catch (error) {
    console.error("Delete conversation error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   PUT /api/messages/:messageId
// @desc    Update a single message (mark read/unread, add labels, hold, etc.)
// @access  Private
router.put("/:messageId", async (req, res) => {
  try {
    const { messageId } = req.params;
    const { isRead, isHeld, isSpam, labels } = req.body;

    const update = {};
    if (isRead !== undefined) update.isRead = isRead;
    if (isHeld !== undefined) {
      update.isHeld = isHeld;
      // Also update status when unholding
      if (isHeld === false) {
        update.status = "received";
      }
    }
    if (isSpam !== undefined) {
      update.isSpam = isSpam;
      // Also update status when marking/unmarking spam
      if (isSpam === false) {
        update.status = "received";
        update.isHeld = false;
      } else {
        update.status = "spam";
        update.isHeld = true;
      }
    }
    if (labels !== undefined) update.labels = labels;

    const message = await Message.findOneAndUpdate(
      { _id: messageId, userId: req.user._id },
      update,
      { new: true }
    );

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    res.json({
      success: true,
      message: "Message updated",
      data: message,
    });
  } catch (error) {
    console.error("Update message error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   DELETE /api/messages/:messageId
// @desc    Delete a single message
// @access  Private
router.delete("/:messageId", async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findOneAndDelete({
      _id: messageId,
      userId: req.user._id,
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    // Update conversation's last message if needed
    const latestMsg = await Message.findOne({
      userId: req.user._id,
      contactPhone: message.contactPhone,
    }).sort({ createdAt: -1 });

    if (latestMsg) {
      await Conversation.findOneAndUpdate(
        { userId: req.user._id, contactPhone: message.contactPhone },
        {
          lastMessage: latestMsg.body.substring(0, 100),
          lastMessageAt: latestMsg.createdAt,
        }
      );
    } else {
      // No messages left, delete conversation
      await Conversation.findOneAndDelete({
        userId: req.user._id,
        contactPhone: message.contactPhone,
      });
    }

    res.json({
      success: true,
      message: "Message deleted",
    });
  } catch (error) {
    console.error("Delete message error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   POST /api/messages/bulk-action
// @desc    Perform bulk action on multiple messages
// @access  Private
router.post("/bulk-action", async (req, res) => {
  try {
    const { messageIds, action, value } = req.body;
    // action: "markRead", "markUnread", "hold", "unhold", "spam", "notSpam", "delete", "addLabel", "removeLabel"

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "messageIds array is required",
      });
    }

    let update = {};
    let deleteAction = false;

    switch (action) {
      case "markRead":
        update = { isRead: true };
        break;
      case "markUnread":
        update = { isRead: false };
        break;
      case "hold":
        update = { isHeld: true };
        break;
      case "unhold":
        update = { isHeld: false };
        break;
      case "spam":
        update = { isSpam: true, isHeld: true };
        break;
      case "notSpam":
        update = { isSpam: false, isHeld: false };
        break;
      case "delete":
        deleteAction = true;
        break;
      case "addLabel":
        if (!value) {
          return res.status(400).json({ success: false, message: "Label value required" });
        }
        update = { $addToSet: { labels: value } };
        break;
      case "removeLabel":
        if (!value) {
          return res.status(400).json({ success: false, message: "Label value required" });
        }
        update = { $pull: { labels: value } };
        break;
      default:
        return res.status(400).json({
          success: false,
          message: "Invalid action",
        });
    }

    const filter = { _id: { $in: messageIds }, userId: req.user._id };

    if (deleteAction) {
      const result = await Message.deleteMany(filter);
      return res.json({
        success: true,
        message: `${result.deletedCount} messages deleted`,
        count: result.deletedCount,
      });
    }

    const result = await Message.updateMany(filter, update);

    res.json({
      success: true,
      message: `${result.modifiedCount} messages updated`,
      count: result.modifiedCount,
    });
  } catch (error) {
    console.error("Bulk action error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

export default router;
