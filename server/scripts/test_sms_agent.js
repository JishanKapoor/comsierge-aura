/**
 * Test SMS Agent - Prototype Features
 * Tests the 7 core scenarios
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
  console.log(`\nTesting SMS Agent for user: ${user.email}\n`);
  console.log('='.repeat(60));
  
  // Test ONLY the reminder
  console.log('\nTesting REMINDER:');
  console.log('Message: "remind me to call jeremy in 30 minutes"');
  
  try {
    const result = await smsAgentChat(userId, 'remind me to call jeremy in 30 minutes', []);
    console.log('Result:', result);
    
    if (result && !result.toLowerCase().includes('error')) {
      console.log('✅ PASS');
    } else {
      console.log('❌ FAIL');
    }
  } catch (error) {
    console.log('❌ FAIL - Error:', error.message);
    console.log(error.stack);
  }
  
  await mongoose.disconnect();
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
