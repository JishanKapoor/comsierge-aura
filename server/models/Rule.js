import mongoose from "mongoose";

const ruleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    rule: {
      type: String,
      required: [true, "Rule description is required"],
    },
    type: {
      type: String,
      enum: ["transfer", "auto-reply", "block", "forward", "priority", "custom", "message-notify"],
      default: "custom",
    },
    active: {
      type: Boolean,
      default: true,
    },
    schedule: {
      mode: {
        type: String,
        enum: ["always", "duration", "custom", "time-window"],
        default: "always",
      },
      durationHours: {
        type: Number,
        default: null,
      },
      startTime: {
        type: Date,
        default: null,
      },
      endTime: {
        type: Date,
        default: null,
      },
      // Time-window schedule (e.g., "10pm to 7am every day")
      timeWindow: {
        startHour: { type: Number, default: null }, // 0-23
        startMinute: { type: Number, default: 0 },
        endHour: { type: Number, default: null }, // 0-23
        endMinute: { type: Number, default: 0 },
        days: [{ type: String }], // ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
        timezone: { type: String, default: 'America/New_York' },
      },
    },
    // Conversation scoping - for "Finite State Dialogue Management"
    conversationScope: {
      // Enable intelligent conversation tracking
      enabled: { type: Boolean, default: false },
      // TTL for conversation state (hours)
      ttlHours: { type: Number, default: 4 },
      // Related intents that should continue the deflection
      relatedIntents: [{ type: String }],
      // Alternative responses for variety
      alternativeResponses: [{ type: String }],
      // Follow-up response templates
      followUpResponses: {
        availability_query: { type: String }, // "when will you come"
        location_query: { type: String }, // "where are you again"
        greeting: { type: String }, // follow-up hello
        default: { type: String }, // generic follow-up
      },
    },
    transferDetails: {
      mode: {
        type: String,
        enum: ["calls", "messages", "both"],
        default: "both",
      },
      priority: {
        type: String,
        enum: ["all", "high-priority"],
        default: "all",
      },
      priorityFilter: {
        type: String,
        default: null,
      },
      contactName: {
        type: String,
        default: null,
      },
      contactPhone: {
        type: String,
        default: null,
      },
      // Auto-reply message for auto-reply rules
      autoReplyMessage: {
        type: String,
        default: null,
      },
    },
    conditions: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    actions: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

const Rule = mongoose.model("Rule", ruleSchema);

export default Rule;
