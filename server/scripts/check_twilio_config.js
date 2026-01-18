import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import User from '../models/User.js';
import TwilioAccount from '../models/TwilioAccount.js';

async function checkTwilioConfig() {
  await mongoose.connect(process.env.MONGODB_URI);
  const userId = '695c7572bbcdab628443e087';

  const user = await User.findById(userId);
  console.log('User:', user.email);
  console.log('Forwarding Number:', user.forwardingNumber);

  const twilioAccounts = await TwilioAccount.find({
    $or: [
      { phoneNumbers: { $exists: true, $ne: [] } },
      { 'phoneAssignments.userId': user._id }
    ]
  });

  console.log('\nTwilio Accounts:', twilioAccounts.length);
  for (const acct of twilioAccounts) {
    console.log('- SID:', acct.accountSid?.slice(0, 10) + '...');
    console.log('  Phone Numbers:', acct.phoneNumbers);
    console.log('  Assignments:', acct.phoneAssignments?.map(a => ({
      phone: a.phoneNumber,
      userId: a.userId?.toString()
    })));
  }

  await mongoose.disconnect();
}

checkTwilioConfig().catch(console.error);
