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
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "sent", "delivered", "failed", "received", "spam", "held", "blocked"],
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
    isBlocked: {
      type: Boolean,
      default: false,
    },
    isPriority: {
      type: Boolean,
      default: false,
    },
    isSpam: {
      type: Boolean,
      default: false,
    },
    // AI Analysis results
    aiAnalysis: {
      priority: {
        type: String,
        enum: ["high", "medium", "low"],
        default: null,
      },
      category: {
        type: String,
        enum: ["inquiry", "complaint", "support", "sales", "spam", "personal", "urgent", "other"],
        default: null,
      },
      sentiment: {
        type: String,
        enum: ["positive", "negative", "neutral"],
        default: null,
      },
      keyTopics: [{
        type: String,
      }],
      suggestedResponse: {
        type: String,
        default: null,
      },
      confidence: {
        type: Number,
        min: 0,
        max: 1,
        default: null,
      },
    },
    // Spam Analysis results
    spamAnalysis: {
      isSpam: {
        type: Boolean,
        default: false,
      },
      spamProbability: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
      senderTrust: {
        type: String,
        enum: ["high", "medium", "low"],
        default: null,
      },
      intent: {
        type: String,
        default: null,
      },
      reasoning: {
        type: String,
        default: null,
      },
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
    wasForwarded: {
      type: Boolean,
      default: false,
    },
    forwardedAt: {
      type: Date,
      default: null,
    },
    forwardedTwilioSid: {
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
