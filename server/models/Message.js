import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
      default: null,
    },
    contactPhone: {
      type: String,
      required: true,
      index: true,
    },
    contactName: {
      type: String,
      default: "Unknown",
    },
    direction: {
      type: String,
      enum: ["incoming", "outgoing"],
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "sent", "delivered", "failed", "received"],
      default: "pending",
    },
    twilioSid: {
      type: String,
      default: null,
    },
    fromNumber: {
      type: String,
      required: true,
    },
    toNumber: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    isMuted: {
      type: Boolean,
      default: false,
    },
    isHeld: {
      type: Boolean,
      default: false,
    },
    isSpam: {
      type: Boolean,
      default: false,
    },
    // AI/Sentiment fields
    sentiment: {
      score: {
        type: String,
        enum: ["positive", "neutral", "negative"],
        default: null,
      },
      confidence: {
        type: Number,
        min: 0,
        max: 100,
        default: null,
      },
    },
    urgency: {
      level: {
        type: String,
        enum: ["low", "medium", "high", "emergency"],
        default: null,
      },
      confidence: {
        type: Number,
        min: 0,
        max: 100,
        default: null,
      },
    },
    category: {
      type: String,
      enum: ["personal", "business", "finance", "meeting", "promo", "scam", "other"],
      default: null,
    },
    labels: [{
      type: String,
      trim: true,
    }],
    // Attachments for MMS
    attachments: [{
      url: String,
      contentType: String,
      filename: String,
      size: Number,
    }],
    // For forwarded messages
    forwardedFrom: {
      type: String,
      default: null,
    },
    forwardedTo: {
      type: String,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Index for fetching conversation threads
messageSchema.index({ userId: 1, contactPhone: 1, createdAt: -1 });

// Index for searching messages by body text
messageSchema.index({ userId: 1, body: "text" });

// Index for sentiment/urgency filtering
messageSchema.index({ userId: 1, "sentiment.score": 1 });
messageSchema.index({ userId: 1, "urgency.level": 1 });
messageSchema.index({ userId: 1, category: 1 });
messageSchema.index({ userId: 1, labels: 1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;
