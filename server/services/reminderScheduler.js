import twilio from 'twilio';
import Reminder from '../models/Reminder.js';
import User from '../models/User.js';
import TwilioAccount from '../models/TwilioAccount.js';

// Process due reminders - called every 30 seconds
export async function processReminders() {
  try {
    const now = new Date();
    
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
