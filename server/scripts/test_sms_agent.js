/**
 * Test SMS Agent - Call via SMS
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { smsAgentChat } from '../services/aiAgentService.js';
import User from '../models/User.js';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

async function runTests() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  
  // Find test user
  const user = await User.findOne({ email: 'bossprojectorcanada@gmail.com' });
  if (!user) {
    console.log('❌ Test user not found');
    process.exit(1);
  }
  
  const userId = user._id.toString();
  console.log(`\nTesting SMS Agent for user: ${user.email}`);
  console.log(`User phoneNumber (Comsierge): ${user.phoneNumber}`);
  console.log(`User forwardingNumber (Personal): ${user.forwardingNumber}`);
  console.log('='.repeat(60));
  
  // Test call via SMS
  console.log('\nTesting: "call 4372392448"');
  
  try {
    const result = await smsAgentChat(userId, 'call 4372392448', []);
    console.log('Result:', result);
  } catch (error) {
    console.log('❌ Error:', error.message);
    console.log(error.stack);
  }
  
  await mongoose.disconnect();
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
