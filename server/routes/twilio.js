import express from "express";
import twilio from "twilio";
import { v2 as cloudinary } from "cloudinary";
import TwilioAccount from "../models/TwilioAccount.js";
import User from "../models/User.js";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import Contact from "../models/Contact.js";
import CallRecord from "../models/CallRecord.js";
import Rule from "../models/Rule.js";
import Media from "../models/Media.js";
import { authMiddleware } from "./auth.js";
import { analyzeIncomingMessage, classifyMessageAsSpam } from "../services/aiService.js";

const router = express.Router();

const hasCloudinaryConfig =
  !!process.env.CLOUDINARY_CLOUD_NAME &&
  !!process.env.CLOUDINARY_API_KEY &&
  !!process.env.CLOUDINARY_API_SECRET;

if (hasCloudinaryConfig) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

// In-memory store for incoming messages (for demo purposes)
// In production, use a database
const incomingMessages = [];
const MAX_MESSAGES = 100;

// Helper to save message to MongoDB
async function saveMessageToDB(msgData) {
  console.log("📝 saveMessageToDB called with:", JSON.stringify(msgData, null, 2));
  
  try {
    // Twilio will sometimes retry webhooks; also clients can retry sends.
    // If we already stored this Twilio message SID for this user, skip creating a duplicate.
    if (msgData?.userId && msgData?.twilioSid) {
      const existing = await Message.findOne({ userId: msgData.userId, twilioSid: msgData.twilioSid });
      if (existing) {
        console.log("ℹ️ Duplicate twilioSid detected; returning existing message:", msgData.twilioSid);
        return existing;
      }
    }

    // Ensure contactId is populated if possible
    if (!msgData.contactId && msgData.userId && msgData.contactPhone) {
      try {
        const contact = await Contact.findOne({ 
          userId: msgData.userId, 
          phone: msgData.contactPhone 
        });
        if (contact) {
          msgData.contactId = contact._id;
          // Also update contact name if it's "Unknown"
          if (msgData.contactName === "Unknown" || !msgData.contactName) {
            msgData.contactName = contact.name;
          }
        }
      } catch (e) {
        console.warn("Failed to lookup contact for message:", e.message);
      }
    }

    // Create the message
    console.log("📝 Creating message in MongoDB...");
    const message = await Message.create(msgData);
    console.log("✅ Message created with ID:", message._id);
    
    // Use phone number as display name if contactName is Unknown or empty
    const displayName = (msgData.contactName && msgData.contactName !== "Unknown") 
      ? msgData.contactName 
      : msgData.contactPhone || "Unknown";
    
    // Update or create conversation
    const conversationFilter = { 
      userId: msgData.userId, 
      contactPhone: msgData.contactPhone 
    };

    const conversationUpdate = {
      $set: {
        lastMessage: msgData.body?.substring(0, 100) || "",
        lastMessageAt: new Date(),
        contactName: displayName,
        // Ensure these fields are set if a new document is created
        userId: msgData.userId,
        contactPhone: msgData.contactPhone,
      }
    };
    
    // Add contactId to conversation update if we found it
    if (msgData.contactId) {
      conversationUpdate.$set.contactId = msgData.contactId;
    }
    
    console.log("📝 Updating conversation with filter:", JSON.stringify(conversationFilter));
    
    if (msgData.direction === "incoming") {
      // For incoming, increment unread count
      conversationUpdate.$inc = { unreadCount: 1 };
    } else {
      // For outgoing, ensure unread count exists (default 0) but don't increment
      conversationUpdate.$setOnInsert = { unreadCount: 0 };
    }

    const conv = await Conversation.findOneAndUpdate(
      conversationFilter,
      conversationUpdate,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log("✅ Conversation updated/created:", conv._id);

    // Outgoing messages must never be effectively "filtered" by a stale held flag.
    // If the user is actively sending a message, treat the thread as released from hold.
    // Keep hold if the user explicitly muted the conversation (mute uses held as a UI grouping).
    if (msgData.direction !== "incoming" && conv?.isHeld && !conv?.isMuted) {
      await Conversation.findByIdAndUpdate(conv._id, { isHeld: false });
    }
    
    return message;
  } catch (error) {
    console.error("❌ saveMessageToDB FAILED:", error);
    console.error("❌ Error name:", error.name);
    console.error("❌ Error message:", error.message);
    if (error.errors) {
      console.error("❌ Validation errors:", JSON.stringify(error.errors, null, 2));
    }
    throw error; // Rethrow to let caller handle it
  }
}

// @route   GET /api/twilio/config
// @desc    Get Twilio configuration for the current user
// @access  Private
router.get("/config", authMiddleware, async (req, res) => {
  try {
    let assignedNumber = null;
    
    // 1. Try to find explicit assignment in DB
    const account = await TwilioAccount.findOne({
      "phoneAssignments.userId": req.user.id
    });

    if (account) {
      const assignment = account.phoneAssignments.find(
        p => p.userId.toString() === req.user.id
      );
      if (assignment) {
        assignedNumber = assignment.phoneNumber;
      }
    }
    
    // 2. If no assignment, fallback to first available number from DB (for dev/single-user)
    if (!assignedNumber) {
         const anyAccount = await TwilioAccount.findOne();
         if (anyAccount && anyAccount.phoneNumbers.length > 0) {
             assignedNumber = anyAccount.phoneNumbers[0];
         }
    }
    
    // 3. Final fallback: use environment variable TWILIO_PHONE_NUMBER
    if (!assignedNumber) {
      assignedNumber = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER || null;
    }

    // Get fresh user data for personal number
    const user = await User.findById(req.user.id);

    res.json({
      success: true,
      assignedNumber,
      personalNumber: user ? user.phoneNumber : null
    });
  } catch (error) {
    console.error("Get Twilio config error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Resolve Twilio credentials - checks DB first, then env vars
async function resolveTwilioConfig(body = {}, userPhone = null) {
  // Normalize phone number helper
  const normalizePhone = (value) => {
    if (!value) return "";
    const cleaned = String(value).replace(/[^\d+]/g, "");
    if (cleaned.startsWith("+")) return cleaned;
    const digits = String(value).replace(/\D/g, "");
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    return cleaned;
  };

  // First try env vars (simplest case)
  let accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID;
  let authToken = process.env.TWILIO_AUTH_TOKEN || process.env.TWILIO_TOKEN;
  let fromNumber = userPhone || process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER;

  // If we have a user phone, try to find the Twilio account that owns it
  if (userPhone) {
    try {
      const normalizedUserPhone = normalizePhone(userPhone);
      // Try explicit assignment first
      let account = await TwilioAccount.findOne({
        "phoneAssignments.phoneNumber": { $in: [userPhone, normalizedUserPhone] },
      });

      // Then try exact match in phoneNumbers
      if (!account) {
        account = await TwilioAccount.findOne({ phoneNumbers: userPhone });
      }
      
      // If no match, try normalized version
      if (!account && normalizedUserPhone && normalizedUserPhone !== userPhone) {
        account = await TwilioAccount.findOne({ phoneNumbers: normalizedUserPhone });
      }
      
      // If still no match, search all accounts and compare normalized
      if (!account) {
        const allAccounts = await TwilioAccount.find({});
        for (const acc of allAccounts) {
          const normalizedPhones = (acc.phoneNumbers || []).map(p => normalizePhone(p));
          if (normalizedPhones.includes(normalizedUserPhone)) {
            account = acc;
            break;
          }
        }
      }
      
      if (account) {
        accountSid = account.accountSid;
        authToken = account.authToken;
        fromNumber = userPhone;
        console.log(`✅ Found Twilio account for phone ${userPhone}: ${account.accountSid.slice(0, 8)}...`);
      } else {
        console.log(`⚠️ No Twilio account found for phone ${userPhone}`);
      }
    } catch (e) {
      console.error("Error fetching Twilio account from DB:", e.message);
    }
  }

  // Do not allow client-supplied credentials. fromNumber is validated elsewhere.
  if (body.fromNumber) fromNumber = body.fromNumber;

  return { accountSid, authToken, fromNumber };
}

// Store an incoming message
function storeIncomingMessage(message) {
  incomingMessages.unshift(message);
  if (incomingMessages.length > MAX_MESSAGES) {
    incomingMessages.pop();
  }
}

// @route   GET /api/twilio/incoming-messages
// @desc    Get stored incoming messages
// @access  Private
router.get("/incoming-messages", (req, res) => {
  res.json({
    success: true,
    count: incomingMessages.length,
    data: incomingMessages,
  });
});

// @route   DELETE /api/twilio/incoming-messages
// @desc    Clear incoming messages
// @access  Private
router.delete("/incoming-messages", (req, res) => {
  incomingMessages.length = 0;
  res.json({ success: true, message: "Messages cleared" });
});

// @route   POST /api/twilio/verify-credentials
// @desc    Verify Twilio account credentials and phone number
// @access  Private (admin only)
router.post("/verify-credentials", async (req, res) => {
  try {
    const { accountSid, authToken, phoneNumber } = await resolveTwilioConfig(req.body);

    // Validation
    if (!accountSid || !authToken) {
      return res.status(400).json({
        success: false,
        message:
          "Account SID and Auth Token are required (provide in request body or set TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN env vars)",
      });
    }

    // Validate Account SID format
    if (!accountSid.startsWith("AC") || accountSid.length !== 34) {
      return res.status(400).json({
        success: false,
        message: "Invalid Account SID format. Must start with 'AC' and be 34 characters",
      });
    }

    // Create Twilio client
    let client;
    try {
      client = twilio(accountSid, authToken);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Failed to initialize Twilio client. Check your credentials.",
      });
    }

    // Verify credentials by fetching account info
    let accountInfo;
    try {
      accountInfo = await client.api.accounts(accountSid).fetch();
    } catch (error) {
      console.error("Twilio auth error:", error.message);
      return res.status(401).json({
        success: false,
        message: "Invalid Twilio credentials. Please check your Account SID and Auth Token.",
        error: error.message,
      });
    }

    // If phone number provided, verify it belongs to this account
    if (phoneNumber) {
      try {
        // Clean up phone number format
        const cleanPhone = phoneNumber.replace(/[^\d+]/g, "");
        
        // Get all incoming phone numbers for this account
        const incomingPhoneNumbers = await client.incomingPhoneNumbers.list();
        
        // Check if the phone number exists in this account
        const phoneExists = incomingPhoneNumbers.some(
          (p) => p.phoneNumber === cleanPhone
        );

        if (!phoneExists) {
          // List available numbers for reference
          const availableNumbers = incomingPhoneNumbers.map((p) => p.phoneNumber);
          return res.status(400).json({
            success: false,
            message: `Phone number ${cleanPhone} not found in this Twilio account`,
            availableNumbers: availableNumbers.length > 0 ? availableNumbers : "No phone numbers in this account",
          });
        }

        // Get phone number details
        const phoneDetails = incomingPhoneNumbers.find(
          (p) => p.phoneNumber === cleanPhone
        );

        return res.json({
          success: true,
          message: "Credentials and phone number verified successfully",
          data: {
            account: {
              sid: accountInfo.sid,
              friendlyName: accountInfo.friendlyName,
              status: accountInfo.status,
              type: accountInfo.type,
            },
            phoneNumber: {
              phoneNumber: phoneDetails.phoneNumber,
              friendlyName: phoneDetails.friendlyName,
              capabilities: phoneDetails.capabilities,
              smsEnabled: phoneDetails.capabilities?.sms || false,
              voiceEnabled: phoneDetails.capabilities?.voice || false,
            },
          },
        });
      } catch (error) {
        console.error("Phone verification error:", error.message);
        return res.status(400).json({
          success: false,
          message: "Failed to verify phone number",
          error: error.message,
        });
      }
    }

    // Return account info if no phone number provided
    res.json({
      success: true,
      message: "Twilio credentials verified successfully",
      data: {
        account: {
          sid: accountInfo.sid,
          friendlyName: accountInfo.friendlyName,
          status: accountInfo.status,
          type: accountInfo.type,
        },
      },
    });
  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during verification",
      error: error.message,
    });
  }
});

// @route   GET /api/twilio/list-numbers
// @desc    List all phone numbers in a Twilio account
// @access  Private (admin only)
router.post("/list-numbers", async (req, res) => {
  try {
    const { accountSid, authToken } = await resolveTwilioConfig(req.body);

    if (!accountSid || !authToken) {
      return res.status(400).json({
        success: false,
        message:
          "Account SID and Auth Token are required (provide in request body or set TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN env vars)",
      });
    }

    const client = twilio(accountSid, authToken);

    try {
      const incomingPhoneNumbers = await client.incomingPhoneNumbers.list();

      const numbers = incomingPhoneNumbers.map((p) => ({
        phoneNumber: p.phoneNumber,
        friendlyName: p.friendlyName,
        smsEnabled: p.capabilities?.sms || false,
        voiceEnabled: p.capabilities?.voice || false,
        status: p.status,
      }));

      res.json({
        success: true,
        count: numbers.length,
        data: numbers,
      });
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials or failed to fetch numbers",
        error: error.message,
      });
    }
  } catch (error) {
    console.error("List numbers error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   POST /api/twilio/send-sms
// @desc    Send an SMS message using user's assigned phone number
// @access  Private (user)
router.post("/send-sms", authMiddleware, async (req, res) => {
  try {
    const { toNumber, body, fromNumber, contactName, mediaBase64, mediaType } = req.body;
    
    if (!fromNumber) {
      return res.status(400).json({
        success: false,
        message: "No phone number assigned to user. Admin must assign a Twilio number first.",
      });
    }
    
    // Either body or media is required
    if (!toNumber || (!body && !mediaBase64)) {
      return res.status(400).json({
        success: false,
        message: "toNumber and either body or media are required",
      });
    }

    // Images only for attachments
    const allowedImageTypes = new Set([
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ]);
    const normalizedMediaType = String(mediaType || "").toLowerCase();
    if (mediaBase64) {
      if (!normalizedMediaType || !normalizedMediaType.startsWith("image/")) {
        return res.status(400).json({
          success: false,
          message: "Only image attachments are supported.",
        });
      }
      if (!allowedImageTypes.has(normalizedMediaType)) {
        return res.status(400).json({
          success: false,
          message: `Unsupported image type: ${normalizedMediaType}`,
        });
      }
    }

    const cleanFrom = (fromNumber || "").replace(/[^\d+]/g, "");
      const normalizeToE164ish = (value) => {
        if (!value) return "";
        const cleaned = String(value).replace(/[^\d+]/g, "");
        if (cleaned.startsWith("+")) return cleaned;
        const digits = String(value).replace(/\D/g, "");
        if (digits.length === 10) return `+1${digits}`;
        if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
        return cleaned;
      };
      const cleanTo = normalizeToE164ish(toNumber);

    // Prevent spoofing: users can only send from their assigned number
    if (req.user?.phoneNumber) {
      const userFrom = String(req.user.phoneNumber).replace(/[^\d+]/g, "");
      if (userFrom && userFrom !== cleanFrom) {
        return res.status(403).json({
          success: false,
          message: "fromNumber does not match your assigned phone number",
        });
      }
    }

    // Resolve credentials from DB based on the fromNumber
    const { accountSid, authToken } = await resolveTwilioConfig(req.body, fromNumber);

    if (!accountSid || !authToken) {
      return res.status(400).json({
        success: false,
        message:
          "Twilio credentials not found. Add a Twilio account in admin panel or set env vars.",
      });
    }

    const client = twilio(accountSid, authToken);
    
    // Validate that fromNumber belongs to this Twilio account
    try {
      const numbers = await client.incomingPhoneNumbers.list();
      const validNumber = numbers.find(n => n.phoneNumber === cleanFrom);
      
      if (!validNumber) {
        console.error(`Phone ${cleanFrom} not found in Twilio account. Available: ${numbers.map(n => n.phoneNumber).join(", ")}`);
        return res.status(400).json({
          success: false,
          message: `Phone number ${cleanFrom} is not registered in the Twilio account. Contact admin.`,
        });
      }
      
      if (!validNumber.capabilities?.sms) {
        return res.status(400).json({
          success: false,
          message: `Phone number ${cleanFrom} does not have SMS capability enabled.`,
        });
      }
      
      // Check MMS capability if sending media
      if (mediaBase64 && !validNumber.capabilities?.mms) {
        return res.status(400).json({
          success: false,
          message: `Phone number ${cleanFrom} does not have MMS capability. Cannot send images.`,
        });
      }
    } catch (e) {
      console.error("Failed to validate Twilio number:", e.message);
      // Continue anyway - Twilio will reject if invalid
    }

    try {
      // Base URL for callbacks/media
      const baseUrl =
        process.env.RENDER_EXTERNAL_URL ||
        process.env.API_BASE_URL ||
        `${req.protocol}://${req.get("host")}`;

      // Build message options
      const messageOptions = {
        body: body || "",
        from: cleanFrom,
        to: cleanTo,
        // Ensure Twilio posts delivery/failure updates back to us
        statusCallback: `${baseUrl}/api/twilio/webhook/status`,
      };

      // Track attachment for saving to message
      let outboundAttachment = null;

      // If media is provided, create a public URL for Twilio to fetch (Cloudinary if configured)
      if (mediaBase64) {
        console.log("📷 MMS requested - media type:", normalizedMediaType);
        
        try {
          let mediaUrl;
          if (hasCloudinaryConfig) {
            const upload = await cloudinary.uploader.upload(mediaBase64, {
              resource_type: "image",
              folder: "comsierge/mms",
            });
            mediaUrl = upload?.secure_url;
            console.log("📷 Cloudinary URL for Twilio:", mediaUrl);
          }

          if (!mediaUrl) {
            // Fallback: Store media in MongoDB
            const media = new Media({
              data: mediaBase64,
              mimeType: normalizedMediaType || "image/jpeg",
              userId: req.user._id,
            });
            await media.save();
            console.log("📷 Media saved to MongoDB with ID:", media._id);

            // Create public URL for Twilio to fetch
            mediaUrl = `${baseUrl}/api/media/${media._id}`;
            console.log("📷 Media URL for Twilio:", mediaUrl);
          }
          
          // Add media URL to message options
          messageOptions.mediaUrl = [mediaUrl];
          
          // Store attachment info for the message record
          outboundAttachment = {
            url: mediaUrl,
            contentType: normalizedMediaType || "image/jpeg",
            filename: "sent_image",
          };
        } catch (mediaError) {
          console.error("❌ Failed to save media:", mediaError);
          return res.status(500).json({
            success: false,
            message: "Failed to process image for MMS",
          });
        }
      }

      console.log("📤 Sending message to Twilio with options:", JSON.stringify({
        ...messageOptions,
        body: messageOptions.body?.substring(0, 50) + "..." // Truncate body for logging
      }, null, 2));

      let twilioMessage;
      try {
        twilioMessage = await client.messages.create(messageOptions);
      } catch (twilioError) {
        console.error("❌ Twilio API error:", twilioError.message);
        console.error("❌ Twilio error code:", twilioError.code);
        console.error("❌ Twilio error details:", twilioError.moreInfo);
        return res.status(400).json({
          success: false,
          message: `Twilio error: ${twilioError.message}`,
          code: twilioError.code,
          moreInfo: twilioError.moreInfo,
        });
      }

      console.log("✅ Twilio message sent:", twilioMessage.sid);

      // Save message to MongoDB for the authenticated user
      let savedMessage = null;
      try {
        const msgData = {
          userId: req.user._id,
          contactPhone: cleanTo,
          contactName: contactName || "Unknown",
          direction: "outgoing",
          body: body || (outboundAttachment ? "[Image]" : ""),
          // Delivery is async; start as pending and update via status callbacks
          status: "pending",
          twilioSid: twilioMessage.sid,
          fromNumber: cleanFrom,
          toNumber: cleanTo,
          isRead: true, // Outgoing messages are always read
          // Include MMS attachment if present
          attachments: outboundAttachment ? [outboundAttachment] : undefined,
        };
        console.log("📝 Attempting to save message:", JSON.stringify(msgData, null, 2));
        savedMessage = await saveMessageToDB(msgData);
        console.log("✅ Message saved to DB with ID:", savedMessage?._id);
      } catch (dbError) {
        console.error("❌ Failed to save sent message to DB:", dbError);
        console.error("❌ Error details:", dbError.message, dbError.errors);
        // Return error to client so they know persistence failed
        return res.status(500).json({
          success: false,
          message: "Message sent via Twilio but failed to save to database history.",
          error: dbError.message,
          details: dbError.errors,
          data: {
            messageSid: twilioMessage.sid,
            status: twilioMessage.status,
          }
        });
      }

      res.json({
        success: true,
        message: "SMS sent successfully",
        data: {
          messageSid: twilioMessage.sid,
          status: twilioMessage.status,
          from: twilioMessage.from,
          to: twilioMessage.to,
          body: twilioMessage.body,
          dateCreated: twilioMessage.dateCreated,
        },
      });
    } catch (error) {
      console.error("Twilio send error:", error.message);
      return res.status(400).json({
        success: false,
        message: "Failed to send SMS",
        error: error.message,
      });
    }
  } catch (error) {
    console.error("Send SMS error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   POST /api/twilio/send-test-sms
// @desc    Send a test SMS to verify phone number works
// @access  Private (admin only)
router.post("/send-test-sms", async (req, res) => {
  try {
    const { accountSid, authToken, fromNumber } = await resolveTwilioConfig(req.body);
    const { toNumber } = req.body;

    if (!accountSid || !authToken || !fromNumber || !toNumber) {
      return res.status(400).json({
        success: false,
        message:
          "All fields are required: accountSid, authToken, fromNumber, toNumber (accountSid/authToken/fromNumber can come from TWILIO_* env vars)",
      });
    }

    const client = twilio(accountSid, authToken);

    try {
      const message = await client.messages.create({
        body: "This is a test message from Comsierge to verify your phone number setup.",
        from: fromNumber,
        to: toNumber,
      });

      res.json({
        success: true,
        message: "Test SMS sent successfully",
        data: {
          messageSid: message.sid,
          status: message.status,
          from: message.from,
          to: message.to,
        },
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Failed to send test SMS",
        error: error.message,
      });
    }
  } catch (error) {
    console.error("Send test SMS error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   POST /api/twilio/configure-webhooks
// @desc    Configure webhooks for a phone number
// @access  Private (admin only)
router.post("/configure-webhooks", async (req, res) => {
  try {
    const { accountSid, authToken, phoneNumber, baseUrl } = req.body;

    if (!accountSid || !authToken || !phoneNumber || !baseUrl) {
      return res.status(400).json({
        success: false,
        message: "All fields are required: accountSid, authToken, phoneNumber, baseUrl",
      });
    }

    const client = twilio(accountSid, authToken);

    try {
      // Find the phone number SID
      const incomingPhoneNumbers = await client.incomingPhoneNumbers.list();
      const cleanPhone = phoneNumber.replace(/[^\d+]/g, "");
      const phoneRecord = incomingPhoneNumbers.find(p => p.phoneNumber === cleanPhone);

      if (!phoneRecord) {
        return res.status(404).json({
          success: false,
          message: `Phone number ${cleanPhone} not found in this account`,
        });
      }

      // Update the phone number with webhook URLs
      const updated = await client.incomingPhoneNumbers(phoneRecord.sid).update({
        smsUrl: `${baseUrl}/api/twilio/webhook/sms`,
        smsMethod: "POST",
        voiceUrl: `${baseUrl}/api/twilio/webhook/voice`,
        voiceMethod: "POST",
        statusCallback: `${baseUrl}/api/twilio/webhook/status`,
        statusCallbackMethod: "POST",
      });

      res.json({
        success: true,
        message: "Webhooks configured successfully",
        data: {
          phoneNumber: updated.phoneNumber,
          friendlyName: updated.friendlyName,
          smsUrl: updated.smsUrl,
          voiceUrl: updated.voiceUrl,
          statusCallback: updated.statusCallback,
        },
      });
    } catch (error) {
      console.error("Webhook config error:", error.message);
      return res.status(400).json({
        success: false,
        message: "Failed to configure webhooks",
        error: error.message,
      });
    }
  } catch (error) {
    console.error("Configure webhooks error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   POST /api/twilio/webhook/sms
// @desc    Handle incoming SMS/MMS messages with AI analysis and routing rules
// @access  Public (Twilio webhook)
router.post("/webhook/sms", async (req, res) => {
  try {
    const { From, To, Body, MessageSid, AccountSid, NumMedia } = req.body;
    
    console.log("📨 Incoming SMS/MMS:");
    console.log(`   From: ${From}`);
    console.log(`   To: ${To}`);
    console.log(`   Body: ${Body}`);
    console.log(`   MessageSid: ${MessageSid}`);
    console.log(`   NumMedia: ${NumMedia || 0}`);
    
    // Parse MMS attachments (images only)
    const attachments = [];
    const numMedia = parseInt(NumMedia || 0, 10);
    if (numMedia > 0) {
      console.log(`   📎 Processing ${numMedia} media attachment(s)...`);
      for (let i = 0; i < numMedia; i++) {
        const mediaUrl = req.body[`MediaUrl${i}`];
        const mediaContentType = req.body[`MediaContentType${i}`];
        if (mediaUrl && String(mediaContentType || "").toLowerCase().startsWith("image/")) {
          console.log(`   📎 Media ${i}: ${mediaContentType} - ${mediaUrl}`);
          attachments.push({
            url: mediaUrl,
            contentType: mediaContentType,
            filename: `media_${i}_${MessageSid}`,
          });
        } else if (mediaUrl) {
          console.log(`   📎 Skipping non-image media ${i}: ${mediaContentType}`);
        }
      }
    }

    // Store the message in memory (for backwards compat)
    storeIncomingMessage({
      id: MessageSid,
      from: From,
      to: To,
      body: Body,
      accountSid: AccountSid,
      direction: "inbound",
      timestamp: new Date().toISOString(),
      status: "received",
    });

    // Find the user who owns this phone number (To) and save to MongoDB
    try {
      const normalizeToE164ish = (value) => {
        if (!value) return "";
        const cleaned = String(value).replace(/[^\d+]/g, "");
        if (cleaned.startsWith("+")) return cleaned;
        const digits = String(value).replace(/\D/g, "");
        if (digits.length === 10) return `+1${digits}`;
        if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
        return cleaned;
      };

      const buildPhoneVariations = (raw) => {
        const normalized = normalizeToE164ish(raw);
        const digitsOnly = String(raw || "").replace(/\D/g, "");
        const last10 = digitsOnly.slice(-10);

        const variations = Array.from(
          new Set(
            [
              raw,
              normalized,
              normalized.replace(/^\+1/, ""),
              normalized.replace(/^\+/, ""),
              digitsOnly,
              digitsOnly.length === 11 && digitsOnly.startsWith("1") ? digitsOnly.slice(1) : digitsOnly,
            ].filter(Boolean)
          )
        );
        return { variations, last10 };
      };

      const { variations: toCandidates, last10 } = buildPhoneVariations(To);
      
      // Try exact matches first
      let user = await User.findOne({ phoneNumber: { $in: toCandidates } });
      
      // If not found, try regex on last 10 digits (allowing for formatting)
      if (!user && last10.length === 10) {
         const regexPattern = last10.split('').join('[^0-9]*');
         console.log(`   ⚠️ Exact match failed, trying regex: ${regexPattern}`);
         user = await User.findOne({ phoneNumber: { $regex: regexPattern, $options: 'i' } });
      }

      // If still not found, check TwilioAccount phone assignments
      if (!user) {
        console.log(`   ⚠️ User not found by phone number, checking TwilioAccount assignments...`);
        const account = await TwilioAccount.findOne({
          "phoneAssignments.phoneNumber": { $in: toCandidates }
        });
        
        if (account) {
          const assignment = account.phoneAssignments.find(p => toCandidates.includes(p.phoneNumber));
          if (assignment && assignment.userId) {
            user = await User.findById(assignment.userId);
            if (user) {
               console.log(`   ✅ Found user ${user.email} via TwilioAccount assignment`);
            }
          }
        }
      }

      // FALLBACK: If still no user, assign to the first Admin user found
      if (!user) {
        console.log(`   ⚠️ User still not found. Falling back to Admin user.`);
        user = await User.findOne({ role: 'admin' });
        if (user) {
           console.log(`   ✅ Fallback: Assigned message to Admin ${user.email}`);
        } else {
           user = await User.findOne({});
           if (user) console.log(`   ✅ Fallback: Assigned message to first user ${user.email}`);
        }
      }

      if (user) {
        // Look up contact info
        const { variations: fromCandidates } = buildPhoneVariations(From);
        const contact = await Contact.findOne({ userId: user._id, phone: { $in: fromCandidates } });
        
        // Build sender context for AI analysis
        const senderContext = {
          isSavedContact: !!contact,
          isFavorite: contact?.isFavorite || false,
          isBlocked: contact?.isBlocked || false,
          tags: contact?.tags || [],
          hasConversationHistory: false,
          messageCount: 0,
          userHasReplied: false,
        };
        
        // Get conversation history for context
        const previousMessages = await Message.find({
          userId: user._id,
          contactPhone: { $in: fromCandidates }
        }).sort({ createdAt: -1 }).limit(10);
        
        const conversationHistory = previousMessages.reverse().map(m => ({
          direction: m.direction,
          content: m.body,
          timestamp: m.createdAt
        }));
        
        senderContext.hasConversationHistory = conversationHistory.length > 0;
        senderContext.messageCount = conversationHistory.length;
        senderContext.userHasReplied = conversationHistory.some(m => m.direction === 'outgoing');
        
        console.log(`   📋 Sender context:`, JSON.stringify(senderContext, null, 2));
        
        // Check if sender is blocked
        if (senderContext.isBlocked) {
          console.log(`   🚫 Sender is BLOCKED - marking message as blocked`);
          await saveMessageToDB({
            userId: user._id,
            contactPhone: normalizeToE164ish(From),
            contactName: contact?.name || normalizeToE164ish(From),
            direction: "incoming",
            body: Body,
            status: "blocked",
            twilioSid: MessageSid,
            fromNumber: normalizeToE164ish(From),
            toNumber: normalizeToE164ish(To),
            isRead: true, // Blocked messages don't need to be "read"
            isBlocked: true,
          });
          
          // Update conversation as blocked
          await Conversation.findOneAndUpdate(
            { userId: user._id, contactPhone: normalizeToE164ish(From) },
            { isBlocked: true },
            { upsert: false }
          );
          
          res.type("text/xml");
          return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
        }
        
        // Run AI analysis
        let aiAnalysis = null;
        let spamAnalysis = null;
        let messageStatus = "received";
        let isHeld = false;
        let isPriority = false;
        let shouldNotify = true;
        
        try {
          console.log(`   Running AI analysis...`);
          
          // Run fast classification for ALL messages (uses your exact logic)
          spamAnalysis = await classifyMessageAsSpam(
            Body,
            From,
            contact?.name || From,
            senderContext,
            conversationHistory
          );
          
          console.log(`   Classification result:`, JSON.stringify(spamAnalysis, null, 2));
          
          // Use the category from classification
          const category = spamAnalysis.category || "INBOX";
          
          // CRITICAL: Also check spamAnalysis.isHeld directly in case it was set
          const spamIsHeld = spamAnalysis.isHeld === true;
          
          console.log(`   DEBUG: category=${category}, spamAnalysis.isHeld=${spamAnalysis.isHeld}, spamIsHeld=${spamIsHeld}`);
          
          if (category === "SPAM" || spamIsHeld) {
            console.log(`   → SPAM: ${spamAnalysis.reasoning}`);
            messageStatus = "spam";
            isHeld = true;
            shouldNotify = false;
          } else {
            // INBOX - not spam, not held
            console.log(`   → INBOX: ${spamAnalysis.reasoning}`);
            messageStatus = "received";
            isHeld = false;
            shouldNotify = true;
          }
          
          // Run full analysis only for INBOX messages from unknown senders
          // For saved contacts, we skip spam detection but STILL analyze for urgency/priority
          if (category === "INBOX" || senderContext.isSavedContact) {
            // Always analyze for urgency - saved contacts can send non-urgent messages too
            aiAnalysis = await analyzeIncomingMessage(
              Body,
              From,
              contact?.name || From,
              conversationHistory,
              senderContext
            );
            
            // Determine priority
            if (aiAnalysis?.priority === "high") {
              isPriority = true;
            }
          }
        } catch (aiError) {
          console.error(`   AI analysis failed:`, aiError.message);
          // On AI error: deliver to inbox but skip forwarding for unknown senders
          if (senderContext.isSavedContact) {
            console.log(`   AI failed but sender is saved contact - still notifying`);
            messageStatus = "received";
            isHeld = false;
            shouldNotify = true;
          } else {
            console.log(`   AI failed for unknown sender - inbox but skip forwarding`);
            messageStatus = "received";
            isHeld = false;
            shouldNotify = false; // Don't forward to personal phone on error
          }
        }
        
        // Get user's message notification rules
        const messageNotifyRules = await Rule.find({
          userId: user._id,
          type: "message-notify",
          active: true
        });
        
        console.log(`   Found ${messageNotifyRules.length} active message notification rules`);
        
        // SPAM should never notify/forward (even if tags would match).
        // This prevents accidentally forwarding spam/phishing to the user's personal phone.
        if (messageStatus === "spam" || spamAnalysis?.isSpam === true) {
          shouldNotify = false;
        }

        // Compute a deterministic effective priority for notification filtering.
        // This reduces reliance on LLM variability for obvious cases.
        const computeEffectivePriority = (text, aiPriority) => {
          const t = String(text || "").trim().toLowerCase();
          const p = String(aiPriority || "").toLowerCase();

          // Obvious short greetings should not page you unless you choose "All messages".
          if (
            t.length > 0 &&
            t.length <= 32 &&
            /^(me|hey|hi|hello|hiya|yo|sup|whats up|what's up)[!?.\s]*$/.test(t)
          ) {
            return "low";
          }

          // Urgent/emergency language should always be treated as high.
          if (/(\bemergency\b|\burgent\b|\basap\b|\bimmediately\b|\bright\s+now\b|\b911\b|\bhelp\b)/i.test(t)) {
            return "high";
          }

          // Scheduling/time-sensitive messages should be treated as high.
          if (
            /(\bmeeting\b|\bappointment\b|\bschedule\b|\breschedule\b|\bcall\s+me\b|\bdeadline\b|\bdue\b|\btoday\b|\btomorrow\b|\btonight\b|\bnext\s+week\b|\b\d{1,2}(:\d{2})?\s*(am|pm)\b)/i.test(t)
          ) {
            return "high";
          }

          if (p === "high" || p === "medium" || p === "low") return p;
          return "medium";
        };

        // Evaluate message notification rules
        for (const rule of messageNotifyRules) {
          const conditions = rule.conditions || {};
          const priorityFilter = conditions.priorityFilter || "all"; // all, important, urgent
          const notifyTags = conditions.notifyTags || [];
          
          console.log(`   Checking message rule: "${rule.rule}" (filter: ${priorityFilter})`);
          
          // Check "Always notify for messages from:" tags first
          if (notifyTags.length > 0) {
            const hasMatchingTag = notifyTags.some(tag => senderContext.tags.includes(tag));
            if (hasMatchingTag) {
              console.log(`   Tag match found - always notify`);
              // Still never notify for spam
              shouldNotify = !(messageStatus === "spam" || spamAnalysis?.isSpam === true);
              if (isHeld && !spamAnalysis?.isSpam) {
                isHeld = false;
                messageStatus = "received";
              }
              break;
            }
          }
          
          // Apply priority filter
          // all = notify for all messages
          // important = notify only for high + medium priority
          // urgent = notify only for high priority
          // 
          // Priority is determined by AI analysis for ALL messages (including saved contacts)
          // Saved contacts are NOT spam, but they can still send non-urgent messages
          const messagePriority = computeEffectivePriority(Body, aiAnalysis?.priority);
          
          console.log(`   Message priority: ${messagePriority} (AI-determined, isSavedContact: ${senderContext.isSavedContact})`);
          
          // Priority filter controls SMS FORWARDING to personal phone, NOT held status.
          // Messages go to "held" ONLY if they are spam. Non-spam messages stay in inbox
          // but just don't get forwarded to personal phone if priority is too low.
          switch (priorityFilter) {
            case "all":
              shouldNotify = !(messageStatus === "spam" || spamAnalysis?.isSpam === true);
              break;
            case "important":
              // Forward only high and medium priority
              if (messagePriority === "high" || messagePriority === "medium") {
                shouldNotify = !(messageStatus === "spam" || spamAnalysis?.isSpam === true);
              } else {
                shouldNotify = false;
                console.log(`   Low priority message - skipping notification (filter: important)`);
              }
              break;
            case "urgent":
              // Forward only high priority
              if (messagePriority === "high") {
                shouldNotify = !(messageStatus === "spam" || spamAnalysis?.isSpam === true);
              } else {
                shouldNotify = false;
                console.log(`   Non-urgent message - skipping notification (filter: urgent)`);
              }
              break;
          }
          break; // Only process first active rule
        }
        
        // If no message-notify rules exist, default to notify all
        if (messageNotifyRules.length === 0) {
          console.log(`   No message notification rules - defaulting to notify all`);
          shouldNotify = true;
        }
        
        // Track if message will be forwarded
        let wasForwarded = false;
        let forwardedTo = null;
        
        // Save message to database with analysis results
        const savedMessage = await saveMessageToDB({
          userId: user._id,
          contactPhone: normalizeToE164ish(From),
          contactName: contact?.name || normalizeToE164ish(From),
          direction: "incoming",
          body: Body || (attachments.length > 0 ? `[Media message: ${attachments.length} attachment(s)]` : ""),
          status: messageStatus,
          twilioSid: MessageSid,
          fromNumber: normalizeToE164ish(From),
          toNumber: normalizeToE164ish(To),
          isRead: false,
          // MMS attachments
          attachments: attachments.length > 0 ? attachments : undefined,
          // AI analysis fields
          aiAnalysis: aiAnalysis ? {
            priority: aiAnalysis.priority,
            category: aiAnalysis.category,
            sentiment: aiAnalysis.sentiment,
            keyTopics: aiAnalysis.keyTopics,
            suggestedResponse: aiAnalysis.suggestedResponse,
            confidence: aiAnalysis.confidence,
          } : null,
          spamAnalysis: spamAnalysis ? {
            isSpam: spamAnalysis.isSpam,
            spamProbability: spamAnalysis.spamProbability,
            senderTrust: spamAnalysis.senderTrust,
            intent: spamAnalysis.intent,
            reasoning: spamAnalysis.reasoning,
          } : null,
          // Status flags
          isHeld,
          isPriority,
          isBlocked: false,
        });
        
        // Update conversation with analysis results
        // IMPORTANT: Only set isHeld=true on the conversation if message is SPAM
        // Non-spam messages should NEVER set the conversation to held
        const conversationUpdate = {
          isPriority: isPriority || undefined,
          lastAiAnalysis: aiAnalysis ? {
            priority: aiAnalysis.priority,
            category: aiAnalysis.category,
            sentiment: aiAnalysis.sentiment,
          } : undefined,
        };
        
        // Only update isHeld if it's spam (true) - never clear it here as user may have manually held it
        if (isHeld && messageStatus === "spam") {
          conversationUpdate.isHeld = true;
        }
        
        await Conversation.findOneAndUpdate(
          { userId: user._id, contactPhone: normalizeToE164ish(From) },
          { $set: conversationUpdate },
          { upsert: false }
        );
        
        console.log(`   Saved to MongoDB for user ${user.email}`);
        console.log(`   Final status: ${messageStatus}, held: ${isHeld}, priority: ${isPriority}, notify: ${shouldNotify}`);
        console.log(`   User's forwardingNumber: ${user.forwardingNumber || "NOT SET"}`);
        
        // FORWARD SMS to user's personal phone if shouldNotify is true
        // But skip if the sender IS the user's personal number (no point forwarding to yourself)
        const normalizedFrom = normalizeToE164ish(From);
        const normalizedForwardingNumber = user.forwardingNumber ? normalizeToE164ish(user.forwardingNumber) : null;
        const isSenderPersonalNumber = normalizedForwardingNumber && normalizedFrom === normalizedForwardingNumber;
        
        console.log(`   Forward check: shouldNotify=${shouldNotify}, forwardingNumber=${user.forwardingNumber}, isSenderPersonalNumber=${isSenderPersonalNumber}`);
        
        if (isSenderPersonalNumber) {
          console.log(`   ❌ Skipping SMS forward - sender (${From}) is user's personal number`);
        } else if (shouldNotify && user.forwardingNumber) {
          console.log(`   Forwarding SMS to personal number: ${user.forwardingNumber}`);
          try {
            // Find the TwilioAccount that owns this phone number (To)
            const normalizedTo = normalizeToE164ish(To);
            let twilioAccount = await TwilioAccount.findOne({ phoneNumbers: To });
            
            // If no match, try normalized version
            if (!twilioAccount && normalizedTo && normalizedTo !== To) {
              twilioAccount = await TwilioAccount.findOne({ phoneNumbers: normalizedTo });
            }
            
            // If still no match, search all accounts and compare normalized
            if (!twilioAccount) {
              const allAccounts = await TwilioAccount.find({});
              for (const acc of allAccounts) {
                const normalizedPhones = (acc.phoneNumbers || []).map(p => normalizeToE164ish(p));
                if (normalizedPhones.includes(normalizedTo)) {
                  twilioAccount = acc;
                  break;
                }
              }
            }
            
            if (twilioAccount && twilioAccount.accountSid && twilioAccount.authToken) {
              console.log(`   Found TwilioAccount for ${To}: ${twilioAccount.accountSid.slice(0, 8)}...`);
              const forwardClient = twilio(twilioAccount.accountSid, twilioAccount.authToken);
              
              // Build forwarded message with sender info
              const senderName = contact?.name || From;
              const forwardedBody = `[SMS from ${senderName}]\n${Body}`;
              
              // Use the normalized To number
              const fromNumber = normalizedTo;
              
              const forwardResult = await forwardClient.messages.create({
                body: forwardedBody,
                from: fromNumber,
                to: user.forwardingNumber
              });
              
              wasForwarded = true;
              forwardedTo = user.forwardingNumber;
              console.log(`   SMS forwarded successfully to ${user.forwardingNumber}`);
              
              // Update the original message to mark it as forwarded
              await Message.findByIdAndUpdate(savedMessage._id, {
                wasForwarded: true,
                forwardedTo: user.forwardingNumber,
                forwardedAt: new Date(),
                forwardedTwilioSid: forwardResult.sid
              });
              
            } else {
              console.log(`   ❌ No TwilioAccount found for ${To} - cannot forward SMS`);
            }
          } catch (forwardErr) {
            console.error(`   Failed to forward SMS:`, forwardErr.message);
          }
        } else if (!shouldNotify) {
          console.log(`   SMS NOT forwarded (held by filter)`);
        } else if (!user.forwardingNumber) {
          console.log(`   SMS NOT forwarded (no forwarding number set)`);
        }
        
      } else {
        console.log(`   No user found for phone ${To}. Candidates checked: ${toCandidates.join(', ')}`);
      }
    } catch (dbError) {
      console.error("   DB save error:", dbError.message);
    }

    // Respond with TwiML (empty response = no auto-reply)
    res.type("text/xml");
    res.send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
  } catch (error) {
    console.error("SMS webhook error:", error);
    res.status(500).send("Error processing SMS");
  }
});

// @route   POST /api/twilio/webhook/voice
// @desc    Handle incoming voice calls AND outgoing browser calls
// @access  Public (Twilio webhook)
router.post("/webhook/voice", async (req, res) => {
  console.log("📞 Voice Webhook ENTRY");
  const response = new twilio.twiml.VoiceResponse();
  
  try {
    const { From, To, CallSid, CallStatus, AccountSid } = req.body;
    
    console.log("📞 Voice Webhook - Full body:", JSON.stringify(req.body, null, 2));
    console.log(`   From: ${From}`);
    console.log(`   To: ${To}`);
    console.log(`   CallSid: ${CallSid}`);
    console.log(`   AccountSid: ${AccountSid}`);

    // Case 1: Outgoing Call from Browser (From is client:identity)
    if (From && From.startsWith("client:")) {
      console.log("   ➡️ Outgoing Browser Call");
      
      // Determine Caller ID (Twilio Number)
      // Priority: customCallerId from request > user's assigned phone > any available Twilio number
      // Note: Twilio sends custom params with same case as provided in device.connect()
      let callerId = req.body.customCallerId || req.body.CustomCallerId;
      console.log(`   customCallerId from request: ${callerId || "not provided"}`);
      
      if (!callerId) {
        // Extract email/identity from client:xxx format
        const identity = From.replace("client:", "");
        console.log(`   Looking up callerId for identity: ${identity}`);
        
        // Try to find user by email (the identity is usually the email)
        try {
          const user = await User.findOne({ email: identity });
          console.log(`   User lookup result: ${user ? `found (phone: ${user.phoneNumber})` : "not found"}`);
          if (user?.phoneNumber) {
            callerId = user.phoneNumber;
            console.log(`   ✅ Found user's phone: ${callerId}`);
          }
        } catch (e) {
          console.error(`   ❌ User lookup error: ${e.message}`);
        }
      }
      
      // Last resort: get first available Twilio number
      if (!callerId) {
        console.log("   Looking for any available Twilio number...");
        try {
          const accounts = await TwilioAccount.find({});
          console.log(`   Found ${accounts.length} Twilio accounts`);
          for (const acc of accounts) {
            console.log(`   Account ${acc.accountSid}: ${acc.phoneNumbers?.length || 0} phone numbers`);
            if (acc.phoneNumbers && acc.phoneNumbers.length > 0) {
              callerId = acc.phoneNumbers[0];
              console.log(`   ✅ Using Twilio number: ${callerId}`);
              break;
            }
          }
        } catch (e) {
          console.error(`   ❌ TwilioAccount lookup error: ${e.message}`);
        }
      }
      
      if (!callerId) {
        console.error("   ❌ No callerId available for outgoing call - check Twilio accounts in DB");
        response.say("We're sorry, an application error has occurred. Goodbye.");
        response.hangup();
        res.type("text/xml");
        return res.send(response.toString());
      }

      console.log(`   📞 Dialing with callerId: ${callerId}, To: ${To}`);
      
      // Get the base URL for recording callback
      const host = req.get('host');
      const protocol = host?.includes('localhost') ? 'http' : 'https';
      const recordingCallbackUrl = `${protocol}://${host}/api/twilio/webhook/recording-status`;
      
      // Create call record for outgoing browser call
      try {
        const identity = From.replace("client:", "");
        const user = await User.findOne({ email: identity });
        
        if (user) {
          // Look up contact name
          let contactName = null;
          const normalizedTo = To.replace(/[^\d+]/g, "");
          let contact = await Contact.findOne({ userId: user._id, phone: normalizedTo });
          if (!contact) {
            const altTo = normalizedTo.startsWith("+") ? normalizedTo.substring(1) : "+" + normalizedTo;
            contact = await Contact.findOne({ userId: user._id, phone: altTo });
          }
          contactName = contact?.name || null;
          
          await CallRecord.create({
            userId: user._id,
            contactPhone: To,
            contactName: contactName,
            direction: "outgoing",
            type: "outgoing",
            status: "initiated", // Will be updated by status webhook
            twilioCallSid: CallSid,
            startedAt: new Date()
          });
          console.log(`   ✅ Created outgoing call record for user ${user.email}, CallSid: ${CallSid}`);
        } else {
          console.log(`   ⚠️ Could not create call record - user not found for identity: ${identity}`);
        }
      } catch (recordErr) {
        console.error(`   ❌ Failed to create call record:`, recordErr.message);
      }
      
      // Get webhook base URL
      const webhookBase = process.env.WEBHOOK_BASE_URL || `${protocol}://${host}`;
      
      const dial = response.dial({
        callerId: callerId,
        answerOnBridge: true,
        record: "record-from-answer-dual", // Record both legs separately for better transcription
        recordingStatusCallback: recordingCallbackUrl,
        recordingStatusCallbackMethod: "POST",
        recordingStatusCallbackEvent: "completed",
        action: `${webhookBase}/api/twilio/webhook/dial-complete` // Handle dial completion
      });

      // Check if destination is a phone number or client
      if (/^[\d\+\-\(\) ]+$/.test(To)) {
        dial.number(To);
      } else {
        dial.client(To);
      }
    } 
    // Case 2: Incoming Call to Twilio Number
    else {
      console.log("   ⬅️ Incoming Call to Number");
      
      const normalize = (p) => p ? p.replace(/[^\d+]/g, "") : "";
      const callerPhone = normalize(From);

      // Find user by phone number
      let user = await User.findOne({ phoneNumber: To });
      if (!user) {
          const altPhone = To.startsWith("+") ? To.substring(1) : "+" + To;
          user = await User.findOne({ phoneNumber: altPhone });
      }

      if (user) {
        console.log(`   ✅ Found user: ${user.email}`);

        // Prevent routing loops: if the caller is the user's routing/forwarding number,
        // block calling the Comsierge number.
        const normalizedForwarding = normalize(user.forwardingNumber);
        if (normalizedForwarding && callerPhone && callerPhone === normalizedForwarding) {
          console.log(`   🔁 Caller is user's forwarding number (${user.forwardingNumber}). Blocking to prevent loop.`);
          response.say({ voice: "alice" }, "Please call from a different number.");
          response.hangup();

          // Still log the call as blocked
          await CallRecord.create({
            userId: user._id,
            contactPhone: From,
            contactName: From,
            direction: "incoming",
            type: "incoming",
            status: "blocked",
            twilioCallSid: CallSid,
            reason: "self_call_from_routing_number",
          });

          res.type("text/xml");
          return res.send(response.toString());
        }
        
        // Check caller info against contacts
        let contact = await Contact.findOne({ userId: user._id, phone: From });
        if (!contact) {
          const altCallerPhone = From.startsWith("+") ? From.substring(1) : "+" + From;
          contact = await Contact.findOne({ userId: user._id, phone: altCallerPhone });
        }
        
        const callerInfo = {
          isSavedContact: !!contact,
          isFavorite: contact?.isFavorite || false,
          isBlocked: contact?.isBlocked || false,
          tags: contact?.tags || [],
          contactName: contact?.name || From
        };
        
        console.log(`   📋 Caller Info:`, callerInfo);
        
        // Check if caller is blocked
        if (callerInfo.isBlocked) {
          console.log(`   🚫 Caller is BLOCKED. Rejecting call.`);
          response.reject();
          
          // Still log the call as blocked
          await CallRecord.create({
            userId: user._id,
            contactPhone: From,
            contactName: callerInfo.contactName,
            direction: "incoming",
            type: "incoming",
            status: "blocked",
            twilioCallSid: CallSid
          });
          
          res.type("text/xml");
          return res.send(response.toString());
        }
        
        // ===============================================
        // TRANSFER RULES - Check FIRST, route DIRECTLY to transfer target
        // Transfer rules bypass forward-to number and go straight to target
        // ===============================================
        const transferRules = await Rule.find({ 
          userId: user._id, 
          type: "transfer",
          active: true 
        });
        
        console.log(`   🔄 Found ${transferRules.length} active transfer rules`);
        
        for (const rule of transferRules) {
          const conditions = rule.conditions || {};
          const mode = conditions.mode || "all";
          const transferDetails = rule.transferDetails || {};
          
          console.log(`   🔍 Checking transfer rule: "${rule.rule}" (mode: ${mode})`);
          
          // Check if rule applies to calls
          const transferMode = transferDetails.mode || "both";
          if (transferMode !== "calls" && transferMode !== "both") {
            console.log(`      ⏭️ Transfer rule is for messages only, skipping`);
            continue;
          }
          
          // Check schedule
          if (rule.schedule?.mode === "duration" && rule.schedule?.endTime) {
            if (new Date() > new Date(rule.schedule.endTime)) {
              console.log(`      ⏭️ Transfer rule expired, skipping`);
              continue;
            }
          }
          
          // Check conditions
          let matches = false;
          
          switch (mode) {
            case "all":
              matches = true;
              console.log(`      ✓ Mode 'all' - matches`);
              break;
              
            case "favorites":
              matches = callerInfo.isFavorite;
              console.log(`      ${matches ? '✓' : '✗'} Mode 'favorites' - isFavorite: ${callerInfo.isFavorite}`);
              break;
              
            case "saved":
              matches = callerInfo.isSavedContact;
              console.log(`      ${matches ? '✓' : '✗'} Mode 'saved' - isSavedContact: ${callerInfo.isSavedContact}`);
              break;
              
            case "tags":
              const requiredTags = conditions.tags || [];
              // If no tags specified, don't match anyone (user must select at least one tag)
              matches = requiredTags.length > 0 && requiredTags.some(tag => callerInfo.tags.includes(tag));
              console.log(`      ${matches ? '✓' : '✗'} Mode 'tags' - required: [${requiredTags}], caller has: [${callerInfo.tags}]`);
              break;
              
            default:
              matches = false;
          }
          
          // Check if transfer target phone exists
          const transferTargetPhone = transferDetails.contactPhone;
          
          if (matches && transferTargetPhone) {
            console.log(`   ✅ Transfer rule matched! Routing DIRECTLY to: ${transferTargetPhone}`);
            
            // Log the call as transferred
            await CallRecord.create({
              userId: user._id,
              contactPhone: From,
              contactName: callerInfo.contactName,
              direction: "incoming",
              type: "incoming",
              status: "transferred",
              twilioCallSid: CallSid,
              forwardedTo: transferTargetPhone,
              matchedRule: rule.rule,
              reason: "transfer_rule"
            });
            
            // Transfer with "press 1 to accept" screening to prevent carrier voicemail
            const webhookBase = process.env.WEBHOOK_BASE_URL || `https://${req.get('host')}`;
            const dial = response.dial({
              callerId: From, // Show original caller ID
              timeout: 30,
              action: `${webhookBase}/api/twilio/webhook/forward-status`
            });
            // Use URL to screen the call with "press 1" - voicemail can't press 1
            dial.number({
              url: `${webhookBase}/api/twilio/webhook/forward-screen?callerName=${encodeURIComponent(callerInfo.contactName || From)}&comsiergeNumber=${encodeURIComponent(To)}`,
              method: "POST"
            }, transferTargetPhone);
            
            res.type("text/xml");
            return res.send(response.toString());
          }
        }
        
        // ===============================================
        // FORWARD RULES - If no transfer rule matched, check forward rules
        // Forward rules route to user's personal forwarding number
        // ===============================================
        const forwardRules = await Rule.find({ 
          userId: user._id, 
          type: "forward",
          active: true 
        });
        
        console.log(`   📜 Found ${forwardRules.length} active forward rules`);
        console.log(`   📜 User's forwardingNumber: ${user.forwardingNumber || "NOT SET"}`);
        
        // Log all forward rules for debugging
        for (const r of forwardRules) {
          console.log(`   📜 Rule: "${r.rule}" | mode: ${r.conditions?.mode} | transferMode: ${r.transferDetails?.mode}`);
        }
        
        // Determine if call should be forwarded based on rules
        let shouldForward = false;
        let matchedRule = null;
        
        for (const rule of forwardRules) {
          const conditions = rule.conditions || {};
          const mode = conditions.mode || "all"; // all, favorites, saved, tags
          
          console.log(`   🔍 Checking rule: "${rule.rule}" (mode: ${mode})`);
          
          // Check if rule applies to calls
          const transferMode = rule.transferDetails?.mode || "both";
          if (transferMode !== "calls" && transferMode !== "both") {
            console.log(`      ⏭️ Rule is for messages only, skipping`);
            continue;
          }
          
          // Check schedule
          if (rule.schedule?.mode === "duration" && rule.schedule?.endTime) {
            if (new Date() > new Date(rule.schedule.endTime)) {
              console.log(`      ⏭️ Rule expired, skipping`);
              continue;
            }
          }
          
          // Check conditions
          let matches = false;
          
          switch (mode) {
            case "all":
              matches = true;
              console.log(`      ✓ Mode 'all' - matches`);
              break;
              
            case "favorites":
              matches = callerInfo.isFavorite;
              console.log(`      ${matches ? '✓' : '✗'} Mode 'favorites' - isFavorite: ${callerInfo.isFavorite}`);
              break;
              
            case "saved":
              matches = callerInfo.isSavedContact;
              console.log(`      ${matches ? '✓' : '✗'} Mode 'saved' - isSavedContact: ${callerInfo.isSavedContact}`);
              break;
              
            case "tags":
              const requiredTags = conditions.tags || [];
              // If no tags specified, don't match anyone (user must select at least one tag)
              matches = requiredTags.length > 0 && requiredTags.some(tag => callerInfo.tags.includes(tag));
              console.log(`      ${matches ? '✓' : '✗'} Mode 'tags' - required: [${requiredTags}], caller has: [${callerInfo.tags}]`);
              break;
              
            default:
              matches = false;
          }
          
          if (matches) {
            shouldForward = true;
            matchedRule = rule;
            console.log(`   ✅ Rule matched! Will forward call.`);
            break;
          }
        }
        
        // Get forwarding number
        const forwardingNumber = user.forwardingNumber;
        
        if (shouldForward && forwardingNumber) {
          console.log(`   📱 Forwarding call to: ${forwardingNumber}`);
          
          // Log the call as forwarded
          await CallRecord.create({
            userId: user._id,
            contactPhone: From,
            contactName: callerInfo.contactName,
            direction: "incoming",
            type: "incoming",
            status: "forwarded",
            twilioCallSid: CallSid,
            forwardedTo: forwardingNumber,
            matchedRule: matchedRule?.rule
          });
          
          // Forward with "press 1 to accept" screening to prevent carrier voicemail
          const webhookBase = process.env.WEBHOOK_BASE_URL || `https://${req.get('host')}`;
          const dial = response.dial({
            // Show the Comsierge number to the user (agent).
            callerId: To,
            timeout: 25,
            action: `${webhookBase}/api/twilio/webhook/forward-status`
          });
          // Use URL to screen the call with "press 1" - voicemail can't press 1
          dial.number({
            url: `${webhookBase}/api/twilio/webhook/forward-screen?callerName=${encodeURIComponent(callerInfo.contactName || From)}&comsiergeNumber=${encodeURIComponent(To)}`,
            method: "POST"
          }, forwardingNumber);
          
        } else {
          // No matching rule or no forwarding number - log as missed, don't ring
          console.log(`   📵 No forward rule matched or no forwarding number. Logging as missed.`);
          
          await CallRecord.create({
            userId: user._id,
            contactPhone: From,
            contactName: callerInfo.contactName,
            direction: "incoming",
            type: "missed",
            status: "missed",
            twilioCallSid: CallSid,
            reason: !forwardingNumber ? "no_forwarding_number" : "no_matching_rule"
          });
          
          // Get webhook base URL
          const vmWebhookBase = process.env.WEBHOOK_BASE_URL || "https://comsierge-iwe0.onrender.com";
          
          // Play a message and optionally record voicemail
          response.say({ voice: "alice" }, "Hello, the person you are trying to reach is unavailable. Please leave a message after the beep.");
          response.record({ 
            maxLength: 120, 
            transcribe: true,
            transcribeCallback: `${vmWebhookBase}/api/twilio/webhook/transcription`,
            action: `${vmWebhookBase}/api/twilio/webhook/voicemail`
          });
          response.say({ voice: "alice" }, "Thank you. Goodbye.");
        }
        
      } else {
        console.log("   ⚠️ No user found for this number. Playing voicemail.");
        const vmWebhookBase = process.env.WEBHOOK_BASE_URL || "https://comsierge-iwe0.onrender.com";
        response.say("Hello, thank you for calling. Please leave a message after the beep.");
        response.record({ 
          maxLength: 120, 
          transcribe: true,
          transcribeCallback: `${vmWebhookBase}/api/twilio/webhook/transcription`,
          action: `${vmWebhookBase}/api/twilio/webhook/voicemail`
        });
        response.say("Thank you. Goodbye.");
      }
    }

    res.type("text/xml");
    res.send(response.toString());

  } catch (error) {
    console.error("Voice webhook error:", error);
    console.error("Voice webhook error stack:", error.stack);
    // response already defined at top of function
    response.say("Sorry, an error occurred.");
    res.type("text/xml");
    res.send(response.toString());
  }
});

// @route   POST /api/twilio/webhook/forward-screen
// @desc    Screen forwarded calls with "press 1 to accept" - prevents carrier voicemail from answering
// @access  Public (Twilio webhook)
router.post("/webhook/forward-screen", async (req, res) => {
  try {
    const { callerName, comsiergeNumber } = req.query;
    const { Digits, CallSid } = req.body;
    const webhookBase = process.env.WEBHOOK_BASE_URL || "https://comsierge-iwe0.onrender.com";
    
    console.log("📞 Forward Screen:", { callerName, comsiergeNumber, Digits, CallSid });
    
    const response = new twilio.twiml.VoiceResponse();
    
    // If user pressed 1, accept the call (bridge to caller)
    if (Digits === "1") {
      console.log("   ✅ User pressed 1 - accepting call");
      // Empty response = bridge is established
      res.type("text/xml");
      return res.send(response.toString());
    }
    
    // If user pressed something else, reject
    if (Digits && Digits !== "1") {
      console.log("   ❌ User declined call");
      response.hangup();
      res.type("text/xml");
      return res.send(response.toString());
    }
    
    // First time - prompt the user to press 1
    const displayName = callerName || "Unknown caller";
    const gather = response.gather({
      numDigits: 1,
      action: `${webhookBase}/api/twilio/webhook/forward-screen?callerName=${encodeURIComponent(callerName || "")}&comsiergeNumber=${encodeURIComponent(comsiergeNumber || "")}`,
      method: "POST",
      timeout: 8
    });
    gather.say({ voice: "alice" }, `Incoming call from ${displayName}. Press 1 to accept.`);
    
    // If no response after timeout, hang up (will trigger forward-status with no-answer)
    response.hangup();
    
    res.type("text/xml");
    res.send(response.toString());
  } catch (error) {
    console.error("Forward screen error:", error);
    const response = new twilio.twiml.VoiceResponse();
    response.hangup();
    res.type("text/xml");
    res.send(response.toString());
  }
});

// @route   POST /api/twilio/webhook/forward-status
// @desc    Handle result of forwarded call attempt
// @access  Public (Twilio webhook)
router.post("/webhook/forward-status", async (req, res) => {
  try {
    const { CallSid, DialCallStatus, DialCallDuration, From, To, AnsweredBy, DialCallAnsweredBy } = req.body;
    console.log("📞 Forward Status:", { CallSid, DialCallStatus, DialCallDuration, From, To });
    console.log("📞 Full forward-status body:", req.body);
    
    const response = new twilio.twiml.VoiceResponse();
    
    // Map Twilio DialCallStatus to our status values
    // IMPORTANT: "completed" from Twilio does NOT mean answered!
    // "answered" means they picked up, "completed" just means call ended
    // "no-answer" means they didn't pick up, "busy" means line was busy
    let finalStatus;
    let finalType;

    const answeredBy = (DialCallAnsweredBy || AnsweredBy || "").toString().toLowerCase();
    const answeredByMachine = answeredBy.includes("machine") || answeredBy.includes("fax") || answeredBy.includes("unknown");
    
    if (DialCallStatus === "answered") {
      // Actually answered the call
      finalStatus = "completed";
      finalType = "incoming";
    } else if (DialCallStatus === "completed") {
      // Call completed - need to check duration to determine if answered
      const duration = parseInt(DialCallDuration) || 0;
      if (answeredByMachine) {
        // Carrier voicemail / machine answered. Treat as not answered by human.
        finalStatus = "no-answer";
        finalType = "missed";
      } else if (duration > 0) {
        // Had duration = was answered
        finalStatus = "completed";
        finalType = "incoming";
      } else {
        // No duration = wasn't answered, probably hung up
        finalStatus = "no-answer";
        finalType = "missed";
      }
    } else if (DialCallStatus === "busy") {
      finalStatus = "busy";
      finalType = "missed";
    } else if (DialCallStatus === "no-answer") {
      finalStatus = "no-answer";
      finalType = "missed";
    } else if (DialCallStatus === "failed") {
      finalStatus = "failed";
      finalType = "missed";
    } else if (DialCallStatus === "canceled") {
      finalStatus = "canceled";
      finalType = "missed";
    } else {
      // Unknown status - treat as missed
      finalStatus = "missed";
      finalType = "missed";
    }
    
    console.log(`   📊 Mapped status: ${DialCallStatus} -> ${finalStatus}, type: ${finalType}`);
    
    // Don't overwrite calls that were already marked as transferred/forwarded
    const updated = await CallRecord.findOneAndUpdate(
      { 
        twilioCallSid: CallSid,
        status: { $nin: ["transferred", "forwarded"] }  // Skip if already transferred/forwarded
      },
      { 
        status: finalStatus,
        type: finalType,
        duration: parseInt(DialCallDuration) || 0
      },
      { new: true }
    );
    
    if (updated) {
      console.log(`   ✅ Updated CallRecord ${CallSid} to status: ${finalStatus}`);
    } else {
      // Check if it was skipped due to being transferred
      const existing = await CallRecord.findOne({ twilioCallSid: CallSid });
      if (existing && (existing.status === "transferred" || existing.status === "forwarded")) {
        console.log(`   ⏭️ Skipped update for ${CallSid} - already marked as ${existing.status}`);
      } else {
        console.log(`   ⚠️ No CallRecord found for ${CallSid}`);
      }
    }
    
    // Get webhook base URL for voicemail action
    const webhookBase = process.env.WEBHOOK_BASE_URL || "https://comsierge-iwe0.onrender.com";
    
    // If not answered, offer voicemail
    if (finalStatus !== "completed") {
      console.log(`   📞 Call was not answered (${DialCallStatus}), offering voicemail`);
      response.say({ voice: "alice" }, "The call could not be completed. Please leave a message after the beep.");
      response.record({ 
        maxLength: 120, 
        transcribe: true,
        transcribeCallback: `${webhookBase}/api/twilio/webhook/transcription`,
        action: `${webhookBase}/api/twilio/webhook/voicemail`
      });
      response.say({ voice: "alice" }, "Thank you. Goodbye.");
    } else {
      console.log(`   ✅ Call was answered, no voicemail needed`);
    }
    
    res.type("text/xml");
    res.send(response.toString());
  } catch (error) {
    console.error("Forward status error:", error);
    const response = new twilio.twiml.VoiceResponse();
    res.type("text/xml");
    res.send(response.toString());
  }
});

// @route   POST /api/twilio/webhook/recording-status
// @desc    Handle call recording completion and trigger AI transcription
// @access  Public (Twilio webhook)
router.post("/webhook/recording-status", async (req, res) => {
  try {
    const { 
      CallSid, 
      RecordingSid, 
      RecordingUrl, 
      RecordingStatus, 
      RecordingDuration,
      RecordingChannels,
      AccountSid
    } = req.body;
    
    console.log("🎙️ Recording Status Callback:", { 
      CallSid, 
      RecordingSid, 
      RecordingStatus,
      RecordingDuration,
      RecordingUrl: RecordingUrl ? `${RecordingUrl.substring(0, 50)}...` : null
    });
    
    if (RecordingStatus !== "completed") {
      console.log(`   Recording status is ${RecordingStatus}, skipping transcription`);
      return res.status(200).send("OK");
    }
    
    // Find the call record by CallSid
    let callRecord = await CallRecord.findOne({ twilioCallSid: CallSid });
    
    // If not found, try to find by other means or create one
    if (!callRecord) {
      console.log(`   No call record found for CallSid ${CallSid}, will update later if found`);
    }
    
    // Save recording URL immediately
    if (callRecord) {
      callRecord.recordingUrl = RecordingUrl;
      callRecord.recordingSid = RecordingSid;
      await callRecord.save();
      console.log(`   ✅ Recording URL saved to call record`);
    }
    
    // Start transcription in background (don't block the webhook response)
    transcribeRecording(CallSid, RecordingUrl, RecordingSid, AccountSid).catch(err => {
      console.error("Transcription error:", err);
    });
    
    res.status(200).send("OK");
  } catch (error) {
    console.error("Recording status webhook error:", error);
    res.status(200).send("OK"); // Always return 200 to Twilio
  }
});

// Transcribe recording using OpenAI Whisper
async function transcribeRecording(callSid, recordingUrl, recordingSid, accountSid) {
  try {
    console.log(`🎤 Starting transcription for call ${callSid}`);
    
    // Get Twilio credentials for this account
    let authToken = process.env.TWILIO_AUTH_TOKEN;
    let accSid = accountSid || process.env.TWILIO_ACCOUNT_SID;
    
    // Try to find account in DB
    if (accountSid) {
      const account = await TwilioAccount.findOne({ accountSid });
      if (account) {
        authToken = account.authToken;
        accSid = account.accountSid;
      }
    }
    
    if (!authToken || !accSid) {
      console.error("   ❌ No Twilio credentials for transcription");
      return;
    }
    
    // Fetch the recording from Twilio (need auth)
    const recordingUrlWithFormat = `${recordingUrl}.mp3`;
    console.log(`   Fetching recording from: ${recordingUrlWithFormat}`);
    
    const response = await fetch(recordingUrlWithFormat, {
      headers: {
        "Authorization": "Basic " + Buffer.from(`${accSid}:${authToken}`).toString("base64")
      }
    });
    
    if (!response.ok) {
      console.error(`   ❌ Failed to fetch recording: ${response.status} ${response.statusText}`);
      return;
    }
    
    const audioBuffer = await response.arrayBuffer();
    console.log(`   ✅ Recording fetched, size: ${audioBuffer.byteLength} bytes`);
    
    // Use OpenAI Whisper for transcription
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error("   ❌ No OpenAI API key for transcription");
      return;
    }
    
    // Create form data for OpenAI
    const FormData = (await import("form-data")).default;
    const formData = new FormData();
    formData.append("file", Buffer.from(audioBuffer), {
      filename: "recording.mp3",
      contentType: "audio/mpeg"
    });
    formData.append("model", "whisper-1");
    formData.append("response_format", "verbose_json"); // Get timestamps
    formData.append("language", "en");
    
    console.log(`   Sending to OpenAI Whisper...`);
    const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        ...formData.getHeaders()
      },
      body: formData
    });
    
    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error(`   ❌ Whisper API error: ${whisperResponse.status}`, errorText);
      return;
    }
    
    const transcriptionResult = await whisperResponse.json();
    console.log(`   ✅ Transcription complete: ${transcriptionResult.text?.substring(0, 100)}...`);
    
    // Update call record with transcription
    const updated = await CallRecord.findOneAndUpdate(
      { twilioCallSid: callSid },
      { 
        transcription: transcriptionResult.text,
        transcriptionSegments: transcriptionResult.segments || [],
        transcriptionLanguage: transcriptionResult.language || "en"
      },
      { new: true }
    );
    
    if (updated) {
      console.log(`   ✅ Transcription saved to call record ${updated._id}`);
    } else {
      console.log(`   ⚠️ Could not find call record to save transcription`);
    }
    
  } catch (error) {
    console.error("Transcription error:", error);
  }
}

// @route   POST /api/twilio/webhook/voicemail
// @desc    Handle voicemail recording
// @access  Public (Twilio webhook)
router.post("/webhook/voicemail", async (req, res) => {
  try {
    const { CallSid, RecordingUrl, RecordingDuration, TranscriptionText, From, To, AccountSid } = req.body;
    console.log("📞 Voicemail received:", { 
      CallSid, 
      RecordingUrl, 
      RecordingDuration,
      hasTranscript: !!TranscriptionText,
      From,
      To
    });
    console.log("📞 Full voicemail body:", req.body);
    
    // Update call record with voicemail info
    const updatedRecord = await CallRecord.findOneAndUpdate(
      { twilioCallSid: CallSid },
      {
        $set: {
          hasVoicemail: true,
          voicemailUrl: RecordingUrl,
          voicemailDuration: parseInt(RecordingDuration) || 0,
          voicemailTranscript: TranscriptionText || null,
          ...(From ? { fromNumber: From } : {}),
          ...(To ? { toNumber: To } : {}),
          ...(AccountSid ? { "metadata.twilioAccountSid": AccountSid } : {}),
        },
      },
      { new: true }
    );
    
    if (updatedRecord) {
      console.log(`   ✅ Updated CallRecord ${CallSid} with voicemail. URL: ${RecordingUrl}`);
    } else {
      console.log(`   ⚠️ No CallRecord found for CallSid: ${CallSid}. Creating new record if possible.`);
      // Try to create a new record if we have enough info
      if (From && To) {
        // Find user by their Twilio number
        const User = (await import("../models/User.js")).default;
        const user = await User.findOne({ phoneNumber: To }) || await User.findOne({ phoneNumber: To.startsWith("+") ? To.substring(1) : "+" + To });
        if (user) {
          await CallRecord.create({
            userId: user._id,
            contactPhone: From,
            contactName: From,
            direction: "incoming",
            type: "missed",
            status: "missed",
            twilioCallSid: CallSid,
            fromNumber: From,
            toNumber: To,
            hasVoicemail: true,
            voicemailUrl: RecordingUrl,
            voicemailDuration: parseInt(RecordingDuration) || 0,
            voicemailTranscript: TranscriptionText || null,
            reason: "voicemail_only",
            metadata: {
              ...(AccountSid ? { twilioAccountSid: AccountSid } : {}),
            },
          });
          console.log(`   ✅ Created new CallRecord with voicemail for user ${user.email}`);
        }
      }
    }
    
    const response = new twilio.twiml.VoiceResponse();
    response.say({ voice: "alice" }, "Thank you for your message. Goodbye.");
    response.hangup();
    
    res.type("text/xml");
    res.send(response.toString());
  } catch (error) {
    console.error("Voicemail error:", error);
    const response = new twilio.twiml.VoiceResponse();
    res.type("text/xml");
    res.send(response.toString());
  }
});

// @route   POST /api/twilio/webhook/transcription
// @desc    Handle voicemail transcription callback (separate from recording)
// @access  Public (Twilio webhook)
router.post("/webhook/transcription", async (req, res) => {
  try {
    const { CallSid, RecordingSid, TranscriptionText, TranscriptionStatus } = req.body;
    console.log("📝 Transcription received:", { 
      CallSid, 
      RecordingSid, 
      TranscriptionStatus,
      TranscriptionText: TranscriptionText?.substring(0, 100)
    });
    
    if (TranscriptionStatus === "completed" && TranscriptionText) {
      // Update call record with transcription
      const updated = await CallRecord.findOneAndUpdate(
        { twilioCallSid: CallSid },
        { voicemailTranscript: TranscriptionText },
        { new: true }
      );
      
      if (updated) {
        console.log(`   ✅ Updated CallRecord ${CallSid} with voicemail transcription`);
      } else {
        // Try by recording SID
        const byRecording = await CallRecord.findOneAndUpdate(
          { voicemailUrl: { $regex: RecordingSid } },
          { voicemailTranscript: TranscriptionText },
          { new: true }
        );
        if (byRecording) {
          console.log(`   ✅ Updated CallRecord by recording SID with transcription`);
        } else {
          console.log(`   ⚠️ No CallRecord found for transcription (CallSid: ${CallSid}, RecordingSid: ${RecordingSid})`);
        }
      }
    }
    
    res.status(200).send("OK");
  } catch (error) {
    console.error("Transcription webhook error:", error);
    res.status(500).send("Error");
  }
});

// @route   POST /api/twilio/webhook/connect
// @desc    Handle outbound call connection - creates two-way voice
// @access  Public (Twilio webhook)
router.post("/webhook/connect", async (req, res) => {
  try {
    const { to } = req.query;
    const { CallSid, CallStatus, Digits, From, To, Called } = req.body;
    
    // From = Twilio number (caller ID shown to agent)
    // To = Agent's personal phone
    // We want to use From (Twilio number) as caller ID when calling the customer
    const twilioNumber = From || Called;
    const webhookBase = process.env.WEBHOOK_BASE_URL || "https://comsierge-iwe0.onrender.com";
    
    console.log("📞 Connect webhook:");
    console.log(`   To (customer): ${to}`);
    console.log(`   From (Twilio): ${twilioNumber}`);
    console.log(`   CallSid: ${CallSid}`);
    console.log(`   Status: ${CallStatus}`);
    console.log(`   Digits: ${Digits}`);

    res.type("text/xml");

    // If user pressed 1, connect the call
    if (Digits === "1") {
      console.log("✅ User pressed 1 - connecting to customer: " + to);
      console.log("   Using caller ID: " + twilioNumber);
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Connecting you now.</Say>
  <Dial callerId="${twilioNumber}" timeout="30" action="${webhookBase}/api/twilio/webhook/dial-status">
    <Number>${to}</Number>
  </Dial>
  <Say voice="alice">The call could not be completed.</Say>
</Response>`);
      return;
    }
    
    // If user pressed anything else or didn't respond, hang up
    if (Digits && Digits !== "1") {
      console.log("❌ User declined - hanging up");
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Call cancelled. Goodbye.</Say>
  <Hangup/>
</Response>`);
      return;
    }

    // First time - prompt the user
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="${webhookBase}/api/twilio/webhook/connect?to=${encodeURIComponent(to)}" method="POST" timeout="10">
    <Say voice="alice">Press 1 to connect, or hang up to cancel.</Say>
  </Gather>
  <Say voice="alice">No response received. Goodbye.</Say>
  <Hangup/>
</Response>`);
  } catch (error) {
    console.error("Connect webhook error:", error);
    res.type("text/xml");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Sorry, we could not connect your call.</Say>
  <Hangup/>
</Response>`);
  }
});

// @route   POST /api/twilio/webhook/dial-complete
// @desc    Handle dial completion for browser calls - captures actual call outcome
// @access  Public (Twilio webhook)
router.post("/webhook/dial-complete", async (req, res) => {
  try {
    const { CallSid, DialCallStatus, DialCallDuration, DialCallSid, From, To } = req.body;
    console.log(`📞 Dial Complete for browser call:`);
    console.log(`   CallSid (parent): ${CallSid}`);
    console.log(`   DialCallSid (child): ${DialCallSid}`);
    console.log(`   DialCallStatus: ${DialCallStatus}`);
    console.log(`   DialCallDuration: ${DialCallDuration}s`);
    
    // Map dial status to our status values
    let dbStatus = "completed";
    if (DialCallStatus === "completed" || DialCallStatus === "answered") {
      dbStatus = "completed";
    } else if (DialCallStatus === "busy") {
      dbStatus = "busy";
    } else if (DialCallStatus === "no-answer") {
      dbStatus = "no-answer";
    } else if (DialCallStatus === "failed") {
      dbStatus = "failed";
    } else if (DialCallStatus === "canceled") {
      dbStatus = "canceled";
    }
    
    // Update the CallRecord using the PARENT CallSid (which we stored)
    // Don't overwrite calls that were already marked as transferred/forwarded
    const updated = await CallRecord.findOneAndUpdate(
      { 
        twilioCallSid: CallSid,
        status: { $nin: ["transferred", "forwarded"] }
      },
      { 
        status: dbStatus,
        duration: parseInt(DialCallDuration) || 0 
      },
      { new: true }
    );
    
    if (updated) {
      console.log(`   ✅ Updated CallRecord to status: ${dbStatus}, duration: ${DialCallDuration}s`);
    } else {
      const existing = await CallRecord.findOne({ twilioCallSid: CallSid });
      if (existing && (existing.status === "transferred" || existing.status === "forwarded")) {
        console.log(`   ⏭️ Skipped update for ${CallSid} - already marked as ${existing.status}`);
      } else {
        console.log(`   ⚠️ No CallRecord found for parent CallSid: ${CallSid}`);
      }
    }
    
    res.type("text/xml");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Hangup/>
</Response>`);
  } catch (error) {
    console.error("Dial complete error:", error);
    res.type("text/xml");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Hangup/>
</Response>`);
  }
});

// @route   POST /api/twilio/webhook/dial-status
// @desc    Handle dial completion for "Call via My Phone" - THIS IS THE KEY ENDPOINT
// @access  Public (Twilio webhook)
router.post("/webhook/dial-status", async (req, res) => {
  try {
    const { CallSid, DialCallStatus, DialCallDuration, DialCallSid, From, To } = req.body;
    console.log(`📞 Dial-Status (Call via My Phone) - IMPORTANT:`);
    console.log(`   CallSid (parent - user's phone): ${CallSid}`);
    console.log(`   DialCallSid (child - destination): ${DialCallSid}`);
    console.log(`   DialCallStatus: ${DialCallStatus}`);
    console.log(`   DialCallDuration: ${DialCallDuration}s`);
    console.log(`   Full body:`, req.body);
    
    // Map dial status to our status values
    // CRITICAL: Use the DIAL duration, not the parent call duration
    // DialCallDuration = actual conversation time with destination
    let dbStatus;
    if (DialCallStatus === "answered") {
      dbStatus = "completed";
    } else if (DialCallStatus === "completed") {
      // Check duration - if > 0, they talked
      const duration = parseInt(DialCallDuration) || 0;
      dbStatus = duration > 0 ? "completed" : "no-answer";
    } else if (DialCallStatus === "busy") {
      dbStatus = "busy";
    } else if (DialCallStatus === "no-answer") {
      dbStatus = "no-answer";
    } else if (DialCallStatus === "failed") {
      dbStatus = "failed";
    } else if (DialCallStatus === "canceled") {
      dbStatus = "canceled";
    } else {
      dbStatus = "no-answer";
    }
    
    console.log(`   📊 Final status: ${dbStatus}`);
    
    // Update CallRecord using the PARENT CallSid (that's what we stored)
    // Don't overwrite calls that were already marked as transferred/forwarded
    const updated = await CallRecord.findOneAndUpdate(
      { 
        twilioCallSid: CallSid,
        status: { $nin: ["transferred", "forwarded"] }
      },
      { 
        status: dbStatus,
        // Use DIAL duration - this is the actual conversation time
        duration: parseInt(DialCallDuration) || 0
      },
      { new: true }
    );
    
    if (updated) {
      console.log(`   ✅ Updated CallRecord to status: ${dbStatus}, duration: ${DialCallDuration}s`);
    } else {
      const existing = await CallRecord.findOne({ twilioCallSid: CallSid });
      if (existing && (existing.status === "transferred" || existing.status === "forwarded")) {
        console.log(`   ⏭️ Skipped update for ${CallSid} - already marked as ${existing.status}`);
      } else {
        console.log(`   ⚠️ No CallRecord found for CallSid: ${CallSid}`);
      }
    }
    
    res.type("text/xml");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Hangup/>
</Response>`);
  } catch (error) {
    console.error("Dial-status error:", error);
    res.type("text/xml");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Hangup/>
</Response>`);
  }
});

// @route   POST /api/twilio/webhook/status
// @desc    Handle message/call status updates
// @access  Public (Twilio webhook)
router.post("/webhook/status", async (req, res) => {
  try {
    const {
      MessageSid,
      CallSid,
      MessageStatus,
      SmsStatus,
      ErrorCode,
      ErrorMessage,
      CallStatus,
      CallDuration,
      From,
      To,
      ParentCallSid,
    } = req.body;
    
    if (MessageSid) {
      const rawStatus = (MessageStatus || SmsStatus || "").toString().toLowerCase();
      console.log(`📊 SMS Status Update: ${MessageSid} - ${rawStatus || "(missing)"}`);

      // Map Twilio message statuses to our enum
      const mapMessageStatus = (s) => {
        switch (s) {
          case "queued":
          case "accepted":
          case "sending":
            return "pending";
          case "sent":
            return "sent";
          case "delivered":
            return "delivered";
          case "undelivered":
          case "failed":
            return "failed";
          default:
            return null;
        }
      };

      const mapped = mapMessageStatus(rawStatus);
      if (mapped) {
        const setUpdate = {
          status: mapped,
          "metadata.twilioStatusRaw": rawStatus || null,
        };

        // Keep error details for debugging when Twilio/carrier rejects delivery
        if (mapped === "failed") {
          if (ErrorCode) setUpdate["metadata.twilioErrorCode"] = ErrorCode;
          if (ErrorMessage) setUpdate["metadata.twilioErrorMessage"] = ErrorMessage;
          if (From) setUpdate["metadata.twilioFrom"] = From;
          if (To) setUpdate["metadata.twilioTo"] = To;
        }

        const updated = await Message.findOneAndUpdate(
          { twilioSid: MessageSid },
          { $set: setUpdate },
          { new: true }
        );

        if (!updated) {
          console.log(`   ⚠️ No Message found for twilioSid ${MessageSid}`);
        } else {
          console.log(`   ✅ Updated Message ${updated._id} status -> ${mapped}`);
        }
      }
    }
    
    if (CallSid) {
      console.log(`📊 Call Status Update: ${CallSid} - ${CallStatus} - Duration: ${CallDuration || 0}s`);
      console.log(`   ParentCallSid: ${ParentCallSid || 'none'}, From: ${From}, To: ${To}`);

      const durationSeconds = parseInt(CallDuration) || 0;

      // Only update on terminal statuses
      const terminalStatuses = ["completed", "busy", "no-answer", "failed", "canceled"];
      if (terminalStatuses.includes(CallStatus)) {
        // Find the record first (we sometimes need to avoid overwriting click-to-call dial duration)
        let record = await CallRecord.findOne({ twilioCallSid: CallSid });
        let matchedBy = CallSid;
        if (!record && ParentCallSid) {
          record = await CallRecord.findOne({ twilioCallSid: ParentCallSid });
          matchedBy = ParentCallSid;
        }

        if (!record) {
          console.log(`   ⚠️ No CallRecord found for ${CallSid} or ParentCallSid ${ParentCallSid}`);
        } else if (record.status === "transferred" || record.status === "forwarded") {
          // Don't overwrite transferred/forwarded calls - they were intentionally ended or routed
          console.log(`   ⏭️ Skipping status update for ${record.status} call ${matchedBy}`);
        } else {
          // Map Twilio statuses to our status values
          let dbStatus = CallStatus;

          // IMPORTANT: If Twilio reports completed but duration is 0, treat as no-answer.
          // This addresses the “shows connected even though I never picked up” symptom.
          if (CallStatus === "completed" && durationSeconds === 0) {
            dbStatus = "no-answer";
          }

          const update = { status: dbStatus };

          // For Click-to-Call, dial-status webhook stores the *real talk time*.
          // Don't overwrite that with the parent-leg CallDuration.
          if (record.reason === "click_to_call") {
            if (dbStatus !== "completed") {
              update.duration = 0;
            } else if ((record.duration || 0) === 0) {
              // If dial-status never fired (e.g., agent never answered), keep duration 0.
              update.duration = 0;
            }
          } else {
            update.duration = durationSeconds;
          }

          const updated = await CallRecord.findByIdAndUpdate(record._id, update, { new: true });
          console.log(`   ✅ Updated CallRecord via ${matchedBy} to status: ${updated?.status}, duration: ${updated?.duration || 0}s`);
        }
      }

      // Non-terminal updates (helps UI move off "Dialing" quickly for Click-to-Call)
      const nonTerminalStatuses = ["initiated", "ringing", "answered"];
      if (nonTerminalStatuses.includes(CallStatus)) {
        let record = await CallRecord.findOne({ twilioCallSid: CallSid });
        let matchedBy = CallSid;
        if (!record && ParentCallSid) {
          record = await CallRecord.findOne({ twilioCallSid: ParentCallSid });
          matchedBy = ParentCallSid;
        }

        if (record && record.reason === "click_to_call") {
          const mappedStatus = CallStatus === "answered" ? "in-progress" : CallStatus;
          const isTerminalAlready = ["completed", "busy", "no-answer", "failed", "canceled"].includes(record.status);
          if (!isTerminalAlready && record.status !== mappedStatus) {
            await CallRecord.findByIdAndUpdate(record._id, { status: mappedStatus });
            console.log(`   ⏱️ Updated Click-to-Call via ${matchedBy} to status: ${mappedStatus}`);
          }
        }
      }
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Status webhook error:", error);
    res.status(500).send("Error");
  }
});

// @route   POST /api/twilio/token
// @desc    Generate Twilio Access Token for Browser Calling (VoIP)
// @access  Private (user)
router.post("/token", authMiddleware, async (req, res) => {
  try {
    // Get user's assigned phone number to find the right Twilio account
    const userPhoneNumber = req.user?.phoneNumber;
    const { accountSid, authToken, fromNumber } = await resolveTwilioConfig(req.body, userPhoneNumber);
    
    if (!accountSid || !authToken) {
      return res.status(400).json({
        success: false,
        message: "Twilio credentials not found. Make sure your phone number is linked to a Twilio account.",
      });
    }

    const client = twilio(accountSid, authToken);
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    // 1. Find or Create TwiML App for Browser Calling
    // We need a TwiML App to handle the outgoing call from the browser
    const appName = "Comsierge Browser Calling";
    let appSid = "";
    const webhookBase = process.env.WEBHOOK_BASE_URL || `https://${req.get('host')}`;
    const voiceWebhookUrl = `${webhookBase}/api/twilio/webhook/voice`;
    
    console.log(`🔧 Token endpoint - Using Twilio account: ${accountSid?.slice(0, 10)}...`);
    console.log(`🔧 Token endpoint - Target voiceWebhookUrl: ${voiceWebhookUrl}`);
    
    try {
      const apps = await client.applications.list({ friendlyName: appName });
      console.log(`🔧 Found ${apps.length} existing TwiML apps with name "${appName}"`);
      
      if (apps.length > 0) {
        appSid = apps[0].sid;
        console.log(`🔧 Existing app SID: ${appSid}, current voiceUrl: ${apps[0].voiceUrl}`);
        
        // ALWAYS update the voiceUrl to ensure it points to current server
        console.log(`📱 Updating TwiML App ${appSid} voiceUrl to: ${voiceWebhookUrl}`);
        await client.applications(appSid).update({
          voiceUrl: voiceWebhookUrl,
          voiceMethod: "POST",
          statusCallback: `${webhookBase}/api/twilio/webhook/call-status`,
          statusCallbackMethod: "POST",
        });
        
        // Verify the update worked
        const updatedApp = await client.applications(appSid).fetch();
        console.log(`✅ TwiML App updated. New voiceUrl: ${updatedApp.voiceUrl}`);
        
        // Extra verification: check if the voiceUrl actually matches
        if (updatedApp.voiceUrl !== voiceWebhookUrl) {
          console.error(`❌ WARNING: voiceUrl mismatch! Expected: ${voiceWebhookUrl}, Got: ${updatedApp.voiceUrl}`);
        }
      } else {
        // Create new app
        const newApp = await client.applications.create({
          friendlyName: appName,
          voiceUrl: voiceWebhookUrl,
          voiceMethod: "POST",
          statusCallback: `${webhookBase}/api/twilio/webhook/call-status`,
          statusCallbackMethod: "POST",
        });
        appSid = newApp.sid;
        console.log(`✅ Created new TwiML App: ${appSid} with voiceUrl: ${voiceWebhookUrl}`);
      }
    } catch (e) {
      console.error("Failed to manage TwiML App:", e);
      console.error("TwiML App error details:", e.message);
      return res.status(500).json({ success: false, message: "Failed to setup calling app: " + e.message });
    }

    // 2. Generate Access Token
    const identity = req.user.email || "user_" + req.user.id;
    
    let apiKey = process.env.TWILIO_API_KEY;
    let apiSecret = process.env.TWILIO_API_SECRET;

    // If API Key/Secret are missing, create a temporary one (or use Account SID fallback if supported, but API Key is better)
    if (!apiKey || !apiSecret) {
      try {
        console.log("⚠️ No TWILIO_API_KEY/SECRET found. Creating temporary API Key...");
        const newKey = await client.newKeys.create({ friendlyName: 'Comsierge Temp Key ' + Date.now() });
        apiKey = newKey.sid;
        apiSecret = newKey.secret;
        console.log("✅ Created temporary API Key:", apiKey);
      } catch (e) {
        console.error("Failed to create API Key:", e);
        // Fallback to Account SID/Auth Token (works for some older SDKs/regions but deprecated)
        apiKey = accountSid;
        apiSecret = authToken;
      }
    }

    const token = new AccessToken(
      accountSid,
      apiKey,
      apiSecret,
      { identity: identity }
    );

    // Grant access to Voice
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: appSid,
      incomingAllow: true, // Allow incoming calls to this browser client
    });
    token.addGrant(voiceGrant);

    console.log(`✅ Token generated for ${identity} using TwiML app ${appSid}`);

    res.json({
      success: true,
      token: token.toJwt(),
      identity: identity,
      twimlAppSid: appSid,
      voiceWebhookUrl: voiceWebhookUrl, // For debugging
      accountSid: accountSid.slice(0, 10) + "..." // For debugging (partial)
    });

  } catch (error) {
    console.error("Token generation error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
});


// @route   POST /api/twilio/conference/add-participant
// @desc    Add a participant to an ongoing call (3-way calling)
// @access  Private (user)
router.post("/conference/add-participant", authMiddleware, async (req, res) => {
  try {
    const { callSid, participantNumber, fromNumber, currentParticipantNumber } = req.body;
    
    if (!participantNumber) {
      return res.status(400).json({
        success: false,
        message: "participantNumber is required"
      });
    }

    // Get user's phone number for caller ID
    const userPhoneNumber = fromNumber || req.user?.phoneNumber;
    if (!userPhoneNumber) {
      return res.status(400).json({
        success: false,
        message: "No phone number assigned to make outbound calls"
      });
    }

    const { accountSid, authToken } = await resolveTwilioConfig({}, userPhoneNumber);
    if (!accountSid || !authToken) {
      return res.status(400).json({
        success: false,
        message: "Twilio credentials not found"
      });
    }

    const client = twilio(accountSid, authToken);
    
    // Create a unique conference name
    const conferenceName = `conf_${req.user.id}_${Date.now()}`;
    const webhookBase = process.env.WEBHOOK_BASE_URL || "https://comsierge-iwe0.onrender.com";
    
    // Clean and format the new participant's number
    const cleanNumber = participantNumber.replace(/[^\d+]/g, "");
    const formattedNumber = cleanNumber.startsWith("+") ? cleanNumber : `+1${cleanNumber}`;
    
    // For browser calls, we create a new outbound call to the new participant
    // The browser SDK call continues, and we connect the new person
    // This effectively creates a 3-way call scenario
    
    const outboundCall = await client.calls.create({
      to: formattedNumber,
      from: userPhoneNumber,
      twiml: `<Response><Say>Please hold while we connect you to the call.</Say><Pause length="60"/></Response>`,
      statusCallback: `${webhookBase}/api/twilio/webhook/status`,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    });

    console.log(`✅ Called participant ${formattedNumber}, call SID: ${outboundCall.sid}`);

    // Note: True 3-way conferencing from browser requires:
    // 1. Browser user connects to a conference room instead of direct dial
    // 2. Original call recipient joins same conference
    // 3. New participant joins same conference
    // This requires changes to how browser calls are initiated

    res.json({
      success: true,
      message: "Calling new participant. They will be connected once they answer.",
      callSid: outboundCall.sid,
      participantNumber: formattedNumber,
    });

  } catch (error) {
    console.error("Add participant error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add participant: " + error.message
    });
  }
});


// @route   POST /api/twilio/make-call
// @desc    Initiate an outbound call using user's assigned phone number
// @access  Private (user)
router.post("/make-call", authMiddleware, async (req, res) => {
  try {
    const { toNumber, message, fromNumber, bridgeTo } = req.body;
    
    // Get user to find their personal phone number (for bridging)
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Use provided bridgeTo, or fallback to user's profile phone number
    const agentNumber = bridgeTo || user.phoneNumber;

    if (!agentNumber) {
      return res.status(400).json({
        success: false,
        message: "You must set your personal phone number in your profile or provide a bridge number to use Click-to-Call.",
      });
    }

    if (!fromNumber) {
      return res.status(400).json({
        success: false,
        message: "No phone number assigned to user. Admin must assign a Twilio number first.",
      });
    }
    
    if (!toNumber) {
      return res.status(400).json({
        success: false,
        message: "toNumber is required",
      });
    }

    // Resolve credentials from DB based on the fromNumber
    const { accountSid, authToken } = await resolveTwilioConfig(req.body, fromNumber);

    if (!accountSid || !authToken) {
      return res.status(400).json({
        success: false,
        message:
          "Twilio credentials not found. Add a Twilio account in admin panel or set env vars.",
      });
    }

    const client = twilio(accountSid, authToken);
    
    // Validate that fromNumber belongs to this Twilio account
    const cleanFrom = fromNumber.replace(/[^\d+]/g, "");
    try {
      const numbers = await client.incomingPhoneNumbers.list();
      const validNumber = numbers.find(n => n.phoneNumber === cleanFrom);
      
      if (!validNumber) {
        console.error(`Phone ${cleanFrom} not found in Twilio account. Available: ${numbers.map(n => n.phoneNumber).join(", ")}`);
        return res.status(400).json({
          success: false,
          message: `Phone number ${cleanFrom} is not registered in the Twilio account. Contact admin.`,
        });
      }
      
      if (!validNumber.capabilities?.voice) {
        return res.status(400).json({
          success: false,
          message: `Phone number ${cleanFrom} does not have voice capability enabled.`,
        });
      }
    } catch (e) {
      console.error("Failed to validate Twilio number:", e.message);
      // Continue anyway - Twilio will reject if invalid
    }

    try {
      // Use the public webhook URL for Twilio callbacks
      const webhookBase = process.env.WEBHOOK_BASE_URL || `https://${req.get('host')}`;
      
      console.log(`📞 Initiating Click-to-Call:`);
      console.log(`   Agent (User): ${agentNumber}`);
      console.log(`   Customer: ${toNumber}`);
      console.log(`   Twilio Number: ${cleanFrom}`);

      // Create a real two-way voice call using <Dial>
      // 1. Call the Agent (User) first
      // 2. When Agent answers, execute TwiML to dial Customer
      const call = await client.calls.create({
        url: `${webhookBase}/api/twilio/webhook/connect?to=${encodeURIComponent(toNumber)}`,
        from: cleanFrom,      // Show Twilio number to Agent
        to: agentNumber,      // Call Agent's real phone
        // Ring timeout for the agent leg (reduces time stuck on "Dialing")
        timeout: 20,
        statusCallback: `${webhookBase}/api/twilio/webhook/status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
      });
      
      // Create call record for Click-to-Call (Call via My Phone)
      try {
        // Look up contact name
        let contactName = null;
        const normalizedTo = toNumber.replace(/[^\d+]/g, "");
        let contact = await Contact.findOne({ userId: user._id, phone: normalizedTo });
        if (!contact) {
          const altTo = normalizedTo.startsWith("+") ? normalizedTo.substring(1) : "+" + normalizedTo;
          contact = await Contact.findOne({ userId: user._id, phone: altTo });
        }
        contactName = contact?.name || null;
        
        await CallRecord.create({
          userId: user._id,
          contactPhone: toNumber,
          contactName: contactName,
          direction: "outgoing",
          type: "outgoing",
          status: "initiated", // Will be updated by status webhook
          twilioCallSid: call.sid,
          startedAt: new Date(),
          reason: "click_to_call"
        });
        console.log(`   ✅ Created outgoing call record for Click-to-Call, CallSid: ${call.sid}`);
      } catch (recordErr) {
        console.error(`   ❌ Failed to create Click-to-Call record:`, recordErr.message);
      }

      res.json({
        success: true,
        message: "Calling your phone now. Please answer to connect to the customer.",
        data: {
          callSid: call.sid,
          status: call.status,
          from: call.from,
          to: call.to,
        },
      });
    } catch (error) {
      console.error("Twilio call error:", error.message);
      return res.status(400).json({
        success: false,
        message: "Failed to make call",
        error: error.message,
      });
    }
  } catch (error) {
    console.error("Make call error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   GET /api/twilio/messages
// @desc    Get message history
// @access  Private (user)
router.post("/messages", async (req, res) => {
  try {
    const { accountSid, authToken, phoneNumber } = await resolveTwilioConfig(req.body);
    const { limit } = req.body;

    if (!accountSid || !authToken) {
      return res.status(400).json({
        success: false,
        message: "accountSid and authToken are required",
      });
    }

    const client = twilio(accountSid, authToken);

    try {
      const options = { limit: limit || 50 };
      if (phoneNumber) {
        // Get messages for a specific number (both sent and received)
        const [sent, received] = await Promise.all([
          client.messages.list({ ...options, from: phoneNumber }),
          client.messages.list({ ...options, to: phoneNumber }),
        ]);
        
        const allMessages = [...sent, ...received]
          .sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime())
          .slice(0, options.limit);

        res.json({
          success: true,
          count: allMessages.length,
          data: allMessages.map(m => ({
            sid: m.sid,
            from: m.from,
            to: m.to,
            body: m.body,
            status: m.status,
            direction: m.direction,
            dateCreated: m.dateCreated,
            dateSent: m.dateSent,
          })),
        });
      } else {
        // Get all messages
        const messages = await client.messages.list(options);
        
        res.json({
          success: true,
          count: messages.length,
          data: messages.map(m => ({
            sid: m.sid,
            from: m.from,
            to: m.to,
            body: m.body,
            status: m.status,
            direction: m.direction,
            dateCreated: m.dateCreated,
            dateSent: m.dateSent,
          })),
        });
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Failed to fetch messages",
        error: error.message,
      });
    }
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   GET /api/twilio/calls
// @desc    Get call history
// @access  Private (user)
router.post("/calls", async (req, res) => {
  try {
    const { accountSid, authToken, phoneNumber } = await resolveTwilioConfig(req.body);
    const { limit } = req.body;

    if (!accountSid || !authToken) {
      return res.status(400).json({
        success: false,
        message: "accountSid and authToken are required",
      });
    }

    const client = twilio(accountSid, authToken);

    try {
      const options = { limit: limit || 50 };
      if (phoneNumber) {
        const [outbound, inbound] = await Promise.all([
          client.calls.list({ ...options, from: phoneNumber }),
          client.calls.list({ ...options, to: phoneNumber }),
        ]);
        
        const allCalls = [...outbound, ...inbound]
          .sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime())
          .slice(0, options.limit);

        res.json({
          success: true,
          count: allCalls.length,
          data: allCalls.map(c => ({
            sid: c.sid,
            from: c.from,
            to: c.to,
            status: c.status,
            direction: c.direction,
            duration: c.duration,
            dateCreated: c.dateCreated,
            startTime: c.startTime,
            endTime: c.endTime,
          })),
        });
      } else {
        const calls = await client.calls.list(options);
        
        res.json({
          success: true,
          count: calls.length,
          data: calls.map(c => ({
            sid: c.sid,
            from: c.from,
            to: c.to,
            status: c.status,
            direction: c.direction,
            duration: c.duration,
            dateCreated: c.dateCreated,
            startTime: c.startTime,
            endTime: c.endTime,
          })),
        });
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Failed to fetch calls",
        error: error.message,
      });
    }
  } catch (error) {
    console.error("Get calls error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   POST /api/twilio/end-call
// @desc    End an active call
// @access  Private (user)
router.post("/end-call", authMiddleware, async (req, res) => {
  try {
    const { callSid } = req.body;

    if (!callSid) {
      return res.status(400).json({
        success: false,
        message: "callSid is required",
      });
    }

    const userPhoneNumber = req.user?.phoneNumber;
    const { accountSid, authToken } = await resolveTwilioConfig({}, userPhoneNumber);

    if (!accountSid || !authToken) {
      return res.status(400).json({
        success: false,
        message: "Twilio credentials not found. Contact admin.",
      });
    }

    const client = twilio(accountSid, authToken);

    try {
      const call = await client.calls(callSid).update({ status: "completed" });

      res.json({
        success: true,
        message: "Call ended successfully",
        data: {
          callSid: call.sid,
          status: call.status,
        },
      });
    } catch (error) {
      console.error("End call error:", error.message);
      return res.status(400).json({
        success: false,
        message: "Failed to end call",
        error: error.message,
      });
    }
  } catch (error) {
    console.error("End call error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   POST /api/twilio/hold-call
// @desc    Put a call on hold or resume
// @access  Private (user)
router.post("/hold-call", authMiddleware, async (req, res) => {
  try {
    const { callSid, hold } = req.body;

    if (!callSid) {
      return res.status(400).json({
        success: false,
        message: "callSid is required",
      });
    }

    const userPhoneNumber = req.user?.phoneNumber;
    const { accountSid, authToken } = await resolveTwilioConfig({}, userPhoneNumber);

    if (!accountSid || !authToken) {
      return res.status(400).json({
        success: false,
        message: "Twilio credentials not found. Contact admin.",
      });
    }

    const client = twilio(accountSid, authToken);

    try {
      // Update call with hold music TwiML or resume
      const twiml = hold
        ? `<Response><Play loop="0">http://com.twilio.music.classical.s3.amazonaws.com/ClsssclC/3.mp3</Play></Response>`
        : `<Response><Say voice="alice">You are now reconnected.</Say></Response>`;

      const call = await client.calls(callSid).update({ twiml });

      res.json({
        success: true,
        message: hold ? "Call placed on hold" : "Call resumed",
        data: {
          callSid: call.sid,
          status: call.status,
          hold: hold,
        },
      });
    } catch (error) {
      console.error("Hold call error:", error.message);
      return res.status(400).json({
        success: false,
        message: "Failed to update call hold status",
        error: error.message,
      });
    }
  } catch (error) {
    console.error("Hold call error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   POST /api/twilio/transfer-call
// @desc    Transfer a call to another number
// @access  Private (user)
router.post("/transfer-call", authMiddleware, async (req, res) => {
  try {
    // Resolve Twilio config from user's phone number (not from body)
    const userPhoneNumber = req.user?.phoneNumber;
    const { accountSid, authToken, fromNumber } = await resolveTwilioConfig(req.body, userPhoneNumber);
    const { callSid, transferTo, duration } = req.body;

    if (!callSid || !transferTo) {
      return res.status(400).json({
        success: false,
        message: "callSid and transferTo are required",
      });
    }
    
    if (!accountSid || !authToken) {
      return res.status(400).json({
        success: false,
        message: "Twilio credentials not found. Contact admin.",
      });
    }

    const client = twilio(accountSid, authToken);

    try {
      // Real transfer: redirect the *callee/PSTN leg* to Dial transferTo,
      // and end the agent leg. This preserves the current other party and
      // connects them to the new destination.

      const buildTransferTwiml = (to) => (
        `<?xml version="1.0" encoding="UTF-8"?>` +
        `<Response>` +
        `<Say voice="alice">Please hold while I transfer your call.</Say>` +
        `<Dial>${to}</Dial>` +
        `</Response>`
      );

      // Try to find the active PSTN (child) leg of this call.
      // IMPORTANT: The frontend may send either the parent (client leg) CallSid OR the child (PSTN) CallSid.
      let parentSid = callSid;
      let childSid = null;

      // If callSid is actually a child call, fetch to discover its parent.
      try {
        const callInfo = await client.calls(callSid).fetch();
        if (callInfo?.parentCallSid) {
          parentSid = callInfo.parentCallSid;
        }
      } catch (e) {
        // Not fatal; we'll attempt transfer using the provided sid.
        console.error("Transfer: failed to fetch call info:", e.message);
      }

      try {
        const children = await client.calls.list({ parentCallSid: parentSid, limit: 20 });
        const activeChild = (children || []).find((c) =>
          ["in-progress", "ringing", "queued"].includes(String(c.status || "").toLowerCase())
        );
        if (activeChild) childSid = activeChild.sid;
      } catch (e) {
        console.error("Transfer: failed to list child calls:", e.message);
      }

      // Prefer redirecting the active PSTN leg; fallback to whichever sid we were given.
      const sidToRedirect = childSid || callSid;
      await client.calls(sidToRedirect).update({ twiml: buildTransferTwiml(transferTo) });

      // Mark the related CallRecord as transferred so status webhooks don't overwrite it.
      // We try several possible SIDs depending on which one the client provided.
      const sidCandidates = [callSid, parentSid, childSid, sidToRedirect].filter(Boolean);
      
      // Build update object with status and forwardedTo, plus duration if provided
      const updateObj = { status: "transferred", forwardedTo: transferTo };
      if (duration !== undefined && duration !== null) {
        updateObj.duration = duration;
      }
      
      await CallRecord.updateMany(
        { twilioCallSid: { $in: sidCandidates } },
        { $set: updateObj }
      );

      // End the agent leg if we redirected a different leg.
      // If the client passed the parentSid (agent/client leg), end it after redirect.
      if (childSid && parentSid && parentSid !== childSid) {
        try {
          await client.calls(parentSid).update({ status: "completed" });
        } catch (e) {
          console.error("Transfer: failed to end agent leg:", e.message);
        }
      }

      res.json({
        success: true,
        message: "Call transferred successfully",
        data: {
          originalCallSid: callSid,
          parentCallSid: parentSid,
          redirectedCallSid: sidToRedirect,
          childCallSid: childSid,
          transferTo: transferTo,
        },
      });
    } catch (error) {
      console.error("Transfer call error:", error.message);
      return res.status(400).json({
        success: false,
        message: "Failed to transfer call",
        error: error.message,
      });
    }
  } catch (error) {
    console.error("Transfer call error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   POST /api/twilio/send-dtmf
// @desc    Send DTMF tones to an active call (for IVR navigation)
// @access  Private (user)
router.post("/send-dtmf", authMiddleware, async (req, res) => {
  try {
    const { callSid, digits } = req.body;

    if (!callSid || !digits) {
      return res.status(400).json({
        success: false,
        message: "callSid and digits are required",
      });
    }

    const userPhoneNumber = req.user?.phoneNumber;
    const { accountSid, authToken } = await resolveTwilioConfig({}, userPhoneNumber);

    if (!accountSid || !authToken) {
      return res.status(400).json({
        success: false,
        message: "Twilio credentials not found. Contact admin.",
      });
    }

    const client = twilio(accountSid, authToken);

    try {
      // Send DTMF tones using TwiML Play
      const twiml = `<Response><Play digits="${digits}"/></Response>`;
      const call = await client.calls(callSid).update({ twiml });

      res.json({
        success: true,
        message: "DTMF tones sent",
        data: {
          callSid: call.sid,
          digits: digits,
        },
      });
    } catch (error) {
      console.error("Send DTMF error:", error.message);
      return res.status(400).json({
        success: false,
        message: "Failed to send DTMF tones",
        error: error.message,
      });
    }
  } catch (error) {
    console.error("Send DTMF error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   POST /api/twilio/create-conference
// @desc    Create a conference call (group call)
// @access  Private (user)
router.post("/create-conference", async (req, res) => {
  try {
    const { accountSid, authToken, fromNumber } = await resolveTwilioConfig(req.body);
    const { participants, conferenceName } = req.body;

    if (!accountSid || !authToken || !fromNumber || !participants || participants.length === 0) {
      return res.status(400).json({
        success: false,
        message: "All fields are required: accountSid, authToken, fromNumber, participants (array of phone numbers)",
      });
    }

    const client = twilio(accountSid, authToken);
    const confName = conferenceName || `comsierge-conf-${Date.now()}`;

    try {
      // Call each participant and connect them to the conference
      const callPromises = participants.map(number =>
        client.calls.create({
          twiml: `<Response><Dial><Conference beep="true" startConferenceOnEnter="true" endConferenceOnExit="false">${confName}</Conference></Dial></Response>`,
          from: fromNumber,
          to: number,
        })
      );

      const calls = await Promise.all(callPromises);

      res.json({
        success: true,
        message: "Conference call created",
        data: {
          conferenceName: confName,
          participants: calls.map(c => ({
            callSid: c.sid,
            to: c.to,
            status: c.status,
          })),
        },
      });
    } catch (error) {
      console.error("Create conference error:", error.message);
      return res.status(400).json({
        success: false,
        message: "Failed to create conference",
        error: error.message,
      });
    }
  } catch (error) {
    console.error("Create conference error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   POST /api/twilio/add-participant
// @desc    Add a participant to an existing conference
// @access  Private (user)
router.post("/add-participant", async (req, res) => {
  try {
    const { accountSid, authToken, fromNumber } = await resolveTwilioConfig(req.body);
    const { participantNumber, conferenceName } = req.body;

    if (!accountSid || !authToken || !fromNumber || !participantNumber || !conferenceName) {
      return res.status(400).json({
        success: false,
        message: "All fields are required: accountSid, authToken, fromNumber, participantNumber, conferenceName",
      });
    }

    const client = twilio(accountSid, authToken);

    try {
      const call = await client.calls.create({
        twiml: `<Response><Dial><Conference beep="true" startConferenceOnEnter="true" endConferenceOnExit="false">${conferenceName}</Conference></Dial></Response>`,
        from: fromNumber,
        to: participantNumber,
      });

      res.json({
        success: true,
        message: "Participant added to conference",
        data: {
          conferenceName: conferenceName,
          callSid: call.sid,
          participantNumber: participantNumber,
          status: call.status,
        },
      });
    } catch (error) {
      console.error("Add participant error:", error.message);
      return res.status(400).json({
        success: false,
        message: "Failed to add participant",
        error: error.message,
      });
    }
  } catch (error) {
    console.error("Add participant error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   POST /api/twilio/record-call
// @desc    Start/stop recording an active call
// @access  Private (user)
router.post("/record-call", authMiddleware, async (req, res) => {
  try {
    const { callSid, action } = req.body;

    if (!callSid || !action) {
      return res.status(400).json({
        success: false,
        message: "callSid and action (start/stop) are required",
      });
    }

    const userPhoneNumber = req.user?.phoneNumber;
    const { accountSid, authToken } = await resolveTwilioConfig({}, userPhoneNumber);

    if (!accountSid || !authToken) {
      return res.status(400).json({
        success: false,
        message: "Twilio credentials not found. Contact admin.",
      });
    }

    const client = twilio(accountSid, authToken);

    try {
      if (action === "start") {
        const recording = await client.calls(callSid).recordings.create({
          recordingStatusCallback: "http://example.com/recording-status",
        });
        
        res.json({
          success: true,
          message: "Recording started",
          data: {
            recordingSid: recording.sid,
            callSid: callSid,
            status: recording.status,
          },
        });
      } else if (action === "stop") {
        // Get active recordings for this call and stop them
        const recordings = await client.calls(callSid).recordings.list({ status: "in-progress" });
        
        for (const rec of recordings) {
          await client.calls(callSid).recordings(rec.sid).update({ status: "stopped" });
        }
        
        res.json({
          success: true,
          message: "Recording stopped",
          data: {
            callSid: callSid,
            stoppedRecordings: recordings.length,
          },
        });
      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid action. Use 'start' or 'stop'",
        });
      }
    } catch (error) {
      console.error("Record call error:", error.message);
      return res.status(400).json({
        success: false,
        message: "Failed to record call",
        error: error.message,
      });
    }
  } catch (error) {
    console.error("Record call error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   GET /api/twilio/call-status/:callSid
// @desc    Get the status of a specific call
// @access  Private (user)
router.post("/call-status", async (req, res) => {
  try {
    const { callSid, fromNumber } = req.body;
    
    // Resolve credentials from DB using the fromNumber
    const { accountSid, authToken } = await resolveTwilioConfig(req.body, fromNumber);

    if (!accountSid || !authToken) {
      return res.status(400).json({
        success: false,
        message: "Could not resolve Twilio credentials",
      });
    }
    
    if (!callSid) {
      return res.status(400).json({
        success: false,
        message: "callSid is required",
      });
    }

    const client = twilio(accountSid, authToken);

    try {
      const call = await client.calls(callSid).fetch();

      res.json({
        success: true,
        data: {
          callSid: call.sid,
          status: call.status,
          from: call.from,
          to: call.to,
          direction: call.direction,
          duration: call.duration,
          startTime: call.startTime,
          endTime: call.endTime,
        },
      });
    } catch (error) {
      console.error("Get call status error:", error.message);
      return res.status(400).json({
        success: false,
        message: "Failed to get call status",
        error: error.message,
      });
    }
  } catch (error) {
    console.error("Get call status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

export default router;
