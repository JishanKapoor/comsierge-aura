import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import Contact from "../models/Contact.js";
import Rule from "../models/Rule.js";
import Reminder from "../models/Reminder.js";
import ScheduledMessage from "../models/ScheduledMessage.js";
import ConversationState from "../models/ConversationState.js";
import CallRecord from "../models/CallRecord.js";
import Media from "../models/Media.js";

/**
 * Deletes all user-specific data when a phone number is unassigned.
 * This ensures that when a new user picks up the same phone number,
 * they start with a clean slate and don't see previous user's data.
 * 
 * @param {string} userId - The MongoDB ObjectId of the user
 * @returns {Object} Summary of deleted records
 */
export async function cleanupUserData(userId) {
  if (!userId) {
    console.warn("cleanupUserData called without userId");
    return { success: false, error: "No userId provided" };
  }

  console.log(`🧹 Cleaning up all data for user ${userId}...`);

  const results = {
    messages: 0,
    conversations: 0,
    contacts: 0,
    rules: 0,
    reminders: 0,
    scheduledMessages: 0,
    conversationStates: 0,
    callRecords: 0,
    media: 0,
  };

  try {
    // Delete all messages
    const messagesResult = await Message.deleteMany({ userId });
    results.messages = messagesResult.deletedCount;

    // Delete all conversations
    const conversationsResult = await Conversation.deleteMany({ userId });
    results.conversations = conversationsResult.deletedCount;

    // Delete all contacts
    const contactsResult = await Contact.deleteMany({ userId });
    results.contacts = contactsResult.deletedCount;

    // Delete all rules
    const rulesResult = await Rule.deleteMany({ userId });
    results.rules = rulesResult.deletedCount;

    // Delete all reminders
    const remindersResult = await Reminder.deleteMany({ userId });
    results.reminders = remindersResult.deletedCount;

    // Delete all scheduled messages
    const scheduledResult = await ScheduledMessage.deleteMany({ userId });
    results.scheduledMessages = scheduledResult.deletedCount;

    // Delete all conversation states
    const statesResult = await ConversationState.deleteMany({ userId });
    results.conversationStates = statesResult.deletedCount;

    // Delete all call records
    const callsResult = await CallRecord.deleteMany({ userId });
    results.callRecords = callsResult.deletedCount;

    // Delete all media files
    const mediaResult = await Media.deleteMany({ userId });
    results.media = mediaResult.deletedCount;

    const totalDeleted = Object.values(results).reduce((a, b) => a + b, 0);
    console.log(`✅ Cleanup complete for user ${userId}. Deleted ${totalDeleted} records:`, results);

    return { success: true, results, totalDeleted };
  } catch (error) {
    console.error(`❌ Error cleaning up user data for ${userId}:`, error);
    return { success: false, error: error.message, results };
  }
}

export default cleanupUserData;
