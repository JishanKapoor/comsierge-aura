import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import authRoutes from "./routes/auth.js";
import twilioRoutes from "./routes/twilio.js";
import aiRoutes from "./routes/ai.js";

// Load environment variables with explicit path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, ".env") });

const app = express();

// Middleware
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:8080", "http://127.0.0.1:5173"],
  credentials: true,
}));
app.use(express.json());
// For Twilio webhooks (they send form-urlencoded data)
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/twilio", twilioRoutes);
app.use("/api/ai", aiRoutes);

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

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
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

startServer();
