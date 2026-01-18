import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import twilio from "twilio";
import User from "../models/User.js";
import TwilioAccount from "../models/TwilioAccount.js";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import Rule from "../models/Rule.js";
import { cleanupUserData } from "../utils/cleanupUserData.js";

const router = express.Router();

const SMTP_USER = process.env.SMTP_USER || "comsiergeai@gmail.com";
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;

if (!SMTP_PASSWORD) {
  console.warn("⚠️ SMTP_PASSWORD is not set. Forgot password + OTP emails will not send.");
}

// Email transporter setup
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASSWORD,
  },
});

// Helper: Normalize phone to E.164-ish format
const normalizeToE164ish = (value) => {
  if (!value) return "";
  const cleaned = String(value).replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  const digits = String(value).replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return cleaned;
};

/**
 * Send Comsierge welcome SMS when forwarding number is set/changed.
 */
async function sendWelcomeSMS(user, toPhoneNumber) {
  try {
    if (!user?.phoneNumber) {
      console.log("   ⚠️ Cannot send welcome SMS - user has no Comsierge number assigned");
      return false;
    }
    
    const userName = user.name || "there";
    const welcomeMessage = `Comsierge Activated — Your AI Phone Number Is Now Live

Hi ${userName}, your Comsierge number is fully active.

From now on, your calls and texts are intelligently filtered, summarized, and routed — no app or Wi-Fi needed.

Here's what I handle for you:
• Filter calls and screen messages
• Apply your rules (like forwarding bank texts or blocking spam)
• Translate and summarize, and respond as needed
• Initiate calls from your Comsierge number

I help prevent spam and keep you updated on your upcoming schedule.

You stay in control. Your phone, your way.

Let me know if you want to call someone, set up new rules, or silence distractions.

I've got it covered.
— Comsierge
Your AI Chief of Staff for Communication`;
    
    // Find TwilioAccount for user's Comsierge number
    const normalizedComsierge = normalizeToE164ish(user.phoneNumber);
    let twilioAccount = await TwilioAccount.findOne({ phoneNumbers: user.phoneNumber });
    
    if (!twilioAccount) {
      twilioAccount = await TwilioAccount.findOne({ phoneNumbers: normalizedComsierge });
    }
    
    if (!twilioAccount) {
      // Search all accounts
      const allAccounts = await TwilioAccount.find({});
      for (const acc of allAccounts) {
        const normalizedPhones = (acc.phoneNumbers || []).map(p => normalizeToE164ish(p));
        if (normalizedPhones.includes(normalizedComsierge)) {
          twilioAccount = acc;
          break;
        }
      }
    }
    
    if (!twilioAccount || !twilioAccount.accountSid || !twilioAccount.authToken) {
      console.log("   ⚠️ Cannot send welcome SMS - no TwilioAccount found for Comsierge number");
      return false;
    }
    
    const client = twilio(twilioAccount.accountSid, twilioAccount.authToken);
    
    console.log(`   📤 Sending welcome SMS from ${normalizedComsierge} to ${toPhoneNumber}`);
    
    const result = await client.messages.create({
      body: welcomeMessage,
      from: normalizedComsierge,
      to: toPhoneNumber
    });
    
    console.log(`   ✅ Welcome SMS sent successfully (SID: ${result.sid})`);
    
    // Save welcome message to DB
    await Message.create({
      userId: user._id,
      contactPhone: toPhoneNumber,
      contactName: user.name || "You",
      direction: "outgoing",
      body: welcomeMessage,
      status: "sent",
      twilioSid: result.sid,
      fromNumber: normalizedComsierge,
      toNumber: toPhoneNumber,
    });
    
    // Update or create conversation
    await Conversation.findOneAndUpdate(
      { userId: user._id, contactPhone: toPhoneNumber },
      {
        $set: {
          contactName: user.name || "You",
          lastMessage: welcomeMessage.substring(0, 100) + "...",
          lastMessageAt: new Date(),
        }
      },
      { upsert: true, new: true }
    );
    
    return true;
  } catch (error) {
    console.error("   ❌ Failed to send welcome SMS:", error.message);
    return false;
  }
}

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send verification email
const sendVerificationEmail = async (email, otp, name) => {
  await transporter.sendMail({
    from: `"Comsierge AI" <${SMTP_USER}>`,
    to: email,
    subject: "Verify your email - Comsierge AI",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #000;">Welcome to Comsierge AI!</h1>
        <p>Hi ${name},</p>
        <p>Thank you for signing up. Please use the following code to verify your email:</p>
        <div style="background: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
          <h2 style="font-size: 32px; letter-spacing: 5px; margin: 0;">${otp}</h2>
        </div>
        <p>This code expires in 10 minutes.</p>
        <p>If you didn't create an account, please ignore this email.</p>
      </div>
    `,
  });
};

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// @route   POST /api/auth/signup
// @desc    Register a new user
// @access  Public
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, email, and password",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    // Email format validation
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    
    if (existingUser) {
      // If user signed up with Google, let them know
      if (existingUser.authProvider === "google" && existingUser.googleId) {
        return res.status(400).json({
          success: false,
          message: "This email is linked to a Google account. Please sign in with Google.",
        });
      }

      return res.status(400).json({
        success: false,
        message: "An account with this email already exists. Please sign in.",
      });
    }

    // Generate OTP for email verification
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create new user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      isEmailVerified: false,
      emailVerificationOTP: otp,
      emailVerificationExpires: otpExpires,
      authProvider: "email",
    });

    // Send verification email
    try {
      await sendVerificationEmail(user.email, otp, user.name);
      console.log(`Verification email sent to ${user.email}`);
    } catch (emailError) {
      console.error("Error sending verification email:", emailError);
      // Continue anyway - user can request resend
    }

    res.status(201).json({
      success: true,
      message: "Account created! Please check your email for verification code.",
      requiresVerification: true,
      email: user.email,
    });
  } catch (error) {
    console.error("Signup error:", error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists",
      });
    }
    
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
});

// @route   POST /api/auth/verify-email
// @desc    Verify email with OTP
router.post("/verify-email", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and verification code",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified",
      });
    }

    // Check if OTP has expired
    if (user.emailVerificationExpires && user.emailVerificationExpires < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "Verification code has expired. Please request a new one.",
        expired: true,
      });
    }

    // Check if OTP matches
    if (user.emailVerificationOTP !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code",
      });
    }

    // Mark email as verified
    user.isEmailVerified = true;
    user.emailVerificationOTP = null;
    user.emailVerificationExpires = null;
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: "Email verified successfully!",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          phoneNumber: user.phoneNumber,
          forwardingNumber: user.forwardingNumber,
        },
        token,
      },
    });
  } catch (error) {
    console.error("Verify email error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
});

// @route   POST /api/auth/resend-otp
// @desc    Resend verification OTP
router.post("/resend-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Please provide email",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified",
      });
    }

    // Generate new OTP
    const otp = generateOTP();
    user.emailVerificationOTP = otp;
    user.emailVerificationExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    // Send verification email
    try {
      await sendVerificationEmail(user.email, otp, user.name);
      console.log(`Verification email resent to ${user.email}`);
    } catch (emailError) {
      console.error("Error resending verification email:", emailError);
      return res.status(500).json({
        success: false,
        message: "Failed to send verification email. Please try again.",
      });
    }

    res.json({
      success: true,
      message: "Verification code sent! Please check your email.",
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check if this is a Google-only account
    if (user.authProvider === "google" && user.googleId && !user.password) {
      return res.status(401).json({
        success: false,
        message: "This account uses Google sign-in. Please sign in with Google.",
        useGoogle: true,
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Admin accounts should not be blocked by OTP email verification.
    // If an admin somehow isn't verified (legacy data), auto-verify on successful login.
    if (user.role === "admin" && !user.isEmailVerified) {
      user.isEmailVerified = true;
      user.emailVerificationOTP = null;
      user.emailVerificationExpires = null;
      await user.save();
    }

    // Check if email is verified (only for email auth, not Google)
    if (user.role !== "admin" && !user.isEmailVerified && user.authProvider === "email") {
      // Generate new OTP and send
      const otp = generateOTP();
      user.emailVerificationOTP = otp;
      user.emailVerificationExpires = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();

      try {
        await sendVerificationEmail(user.email, otp, user.name);
      } catch (emailError) {
        console.error("Error sending verification email on login:", emailError);
      }

      return res.status(403).json({
        success: false,
        message: "Please verify your email first. A new code has been sent.",
        requiresVerification: true,
        email: user.email,
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Your account has been deactivated",
      });
    }

    const token = generateToken(user._id);
    user.lastLogin = new Date();
    await user.save();

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          phoneNumber: user.phoneNumber,
          forwardingNumber: user.forwardingNumber,
          plan: user.plan,
          createdAt: user.createdAt,
        },
        token,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
});

// @route   GET /api/auth/me
router.get("/me", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          phoneNumber: user.phoneNumber,
          forwardingNumber: user.forwardingNumber,
          plan: user.plan,
          createdAt: user.createdAt,
          translationSettings: user.translationSettings || {
            receiveLanguage: "en",
            sendLanguage: "en",
            autoTranslateIncoming: false,
            translateOutgoing: false,
          },
        },
      },
    });
  } catch (error) {
    console.error("Auth check error:", error);
    res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
});

// @route   GET /api/auth/available-phones
// @desc    Get all phone numbers not assigned to any user (authenticated)
router.get("/available-phones", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("_id");
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    const accounts = await TwilioAccount.find().select("phoneNumbers");
    const allPhones = accounts.flatMap((a) => a.phoneNumbers || []);

    const assignedUsers = await User.find({ phoneNumber: { $ne: null } }).select("phoneNumber");
    const assignedPhones = assignedUsers.map((u) => u.phoneNumber);

    const availablePhones = allPhones.filter((p) => !assignedPhones.includes(p));

    res.json({
      success: true,
      data: {
        available: availablePhones,
      },
    });
  } catch (error) {
    console.error("Get available phones error:", error);
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
});

// @route   PUT /api/auth/me/phone
// @desc    Assign a phone number to the current user
router.put("/me/phone", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: "Please select a phone number" });
    }

    const account = await TwilioAccount.findOne({ phoneNumbers: phoneNumber }).select("_id");
    if (!account) {
      return res.status(400).json({ success: false, message: "Phone number not found in any Twilio account" });
    }

    const existingUser = await User.findOne({ phoneNumber, _id: { $ne: user._id } }).select("_id");
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Phone number already assigned to another user" });
    }

    // Check if this is a fresh assignment (user didn't have a phone before)
    const isFirstTimeAssignment = !user.phoneNumber;

    user.phoneNumber = phoneNumber;
    await user.save();

    // Create default routing rule for new users
    if (isFirstTimeAssignment) {
      try {
        // Check if user already has any routing rules (in case they had rules from before)
        const existingRules = await Rule.findOne({ userId: user._id, type: "forward" });
        
        if (!existingRules) {
          // Create default rule: Forward all calls + medium/high priority messages
          await Rule.create({
            userId: user._id,
            rule: "Forward all calls and important messages to my phone",
            type: "forward",
            active: true,
            schedule: { mode: "always" },
            transferDetails: {
              mode: "both",
              priority: "all",
              priorityFilter: "medium,high",
              contactPhone: user.forwardingNumber || null,
            },
            conditions: {
              callsEnabled: true,
              messagesEnabled: true,
              messagePriority: ["medium", "high"],
            },
          });
          console.log(`✅ Created default routing rule for new user ${user._id}`);
        }
      } catch (ruleError) {
        console.error("Error creating default rule:", ruleError);
        // Don't fail the phone assignment if rule creation fails
      }
    }

    res.json({
      success: true,
      message: "Phone number assigned",
      data: {
        user: {
          id: user._id,
          phoneNumber: user.phoneNumber,
        },
      },
    });
  } catch (error) {
    console.error("Assign phone to current user error:", error);
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
});

// @route   DELETE /api/auth/me/phone
// @desc    Unassign the phone number from the current user
router.delete("/me/phone", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    // Clean up all user data when phone is unassigned
    if (user.phoneNumber) {
      console.log(`🧹 User ${user._id} unassigning phone ${user.phoneNumber}. Cleaning up all data...`);
      await cleanupUserData(user._id);
    }

    user.phoneNumber = null;
    await user.save();

    res.json({
      success: true,
      message: "Phone number unassigned (all data cleared)",
      data: {
        user: {
          id: user._id,
          phoneNumber: null,
        },
      },
    });
  } catch (error) {
    console.error("Unassign phone from current user error:", error);
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
});

// @route   PUT /api/auth/me/forwarding
// @desc    Update forwarding number for the current user
router.put("/me/forwarding", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    const { forwardingNumber } = req.body;
    if (forwardingNumber) {
      const digits = forwardingNumber.replace(/\D/g, "");
      const isValid = digits.length === 10 || (digits.length === 11 && digits[0] === "1");
      if (!isValid) return res.status(400).json({ success: false, message: "Please enter a valid US phone number" });
    }

    // Detect if forwarding number is actually changing
    const oldForwardingNumber = user.forwardingNumber;
    const normalizeNumber = (num) => num ? normalizeToE164ish(num) : null;
    const oldNormalized = normalizeNumber(oldForwardingNumber);
    const newNormalized = forwardingNumber ? normalizeNumber(forwardingNumber) : null;
    const isNewNumber = newNormalized && newNormalized !== oldNormalized;

    user.forwardingNumber = forwardingNumber || null;
    await user.save();

    // Update existing routing rules to use the new forwarding number
    if (forwardingNumber) {
      try {
        await Rule.updateMany(
          { userId: user._id, type: "forward" },
          { 
            $set: { 
              "conditions.destinationLabel": forwardingNumber,
              "transferDetails.contactPhone": forwardingNumber
            }
          }
        );
        await Rule.updateMany(
          { userId: user._id, type: "message-notify" },
          { 
            $set: { 
              "conditions.destinationLabel": forwardingNumber
            }
          }
        );
        console.log(`📋 Updated routing rules for user ${user._id} to new forwarding number: ${forwardingNumber}`);
      } catch (ruleErr) {
        console.error("Failed to update routing rules:", ruleErr);
      }
    }

    // Send welcome SMS if number changed and user has a Comsierge number
    if (isNewNumber && user.phoneNumber) {
      console.log(`📱 Forwarding number changed from ${oldForwardingNumber || 'none'} to ${forwardingNumber} - sending welcome SMS`);
      sendWelcomeSMS(user, newNormalized).catch(err => console.error("Welcome SMS error:", err));
    }

    res.json({
      success: true,
      message: "Forwarding number updated",
      data: {
        user: {
          id: user._id,
          forwardingNumber: user.forwardingNumber,
        },
      },
    });
  } catch (error) {
    console.error("Update forwarding for current user error:", error);
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
});

// @route   PUT /api/auth/me/translation-settings
// @desc    Update translation settings for the current user (syncs across devices)
router.put("/me/translation-settings", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    const { receiveLanguage, sendLanguage, autoTranslateIncoming, translateOutgoing } = req.body;
    
    // Update only provided fields
    if (!user.translationSettings) {
      user.translationSettings = {};
    }
    if (receiveLanguage !== undefined) user.translationSettings.receiveLanguage = receiveLanguage;
    if (sendLanguage !== undefined) user.translationSettings.sendLanguage = sendLanguage;
    if (autoTranslateIncoming !== undefined) user.translationSettings.autoTranslateIncoming = autoTranslateIncoming;
    if (translateOutgoing !== undefined) user.translationSettings.translateOutgoing = translateOutgoing;
    
    await user.save();

    res.json({
      success: true,
      message: "Translation settings updated",
      data: {
        translationSettings: user.translationSettings,
      },
    });
  } catch (error) {
    console.error("Update translation settings error:", error);
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
});

// @route   PUT /api/auth/change-password
router.put("/change-password", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("+password");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Please provide current and new password" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "New password must be at least 6 characters" });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) return res.status(401).json({ success: false, message: "Current password is incorrect" });

    user.password = newPassword;
    user.passwordResetToken = null;
    user.passwordResetIssuedAt = null;
    user.passwordResetExpires = null;
    await user.save();

    res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// @route   PUT /api/auth/profile
router.put("/profile", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const { name, email, avatar } = req.body;

    if (email && email.toLowerCase() !== user.email) {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) return res.status(400).json({ success: false, message: "Email already in use" });
      user.email = email.toLowerCase();
    }
    if (name) user.name = name;
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: { user: { id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar } },
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// @route   GET /api/auth/users
router.get("/users", async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json({ success: true, count: users.length, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// @route   DELETE /api/auth/users/all
router.delete("/users/all", async (req, res) => {
  try {
    await User.deleteMany({});
    res.json({ success: true, message: "All users deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// @route   DELETE /api/auth/users/:id
router.delete("/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    
    // Clean up all user data before deleting the user
    console.log(`🧹 Deleting user ${user._id}. Cleaning up all data...`);
    await cleanupUserData(user._id);
    
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "User and all data deleted successfully", data: { id: req.params.id } });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// @route   PUT /api/auth/users/:id/phone
router.put("/users/:id/phone", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    
    const oldPhone = user.phoneNumber;
    const newPhone = req.body.phoneNumber;
    
    // If phone is being removed or changed, clean up all user data
    const isUnassigning = !newPhone && oldPhone;
    const isChangingPhone = newPhone && oldPhone && newPhone !== oldPhone;
    
    if (isUnassigning || isChangingPhone) {
      console.log(`🧹 Phone ${isUnassigning ? 'unassigned' : 'changed'} for user ${user._id}. Cleaning up all data...`);
      await cleanupUserData(user._id);
    }
    
    user.phoneNumber = newPhone || null;
    await user.save();
    res.json({ success: true, message: newPhone ? "Phone number updated" : "Phone number unassigned (all data cleared)", data: { user: { id: user._id, phoneNumber: user.phoneNumber } } });
  } catch (error) {
    console.error("Update user phone error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// @route   PUT /api/auth/users/:id/forwarding
router.put("/users/:id/forwarding", async (req, res) => {
  try {
    const { forwardingNumber } = req.body;
    if (forwardingNumber) {
      const digits = forwardingNumber.replace(/\D/g, "");
      const isValid = (digits.length === 10) || (digits.length === 11 && digits[0] === '1');
      if (!isValid) return res.status(400).json({ success: false, message: "Please enter a valid US phone number" });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    
    // Detect if forwarding number is actually changing
    const oldForwardingNumber = user.forwardingNumber;
    const oldNormalized = oldForwardingNumber ? normalizeToE164ish(oldForwardingNumber) : null;
    const newNormalized = forwardingNumber ? normalizeToE164ish(forwardingNumber) : null;
    const isNewNumber = newNormalized && newNormalized !== oldNormalized;
    
    user.forwardingNumber = forwardingNumber || null;
    await user.save();
    
    // Update existing routing rules to use the new forwarding number
    if (forwardingNumber) {
      try {
        // Update forward rules with the new destination
        await Rule.updateMany(
          { userId: user._id, type: "forward" },
          { 
            $set: { 
              "conditions.destinationLabel": forwardingNumber,
              "transferDetails.contactPhone": forwardingNumber
            }
          }
        );
        // Update message-notify rules with the new destination
        await Rule.updateMany(
          { userId: user._id, type: "message-notify" },
          { 
            $set: { 
              "conditions.destinationLabel": forwardingNumber
            }
          }
        );
        console.log(`📋 Updated routing rules for user ${user._id} to new forwarding number: ${forwardingNumber}`);
      } catch (ruleErr) {
        console.error("Failed to update routing rules:", ruleErr);
      }
    }
    
    // Send welcome SMS if number changed and user has a Comsierge number
    if (isNewNumber && user.phoneNumber) {
      console.log(`📱 [Admin] Forwarding number changed from ${oldForwardingNumber || 'none'} to ${forwardingNumber} - sending welcome SMS`);
      sendWelcomeSMS(user, newNormalized).catch(err => console.error("Welcome SMS error:", err));
    }
    
    res.json({ success: true, message: "Forwarding number saved", data: { user: { id: user._id, forwardingNumber: user.forwardingNumber } } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// @route   POST /api/auth/create-admin
router.post("/create-admin", async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const existingAdmin = await User.findOne({ email: email?.toLowerCase() || "admin@comsierge.com" });
    if (existingAdmin) {
      return res.status(400).json({ success: false, message: "Admin already exists" });
    }
    const admin = await User.create({
      name: name || "Admin",
      email: email?.toLowerCase() || "admin@comsierge.com",
      password: password || "admin123",
      role: "admin",
      isEmailVerified: true,
    });
    res.status(201).json({ success: true, message: "Admin created", data: { id: admin._id, email: admin.email } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ========== GOOGLE OAUTH ==========

// @route   POST /api/auth/google
router.post("/google", async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ success: false, message: "Access token is required" });
    }

    // Fetch user info from Google
    const googleResponse = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`);

    if (!googleResponse.ok) {
      const errorText = await googleResponse.text();
      console.error("Google userinfo error details:", errorText);
      return res.status(401).json({ success: false, message: "Invalid or expired Google token" });
    }

    const googleUser = await googleResponse.json();
    const { email, name, picture, id: googleId } = googleUser;

    if (!email) {
      return res.status(400).json({ success: false, message: "Could not get email from Google account" });
    }

    let user = await User.findOne({ email: email.toLowerCase() });
    let isNewUser = false;
    let linkedAccount = false;

    if (user) {
      if (user.googleId && user.googleId !== googleId) {
        return res.status(400).json({ success: false, message: "This email is already linked to a different Google account" });
      }
      if (!user.googleId) {
        user.googleId = googleId;
        linkedAccount = true;
      }
      if (!user.avatar && picture) user.avatar = picture;
      if (!user.isEmailVerified) user.isEmailVerified = true;
      user.lastLogin = new Date();
      await user.save();
    } else {
      isNewUser = true;
      user = await User.create({
        name: name || email.split("@")[0],
        email: email.toLowerCase(),
        password: crypto.randomBytes(32).toString("hex"),
        avatar: picture,
        googleId,
        isActive: true,
        isEmailVerified: true,
        authProvider: "google",
      });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: isNewUser ? "Account created successfully" : "Signed in successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          phoneNumber: user.phoneNumber,
          forwardingNumber: user.forwardingNumber,
        },
        token,
        isNew: isNewUser,
        linked: linkedAccount,
      },
    });
  } catch (error) {
    console.error("Google OAuth error:", error);
    res.status(500).json({ success: false, message: "Failed to authenticate with Google" });
  }
});

