import mongoose from "mongoose";

const callRecordSchema = new mongoose.Schema(
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
    type: {
      type: String,
      enum: ["incoming", "outgoing", "missed"],
      required: true,
    },
    status: {
      type: String,
      enum: ["initiated", "ringing", "in-progress", "completed", "busy", "failed", "no-answer", "canceled"],
      default: "initiated",
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
    duration: {
      type: Number, // in seconds
      default: 0,
    },
    startTime: {
      type: Date,
      default: null,
    },
    endTime: {
      type: Date,
      default: null,
    },
    recordingUrl: {
      type: String,
      default: null,
    },
    transcription: {
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

// Index for fetching call history
callRecordSchema.index({ userId: 1, createdAt: -1 });

const CallRecord = mongoose.model("CallRecord", callRecordSchema);

export default CallRecord;
