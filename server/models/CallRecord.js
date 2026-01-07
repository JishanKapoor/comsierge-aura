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
      default: "incoming",
    },
    status: {
      type: String,
      enum: ["initiated", "ringing", "in-progress", "completed", "busy", "failed", "no-answer", "canceled", "missed", "forwarded", "blocked", "transferred"],
      default: "initiated",
    },
    twilioSid: {
      type: String,
      default: null,
    },
    twilioCallSid: {
      type: String,
      default: null,
      index: true,
    },
    fromNumber: {
      type: String,
      default: null,
    },
    toNumber: {
      type: String,
      default: null,
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
    recordingSid: {
      type: String,
      default: null,
    },
    transcription: {
      type: String,
      default: null,
    },
    transcriptionSegments: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    transcriptionLanguage: {
      type: String,
      default: null,
    },
    // Forwarding fields
    forwardedTo: {
      type: String,
      default: null,
    },
    matchedRule: {
      type: String,
      default: null,
    },
    reason: {
      type: String,
      default: null,
    },
    // Voicemail fields
    hasVoicemail: {
      type: Boolean,
      default: false,
    },
    voicemailUrl: {
      type: String,
      default: null,
    },
    voicemailDuration: {
      type: Number,
      default: 0,
    },
    voicemailTranscript: {
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
