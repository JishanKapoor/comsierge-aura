import express from "express";
import Contact from "../models/Contact.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import CallRecord from "../models/CallRecord.js";
import Rule from "../models/Rule.js";
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

// @route   GET /api/contacts
// @desc    Get all contacts for current user
// @access  Private
router.get("/", async (req, res) => {
  try {
    const contacts = await Contact.find({ userId: req.user._id }).sort({ name: 1 });
    res.json({
      success: true,
      count: contacts.length,
      data: contacts,
    });
  } catch (error) {
    console.error("Get contacts error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   POST /api/contacts
// @desc    Create a new contact
// @access  Private
router.post("/", async (req, res) => {
  try {
    const { name, phone, email, company, notes, tags, avatar, isFavorite, isBlocked } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: "Name and phone are required",
      });
    }

    // Check for existing contact with same phone (handle different formatting)
    const phoneCandidates = buildPhoneCandidates(phone);
    const digitsOnly = String(phone || "").replace(/\D/g, "");
    const last10 = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : "";

    let existing = await Contact.findOne({
      userId: req.user._id,
      phone: { $in: phoneCandidates },
    });

    if (!existing && last10.length === 10) {
      const regexPattern = last10.split("").join("[^0-9]*");
      existing = await Contact.findOne({
        userId: req.user._id,
        phone: { $regex: regexPattern, $options: "i" },
      });
    }

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Contact with this phone number already exists",
      });
    }

    const contact = await Contact.create({
      userId: req.user._id,
      name,
      phone,
      email,
      company,
      notes,
      tags: tags || [],
      avatar,
      ...(isFavorite !== undefined ? { isFavorite } : {}),
      ...(isBlocked !== undefined ? { isBlocked } : {}),
    });

    // Sync contact name to existing conversations/messages/calls with this phone number
    try {
      const phoneCandidates = buildPhoneCandidates(phone);
      
      await Conversation.updateMany(
        { userId: req.user._id, contactPhone: { $in: phoneCandidates } },
        { $set: { contactName: name, contactId: contact._id } }
      );
      
      await Message.updateMany(
        { userId: req.user._id, contactPhone: { $in: phoneCandidates } },
        { $set: { contactName: name, contactId: contact._id } }
      );
      
      await CallRecord.updateMany(
        { userId: req.user._id, contactPhone: { $in: phoneCandidates } },
        { $set: { contactName: name, contactId: contact._id } }
      );
      
      console.log(`✅ Contact "${name}" created, synced name to existing conversations/messages/calls`);
    } catch (syncError) {
      console.error("Name sync on create error (non-fatal):", syncError);
    }

    res.status(201).json({
      success: true,
      message: "Contact created",
      data: contact,
    });
  } catch (error) {
    console.error("Create contact error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   PUT /api/contacts/:id
// @desc    Update a contact
// @access  Private
router.put("/:id", async (req, res) => {
  try {
    const contact = await Contact.findOne({ _id: req.params.id, userId: req.user._id });
    
    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found",
      });
    }

    const oldName = contact.name;
    const oldPhone = contact.phone;

    const { name, phone, email, company, notes, tags, avatar, isFavorite, isBlocked } = req.body;

    // If updating phone, prevent duplicates across different formatting
    if (phone && phone !== contact.phone) {
      const phoneCandidates = buildPhoneCandidates(phone);
      const digitsOnly = String(phone || "").replace(/\D/g, "");
      const last10 = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : "";

      let collision = await Contact.findOne({
        userId: req.user._id,
        _id: { $ne: contact._id },
        phone: { $in: phoneCandidates },
      });

      if (!collision && last10.length === 10) {
        const regexPattern = last10.split("").join("[^0-9]*");
        collision = await Contact.findOne({
          userId: req.user._id,
          _id: { $ne: contact._id },
          phone: { $regex: regexPattern, $options: "i" },
        });
      }

      if (collision) {
        return res.status(400).json({
          success: false,
          message: "Contact with this phone number already exists",
        });
      }
    }
    
    if (name) contact.name = name;
    if (phone) contact.phone = phone;
    if (email !== undefined) contact.email = email;
    if (company !== undefined) contact.company = company;
    if (notes !== undefined) contact.notes = notes;
    if (tags !== undefined) contact.tags = tags;
    if (avatar !== undefined) contact.avatar = avatar;
    if (isFavorite !== undefined) contact.isFavorite = isFavorite;
    if (isBlocked !== undefined) contact.isBlocked = isBlocked;

    await contact.save();

    // Keep denormalized names in sync across the app (Inbox/Calls/Rules).
    // This prevents stale names from appearing in search and lists.
    // Wrapped in try-catch so propagation failures don't break the main save.
    try {
      const phoneCandidates = buildPhoneCandidates(oldPhone, contact.phone);
      console.log(`[Contact Rename] Propagating name "${contact.name}" for phones:`, phoneCandidates);

      if (contact.name) {
        const nameUpdate = { contactName: contact.name };

        await Conversation.updateMany(
          {
            userId: req.user._id,
            $or: [{ contactId: contact._id }, { contactPhone: { $in: phoneCandidates } }],
          },
          { $set: nameUpdate }
        );

        await Message.updateMany(
          {
            userId: req.user._id,
            $or: [{ contactId: contact._id }, { contactPhone: { $in: phoneCandidates } }],
          },
          { $set: nameUpdate }
        );

        await CallRecord.updateMany(
          {
            userId: req.user._id,
            $or: [{ contactId: contact._id }, { contactPhone: { $in: phoneCandidates } }],
          },
          { $set: nameUpdate }
        );

        await Rule.updateMany(
          {
            userId: req.user._id,
            "transferDetails.contactPhone": { $in: phoneCandidates },
          },
          { $set: { "transferDetails.contactName": contact.name } }
        ).then(result => {
          if (result.modifiedCount > 0) {
            console.log(`[Contact Rename] Updated ${result.modifiedCount} transfer rules (target contact)`);
          }
        });

        // Also update sourceContactName in transfer rules when the SOURCE contact is renamed
        await Rule.updateMany(
          {
            userId: req.user._id,
            "conditions.sourceContactPhone": { $in: phoneCandidates },
          },
          { $set: { "conditions.sourceContactName": contact.name } }
        ).then(result => {
          if (result.modifiedCount > 0) {
            console.log(`[Contact Rename] Updated ${result.modifiedCount} transfer rules (source contact)`);
          }
        });
      }
    } catch (propagationError) {
      console.error("Name propagation error (non-fatal):", propagationError);
      // Don't fail the request - contact was saved successfully
    }

    res.json({
      success: true,
      message: "Contact updated",
      data: contact,
    });
  } catch (error) {
    console.error("Update contact error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   DELETE /api/contacts/:id
// @desc    Delete a contact
// @access  Private
router.delete("/:id", async (req, res) => {
  try {
    const contact = await Contact.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    
    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found",
      });
    }

    // Update Conversations and Messages to remove the contact name
    // Revert contactName back to the phone number
    const phoneCandidates = buildPhoneCandidates(contact.phone);
    
    // Update conversations - set contactName back to phone number
    await Conversation.updateMany(
      { userId: req.user._id, contactPhone: { $in: phoneCandidates } },
      { $set: { contactName: contact.phone } }
    );
    
    // Update messages - set contactName back to phone number
    await Message.updateMany(
      { userId: req.user._id, contactPhone: { $in: phoneCandidates } },
      { $set: { contactName: contact.phone } }
    );
    
    // Update call records - set contactName back to phone number
    await CallRecord.updateMany(
      { userId: req.user._id, contactPhone: { $in: phoneCandidates } },
      { $set: { contactName: contact.phone } }
    );
    
    console.log(`✅ Contact "${contact.name}" deleted, reverted name in conversations/messages/calls`);

    res.json({
      success: true,
      message: "Contact deleted",
    });
  } catch (error) {
    console.error("Delete contact error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   POST /api/contacts/bulk
// @desc    Bulk import contacts
// @access  Private
router.post("/bulk", async (req, res) => {
  try {
    const { contacts } = req.body;

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Contacts array is required",
      });
    }

    const results = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };

    for (const c of contacts) {
      try {
        if (!c.name || !c.phone) {
          results.failed++;
          results.errors.push(`Missing name or phone for contact`);
          continue;
        }

        const existing = await Contact.findOne({ userId: req.user._id, phone: c.phone });
        if (existing) {
          // Update existing
          existing.name = c.name;
          if (c.email) existing.email = c.email;
          if (c.company) existing.company = c.company;
          await existing.save();
          results.updated++;
        } else {
          // Create new
          await Contact.create({
            userId: req.user._id,
            name: c.name,
            phone: c.phone,
            email: c.email,
            company: c.company,
          });
          results.created++;
        }
      } catch (e) {
        results.failed++;
        results.errors.push(e.message);
      }
    }

    res.json({
      success: true,
      message: `Import complete: ${results.created} created, ${results.updated} updated, ${results.failed} failed`,
      data: results,
    });
  } catch (error) {
    console.error("Bulk import error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

export default router;
