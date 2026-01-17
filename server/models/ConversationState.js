import mongoose from "mongoose";

/**
 * ConversationState Model
 * 
 * Tracks active conversation states for Finite State Dialogue Management.
 * When a rule triggers (e.g., auto-reply), this creates a "conversation state"
 * that persists across multiple messages from the same contact, enabling
 * intelligent follow-up responses and context-aware behavior.
 * 
 * States:
 * - IDLE: No active rule engagement
 * - BOUND/deflecting: Active deflection rule in effect
 * - SCHEDULING_MODE: Multi-turn scheduling negotiation
 * - DND_ACTIVE: Do Not Disturb mode
 * - TEMP_WHITELIST: Temporary bypass after VIP code
 * - SCREENING_MODE: Unknown caller screening
 * - FORWARDING: Message forwarded, awaiting user response
 * - DESTROYED: Emergency override triggered, state terminated
 */

const conversationStateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    contactPhone: {
      type: String,
      required: true,
      index: true,
    },
    contactName: {
      type: String,
      default: null,
    },
    ruleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rule",
      default: null,
    },
    // Current state of the conversation
    state: {
      type: String,
      enum: [
        'IDLE',
        'BOUND',           // Active deflection
        'deflecting',      // Alias for BOUND
        'SCHEDULING_MODE', // Multi-turn scheduling
        'DND_ACTIVE',      // Do Not Disturb
        'TEMP_WHITELIST',  // VIP bypass active
        'SCREENING_MODE',  // Unknown caller screening
        'FORWARDING',      // Forwarded, awaiting response
        'DESTROYED',       // Emergency override terminated
        'busy', 'away', 'sleeping', 'meeting', 'custom', // Legacy states
      ],
      default: 'IDLE',
    },
    // Priority score of the active rule (for override logic)
    rulePriority: {
      type: Number,
      default: 50,
    },
    // The intent that originally triggered this state
    triggerIntent: {
      type: String,
      default: null,
    },
    // The original message that triggered the rule
    triggerMessage: {
      type: String,
      default: null,
    },
    // Template for the initial response
    responseTemplate: {
      type: String,
      default: null,
    },
    // Alternative responses for variety
    alternativeResponses: [{
      type: String,
    }],
    // Related intents that should continue this state
    relatedIntents: [{
      type: String,
    }],
    // Number of responses sent in this conversation state
    responseCount: {
      type: Number,
      default: 0,
    },
    // Last response sent
    lastResponse: {
      type: String,
      default: null,
    },
    // Challenge count (for screening mode)
    challengeCount: {
      type: Number,
      default: 0,
    },
    // When this state was activated
    activatedAt: {
      type: Date,
      default: Date.now,
    },
    // When this state expires (TTL)
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    // Memory of recent exchanges in this conversation
    contextMemory: [{
      timestamp: { type: Date, default: Date.now },
      incomingIntent: String,
      incomingMessage: String,
      responseSent: String,
      action: String,
    }],
    // Scheduling-specific data
    schedulingData: {
      requestedMeeting: { type: Boolean, default: false },
      proposedSlots: [{ type: String }],
      selectedSlot: { type: String, default: null },
      confirmed: { type: Boolean, default: false },
      calendarEventId: { type: String, default: null },
    },
    // Screening-specific data
    screeningData: {
      identifiedName: { type: String, default: null },
      identifiedAs: { type: String, default: null },
      challengesFailed: { type: Number, default: 0 },
      forwardedToUser: { type: Boolean, default: false },
    },
    // VIP/DND bypass data
    bypassData: {
      codeUsed: { type: String, default: null },
      bypassExpiresAt: { type: Date, default: null },
      originalState: { type: String, default: null },
    },
    // Emergency override data
    emergencyData: {
      triggered: { type: Boolean, default: false },
      intent: { type: String, default: null },
      message: { type: String, default: null },
      userNotified: { type: Boolean, default: false },
      timestamp: { type: Date, default: null },
    },
    // Is this state currently active?
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient lookups
conversationStateSchema.index({ userId: 1, contactPhone: 1, active: 1 });

// Auto-expire documents after expiresAt
conversationStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static method to find active state for a contact
conversationStateSchema.statics.findActiveState = async function(userId, contactPhone) {
  // Normalize phone number
  const normalizedPhone = contactPhone.replace(/\D/g, '').slice(-10);
  
  return this.findOne({
    userId,
    $or: [
      { contactPhone: contactPhone },
      { contactPhone: normalizedPhone },
      { contactPhone: `+1${normalizedPhone}` },
      { contactPhone: { $regex: normalizedPhone + '$' } },
    ],
    active: true,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } },
    ],
  }).sort({ createdAt: -1 }).populate('ruleId');
};

