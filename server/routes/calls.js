import express from "express";
import CallRecord from "../models/CallRecord.js";
import Contact from "../models/Contact.js";
import { authMiddleware } from "./auth.js";

const router = express.Router();

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
    // "incoming" shows all incoming calls (answered, forwarded, blocked)
    // "outgoing" shows outgoing calls
    // "missed" shows missed calls
    if (type && type !== "all") {
      if (type === "incoming") {
        // For incoming filter, match type=incoming OR direction=incoming (for backwards compat)
        // Exclude missed calls
        query.$and = [
          { $or: [{ type: "incoming" }, { direction: "incoming" }] },
          { type: { $ne: "missed" } },
          { status: { $ne: "missed" } }
        ];
      } else if (type === "outgoing") {
        // Match type=outgoing OR direction=outgoing (for backwards compat)
        query.$or = [
          { type: "outgoing" },
          { direction: "outgoing" }
        ];
      } else if (type === "missed") {
        // Match type=missed OR status=missed
        query.$or = [
          { type: "missed" },
          { status: "missed" }
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

    res.json({
      success: true,
      count: calls.length,
      data: calls,
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
      twilioSid,
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
    const callRecord = await CallRecord.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    
    if (!callRecord) {
      return res.status(404).json({
        success: false,
        message: "Call record not found",
      });
    }

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

    // Get Twilio credentials from user's account or env
    const TwilioAccount = (await import("../models/TwilioAccount.js")).default;
    const twilioAccount = await TwilioAccount.findOne({ userId: req.user._id });
    
    const accountSid = twilioAccount?.accountSid || process.env.TWILIO_ACCOUNT_SID;
    const authToken = twilioAccount?.authToken || process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      return res.status(500).json({ success: false, message: "Twilio not configured" });
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