// ========== FORGOT PASSWORD ==========

// @route   POST /api/auth/forgot-password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Please provide an email address" });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.json({ success: true, message: "If an account exists, you will receive a password reset link" });
    }

    if (user.authProvider === "google" && user.googleId) {
      return res.json({ success: true, message: "If an account exists, you will receive a password reset link" });
    }

    // Throttle reset emails to prevent abuse.
    // We only store `passwordResetExpires` (set to now + 1 hour), so infer the request time from it.
    const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
    const RESET_COOLDOWN_MS = 30 * 1000;
    if (
      user.passwordResetExpires &&
      user.passwordResetExpires > Date.now() + (RESET_TOKEN_TTL_MS - RESET_COOLDOWN_MS)
    ) {
      return res.status(429).json({ success: false, message: "Please wait before requesting another reset link" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");

    user.passwordResetToken = resetTokenHash;
    user.passwordResetIssuedAt = new Date();
    user.passwordResetExpires = Date.now() + 60 * 60 * 1000;
    await user.save();

    const frontendUrl = process.env.NODE_ENV === "production" ? "https://comsierge-ai.onrender.com" : "http://localhost:5173";
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    console.log(`Password reset for ${email}: ${resetUrl}`);

    try {
      await transporter.sendMail({
        from: `"Comsierge AI" <${SMTP_USER}>`,
        to: email,
        subject: "Password Reset Request",
        html: `
          <h1>Password Reset Request</h1>
          <p>You requested a password reset for your Comsierge AI account.</p>
          <p>Please click the link below to reset your password:</p>
          <a href="${resetUrl}" style="padding: 10px 20px; background-color: #000; color: #fff; text-decoration: none; border-radius: 5px;">Reset Password</a>
          <p>If you didn't request this, please ignore this email.</p>
          <p>This link will expire in 1 hour.</p>
        `,
      });
      console.log(`Password reset email sent to ${email}`);
    } catch (emailError) {
      console.error("Error sending email:", emailError);
      // Don't fail the request, but log the error. 
      // In production, we might want to alert the user, 
      // but for security we usually pretend it worked.
    }

    res.json({
      success: true,
      message: "If an account exists, you will receive a password reset link",
      ...(process.env.NODE_ENV !== "production" && { resetUrl }),
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// @route   POST /api/auth/reset-password
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ success: false, message: "Please provide token and new password" });
    if (password.length < 6) return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({ passwordResetToken: tokenHash, passwordResetExpires: { $gt: Date.now() } });

    if (!user) return res.status(400).json({ success: false, message: "Invalid or expired reset token" });

    // If the user changed their password after this reset link was issued,
    // invalidate the link.
    if (
      user.passwordResetIssuedAt &&
      user.passwordChangedAt &&
      user.passwordChangedAt.getTime() > user.passwordResetIssuedAt.getTime()
    ) {
      user.passwordResetToken = null;
      user.passwordResetIssuedAt = null;
      user.passwordResetExpires = null;
      await user.save();
      return res.status(400).json({ success: false, message: "Invalid or expired reset token" });
    }

    user.password = password;
    user.passwordResetToken = null;
    user.passwordResetIssuedAt = null;
    user.passwordResetExpires = null;
    await user.save();

    const jwtToken = generateToken(user._id);

    res.json({
      success: true,
      message: "Password reset successfully",
      data: {
        user: { id: user._id, name: user.name, email: user.email, role: user.role, phoneNumber: user.phoneNumber, forwardingNumber: user.forwardingNumber },
        token: jwtToken,
      },
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Auth middleware
export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ success: false, message: "User not found" });

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

// Admin middleware
export const adminMiddleware = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }
  next();
};

export default router;
