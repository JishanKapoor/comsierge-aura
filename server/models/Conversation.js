import mongoose from "mongoose";

// Conversation represents a thread between user and a contact
const conversationSchema = new mongoose.Schema(
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
    },
    contactName: {
      type: String,
      default: null, // null means use contactPhone as display name
    },
    lastMessage: {
      type: String,
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    unreadCount: {
      type: Number,
      default: 0,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    isMuted: {
      type: Boolean,
      default: false,
    },
    isArchived: {
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
    // Last AI analysis for this conversation
    lastAiAnalysis: {
      priority: {
        type: String,
        enum: ["high", "medium", "low"],
        default: null,
      },
      category: {
        type: String,
        default: null,
      },
      sentiment: {
        type: String,
        enum: ["positive", "negative", "neutral"],
        default: null,
      },
      spamProbability: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
    },
    // Time-aware priority context derived from message text (meeting/deadline expiry, emergency stickiness)
    priorityContext: {
      kind: {
        type: String,
        enum: ["emergency", "meeting", "deadline", "important"],
        default: null,
      },
      eventAt: {
        type: Date,
        default: null,
      },
      expiresAt: {
        type: Date,
        default: null,
      },
      detectedAt: {
        type: Date,
        default: null,
      },
      source: {
        type: String,
        default: "heuristic",
      },
    },
    priority: {
      type: String,
      enum: ["normal", "high", "urgent"],
      default: "normal",
    },
    transferPrefs: {
      to: {
        type: String,
        default: null,
      },
      type: {
        type: String,
        enum: ["all", "high-priority"],
        default: "all",
      },
      priorityFilter: {
        type: String,
        default: "all",
      },
    },
    language: {
      receive: {
        type: String,
        default: "en",
      },
      send: {
        type: String,
        default: "en",
      },
    },

    // Tracks SMS forwarding to the user's personal forwarding number.
    // Used to support burst-aware forwarding (people often split one thought into multiple messages).
    lastForwardedAt: {
      type: Date,
      default: null,
    },
    lastForwardedTo: {
      type: String,
      default: null,
    },
    // Anchor timestamp for a short follow-up window. This should be set only when a message is
    // forwarded due to meeting the priority filter directly (not via follow-up), so the window
    // does NOT extend indefinitely during a long chat.
    forwardBurstAnchorAt: {
      type: Date,
      default: null,
    },
    forwardBurstAnchorTo: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for user + contact phone uniqueness
conversationSchema.index({ userId: 1, contactPhone: 1 }, { unique: true });

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
