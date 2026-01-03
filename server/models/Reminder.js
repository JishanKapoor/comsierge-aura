import mongoose from 'mongoose';

const reminderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  twilioAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TwilioAccount'
  },
  type: {
    type: String,
    enum: ['personal', 'call', 'message'],
    default: 'personal'
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  contactId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contact'
  },
  contactPhone: {
    type: String
  },
  contactName: {
    type: String
  },
  scheduledAt: {
    type: Date,
    required: true
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date
  },
  notificationSent: {
    type: Boolean,
    default: false
  },
  recurrence: {
    type: String,
    enum: ['none', 'daily', 'weekly', 'monthly'],
    default: 'none'
  }
}, {
  timestamps: true
});

// Index for efficient queries
reminderSchema.index({ userId: 1, scheduledAt: 1 });
reminderSchema.index({ userId: 1, isCompleted: 1 });
reminderSchema.index({ scheduledAt: 1, notificationSent: 1 });

const Reminder = mongoose.model('Reminder', reminderSchema);
export default Reminder;
