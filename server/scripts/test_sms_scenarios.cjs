/**
 * Advanced SMS + AI Scenario Test Harness for Comsierge
 *
 * Covers:
 * - NLP ambiguity
 * - Rule conflicts
 * - Multi-step conversations
 * - Context memory
 * - Time-based logic
 * - Entity resolution
 * - Fail-safe behavior
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.error('MONGODB_URI not found in environment');
      process.exit(1);
    }

    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    const { rulesAgentChat } = await import('../services/aiAgentService.js');
    const User = (await import('../models/User.js')).default;

    // Use a user with forwarding number configured
    let testUser = await User.findOne({ forwardingNumber: { $exists: true, $ne: null, $ne: '' } });
    if (!testUser) {
      testUser = await User.findOne({});
    }
    
    if (!testUser) {
      console.error('No test user found');
      process.exit(1);
    }

    const userId = testUser._id.toString();

    console.log(`\nUsing test user: ${testUser.email || testUser.name || userId}`);
    console.log(`Forwarding number: ${testUser.forwardingNumber || 'NOT SET'}`);
    console.log(`Comsierge number: ${testUser.phoneNumber || 'NOT SET'}`);
    console.log('\n' + '='.repeat(100) + '\n');

    // Track conversation history for multi-step tests
    let chatHistory = [];

    const scenarios = [
      // CORE FLOWS
      {
        name: "1. Basic Call Command",
        message: "call mark",
        expectation: "Initiates call flow and confirms contact resolution",
        resetHistory: true
      },
      {
        name: "2. Conversation Summary",
        message: "summarize my convo with mark",
        expectation: "Returns a structured summary with timestamps and key topics",
        resetHistory: true
      },

      // ENTITY RESOLUTION
      {
        name: "3. Ambiguous Contact",
        message: "call alex",
        expectation: "Should ask user to clarify which Alex (Alex M, Alex R, etc.)",
        resetHistory: true
      },

      // RULE ENGINE
      {
        name: "4. Conditional Smart Rule",
        message: "if grandma asks where i am, tell her i am studying",
        expectation: "Creates NLP-based rule with intent + keyword matching",
        resetHistory: true
      },
      {
        name: "5. Conflicting Rule Creation",
        message: "if grandma texts me, ignore her",
        expectation: "Should warn about conflict with existing grandma auto-reply rule",
        resetHistory: false  // Keep context from previous grandma rule
      },

      // TIME-BASED LOGIC
      {
        name: "6. Time Window Rule",
        message: "between 10pm and 7am auto reply to everyone that i am asleep",
        expectation: "Creates scheduled time-based automation rule",
        resetHistory: true
      },

      // CONTEXT MEMORY
      {
        name: "7. Contextual Follow-up",
        message: "do that for my boss too",
        expectation: "Applies last automation logic to 'boss' contact",
        resetHistory: false  // Needs context from previous rule
      },

      // SPAM DEFENSE
      {
        name: "8. Spam Flood Simulation",
        message: "block all numbers that send more than 3 messages in 1 minute",
        expectation: "Creates rate-limit based spam protection rule",
        resetHistory: true
      },

      // SPAM BLOCKING WITH CLARIFICATION
      {
        name: "9. Block Spam (Should Ask Clarification)",
        message: "block all spam messages and calls",
        expectation: "Asks clarifying questions about calls AND messages preferences",
        resetHistory: true
      },

      // MEETING FLOW
      {
        name: "10. Show Meetings",
        message: "show me my upcoming meetings",
        expectation: "Searches for meetings/events",
        resetHistory: true
      },

      // MULTI-STEP FLOW
      {
        name: "11. Meeting Creation",
        message: "schedule a meeting with mark tomorrow at 3pm",
        expectation: "Creates event and confirms with calendar + SMS",
        resetHistory: true
      },
      {
        name: "12. Modify Meeting",
        message: "push that meeting by 1 hour",
        expectation: "Reschedules previous meeting using conversational context",
        resetHistory: false
      },

      // FAIL-SAFE - Call own numbers
      {
        name: "13. Call Own Forwarding Number",
        message: `call ${testUser.forwardingNumber || '+13828804321'}`,
        expectation: "Hard fail: Can't make a phone call to your personal number",
        resetHistory: true
      },
      {
        name: "14. Call Own Comsierge Number",
        message: `call ${testUser.phoneNumber || '+18314806288'}`,
        expectation: "Hard fail: Can't call your own Comsierge number",
        resetHistory: true
      },

      // NLP ROBUSTNESS
      {
        name: "15. Slang / Casual Language",
        message: "yo tell grandma im out rn",
        expectation: "Correctly interprets as auto-reply or immediate send",
        resetHistory: true
      },

      // DATA CONSISTENCY
      {
        name: "16. System Memory Test",
        message: "what rules do i currently have active",
        expectation: "Returns structured list of all active rules",
        resetHistory: true
      },

      // ESCALATION
      {
        name: "17. Human Escalation",
        message: "this isn't working let me talk to support",
        expectation: "Should respond with support guidance or create ticket",
        resetHistory: true
      },

      // OFFLINE MODE SIMULATION
      {
        name: "18. SMS Command Format",
        message: "@comsierge if mark texts me say ill call later",
        expectation: "Creates rule using SMS-only command format",
        resetHistory: true
      },

      // HISTORICAL RECALL
      {
        name: "19. Historical Recall",
        message: "what did grandma usually ask me last week",
        expectation: "Summarizes past message patterns",
        resetHistory: true
      },

      // ROUTING PREFERENCES
      {
        name: "20. Favorites Only Calls",
        message: "only let my favorites call me",
        expectation: "Sets routing preferences for calls to favorites",
        resetHistory: true
      },

      // REMINDER
      {
        name: "21. Set Reminder",
        message: "remind me to call mark in 2 hours",
        expectation: "Creates a reminder",
        resetHistory: true
      },

      // FORWARDING RULES
      {
        name: "22. Forward Messages Rule",
        message: "forward all messages from my accountant to my email",
        expectation: "Creates smart forwarding rule",
        resetHistory: true
      },

      // TRANSLATION
      {
        name: "23. Translation Request",
        message: "translate hello world to spanish",
        expectation: "Translates text",
        resetHistory: true
      },

      // PHONE INFO
      {
        name: "24. Phone Info",
        message: "what is my comsierge number",
        expectation: "Returns user's Comsierge phone number",
        resetHistory: true
      }
    ];

    let passed = 0;
    let failed = 0;

    for (const scenario of scenarios) {
      console.log(`TEST: ${scenario.name}`);
      console.log(`Input: "${scenario.message}"`);
      console.log(`Expected: ${scenario.expectation}`);
      console.log('');

      // Reset history if needed
      if (scenario.resetHistory) {
        chatHistory = [];
      }

      try {
        const result = await rulesAgentChat(
          userId,
          scenario.message,
          chatHistory,
          { viaSms: true }
        );

        console.log(`RESULT:\n${result}`);
        
        // Add to history for context
        chatHistory.push({ role: 'user', text: scenario.message });
        chatHistory.push({ role: 'assistant', text: result });
        
        // Basic pass/fail detection
        const isError = result.toLowerCase().includes('error') && !scenario.expectation.toLowerCase().includes('error');
        if (isError) {
          console.log('STATUS: ⚠️ POTENTIAL ISSUE');
          failed++;
        } else {
          console.log('STATUS: ✓ COMPLETED');
          passed++;
        }
      } catch (err) {
        console.log(`ERROR:\n${err.stack || err.message}`);
        console.log('STATUS: ✗ FAILED');
        failed++;
      }

      console.log('\n' + '-'.repeat(100) + '\n');
      await sleep(500); // simulate real-world SMS delays
    }

    console.log('='.repeat(100));
    console.log(`SUMMARY: ${passed} passed, ${failed} failed out of ${scenarios.length} tests`);
    console.log('Advanced test suite completed.');

  } catch (error) {
    console.error('Test harness error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runTests();
