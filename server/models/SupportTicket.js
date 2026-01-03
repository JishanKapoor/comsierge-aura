import mongoose from "mongoose";

const replySchema = new mongoose.Schema({
  message: {
    type: String,
    required: true,
  },
  isSupport: {
    type: Boolean,
    default: false,
  },
  timestamp: {
    type: String,
    required: true,
  },
  authorName: {
    type: String,
    default: "Unknown",
  },
});

const supportTicketSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userName: {
      type: String,
      required: true,
    },
    userEmail: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["open", "in-progress", "resolved"],
      default: "open",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    replies: [replySchema],
  },
  {
    timestamps: true,
  }
);

const SupportTicket = mongoose.model("SupportTicket", supportTicketSchema);

export default SupportTicket;
