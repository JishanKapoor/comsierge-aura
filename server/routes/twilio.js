import express from "express";
import twilio from "twilio";

const router = express.Router();

// In-memory store for incoming messages (for demo purposes)
// In production, use a database
const incomingMessages = [];
const MAX_MESSAGES = 100;

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

// @route   POST /api/twilio/send-sms
// @desc    Send an SMS message
// @access  Private (user)
router.post("/send-sms", async (req, res) => {
  try {
    const { accountSid, authToken, fromNumber, toNumber, body } = req.body;

    if (!accountSid || !authToken || !fromNumber || !toNumber || !body) {
      return res.status(400).json({
        success: false,
        message: "All fields are required: accountSid, authToken, fromNumber, toNumber, body",
      });
    }

    const client = twilio(accountSid, authToken);

    try {
      const message = await client.messages.create({
        body: body,
        from: fromNumber,
        to: toNumber,
      });

      res.json({
        success: true,
        message: "SMS sent successfully",
        data: {
          messageSid: message.sid,
          status: message.status,
          from: message.from,
          to: message.to,
          body: message.body,
          dateCreated: message.dateCreated,
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
// @desc    Handle incoming SMS messages
// @access  Public (Twilio webhook)
router.post("/webhook/sms", async (req, res) => {
  try {
    const { From, To, Body, MessageSid, AccountSid } = req.body;
    
    console.log("📨 Incoming SMS:");
    console.log(`   From: ${From}`);
    console.log(`   To: ${To}`);
    console.log(`   Body: ${Body}`);
    console.log(`   MessageSid: ${MessageSid}`);

    // Store the message in memory
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

    // Respond with TwiML (empty response = no auto-reply)
    res.type("text/xml");
    res.send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
  } catch (error) {
    console.error("SMS webhook error:", error);
    res.status(500).send("Error processing SMS");
  }
});

// @route   POST /api/twilio/webhook/voice
// @desc    Handle incoming voice calls
// @access  Public (Twilio webhook)
router.post("/webhook/voice", async (req, res) => {
  try {
    const { From, To, CallSid, CallStatus } = req.body;
    
    console.log("📞 Incoming Call:");
    console.log(`   From: ${From}`);
    console.log(`   To: ${To}`);
    console.log(`   CallSid: ${CallSid}`);
    console.log(`   Status: ${CallStatus}`);

    // Respond with TwiML
    res.type("text/xml");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Hello, thank you for calling. Please leave a message after the beep.</Say>
  <Record maxLength="120" transcribe="true" />
  <Say voice="alice">Thank you for your message. Goodbye.</Say>
</Response>`);
  } catch (error) {
    console.error("Voice webhook error:", error);
    res.status(500).send("Error processing call");
  }
});

// @route   POST /api/twilio/webhook/status
// @desc    Handle message/call status updates
// @access  Public (Twilio webhook)
router.post("/webhook/status", async (req, res) => {
  try {
    const { MessageSid, CallSid, MessageStatus, CallStatus, From, To } = req.body;
    
    if (MessageSid) {
      console.log(`📊 SMS Status Update: ${MessageSid} - ${MessageStatus}`);
    }
    if (CallSid) {
      console.log(`📊 Call Status Update: ${CallSid} - ${CallStatus}`);
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Status webhook error:", error);
    res.status(500).send("Error");
  }
});

// @route   POST /api/twilio/make-call
// @desc    Initiate an outbound call
// @access  Private (user)
router.post("/make-call", async (req, res) => {
  try {
    const { accountSid, authToken, fromNumber, toNumber, message } = req.body;

    if (!accountSid || !authToken || !fromNumber || !toNumber) {
      return res.status(400).json({
        success: false,
        message: "All fields are required: accountSid, authToken, fromNumber, toNumber",
      });
    }

    const client = twilio(accountSid, authToken);

    try {
      // Create TwiML for the call
      const twiml = message 
        ? `<Response><Say voice="alice">${message}</Say></Response>`
        : `<Response><Say voice="alice">Hello, this is a call from Comsierge.</Say></Response>`;

      const call = await client.calls.create({
        twiml: twiml,
        from: fromNumber,
        to: toNumber,
      });

      res.json({
        success: true,
        message: "Call initiated successfully",
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
    const { accountSid, authToken, phoneNumber, limit } = req.body;

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
    const { accountSid, authToken, phoneNumber, limit } = req.body;

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

export default router;
