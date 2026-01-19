import express from "express";
import CallRecord from "../models/CallRecord.js";
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

// @route   GET /api/calls
// @desc    Get call history for current user
// @access  Private
router.get("/", async (req, res) => {
  try {
    const { limit = 50, type, before } = req.query;

    const query = { userId: req.user._id };
    
    // Filter by type if specified
    // "incoming" shows all incoming calls including missed, answered, forwarded, blocked
    // "outgoing" shows outgoing calls
    if (type && type !== "all") {
      if (type === "incoming") {
        // For incoming filter, match type=incoming OR type=missed OR direction=incoming
        // Missed calls are incoming calls that weren't answered
        query.$or = [
          { type: "incoming" },
          { type: "missed" },
          { direction: "incoming" }
        ];
      } else if (type === "outgoing") {
        // Match type=outgoing OR direction=outgoing (for backwards compat)
        query.$or = [
          { type: "outgoing" },
          { direction: "outgoing" }
        ];
      } else {
        query.type = type;
      }
    }

    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const calls = await CallRecord.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    // Ensure consistent display names even if older records had stale contactName.
    const contactIds = Array.from(
      new Set(
        calls
          .map((c) => c.contactId)
          .filter(Boolean)
          .map((id) => String(id))
      )
    );

    const contactsById = new Map();
    const contactsByPhone = new Map();
    if (contactIds.length) {
      const contacts = await Contact.find({
        userId: req.user._id,
        _id: { $in: contactIds },
      }).select("_id name phone");

      for (const contact of contacts) {
        contactsById.set(String(contact._id), contact);
        if (contact.phone) {
          for (const key of buildPhoneCandidates(contact.phone)) {
            contactsByPhone.set(String(key), contact);
          }
        }
      }
    }

    // Fallback: resolve by phone for legacy records missing contactId
    const callPhones = Array.from(
      new Set(calls.map((c) => c.contactPhone).filter(Boolean).map((p) => String(p)))
    );
    if (callPhones.length) {
      const phoneCandidates = buildPhoneCandidates(...callPhones);
      const contactsByPhoneCandidates = await Contact.find({
        userId: req.user._id,
        phone: { $in: phoneCandidates },
      }).select("_id name phone");
      for (const contact of contactsByPhoneCandidates) {
        if (contact.phone) {
          for (const key of buildPhoneCandidates(contact.phone)) {
            contactsByPhone.set(String(key), contact);
          }
        }
      }
    }

    const responseCalls = calls.map((call) => {
      const obj = call.toObject();
      const c = obj.contactId
        ? contactsById.get(String(obj.contactId))
        : (obj.contactPhone ? contactsByPhone.get(String(obj.contactPhone)) : null);
      if (c?.name) obj.contactName = c.name;
      return obj;
    });

    res.json({
      success: true,
      count: responseCalls.length,
      data: responseCalls,
    });
  } catch (error) {
    console.error("Get calls error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   POST /api/calls
// @desc    Save a call record
// @access  Private
router.post("/", async (req, res) => {
  try {
    const {
      contactPhone,
      contactName,
      direction,
      type,
      status,
      twilioSid,
      twilioCallSid,
      callSid,
      fromNumber,
      toNumber,
      duration,
      startTime,
      endTime,
    } = req.body;

    if (!contactPhone || !type) {
      return res.status(400).json({
        success: false,
        message: "contactPhone and type are required",
      });
    }

    // Find contact if exists
    const contact = await Contact.findOne({ userId: req.user._id, phone: contactPhone });

    const callRecord = await CallRecord.create({
      userId: req.user._id,
      contactId: contact?._id,
      contactPhone,
      contactName: contactName || contact?.name || "Unknown",
      direction: direction || (type === "outgoing" ? "outgoing" : "incoming"),
      type,
      status: status || "completed",
      // Back-compat: older clients send `twilioSid` or `callSid`.
      // Our Twilio webhooks update by `twilioCallSid`.
      twilioSid: twilioSid || callSid,
      twilioCallSid: twilioCallSid || callSid || twilioSid,
      fromNumber: fromNumber || req.user.phoneNumber,
      toNumber: toNumber || contactPhone,
      duration: duration || 0,
      startTime: startTime ? new Date(startTime) : null,
      endTime: endTime ? new Date(endTime) : null,
    });

    res.status(201).json({
      success: true,
      message: "Call record saved",
      data: callRecord,
    });
  } catch (error) {
    console.error("Save call error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   PUT /api/calls/:id
// @desc    Update a call record (status, duration, etc)
// @access  Private
router.put("/:id", async (req, res) => {
  try {
    const callRecord = await CallRecord.findOne({ _id: req.params.id, userId: req.user._id });
    
    if (!callRecord) {
      return res.status(404).json({
        success: false,
        message: "Call record not found",
      });
    }

    const { status, duration, endTime, recordingUrl, transcription } = req.body;
    
    if (status) callRecord.status = status;
    if (duration !== undefined) callRecord.duration = duration;
    if (endTime) callRecord.endTime = new Date(endTime);
    if (recordingUrl) callRecord.recordingUrl = recordingUrl;
    if (transcription) callRecord.transcription = transcription;

    await callRecord.save();

    res.json({
      success: true,
      message: "Call record updated",
      data: callRecord,
    });
  } catch (error) {
    console.error("Update call error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   DELETE /api/calls/:id
// @desc    Delete a call record
// @access  Private
router.delete("/:id", async (req, res) => {
  try {
    // First find the call record to get recording info for cleanup
    const callRecord = await CallRecord.findOne({ _id: req.params.id, userId: req.user._id });
    
    if (!callRecord) {
      return res.status(404).json({
        success: false,
        message: "Call record not found",
      });
    }

    // Try to delete any Twilio recordings associated with this call
    if (callRecord.recordingSid || callRecord.voicemailUrl) {
      try {
        // Import User model to get Twilio credentials
        const User = (await import("../models/User.js")).default;
        const user = await User.findById(req.user._id);
        
        if (user?.twilioAccountSid && user?.twilioAuthToken) {
          const twilio = (await import("twilio")).default;
          const twilioClient = twilio(user.twilioAccountSid, user.twilioAuthToken);
          
          // Delete recording if we have the SID
          if (callRecord.recordingSid) {
            try {
              await twilioClient.recordings(callRecord.recordingSid).remove();
              console.log(`Deleted Twilio recording: ${callRecord.recordingSid}`);
            } catch (recErr) {
              console.log(`Could not delete recording ${callRecord.recordingSid}:`, recErr.message);
            }
          }
          
          // Extract recording SID from voicemail URL if available
          if (callRecord.voicemailUrl && !callRecord.recordingSid) {
            const voicemailMatch = callRecord.voicemailUrl.match(/Recordings\/([A-Z0-9]+)/i);
            if (voicemailMatch) {
              try {
                await twilioClient.recordings(voicemailMatch[1]).remove();
                console.log(`Deleted Twilio voicemail recording: ${voicemailMatch[1]}`);
              } catch (vmErr) {
                console.log(`Could not delete voicemail recording:`, vmErr.message);
              }
            }
          }
        }
      } catch (twilioErr) {
        console.log("Error during Twilio cleanup:", twilioErr.message);
        // Continue with deletion even if Twilio cleanup fails
      }
    }

    // Now delete the call record from database
    await CallRecord.deleteOne({ _id: callRecord._id });

    res.json({
      success: true,
      message: "Call record deleted",
    });
  } catch (error) {
    console.error("Delete call error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   GET /api/calls/contact/:phone
// @desc    Get call history for a specific contact phone
// @access  Private
router.get("/contact/:phone", async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const contactPhone = req.params.phone;
    
    // Normalize phone number for matching
    const normalizedPhone = contactPhone.replace(/[^\d+]/g, "");
    
    const calls = await CallRecord.find({
      userId: req.user._id,
      $or: [
        { contactPhone: normalizedPhone },
        { contactPhone: { $regex: normalizedPhone.replace(/^\+1/, ""), $options: "i" } },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      count: calls.length,
      data: calls,
    });
  } catch (error) {
    console.error("Get calls for contact error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   GET /api/calls/stats
// @desc    Get call statistics for current user
// @access  Private
router.get("/stats", async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get counts by type
    const [total, incoming, outgoing, missed] = await Promise.all([
      CallRecord.countDocuments({ userId }),
      CallRecord.countDocuments({ userId, type: "incoming" }),
      CallRecord.countDocuments({ userId, type: "outgoing" }),
      CallRecord.countDocuments({ userId, type: "missed" }),
    ]);
    
    // Get total call duration
    const durationResult = await CallRecord.aggregate([
      { $match: { userId } },
      { $group: { _id: null, totalDuration: { $sum: "$duration" } } },
    ]);
    const totalDuration = durationResult[0]?.totalDuration || 0;
    
    // Get today's calls
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCalls = await CallRecord.countDocuments({
      userId,
      createdAt: { $gte: today },
    });
    
    res.json({
      success: true,
      data: {
        total,
        incoming,
        outgoing,
        missed,
        totalDuration,
        todayCalls,
      },
    });
  } catch (error) {
    console.error("Get call stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @route   GET /api/calls/:id/voicemail
// @desc    Stream voicemail audio (proxy to Twilio with auth)
// @access  Private
router.get("/:id/voicemail", async (req, res) => {
  try {
    const call = await CallRecord.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    });

    if (!call) {
      return res.status(404).json({ success: false, message: "Call not found" });
    }

    if (!call.voicemailUrl) {
      return res.status(404).json({ success: false, message: "No voicemail for this call" });
    }

    const normalizePhone = (value) => {
      const cleaned = String(value || "").replace(/[^\d+]/g, "");
      if (!cleaned) return "";
      if (cleaned.startsWith("+")) return cleaned;
      // Best-effort: assume US if no country code
      return `+${cleaned}`;
    };

    // Resolve Twilio credentials.
    // IMPORTANT: TwilioAccount does NOT have a `userId` field at the top-level.
    const TwilioAccount = (await import("../models/TwilioAccount.js")).default;
    let twilioAccount = null;

    const hintedAccountSid = call?.metadata?.twilioAccountSid || call?.metadata?.accountSid;
    if (hintedAccountSid) {
      twilioAccount = await TwilioAccount.findOne({ accountSid: hintedAccountSid });
    }

    // Try matching by the user's assigned Twilio number (most reliable for incoming voicemail)
    if (!twilioAccount && req.user?.phoneNumber) {
      const target = normalizePhone(req.user.phoneNumber);
      const accounts = await TwilioAccount.find({});
      twilioAccount = accounts.find(acc => (acc.phoneNumbers || []).some(p => normalizePhone(p) === target)) || null;
    }

    // Try matching by call's to/from fields if present
    if (!twilioAccount) {
      const maybeTwilioNumber = normalizePhone(call.toNumber || call.fromNumber);
      if (maybeTwilioNumber) {
        const accounts = await TwilioAccount.find({});
        twilioAccount = accounts.find(acc => (acc.phoneNumbers || []).some(p => normalizePhone(p) === maybeTwilioNumber)) || null;
      }
    }

    const accountSid = twilioAccount?.accountSid || process.env.TWILIO_ACCOUNT_SID;
    const authToken = twilioAccount?.authToken || process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      return res.status(500).json({ success: false, message: "Phone service not configured" });
    }

    // Fetch the recording from Twilio with authentication
    const recordingUrl = call.voicemailUrl.endsWith('.mp3') 
      ? call.voicemailUrl 
      : `${call.voicemailUrl}.mp3`;

    const response = await fetch(recordingUrl, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64')
      }
    });

    if (!response.ok) {
      console.error("Twilio recording fetch failed:", response.status, await response.text());
      return res.status(response.status).json({ success: false, message: "Failed to fetch voicemail" });
    }

    // Stream the audio back to the client
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': response.headers.get('content-length'),
    });

    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));

  } catch (error) {
    console.error("Get voicemail error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

export default router;
