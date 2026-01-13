import mongoose from 'mongoose';

const scheduledMessageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  twilioAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TwilioAccount'
  },
  contactId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contact'
  },
  contactPhone: {
    type: String,
    required: true
  },
  contactName: {
    type: String,
    default: 'Unknown'
  },
  messageBody: {
    type: String,
    required: true
  },
  scheduledAt: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed', 'cancelled'],
    default: 'pending'
  },
  sentAt: {
    type: Date
  },
  twilioSid: {
    type: String
  },
  errorMessage: {
    type: String
  }
}, {
  timestamps: true
});

// Index for efficient queries - find pending messages that are due
scheduledMessageSchema.index({ status: 1, scheduledAt: 1 });
scheduledMessageSchema.index({ userId: 1, scheduledAt: 1 });

export default mongoose.model('ScheduledMessage', scheduledMessageSchema);