// Static method to deactivate all states for a contact
conversationStateSchema.statics.deactivateForContact = async function(userId, contactPhone, newState = 'DESTROYED') {
  const normalizedPhone = contactPhone.replace(/\D/g, '').slice(-10);
  
  return this.updateMany(
    {
      userId,
      $or: [
        { contactPhone: contactPhone },
        { contactPhone: normalizedPhone },
        { contactPhone: `+1${normalizedPhone}` },
        { contactPhone: { $regex: normalizedPhone + '$' } },
      ],
      active: true,
    },
    { $set: { active: false, state: newState } }
  );
};

// Static method to create or update a scheduling state
conversationStateSchema.statics.enterSchedulingMode = async function(userId, contactPhone, proposedSlots, contactName = null) {
  const normalizedPhone = contactPhone.replace(/\D/g, '').slice(-10);
  
  // Deactivate any existing state
  await this.deactivateForContact(userId, contactPhone, 'IDLE');
  
  // Create new scheduling state
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 2); // 2 hour TTL for scheduling
  
  return this.create({
    userId,
    contactPhone: `+1${normalizedPhone}`,
    contactName,
    state: 'SCHEDULING_MODE',
    rulePriority: 50,
    triggerIntent: 'meeting_request',
    schedulingData: {
      requestedMeeting: true,
      proposedSlots: proposedSlots,
      selectedSlot: null,
      confirmed: false,
    },
    expiresAt,
    active: true,
  });
};

// Static method to enter screening mode
conversationStateSchema.statics.enterScreeningMode = async function(userId, contactPhone) {
  const normalizedPhone = contactPhone.replace(/\D/g, '').slice(-10);
  
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 30); // 30 min TTL for screening
  
  return this.create({
    userId,
    contactPhone: `+1${normalizedPhone}`,
    state: 'SCREENING_MODE',
    rulePriority: 40,
    triggerIntent: 'greeting',
    challengeCount: 0,
    screeningData: {
      identifiedName: null,
      challengesFailed: 0,
      forwardedToUser: false,
    },
    expiresAt,
    active: true,
  });
};

// Static method to grant temporary whitelist (VIP bypass)
conversationStateSchema.statics.grantTempWhitelist = async function(userId, contactPhone, durationMinutes = 15) {
  const normalizedPhone = contactPhone.replace(/\D/g, '').slice(-10);
  
  // Find current state to preserve
  const currentState = await this.findActiveState(userId, contactPhone);
  const originalState = currentState?.state || 'DND_ACTIVE';
  
  // Deactivate current state
  await this.deactivateForContact(userId, contactPhone, 'IDLE');
  
  const bypassExpires = new Date();
  bypassExpires.setMinutes(bypassExpires.getMinutes() + durationMinutes);
  
  return this.create({
    userId,
    contactPhone: `+1${normalizedPhone}`,
    state: 'TEMP_WHITELIST',
    rulePriority: 95,
    triggerIntent: 'vip_override_code',
    bypassData: {
      codeUsed: true,
      bypassExpiresAt: bypassExpires,
      originalState: originalState,
    },
    expiresAt: bypassExpires,
    active: true,
  });
};

// Static method to trigger emergency override
conversationStateSchema.statics.triggerEmergencyOverride = async function(userId, contactPhone, intent, message) {
  const normalizedPhone = contactPhone.replace(/\D/g, '').slice(-10);
  
  // Deactivate all states (DESTROY)
  await this.deactivateForContact(userId, contactPhone, 'DESTROYED');
  
  // Create emergency record
  return this.create({
    userId,
    contactPhone: `+1${normalizedPhone}`,
    state: 'DESTROYED',
    rulePriority: 99,
    triggerIntent: intent,
    emergencyData: {
      triggered: true,
      intent: intent,
      message: message?.substring(0, 500),
      userNotified: false,
      timestamp: new Date(),
    },
    active: false, // Emergency states are immediately inactive (state destroyed)
  });
};

// Check if an emergency intent should override current state
conversationStateSchema.statics.shouldOverride = function(currentState, intentPriority) {
  if (!currentState) return false;
  return intentPriority > (currentState.rulePriority || 50);
};

const ConversationState = mongoose.model("ConversationState", conversationStateSchema);

export default ConversationState;
