import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import authRoutes from "./routes/auth.js";
import twilioRoutes from "./routes/twilio.js";
import aiRoutes from "./routes/ai.js";
import contactsRoutes from "./routes/contacts.js";
import messagesRoutes from "./routes/messages.js";
import callsRoutes from "./routes/calls.js";
import rulesRoutes from "./routes/rules.js";
import adminRoutes from "./routes/admin.js";
import supportRoutes from "./routes/support.js";
import remindersRoutes from "./routes/reminders.js";
import translateRoutes from "./routes/translate.js";
import mediaRoutes from "./routes/media.js";
import aiCallsRoutes from "./routes/ai-calls.js";
import { startReminderScheduler } from "./services/reminderScheduler.js";

// Load environment variables with explicit path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, ".env") });

console.log("🔑 OPENAI_API_KEY present:", !!process.env.OPENAI_API_KEY);
console.log("🔑 MONGODB_URI present:", !!process.env.MONGODB_URI);

const app = express();

// Middleware
const isDev = (process.env.NODE_ENV || "development") !== "production";
const isAllowedDevOrigin = (origin) => {
  if (!origin) return true; // allow curl/postman/no-origin

  const allowed = [
    /^http:\/\/localhost(?::\d+)?$/i,
    /^http:\/\/127\.0\.0\.1(?::\d+)?$/i,
    /^http:\/\/(?:10|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d+\.\d+\.\d+(?::\d+)?$/i,
  ];

  return allowed.some((re) => re.test(origin));
};

app.use(
  cors({
    origin: (origin, cb) => {
      if (isDev) return cb(null, isAllowedDevOrigin(origin));
      // Production: allow Render frontend and common origins
      const prodAllowed = [
        /^https:\/\/comsierge.*\.onrender\.com$/i,
        /^https:\/\/.*\.vercel\.app$/i,
        /^https:\/\/.*\.netlify\.app$/i,
      ];
      if (!origin || prodAllowed.some(re => re.test(origin))) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  })
);
// Increase JSON body limit for base64 image uploads (default is 100KB)
app.use(express.json({ limit: '5mb' }));
// For Twilio webhooks (they send form-urlencoded data)
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/twilio", twilioRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/contacts", contactsRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/calls", callsRoutes);
app.use("/api/rules", rulesRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/reminders", remindersRoutes);
app.use("/api/translate", translateRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/ai-calls", aiCallsRoutes);

// Root route - shows API info
app.get("/", (req, res) => {
  res.json({
    name: "Comsierge API",
    version: "1.0.0",
    status: "running",
    endpoints: {
      auth: "/api/auth",
      twilio: "/api/twilio",
      ai: "/api/ai",
      contacts: "/api/contacts",
      messages: "/api/messages",
      calls: "/api/calls",
      rules: "/api/rules",
      admin: "/api/admin",
      reminders: "/api/reminders",
      translate: "/api/translate",
      health: "/api/health",
    },
  });
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Something went wrong!",
  });
});

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    console.log("🔄 Connecting to MongoDB...");
    
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: "comsierge", // Explicitly set database name
    });
    
    console.log("✅ MongoDB connected successfully");
    console.log(`📁 Database: ${mongoose.connection.db.databaseName}`);
    
    // List collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`📋 Collections: ${collections.map(c => c.name).join(", ") || "none yet"}`);

    // Start the reminder scheduler
    startReminderScheduler();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
      console.log(`📡 API endpoints:`);
      console.log(`   POST /api/auth/signup - Register new user`);
      console.log(`   POST /api/auth/login - Login user`);
      console.log(`   GET  /api/auth/me - Get current user`);
      console.log(`   PUT  /api/auth/profile - Update profile`);
      console.log(`   GET  /api/auth/users - List all users`);
      console.log(`   DELETE /api/auth/users/all - Delete all users`);
      console.log(`   🤖 AI Endpoints:`);
      console.log(`   POST /api/ai/analyze - Analyze a message`);
      console.log(`   POST /api/ai/priority - Quick priority check`);
      console.log(`   POST /api/ai/batch-analyze - Batch analyze messages`);
      console.log(`   POST /api/ai/auto-response - Generate auto-response`);
      console.log(`   POST /api/ai/should-hold - Check if should hold`);
      console.log(`   POST /api/ai/process-incoming - Full incoming processing`);
      console.log(`   POST /api/ai/reply-suggestions - Generate reply suggestions (GPT-4o)`);
      console.log(`   POST /api/ai/rewrite - Rewrite message (GPT-4o)`);
      console.log(`   POST /api/ai/conversation-chat - AI Agent Chat`);
    });
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    process.exit(1);
  }
};

// Handle MongoDB connection events
mongoose.connection.on("disconnected", () => {
  console.log("⚠️ MongoDB disconnected");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB error:", err);
});

// Global error handlers
process.on('uncaughtException', (err) => {
  console.error('🔥 Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 Unhandled Rejection:', reason);
});

startServer();
