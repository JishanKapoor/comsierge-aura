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
        enum: ["always", "duration", "custom"],
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
