import twilio from 'twilio';
import Reminder from '../models/Reminder.js';
import ScheduledMessage from '../models/ScheduledMessage.js';
import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import User from '../models/User.js';
import TwilioAccount from '../models/TwilioAccount.js';

// Process due reminders and scheduled messages - called every 30 seconds
export async function processReminders() {
  try {
    const now = new Date();
    
    // Process scheduled messages first
    await processScheduledMessages(now);
    
    // Find reminders that are due and haven't been notified
    const dueReminders = await Reminder.find({
      isCompleted: false,
      notificationSent: false,
      scheduledAt: { $lte: now }
    }).populate('userId');

    if (dueReminders.length === 0) return;

    console.log(`🔔 Processing ${dueReminders.length} due reminder(s)...`);

    for (const reminder of dueReminders) {
      try {
        await executeReminder(reminder);
        
        // Mark as notified
        await Reminder.findByIdAndUpdate(reminder._id, { 
          notificationSent: true,
          isCompleted: reminder.type === 'personal' // Auto-complete personal reminders after notification
        });
        
        console.log(`✅ Processed reminder: ${reminder.title}`);
      } catch (error) {
        console.error(`❌ Failed to process reminder ${reminder._id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in processReminders:', error);
  }
}

async function executeReminder(reminder) {
  const user = reminder.userId;
  if (!user) {
    console.log('No user found for reminder');
    return;
  }

  // Get user's Twilio account
  const twilioAccount = await TwilioAccount.findOne({
    $or: [
      { phoneNumbers: { $exists: true, $ne: [] } },
      { 'phoneAssignments.userId': user._id }
    ]
  });

  if (!twilioAccount) {
    console.log('No Twilio account found for user');
    return;
  }

  // Get the user's assigned phone number
  let fromNumber = null;
  if (twilioAccount.phoneAssignments?.length > 0) {
    const assignment = twilioAccount.phoneAssignments.find(
      a => a.userId?.toString() === user._id.toString()
    );
    if (assignment) {
      fromNumber = assignment.phoneNumber;
    }
  }
  if (!fromNumber && twilioAccount.phoneNumbers?.length > 0) {
    fromNumber = twilioAccount.phoneNumbers[0];
  }

  if (!fromNumber) {
    console.log('No phone number available for sending');
    return;
  }

  // Get user's forwarding number (their personal phone)
  const toNumber = user.forwardingNumber;
  if (!toNumber) {
    console.log('User has no forwarding number set');
    return;
  }

  // Initialize Twilio client
  const client = twilio(twilioAccount.accountSid, twilioAccount.authToken);

  if (reminder.type === 'call') {
    // Make a call
    console.log(`📞 Calling ${toNumber} for reminder: ${reminder.title}`);
    
    const twiml = `
      <Response>
        <Say voice="Polly.Joanna">
          Hello! This is your Comsierge reminder. 
          ${reminder.title}. 
          ${reminder.description ? reminder.description : ''}
          ${reminder.contactName ? `This is regarding ${reminder.contactName}.` : ''}
          Press any key to dismiss this reminder.
        </Say>
        <Pause length="2"/>
        <Say voice="Polly.Joanna">
          Goodbye!
        </Say>
      </Response>
    `;
    
    await client.calls.create({
      to: toNumber,
      from: fromNumber,
      twiml: twiml,
    });
    
  } else {
    // Send SMS (for 'message' or 'personal' type)
    console.log(`📱 Texting ${toNumber} for reminder: ${reminder.title}`);
    
    let message = `🔔 Reminder: ${reminder.title}`;
    if (reminder.description) {
      message += `\n${reminder.description}`;
    }
    if (reminder.contactName) {
      message += `\n(Re: ${reminder.contactName})`;
    }
    
    await client.messages.create({
      to: toNumber,
      from: fromNumber,
      body: message,
    });
  }
}

// Process scheduled messages (messages to contacts that were scheduled for later)
async function processScheduledMessages(now) {
  try {
    const dueMessages = await ScheduledMessage.find({
      status: 'pending',
      scheduledAt: { $lte: now }
    }).populate('userId');

    if (dueMessages.length === 0) return;

    console.log(`📬 Processing ${dueMessages.length} scheduled message(s)...`);

    for (const scheduledMsg of dueMessages) {
      try {
        await sendScheduledMessage(scheduledMsg);
        
        // Mark as sent
        await ScheduledMessage.findByIdAndUpdate(scheduledMsg._id, {
          status: 'sent',
          sentAt: new Date()
        });
        
        console.log(`✅ Sent scheduled message to ${scheduledMsg.contactName || scheduledMsg.contactPhone}`);
      } catch (error) {
        console.error(`❌ Failed to send scheduled message ${scheduledMsg._id}:`, error);
        await ScheduledMessage.findByIdAndUpdate(scheduledMsg._id, {
          status: 'failed',
          errorMessage: error.message
        });
      }
    }
  } catch (error) {
    console.error('Error in processScheduledMessages:', error);
  }
}

async function sendScheduledMessage(scheduledMsg) {
  const user = scheduledMsg.userId;
  if (!user) throw new Error('No user found for scheduled message');

  // Get Twilio account
  const twilioAccount = await TwilioAccount.findOne({
    $or: [
      { phoneNumbers: { $exists: true, $ne: [] } },
      { 'phoneAssignments.userId': user._id }
    ]
  });

  if (!twilioAccount) throw new Error('No Twilio account found');

  // Get user's assigned phone number (from number)
  let fromNumber = null;
  if (twilioAccount.phoneAssignments?.length > 0) {
    const assignment = twilioAccount.phoneAssignments.find(
      a => a.userId?.toString() === user._id.toString()
    );
    if (assignment) fromNumber = assignment.phoneNumber;
  }
  if (!fromNumber && twilioAccount.phoneNumbers?.length > 0) {
    fromNumber = twilioAccount.phoneNumbers[0];
  }

  if (!fromNumber) throw new Error('No phone number available for sending');

  // Initialize Twilio client and send
  const client = twilio(twilioAccount.accountSid, twilioAccount.authToken);
  
  console.log(`📱 Sending scheduled message to ${scheduledMsg.contactPhone}: "${scheduledMsg.messageBody}"`);
  
  const twilioMessage = await client.messages.create({
    to: scheduledMsg.contactPhone,
    from: fromNumber,
    body: scheduledMsg.messageBody,
  });

  // Update the scheduled message with Twilio SID
  scheduledMsg.twilioSid = twilioMessage.sid;

  // Save to Message history
  const savedMessage = new Message({
    userId: user._id,
    contactPhone: scheduledMsg.contactPhone,
    contactName: scheduledMsg.contactName || scheduledMsg.contactPhone,
    direction: 'outgoing',
    body: scheduledMsg.messageBody,
    status: 'sent',
    twilioSid: twilioMessage.sid,
    fromNumber,
    toNumber: scheduledMsg.contactPhone,
    isRead: true,
  });
  await savedMessage.save();

  // Update conversation
  const phoneDigits = scheduledMsg.contactPhone.replace(/\D/g, '').slice(-10);
  const allConvos = await Conversation.find({ userId: user._id });
  const matchingConvo = allConvos.find(c => {
    const convoDigits = (c.contactPhone || '').replace(/\D/g, '').slice(-10);
    return convoDigits === phoneDigits;
  });
  if (matchingConvo) {
    matchingConvo.lastMessage = scheduledMsg.messageBody;
    matchingConvo.lastMessageAt = new Date();
    matchingConvo.messageCount = (matchingConvo.messageCount || 0) + 1;
    await matchingConvo.save();
  }
}

// Start the scheduler
let schedulerInterval = null;

export function startReminderScheduler() {
  if (schedulerInterval) {
    console.log('Reminder scheduler already running');
    return;
  }
  
  console.log('🕐 Starting reminder scheduler (checking every 30s)...');
  
  // Check immediately, then every 30 seconds
  processReminders();
  schedulerInterval = setInterval(processReminders, 30 * 1000);
}

export function stopReminderScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('Reminder scheduler stopped');
  }
}
