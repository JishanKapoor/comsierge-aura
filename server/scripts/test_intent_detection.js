/**
 * Test script for intent detection
 * Tests the detectMessageIntent function logic
 */

// Copy of the intent detection function for testing
function detectMessageIntent(messageBody) {
  if (!messageBody || typeof messageBody !== 'string') {
    return { intent: 'unknown', confidence: 0 };
  }
  
  const body = messageBody.toLowerCase().trim();
  
  // Intent patterns - order matters (more specific first)
  const intentPatterns = [
    // Urgency/emergency - check FIRST before greetings
    {
      intent: 'urgent',
      patterns: [
        /\burgent\b/i,
        /\bemergency\b/i,
        /\basap\b/i,
        /need.*now/i,
        /help\s*!/i,
        /\bimportant\b/i,
      ],
      keywords: []
    },
    // Location queries
    { 
      intent: 'location_query',
      patterns: [
        /where\s+(are|r)\s+(you|u)/i,
        /where\s+u\s+at/i,
        /what.*location/i,
        /where.*now/i,
        /what\s+place/i,
        /which\s+city/i,
        /are\s+(you|u)\s+(still\s+)?(at|in)/i,
      ],
      keywords: ['where are you', 'where r u', 'where u at', 'location']
    },
    // Availability/timing queries
    {
      intent: 'availability_query',
      patterns: [
        /when\s+(will|are|r)\s+(you|u)/i,
        /what\s+time/i,
        /how\s+long/i,
        /when.*coming/i,
        /when.*here/i,
        /when.*back/i,
        /are\s+(you|u)\s+(free|available|busy)/i,
        /what.*eta/i,
      ],
      keywords: ['when will you', 'what time', 'how long', 'when coming', 'are you free', 'eta']
    },
    // Activity queries
    {
      intent: 'activity_query',
      patterns: [
        /what\s+(are|r)\s+(you|u)\s+doing/i,
        /what.*up\s+to/i,
        /\bwyd\b/i,
        /whatcha\s+doing/i,
        /you\s+busy/i,
        /still\s+(at\s+)?work/i,
      ],
      keywords: ['what are you doing', 'whatcha doing', 'what up', 'you busy']
    },
    // Greetings - use word boundaries to avoid false matches
    {
      intent: 'greeting',
      patterns: [
        /^(hey|hi|hello|yo|sup|what'?s?\s*up|hola)\b/i,
        /good\s+(morning|afternoon|evening)/i,
        /how\s+(are|r)\s+(you|u)\b/i,
        /how's\s+it\s+going/i,
      ],
      keywords: []  // Removed keywords to avoid false matches like "This" -> "hi"
    },
    // Confirmation/acknowledgment
    {
      intent: 'acknowledgment',
      patterns: [
        /^(ok|okay|k|kk|sure|alright|got\s*it|thanks|thx|ty)\b/i,
        /^(cool|sounds\s+good|perfect|great)\b/i,
      ],
      keywords: []
    },
    // Questions (generic) - more specific patterns
    {
      intent: 'question',
      patterns: [
        /\?$/,
        /^(can|could|would|will|do|does|have|has)\s+(you|i|we|they)/i,
      ],
      keywords: []
    },
  ];
  
  // Check each intent pattern
  for (const { intent, patterns, keywords } of intentPatterns) {
    // Check regex patterns
    for (const pattern of patterns) {
      if (pattern.test(body)) {
        return { intent, confidence: 0.9 };
      }
    }
    
    // Check keywords (whole word match using regex)
    for (const keyword of keywords) {
      const keywordRegex = new RegExp(`\\b${keyword.replace(/\s+/g, '\\s+')}\\b`, 'i');
      if (keywordRegex.test(body)) {
        return { intent, confidence: 0.7 };
      }
    }
  }
  
  // Default to statement
  return { intent: 'statement', confidence: 0.5 };
}

// Test cases
const testMessages = [
  // Location queries
  { msg: "Where are you?", expected: "location_query" },
  { msg: "where r u", expected: "location_query" },
  { msg: "where u at", expected: "location_query" },
  { msg: "what's your location", expected: "location_query" },
  
  // Availability queries
  { msg: "When will you be here?", expected: "availability_query" },
  { msg: "What time are you coming?", expected: "availability_query" },
  { msg: "How long will you be?", expected: "availability_query" },
  { msg: "when are you coming back", expected: "availability_query" },
  { msg: "are you free?", expected: "availability_query" },
  
  // Activity queries
  { msg: "What are you doing?", expected: "activity_query" },
  { msg: "wyd", expected: "activity_query" },
  { msg: "whatcha doing", expected: "activity_query" },
  { msg: "you busy?", expected: "activity_query" },
  
  // Greetings
  { msg: "Hey", expected: "greeting" },
  { msg: "Hi there!", expected: "greeting" },
  { msg: "Hello", expected: "greeting" },
  { msg: "Good morning", expected: "greeting" },
  { msg: "How are you?", expected: "greeting" },
  
  // Urgent
  { msg: "URGENT - call me back!", expected: "urgent" },
  { msg: "This is an emergency", expected: "urgent" },
  { msg: "Need this ASAP", expected: "urgent" },
  
  // Acknowledgment
  { msg: "Ok", expected: "acknowledgment" },
  { msg: "Sure", expected: "acknowledgment" },
  { msg: "Thanks", expected: "acknowledgment" },
  { msg: "Got it", expected: "acknowledgment" },
  
  // Questions
  { msg: "Can you help me?", expected: "question" },
  { msg: "Will you be there?", expected: "question" },
  
  // Statements
  { msg: "I went to the store today", expected: "statement" },
  { msg: "The weather is nice", expected: "statement" },
];

console.log("Testing Intent Detection\n");
console.log("=".repeat(60));

let passed = 0;
let failed = 0;

for (const { msg, expected } of testMessages) {
  const result = detectMessageIntent(msg);
  const status = result.intent === expected ? "✅" : "❌";
  
  if (result.intent === expected) {
    passed++;
  } else {
    failed++;
  }
  
  console.log(`${status} "${msg}"`);
  console.log(`   Expected: ${expected}, Got: ${result.intent} (confidence: ${result.confidence})`);
}

console.log("\n" + "=".repeat(60));
console.log(`Results: ${passed} passed, ${failed} failed out of ${testMessages.length} tests`);

// Conversation flow simulation
console.log("\n\n=== Conversation Flow Simulation ===\n");

const grandmaConversation = [
  "Hey sweetie, where are you?",
  "When will you be home?",
  "Are you still at work?",
  "Ok, let me know when you're back"
];

console.log("Simulating a conversation with Grandma:");
for (const msg of grandmaConversation) {
  const result = detectMessageIntent(msg);
  console.log(`  Grandma: "${msg}"`);
  console.log(`    -> Intent: ${result.intent} (confidence: ${result.confidence})`);
  console.log();
}
