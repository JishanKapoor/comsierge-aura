import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
import Rule from '../models/Rule.js';

async function cleanupRules() {
  await mongoose.connect(process.env.MONGODB_URI);
  const userId = '695c7572bbcdab628443e087';

  // Delete all grandmother rules (contact doesn't exist anyway)
  const deleted = await Rule.deleteMany({ 
    userId, 
    type: 'auto-reply',
    rule: { $regex: /grandmother|grandma/i }
  });
  console.log('Deleted', deleted.deletedCount, 'grandmother auto-reply rules');

  // Delete uncle bob rule (contact doesn't exist)
  const deleted2 = await Rule.deleteMany({
    userId,
    type: 'auto-reply', 
    rule: { $regex: /uncle bob/i }
  });
  console.log('Deleted', deleted2.deletedCount, 'uncle bob auto-reply rules');

  // Show remaining rules
  const remaining = await Rule.find({ userId, active: true }).sort({ createdAt: -1 });
  console.log('\nRemaining active rules:', remaining.length);
  remaining.forEach((r, i) => console.log((i+1) + '. [' + r.type + '] ' + r.rule.substring(0, 60)));

  await mongoose.disconnect();
}

cleanupRules().catch(console.error);
