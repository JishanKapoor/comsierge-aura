import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";

const router = express.Router();

// Google OAuth client
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.NODE_ENV === "production"
    ? "https://comsierge-iwe0.onrender.com/api/auth/google/callback"
    : "http://localhost:5000/api/auth/google/callback"
);

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

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    // Create new user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
    });

    // Generate token
    const token = generateToken(user._id);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          plan: user.plan,
          createdAt: user.createdAt,
        },
        token,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists",
      });
    }
    
    // Handle validation errors
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

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Find user and include password for comparison
    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Your account has been deactivated",
      });
    }

    // Generate token
    const token = generateToken(user._id);

    // Update last login
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
// @desc    Get current user
// @access  Private
router.get("/me", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
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
        },
      },
    });
  } catch (error) {
    console.error("Auth check error:", error);
    res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
});

// @route   PUT /api/auth/change-password
// @desc    Change user password
// @access  Private
router.put("/change-password", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const { currentPassword, newPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide current password and new password",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters",
      });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Update password (will be hashed by pre-save hook)
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put("/profile", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const { name, email, avatar } = req.body;

    // Check if new email already exists (if changing email)
    if (email && email.toLowerCase() !== user.email) {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email already in use",
        });
      }
      user.email = email.toLowerCase();
    }

    if (name) user.name = name;
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          plan: user.plan,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
});

// @route   GET /api/auth/users
// @desc    Get all users (admin only - for demo purposes)
// @access  Private
router.get("/users", async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    
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
    });
  }
});

