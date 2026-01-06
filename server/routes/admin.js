import express from "express";
import twilio from "twilio";
import TwilioAccount from "../models/TwilioAccount.js";
import User from "../models/User.js";
import { authMiddleware, adminMiddleware } from "./auth.js";

const router = express.Router();

// @route   GET /api/admin/twilio-accounts
// @desc    Get all Twilio accounts (admin only)
// @access  Private (admin)
router.get("/twilio-accounts", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const accounts = await TwilioAccount.find().populate("phoneAssignments.userId", "name email");
    res.json({
      success: true,
      count: accounts.length,
      data: accounts,
    });
  } catch (error) {
    console.error("Get Twilio accounts error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   POST /api/admin/twilio-accounts
// @desc    Add a new Twilio account (or add a single phone to existing account)
// @access  Private (admin)
router.post("/twilio-accounts", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { accountSid, authToken, friendlyName, phoneNumber } = req.body;

    if (!accountSid || !authToken) {
      return res.status(400).json({
        success: false,
        message: "Account SID and Auth Token are required",
      });
    }

    // Verify credentials with Twilio
    const client = twilio(accountSid, authToken);
    let accountInfo;
    try {
      accountInfo = await client.api.accounts(accountSid).fetch();
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: "Invalid Twilio credentials",
        error: e.message,
      });
    }

    // If a specific phone number was provided, only add that one
    // Otherwise, this is just creating/updating the account without adding numbers
    let phoneNumbers = [];
    if (phoneNumber) {
      // Verify this phone number belongs to the account
      const numbers = await client.incomingPhoneNumbers.list({ phoneNumber });
      if (numbers.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Phone number not found in this Twilio account",
        });
      }

      // Configure webhook for this specific number
      const webhookBase = process.env.WEBHOOK_BASE_URL;
      if (webhookBase) {
        try {
          await client.incomingPhoneNumbers(numbers[0].sid).update({
            voiceUrl: `${webhookBase}/api/twilio/webhook/voice`,
            voiceMethod: "POST",
            smsUrl: `${webhookBase}/api/twilio/webhook/sms`,
            smsMethod: "POST",
          });
          console.log(`✅ Configured webhooks for ${phoneNumber}`);
        } catch (err) {
          console.error(`❌ Failed to configure webhooks for ${phoneNumber}:`, err.message);
        }
      }

      phoneNumbers = [phoneNumber];
    }

    // Check if account already exists
    let account = await TwilioAccount.findOne({ accountSid });
    if (account) {
      // Update existing - merge phone numbers (don't replace)
      account.authToken = authToken;
      if (phoneNumber && !account.phoneNumbers.includes(phoneNumber)) {
        account.phoneNumbers.push(phoneNumber);
      }
      account.friendlyName = friendlyName || accountInfo.friendlyName;
      await account.save();
    } else {
      // Create new
      account = await TwilioAccount.create({
        accountSid,
        authToken,
        phoneNumbers,
        friendlyName: friendlyName || accountInfo.friendlyName,
      });
    }

    res.status(201).json({
      success: true,
      message: phoneNumber ? "Phone number added" : "Twilio account added",
      data: {
        ...account.toObject(),
        authToken: undefined, // Don't return auth token
      },
    });
  } catch (error) {
    console.error("Add Twilio account error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   DELETE /api/admin/twilio-accounts/:id
// @desc    Remove a Twilio account
// @access  Private (admin)
router.delete("/twilio-accounts/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const account = await TwilioAccount.findByIdAndDelete(req.params.id);
    
    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Twilio account not found",
      });
    }

    // Unassign phone numbers from users
    await User.updateMany(
      { phoneNumber: { $in: account.phoneNumbers } },
      { phoneNumber: null }
    );

    res.json({
      success: true,
      message: "Twilio account removed",
    });
  } catch (error) {
    console.error("Delete Twilio account error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   DELETE /api/admin/twilio-accounts/:accountSid/phones/:phone
// @desc    Remove a single phone number from a Twilio account
// @access  Private (admin)
router.delete("/twilio-accounts/:accountSid/phones/:phone", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { accountSid, phone } = req.params;
    const decodedPhone = decodeURIComponent(phone);

    const account = await TwilioAccount.findOne({ accountSid });
    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Twilio account not found",
      });
    }

    if (!account.phoneNumbers.includes(decodedPhone)) {
      return res.status(404).json({
        success: false,
        message: "Phone number not found in this account",
      });
    }

    // Remove phone from account
    account.phoneNumbers = account.phoneNumbers.filter((p) => p !== decodedPhone);
    await account.save();

    // Unassign from any user who has this phone
    await User.updateMany({ phoneNumber: decodedPhone }, { phoneNumber: null });

    // If account has no more phones, optionally delete it
    if (account.phoneNumbers.length === 0) {
      await TwilioAccount.findByIdAndDelete(id);
      return res.json({
        success: true,
        message: "Phone number removed. Account deleted (no remaining numbers).",
        accountDeleted: true,
      });
    }

    res.json({
      success: true,
      message: "Phone number removed",
      data: { remainingPhones: account.phoneNumbers },
    });
  } catch (error) {
    console.error("Delete phone from account error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users (admin only)
// @access  Private (admin)
router.get("/users", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   PUT /api/admin/users/:id/assign-phone
// @desc    Assign a phone number to a user
// @access  Private (admin)
router.put("/users/:id/assign-phone", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (phoneNumber) {
      // Verify phone number exists in a Twilio account
      const account = await TwilioAccount.findOne({ phoneNumbers: phoneNumber });
      if (!account) {
        return res.status(400).json({
          success: false,
          message: "Phone number not found in any Twilio account",
        });
      }

      // Auto-configure webhook for this specific number
      const webhookBase = process.env.WEBHOOK_BASE_URL;
      if (webhookBase && account.accountSid && account.authToken) {
        try {
          const client = twilio(account.accountSid, account.authToken);
          const numbers = await client.incomingPhoneNumbers.list({ phoneNumber });
          if (numbers.length > 0) {
            await client.incomingPhoneNumbers(numbers[0].sid).update({
              voiceUrl: `${webhookBase}/api/twilio/webhook/voice`,
              voiceMethod: "POST",
              smsUrl: `${webhookBase}/api/twilio/webhook/sms`,
              smsMethod: "POST",
            });
            console.log(`✅ Auto-configured webhooks for ${phoneNumber}`);
          }
        } catch (webhookErr) {
          console.error(`⚠️ Failed to auto-configure webhooks for ${phoneNumber}:`, webhookErr.message);
          // Continue anyway - don't block assignment
        }
      }

      // Check if already assigned to another user
      const existingUser = await User.findOne({ phoneNumber, _id: { $ne: userId } });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Phone number already assigned to another user",
        });
      }

      // Update phone assignment tracking
      await TwilioAccount.updateOne(
        { _id: account._id },
        {
          $pull: { phoneAssignments: { phoneNumber } },
        }
      );
      await TwilioAccount.updateOne(
        { _id: account._id },
        {
          $push: {
            phoneAssignments: {
              phoneNumber,
              userId: user._id,
              assignedAt: new Date(),
            },
          },
        }
      );
    }

    user.phoneNumber = phoneNumber || null;
    await user.save();

    res.json({
      success: true,
      message: phoneNumber ? "Phone number assigned" : "Phone number unassigned",
      data: user,
    });
  } catch (error) {
    console.error("Assign phone error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   PUT /api/admin/users/:id/role
// @desc    Update user role
// @access  Private (admin)
router.put("/users/:id/role", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { role } = req.body;
    const userId = req.params.id;

    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "User role updated",
      data: user,
    });
  } catch (error) {
    console.error("Update role error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   GET /api/admin/available-phones
// @desc    Get all phone numbers not assigned to any user
// @access  Private (admin)
router.get("/available-phones", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const accounts = await TwilioAccount.find();
    const allPhones = accounts.flatMap(a => a.phoneNumbers);
    
    const assignedUsers = await User.find({ phoneNumber: { $ne: null } }).select("phoneNumber");
    const assignedPhones = assignedUsers.map(u => u.phoneNumber);
    
    const availablePhones = allPhones.filter(p => !assignedPhones.includes(p));

    res.json({
      success: true,
      data: {
        all: allPhones,
        assigned: assignedPhones,
        available: availablePhones,
      },
    });
  } catch (error) {
    console.error("Get available phones error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   POST /api/admin/refresh-twilio-numbers
// @desc    Refresh phone numbers from Twilio
// @access  Private (admin)
router.post("/refresh-twilio-numbers", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const accounts = await TwilioAccount.find();
    const results = [];

    for (const account of accounts) {
      try {
        const client = twilio(account.accountSid, account.authToken);
        const numbers = await client.incomingPhoneNumbers.list();
        account.phoneNumbers = numbers.map(n => n.phoneNumber);
        await account.save();
        results.push({
          accountSid: account.accountSid,
          phoneNumbers: account.phoneNumbers,
          success: true,
        });
      } catch (e) {
        results.push({
          accountSid: account.accountSid,
          success: false,
          error: e.message,
        });
      }
    }

    res.json({
      success: true,
      message: "Phone numbers refreshed",
      data: results,
    });
  } catch (error) {
    console.error("Refresh numbers error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

export default router;
