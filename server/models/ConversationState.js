import mongoose from "mongoose";

/**
 * ConversationState - Tracks active rule states per conversation thread
 * 
 * This model enables "Finite State Dialogue Management with Scoped Automation"
 * - When a rule activates for a contact, it creates a conversation state
 * - Follow-up messages use this state to provide consistent responses
 * - States auto-expire after TTL (time-to-live)
 */
const conversationStateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // The contact phone this state applies to
    contactPhone: {
      type: String,
      required: true,
      index: true,
    },
    contactName: {
      type: String,
      default: null,
    },
    // The rule that activated this state
    ruleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rule",
      required: true,
    },
    // Current state of the conversation
    state: {
      type: String,
      enum: ["deflecting", "busy", "away", "sleeping", "meeting", "custom"],
      default: "deflecting",
    },
    // The original trigger intent that activated the rule
    triggerIntent: {
      type: String,
      enum: ["location_query", "availability_query", "greeting", "request", "question", "other"],
      default: "other",
    },
    // The original message that triggered the rule
    triggerMessage: {
      type: String,
      default: null,
    },
    // The response template being used
    responseTemplate: {
      type: String,
      required: true,
    },
    // Alternative responses for variety
    alternativeResponses: [{
      type: String,
    }],
    // Track how many times we've responded in this state
    responseCount: {
      type: Number,
      default: 0,
    },
    // Last response sent
    lastResponse: {
      type: String,
      default: null,
    },
    // When this state was activated
    activatedAt: {
      type: Date,
      default: Date.now,
    },
    // When this state expires (TTL)
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    // Related intents that should continue this state
    relatedIntents: [{
      type: String,
    }],
    // Context memory - what we've told them, what they've asked
    contextMemory: {
      // What the user has been told
      statedReasons: [{
        type: String,
      }],
      // Follow-up questions they've asked
      askedQuestions: [{
        intent: String,
        message: String,
        respondedWith: String,
        timestamp: Date,
      }],
    },
    // Is this state still active?
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast lookup
conversationStateSchema.index({ userId: 1, contactPhone: 1, active: 1 });

// Auto-expire documents after expiresAt
conversationStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static method to find active state for a contact
conversationStateSchema.statics.findActiveState = async function(userId, contactPhone) {
  const normalizedPhone = contactPhone.replace(/[^\d+]/g, '');
  return this.findOne({
    userId,
    contactPhone: { $in: [contactPhone, normalizedPhone, `+${normalizedPhone}`, `+1${normalizedPhone.slice(-10)}`] },
    active: true,
    expiresAt: { $gt: new Date() },
  }).populate('ruleId');
};

// Static method to deactivate states for a contact
conversationStateSchema.statics.deactivateForContact = async function(userId, contactPhone) {
  const normalizedPhone = contactPhone.replace(/[^\d+]/g, '');
  return this.updateMany(
    {
      userId,
      contactPhone: { $in: [contactPhone, normalizedPhone, `+${normalizedPhone}`, `+1${normalizedPhone.slice(-10)}`] },
      active: true,
    },
    { active: false }
  );
};

const ConversationState = mongoose.model("ConversationState", conversationStateSchema);

export default ConversationState;
