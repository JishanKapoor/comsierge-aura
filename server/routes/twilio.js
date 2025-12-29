import express from "express";
import twilio from "twilio";

const router = express.Router();

// @route   POST /api/twilio/verify-credentials
// @desc    Verify Twilio account credentials and phone number
// @access  Private (admin only)
router.post("/verify-credentials", async (req, res) => {
  try {
    const { accountSid, authToken, phoneNumber } = req.body;

    // Validation
    if (!accountSid || !authToken) {
      return res.status(400).json({
        success: false,
        message: "Account SID and Auth Token are required",
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
    const { accountSid, authToken } = req.body;

    if (!accountSid || !authToken) {
      return res.status(400).json({
        success: false,
        message: "Account SID and Auth Token are required",
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

// @route   POST /api/twilio/send-test-sms
// @desc    Send a test SMS to verify phone number works
// @access  Private (admin only)
router.post("/send-test-sms", async (req, res) => {
  try {
    const { accountSid, authToken, fromNumber, toNumber } = req.body;

    if (!accountSid || !authToken || !fromNumber || !toNumber) {
      return res.status(400).json({
        success: false,
        message: "All fields are required: accountSid, authToken, fromNumber, toNumber",
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

export default router;
