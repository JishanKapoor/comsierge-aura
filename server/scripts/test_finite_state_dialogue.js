/**
 * Test for Finite State Dialogue Management
 * Simulates the complete flow of conversation-aware auto-replies
 */

const testScenarios = [
  {
    name: "Grandma Night Check Scenario",
    description: "User sets up rule: 'when grandma asks where I am between 10pm-7am, tell her I'm sleeping'",
    rule: {
      type: "auto-reply",
      conditions: {
        sourceContactPhone: "+15551234567",
        sourceContactName: "Grandma",
        triggerIntents: ["location_query", "availability_query", "activity_query"],
      },
      transferDetails: {
        autoReplyMessage: "I'm sleeping right now, I'll text you in the morning! 💤",
      },
      conversationScope: {
        enabled: true,
        ttlHours: 8, // Active through the night
        relatedIntents: ["location_query", "availability_query", "activity_query", "greeting"],
        alternativeResponses: [
          "Still sleeping! 😴",
          "I'll be up in a few hours",
        ],
        followUpResponses: {
          location_query: "Still at home sleeping",
          availability_query: "I'll text when I wake up!",
          greeting: "Hey! Still asleep, talk soon 💤",
          default: "I'm resting, I'll get back to you in the morning",
        },
      },
      schedule: {
        mode: "time-window",
        timeWindow: {
          startHour: 22,
          endHour: 7,
          days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
        },
      },
    },
    conversation: [
      { 
        from: "Grandma", 
        message: "Hey sweetie, where are you?", 
        expectedIntent: "location_query",
        expectedResponse: "I'm sleeping right now, I'll text you in the morning! 💤",
        shouldCreateState: true,
      },
      { 
        from: "Grandma", 
        message: "When will you be up?", 
        expectedIntent: "availability_query",
        expectedResponse: "I'll text when I wake up!",
        shouldCreateState: false, // State already exists
      },
      { 
        from: "Grandma", 
        message: "Ok honey, love you", 
        expectedIntent: "statement",
        expectedResponse: "I'm resting, I'll get back to you in the morning", // default
        shouldCreateState: false,
      },
    ],
  },
  {
    name: "Work Hours Away Message",
    description: "User sets up rule: 'if anyone texts asking what I'm doing during work hours, say I'm in meetings'",
    rule: {
      type: "auto-reply",
      conditions: {
        triggerIntents: ["activity_query", "availability_query"],
      },
      transferDetails: {
        autoReplyMessage: "I'm in meetings right now. I'll get back to you after 5pm.",
      },
      conversationScope: {
        enabled: true,
        ttlHours: 4,
        relatedIntents: ["activity_query", "availability_query", "location_query"],
        followUpResponses: {
          availability_query: "Still in meetings, should be done by 5pm",
          location_query: "At the office in meetings",
          default: "Can't chat right now, in meetings",
        },
      },
      schedule: {
        mode: "time-window",
        timeWindow: {
          startHour: 9,
          endHour: 17,
          days: ["mon", "tue", "wed", "thu", "fri"],
        },
      },
    },
    conversation: [
      {
        from: "Friend",
        message: "wyd?",
        expectedIntent: "activity_query",
        expectedResponse: "I'm in meetings right now. I'll get back to you after 5pm.",
        shouldCreateState: true,
      },
      {
        from: "Friend",
        message: "are you free for lunch?",
        expectedIntent: "availability_query",
        expectedResponse: "Still in meetings, should be done by 5pm",
        shouldCreateState: false,
      },
    ],
  },
];

console.log("=".repeat(70));
console.log("FINITE STATE DIALOGUE MANAGEMENT - Test Scenarios");
console.log("=".repeat(70));
console.log();

for (const scenario of testScenarios) {
  console.log(`📋 ${scenario.name}`);
  console.log(`   ${scenario.description}`);
  console.log();
  
  console.log("   Rule Configuration:");
  console.log(`   - Type: ${scenario.rule.type}`);
  console.log(`   - Initial Response: "${scenario.rule.transferDetails.autoReplyMessage}"`);
  console.log(`   - Conversation Scope: ${scenario.rule.conversationScope.enabled ? "ENABLED" : "DISABLED"}`);
  console.log(`   - TTL: ${scenario.rule.conversationScope.ttlHours} hours`);
  console.log(`   - Trigger Intents: ${scenario.rule.conditions.triggerIntents?.join(", ") || "any"}`);
  console.log();
  
  console.log("   Conversation Flow:");
  let stateCreated = false;
  
  for (let i = 0; i < scenario.conversation.length; i++) {
    const turn = scenario.conversation[i];
    console.log(`   ${i + 1}. [${turn.from}]: "${turn.message}"`);
    console.log(`      Intent: ${turn.expectedIntent}`);
    console.log(`      State: ${turn.shouldCreateState ? "CREATE NEW" : (stateCreated ? "USE EXISTING" : "NONE")}`);
    console.log(`      Response: "${turn.expectedResponse}"`);
    
    if (turn.shouldCreateState) {
      stateCreated = true;
    }
    console.log();
  }
  
  console.log("-".repeat(70));
  console.log();
}

console.log("=".repeat(70));
console.log("KEY FEATURES:");
console.log("=".repeat(70));
console.log(`
1. INTENT DETECTION
   - Automatically detects message intent (location_query, availability_query, etc.)
   - Uses patterns and keywords for high-confidence matching

2. CONVERSATION STATE TRACKING
   - Creates a ConversationState when rule first triggers
   - State tracks: userId, contactPhone, ruleId, triggerIntent, responseCount
   - State persists across multiple messages from same contact

3. CONTEXTUAL FOLLOW-UP RESPONSES
   - First message: Uses main autoReplyMessage
   - Follow-ups: Uses intent-specific followUpResponses
   - Variety: Can cycle through alternativeResponses

4. TIME-TO-LIVE (TTL)
   - Each conversation state has an expiration time
   - MongoDB TTL index auto-removes expired states
   - Prevents stale deflections

5. TIME-WINDOW SCHEDULING
   - Rules can be active only during specific hours
   - Supports overnight windows (e.g., 10pm-7am)
   - Day-of-week filtering

6. CONVERSATION MEMORY
   - contextMemory array stores recent exchanges
   - Useful for AI-enhanced responses in future
`);
