import mongoose from 'mongoose';

const aiCallSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Call target
  contactPhone: {
    type: String,
    required: true
  },
  contactName: {
    type: String,
    default: 'Unknown'
  },
  // The AI's mission/script for this call
  objective: {
    type: String,
    required: true
  },
  // Detailed script points (optional)
  scriptPoints: [{
    type: String
  }],
  // Voice settings
  voiceName: {
    type: String,
    default: 'Polly.Joanna' // AWS Polly voice
  },
  voiceStyle: {
    type: String,
    enum: ['friendly', 'professional', 'casual'],
    default: 'friendly'
  },
  // Scheduling
  scheduledAt: {
    type: Date,
    default: null // null = immediate
  },
  // Call status
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'failed', 'cancelled', 'no-answer'],
    default: 'pending'
  },
  // Call execution details
  twilioCallSid: {
    type: String,
    default: null
  },
  startedAt: {
    type: Date,
    default: null
  },
  endedAt: {
    type: Date,
    default: null
  },
  durationSeconds: {
    type: Number,
    default: 0
  },
  // Conversation tracking
  conversationState: {
    currentStep: { type: Number, default: 0 },
    completedPoints: [{ type: String }],
    context: { type: String, default: '' }
  },
  // Full transcript
  transcript: [{
    speaker: { type: String, enum: ['ai', 'human'] },
    text: { type: String },
    timestamp: { type: Date }
  }],
  // AI-generated summary after call
  summary: {
    type: String,
    default: null
  },
  // Key points extracted from call
  keyPoints: [{
    type: String
  }],
  // Action items from the call
  actionItems: [{
    type: String
  }],
  // User notified about call result
  userNotified: {
    type: Boolean,
    default: false
  },
  // Error tracking
  errorMessage: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
aiCallSchema.index({ status: 1, scheduledAt: 1 });
aiCallSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('AICall', aiCallSchema);
