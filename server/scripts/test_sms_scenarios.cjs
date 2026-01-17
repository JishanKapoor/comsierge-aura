/**
 * Test SMS scenarios for Comsierge AI
 * Tests the key user requests:
 * 1. @comsierge call mark
 * 2. @comsierge summarize my convo with mark
 * 3. @comsierge if i receive a message from grandma and she talks about where i am, text her that i am away
 * 4. @comsierge show me my upcoming meetings
 * 5. @comsierge block all spam messages and calls
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function runTests() {
  try {
    // Connect to MongoDB
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.error('MONGODB_URI not found in environment');
      process.exit(1);
    }
    
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');
    
    // Import the AI service (ESM module)
    const { rulesAgentChat } = await import('../services/aiAgentService.js');
    
    // Get a test user
    const User = (await import('../models/User.js')).default;
    const testUser = await User.findOne({});
    
    if (!testUser) {
      console.error('No test user found');
      process.exit(1);
    }
    
    const userId = testUser._id.toString();
    console.log(`\nUsing test user: ${testUser.email || testUser.name || userId}`);
    console.log(`Forwarding number: ${testUser.forwardingNumber || 'NOT SET'}`);
    console.log(`Comsierge number: ${testUser.phoneNumber || 'NOT SET'}`);
    console.log('\n' + '='.repeat(80) + '\n');
    
    const scenarios = [
      {
        name: "1. Call a contact",
        message: "call mark",
        expectation: "Should initiate a call flow (call user's phone, press 1 to connect)"
      },
      {
        name: "2. Summarize conversation",
        message: "summarize my convo with mark",
        expectation: "Should summarize messages with that contact"
      },
      {
        name: "3. Smart rule with condition",
        message: "if i receive a message from grandma and she talks about where i am, text her that i am away",
        expectation: "Should create a smart rule with keyword detection and auto-reply"
      },
      {
        name: "4. Show meetings",
        message: "show me my upcoming meetings",
        expectation: "Should search for meetings/events in messages or calendar"
      },
      {
        name: "5. Block spam (should ask clarification)",
        message: "block all spam messages and calls",
        expectation: "Should ask clarifying questions about calls AND messages preferences"
      },
      {
        name: "6. Call own phone number (should block)",
        message: `call ${testUser.forwardingNumber || '+13828804321'}`,
        expectation: "Should return error: Can't make a phone call to your personal number"
      }
    ];
    
    for (const scenario of scenarios) {
      console.log(`TEST: ${scenario.name}`);
      console.log(`Input: "${scenario.message}"`);
      console.log(`Expected: ${scenario.expectation}`);
      console.log('');
      
      try {
        const result = await rulesAgentChat(userId, scenario.message, [], { viaSms: true });
        console.log(`RESULT:\n${result}`);
      } catch (err) {
        console.log(`ERROR: ${err.message}`);
      }
      
      console.log('\n' + '-'.repeat(80) + '\n');
    }
    
    console.log('Tests completed!');
    
  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runTests();
