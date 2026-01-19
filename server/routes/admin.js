import express from "express";
import twilio from "twilio";
import TwilioAccount from "../models/TwilioAccount.js";
import User from "../models/User.js";
import { authMiddleware, adminMiddleware } from "./auth.js";
import { cleanupUserData } from "../utils/cleanupUserData.js";

const router = express.Router();

const normalizeToE164ish = (value) => {
  if (!value) return "";
  const cleaned = String(value).replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  const digits = String(value).replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return cleaned;
};

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
        message: "Invalid phone service credentials",
        error: e.message,
      });
    }

    // Only add the specific phone number provided (never auto-import all numbers)
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "phoneNumber is required. This endpoint only adds one specific number and will not import all numbers automatically.",
      });
    }

    const normalizedPhone = normalizeToE164ish(phoneNumber);
    if (!normalizedPhone) {
      return res.status(400).json({
        success: false,
        message: "Invalid phoneNumber",
      });
    }

    // Verify this phone number belongs to the account (do an exact match)
    const allIncoming = await client.incomingPhoneNumbers.list();
    const match = allIncoming.find((n) => normalizeToE164ish(n.phoneNumber) === normalizedPhone);
    if (!match) {
      return res.status(400).json({
        success: false,
        message: "Phone number not found in this account",
      });
    }

    // Configure webhook for this specific number
    const webhookBase = process.env.WEBHOOK_BASE_URL;
    if (webhookBase) {
      try {
        await client.incomingPhoneNumbers(match.sid).update({
          voiceUrl: `${webhookBase}/api/twilio/webhook/voice`,
          voiceMethod: "POST",
          smsUrl: `${webhookBase}/api/twilio/webhook/sms`,
          smsMethod: "POST",
        });
        console.log(`✅ Configured webhooks for ${normalizedPhone}`);
      } catch (err) {
        console.error(`❌ Failed to configure webhooks for ${normalizedPhone}:`, err.message);
      }
    }

    // Check if account already exists
    let account = await TwilioAccount.findOne({ accountSid });
    if (account) {
      // Update existing - merge phone numbers (don't replace)
      account.authToken = authToken;
      const existingNorm = new Set(account.phoneNumbers.map((p) => normalizeToE164ish(p)));
      if (!existingNorm.has(normalizedPhone)) {
        account.phoneNumbers.push(normalizedPhone);
      }
      account.friendlyName = friendlyName || accountInfo.friendlyName;
      await account.save();
    } else {
      // Create new
      account = await TwilioAccount.create({
        accountSid,
        authToken,
        phoneNumbers: [normalizedPhone],
        friendlyName: friendlyName || accountInfo.friendlyName,
      });
    }

    res.status(201).json({
      success: true,
      message: "Phone number added",
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
        message: "Phone service account not found",
      });
    }

    // Find all users who have these phone numbers and clean up their data
    const affectedUsers = await User.find({ phoneNumber: { $in: account.phoneNumbers } });
    for (const user of affectedUsers) {
      console.log(`🧹 Cleaning data for user ${user._id} (phone: ${user.phoneNumber})`);
      await cleanupUserData(user._id);
    }

    // Unassign phone numbers from users
    await User.updateMany(
      { phoneNumber: { $in: account.phoneNumbers } },
      { phoneNumber: null }
    );

    res.json({
      success: true,
      message: "Phone service account removed and all user data cleaned up",
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

// @route   DELETE /api/admin/twilio-accounts/by-sid/:accountSid
// @desc    Remove a Twilio account by Account SID
// @access  Private (admin)
router.delete("/twilio-accounts/by-sid/:accountSid", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { accountSid } = req.params;
    const account = await TwilioAccount.findOneAndDelete({ accountSid });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Phone service account not found",
      });
    }

    // Find all users who have these phone numbers and clean up their data
    const affectedUsers = await User.find({ phoneNumber: { $in: account.phoneNumbers } });
    for (const user of affectedUsers) {
      console.log(`🧹 Cleaning data for user ${user._id} (phone: ${user.phoneNumber})`);
      await cleanupUserData(user._id);
    }

    await User.updateMany(
      { phoneNumber: { $in: account.phoneNumbers } },
      { phoneNumber: null }
    );

    res.json({
      success: true,
      message: "Phone service account removed and all user data cleaned up",
    });
  } catch (error) {
    console.error("Delete Twilio account by SID error:", error);
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
    const targetNorm = normalizeToE164ish(decodedPhone);

    const account = await TwilioAccount.findOne({ accountSid });
    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Phone service account not found",
      });
    }

    const existingNorm = new Set(account.phoneNumbers.map((p) => normalizeToE164ish(p)));
    if (!existingNorm.has(targetNorm)) {
      return res.status(404).json({
        success: false,
        message: "Phone number not found in this account",
      });
    }

    // Remove phone from account
    const removedPhones = account.phoneNumbers.filter((p) => normalizeToE164ish(p) === targetNorm);
    account.phoneNumbers = account.phoneNumbers.filter((p) => normalizeToE164ish(p) !== targetNorm);
    await account.save();

    // Find all users who have this phone and clean up their data
    const affectedUsers = await User.find({ phoneNumber: { $in: [decodedPhone, targetNorm, ...removedPhones] } });
    for (const user of affectedUsers) {
      console.log(`🧹 Cleaning data for user ${user._id} (phone: ${user.phoneNumber})`);
      await cleanupUserData(user._id);
    }

    // Unassign from any user who has this phone
    await User.updateMany({ phoneNumber: { $in: [decodedPhone, targetNorm, ...removedPhones] } }, { phoneNumber: null });

    // If account has no more phones, optionally delete it
    if (account.phoneNumbers.length === 0) {
      await TwilioAccount.findByIdAndDelete(account._id);
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

// @route   POST /api/admin/cleanup-phone-assignments
// @desc    Find users with assigned phones and optionally unassign them
// @access  Private (admin)
router.post("/cleanup-phone-assignments", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { unassign } = req.body; // If true, actually unassign; otherwise just report

    const usersWithPhones = await User.find({ phoneNumber: { $ne: null } }).select("_id name email phoneNumber");
    
    const report = usersWithPhones.map(u => ({
      userId: u._id,
      name: u.name,
      email: u.email,
      phoneNumber: u.phoneNumber,
    }));

    if (unassign && usersWithPhones.length > 0) {
      for (const user of usersWithPhones) {
        console.log(`🧹 Admin cleanup: unassigning ${user.phoneNumber} from user ${user._id}`);
        await cleanupUserData(user._id);
        user.phoneNumber = null;
        await user.save();
      }
    }

    res.json({
      success: true,
      message: unassign 
        ? `Unassigned ${usersWithPhones.length} phone numbers` 
        : `Found ${usersWithPhones.length} users with assigned phones`,
      data: report,
    });
  } catch (error) {
    console.error("Cleanup phone assignments error:", error);
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
          message: "Phone number not found in any account",
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

    // If phone is being removed or changed, clean up all user data
    const oldPhone = user.phoneNumber;
    const isUnassigning = !phoneNumber && oldPhone;
    const isChangingPhone = phoneNumber && oldPhone && phoneNumber !== oldPhone;
    
    if (isUnassigning || isChangingPhone) {
      console.log(`🧹 Phone ${isUnassigning ? 'unassigned' : 'changed'} for user ${userId}. Cleaning up all data...`);
      await cleanupUserData(userId);
    }

    user.phoneNumber = phoneNumber || null;
    await user.save();

    res.json({
      success: true,
      message: phoneNumber ? "Phone number assigned" : "Phone number unassigned (all data cleared)",
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
    // This endpoint imports ALL numbers from Twilio into Mongo.
    // Require explicit confirmation so it can't be triggered accidentally.
    if (req.body?.confirm !== "IMPORT_ALL") {
      return res.status(400).json({
        success: false,
        message: "Refusing to import all numbers. To proceed, send JSON body { confirm: \"IMPORT_ALL\" }.",
      });
    }

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
