import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import Reminder from '../models/Reminder.js';

async function checkReminders() {
  await mongoose.connect(process.env.MONGODB_URI);
  const userId = '695c7572bbcdab628443e087';

  const reminders = await Reminder.find({ 
    userId, 
    title: { $regex: /Test/i }
  }).sort({ scheduledAt: -1 });

  console.log('Test Reminders:');
  for (const r of reminders) {
    console.log('- ' + r.title + ' [' + r.type + ']');
    console.log('  Scheduled:', r.scheduledAt);
    console.log('  NotificationSent:', r.notificationSent);
    console.log('  Completed:', r.isCompleted);
    console.log('');
  }

  await mongoose.disconnect();
}

checkReminders().catch(console.error);
