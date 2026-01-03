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
  },
  {
    timestamps: true,
  }
);

// Compound index for user + contact phone uniqueness
conversationSchema.index({ userId: 1, contactPhone: 1 }, { unique: true });

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