// @route   DELETE /api/auth/users/all
// @desc    Delete all users (for testing/reset)
// @access  Public (should be protected in production)
router.delete("/users/all", async (req, res) => {
  try {
    await User.deleteMany({});
    
    res.json({
      success: true,
      message: "All users deleted",
    });
  } catch (error) {
    console.error("Delete users error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   DELETE /api/auth/users/:id
// @desc    Delete a single user by ID
// @access  Private (admin only)
router.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    await User.findByIdAndDelete(id);
    
    res.json({
      success: true,
      message: "User deleted successfully",
      data: { id },
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   PUT /api/auth/users/:id/phone
// @desc    Update user's assigned phone number
// @access  Private (admin only)
router.put("/users/:id/phone", async (req, res) => {
  try {
    const { id } = req.params;
    const { phoneNumber } = req.body;
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.phoneNumber = phoneNumber;
    await user.save();
    
    res.json({
      success: true,
      message: phoneNumber ? "Phone number assigned" : "Phone number unassigned",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
        },
      },
    });
  } catch (error) {
    console.error("Update user phone error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   PUT /api/auth/users/:id/forwarding
// @desc    Update user's call forwarding number
// @access  Private
router.put("/users/:id/forwarding", async (req, res) => {
  try {
    const { id } = req.params;
    const { forwardingNumber } = req.body;
    
    // Validate phone number format (US numbers: 10 digits or 11 starting with 1)
    if (forwardingNumber) {
      const digits = forwardingNumber.replace(/\D/g, "");
      const isValid = (digits.length === 10 && digits[0] >= '2' && digits[0] <= '9') ||
                      (digits.length === 11 && digits[0] === '1' && digits[1] >= '2' && digits[1] <= '9');
      
      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid US phone number",
        });
      }
    }
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.forwardingNumber = forwardingNumber || null;
    await user.save();
    
    res.json({
      success: true,
      message: forwardingNumber ? "Forwarding number saved" : "Forwarding number cleared",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
          forwardingNumber: user.forwardingNumber,
        },
      },
    });
  } catch (error) {
    console.error("Update user forwarding error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   POST /api/auth/create-admin
// @desc    Create an admin user (for setup)
// @access  Public (should be protected in production)
router.post("/create-admin", async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: email?.toLowerCase() || "admin@comsierge.com" });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: "Admin user already exists",
        data: {
          email: existingAdmin.email,
          role: existingAdmin.role,
        },
      });
    }

    // Create admin user
    const admin = await User.create({
      name: name || "Admin",
      email: email?.toLowerCase() || "admin@comsierge.com",
      password: password || "admin123",
      role: "admin",
    });

    res.status(201).json({
      success: true,
      message: "Admin user created",
      data: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Create admin error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// ========== GOOGLE OAUTH ==========

// @route   GET /api/auth/google
// @desc    Redirect to Google OAuth
// @access  Public
router.get("/google", (req, res) => {
  const frontendUrl = process.env.NODE_ENV === "production"
    ? "https://comsierge-ai.onrender.com"
    : "http://localhost:5173";
  
  const authUrl = googleClient.generateAuthUrl({
    access_type: "offline",
    scope: ["profile", "email"],
    prompt: "consent",
    state: frontendUrl, // Pass frontend URL in state for redirect
  });
  
  res.redirect(authUrl);
});

// @route   GET /api/auth/google/callback
// @desc    Handle Google OAuth callback
// @access  Public
router.get("/google/callback", async (req, res) => {
  const frontendUrl = process.env.NODE_ENV === "production"
    ? "https://comsierge-ai.onrender.com"
    : "http://localhost:5173";
  
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.redirect(`${frontendUrl}/auth?error=no_code`);
    }

    // Exchange code for tokens
    const { tokens } = await googleClient.getToken(code);
    googleClient.setCredentials(tokens);

    // Get user info from Google
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;

    // Find or create user
    let user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // Create new user with Google info
      user = await User.create({
        name: name || email.split("@")[0],
        email: email.toLowerCase(),
        password: crypto.randomBytes(32).toString("hex"), // Random password for OAuth users
        avatar: picture,
        googleId,
        isActive: true,
      });
      console.log("Created new user via Google OAuth:", email);
    } else {
      // Update existing user with Google info if missing
      if (!user.googleId) {
        user.googleId = googleId;
      }
      if (!user.avatar && picture) {
        user.avatar = picture;
      }
      user.lastLogin = new Date();
      await user.save();
      console.log("Existing user logged in via Google:", email);
    }

    // Generate JWT token
    const token = generateToken(user._id);

    // Redirect to frontend with token
    res.redirect(`${frontendUrl}/auth?token=${token}&google=success`);
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    res.redirect(`${frontendUrl}/auth?error=oauth_failed`);
  }
});

// ========== FORGOT PASSWORD ==========

// @route   POST /api/auth/forgot-password
// @desc    Request password reset (sends email)
// @access  Public
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Please provide an email address",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({
        success: true,
        message: "If an account exists with this email, you will receive a password reset link",
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");

    // Save reset token to user (expires in 1 hour)
    user.passwordResetToken = resetTokenHash;
    user.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    // Build reset URL
    const frontendUrl = process.env.NODE_ENV === "production"
      ? "https://comsierge-ai.onrender.com"
      : "http://localhost:5173";
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    // For now, log the reset URL (in production, send via email)
    console.log(`Password reset requested for ${email}`);
    console.log(`Reset URL: ${resetUrl}`);

    // TODO: Send email with reset link using your email service
    // Example with Resend:
    // await resend.emails.send({
    //   from: 'noreply@comsierge.com',
    //   to: email,
    //   subject: 'Reset your Comsierge password',
    //   html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. Link expires in 1 hour.</p>`
    // });

    res.json({
      success: true,
      message: "If an account exists with this email, you will receive a password reset link",
      // Include reset URL in dev for testing
      ...(process.env.NODE_ENV !== "production" && { resetUrl }),
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide token and new password",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    // Hash the token to compare with stored hash
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // Find user with valid reset token
    const user = await User.findOne({
      passwordResetToken: tokenHash,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    // Update password and clear reset token
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // Generate new JWT token so user is logged in
    const jwtToken = generateToken(user._id);

    res.json({
      success: true,
      message: "Password reset successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        token: jwtToken,
      },
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
});

// Auth middleware - verifies JWT and attaches user to req
export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

// Admin middleware - requires user to be admin
export const adminMiddleware = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }
  next();
};

export default router;
