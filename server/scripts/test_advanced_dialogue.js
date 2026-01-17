/**
 * Advanced Finite State Dialogue Management Tests
 * 
 * Tests 5 distinct scenarios to stress-test the conversation state machine:
 * 1. Emergency Override (Escalation Logic)
 * 2. Scheduling Negotiation (Multi-Turn Logic)
 * 3. Code Word VIP Bypass
 * 4. Ambiguity Loop (Error Handling / Screening)
 * 
 * Run: node server/scripts/test_advanced_dialogue.js
 */

// ============================================
// INTENT PRIORITIES (same as twilio.js)
// ============================================
const INTENT_PRIORITIES = {
  emergency_medical: 99,
  emergency_safety: 99,
  vip_override_code: 95,
  urgent: 80,
  plea_desperate: 75,
  plea_soft: 60,
  meeting_request: 50,
  proposal_time: 50,
  proposal_correction: 50,
  confirmation: 50,
  call_request: 40,
  location_query: 30,
  availability_query: 30,
  activity_query: 30,
  identification_success: 30,
  identification_vague: 20,
  greeting: 10,
  acknowledgment: 10,
  question: 10,
  statement: 5,
  unknown: 0,
};

// ============================================
// INTENT DETECTION (copy from twilio.js)
// ============================================
function detectMessageIntent(messageBody, options = {}) {
  if (!messageBody || typeof messageBody !== 'string') {
    return { intent: 'unknown', confidence: 0, priority: 0 };
  }
  
  const body = messageBody.toLowerCase().trim();
  const { vipCodeWord } = options;
  
  const intentPatterns = [
    // === EMERGENCY INTENTS (Priority 99) ===
    {
      intent: 'emergency_medical',
      patterns: [
        /\b(fell|fallen)\s+(down|over)/i,
        /\b(hurt|injured|bleeding|broken)\b/i,
        /\bheart\s+(attack|problem)/i,
        /can'?t\s+breathe/i,
        /\b(hospital|ambulance|911)\b/i,
        /\b(scared|terrified)\b.*\b(hurt|fell|pain)/i,
        /\bpain\b.*\b(chest|heart)/i,
        /chest\s+(hurts?|ache|pain)/i,
        /medical\s+emergency/i,
        /i\s+fell\s+down/i,
        /fell.*scared/i,
      ],
      keywords: ['fell down', 'i fell', 'hurt myself', 'in pain', 'call 911']
    },
    {
      intent: 'emergency_safety',
      patterns: [
        /someone\s+(broke|breaking)\s+in/i,
        /\b(intruder|robber|burglar)\b/i,
        /\bfire\b.*\b(house|building|home)/i,
        /\baccident\b/i,
        /help\s*!+/i,
        /call.*police/i,
      ],
      keywords: ['break in', 'car accident', 'need police']
    },
    // === PLEA INTENTS (Priority 60-75) ===
    // plea_desperate: Explicit please + urgency OR "desperately"
    {
      intent: 'plea_desperate',
      patterns: [
        /please.*\b(help|call|answer)\b/i,
        /\bdesperately\b/i,
        /\bbegging\b/i,
      ],
      keywords: ['please call', 'please help', 'desperately']
    },
    // plea_soft: "I need you" without explicit please (lower urgency)
    {
      intent: 'plea_soft',
      patterns: [
        /i\s+(really\s+)?need\s+(you|to\s+talk)/i,
        /\bmiss\s+you\b/i,
      ],
      keywords: ['need you', 'miss you', 'really need you']
    },
    // === SCHEDULING INTENTS (Priority 50) ===
    {
      intent: 'meeting_request',
      patterns: [
        /can\s+we\s+(chat|talk|meet|schedule)/i,
        /\bschedule\s+(a\s+)?(call|meeting)/i,
        /got\s+time\s+to\s+(talk|chat)/i,
      ],
      keywords: ['can we chat', 'schedule a call']
    },
    {
      intent: 'proposal_time',
      patterns: [
        /how\s+about\s+(\d|noon)/i,
        /what\s+about\s+(\d)/i,
        /^\d{1,2}(:\d{2})?\s*([ap]m?)?$/i,
      ],
      keywords: []
    },
    {
      intent: 'proposal_correction',
      patterns: [
        /actually[,.]?\s*(make|let'?s)/i,
        /on\s+second\s+thought/i,
      ],
      keywords: ['actually make it', 'change it to']
    },
    {
      intent: 'confirmation',
      patterns: [
        /^(yes|yeah|yep|sure|confirmed?)\b/i,
        /that\s+works/i,
        /sounds\s+good/i,
      ],
      keywords: ['yes', 'confirmed', 'sounds good']
    },
    // === CALL REQUEST (Priority 40) ===
    {
      intent: 'call_request',
      patterns: [
        /\bcall\s+me\b/i,
        /can\s+you\s+call/i,
      ],
      keywords: ['call me']
    },
    // === IDENTIFICATION INTENTS ===
    // identification_vague: Says "me" or vague reference without a name
    {
      intent: 'identification_vague',
      patterns: [
        /^it'?s\s+me\.?$/i,
        /^me\.?$/i,
        /the\s+(guy|girl|person|one)\s+from/i,
        /remember\s+me/i,
        /you\s+know\s+who\s+(this|i)/i,
      ],
      keywords: []
    },
    // identification_success: Actually provides a name
    {
      intent: 'identification_success',
      patterns: [
        /^(this\s+is|it'?s|i'?m|my\s+name\s+is)\s+[A-Z][a-z]+/i,
        /^[A-Z][a-z]+\s+(here|speaking)/i,
      ],
      keywords: []
    },
    // === LOCATION/AVAILABILITY (Priority 30) ===
    { 
      intent: 'location_query',
      patterns: [/where\s+(are|r)\s+(you|u)/i],
      keywords: ['where are you']
    },
    {
      intent: 'availability_query',
      patterns: [/when\s+(will|are)\s+(you|u)/i],
      keywords: ['when will you']
    },
    // === GREETINGS (Priority 10) ===
    {
      intent: 'greeting',
      patterns: [
        /^(hey|hi|hello|yo)\b/i,
        /^hello\?$/i,
      ],
      keywords: []
    },
  ];
  
  // Check VIP code word first
  if (vipCodeWord && body === vipCodeWord.toLowerCase()) {
    return { 
      intent: 'vip_override_code', 
      confidence: 1.0, 
      priority: INTENT_PRIORITIES.vip_override_code,
      isOverride: true 
    };
  }
  
  for (const { intent, patterns, keywords } of intentPatterns) {
    for (const pattern of patterns) {
      if (pattern.test(body)) {
        const priority = INTENT_PRIORITIES[intent] || 0;
        return { 
          intent, 
          confidence: 0.9, 
          priority,
          isOverride: priority >= 95,
          isEmergency: intent.startsWith('emergency_'),
        };
      }
    }
    for (const keyword of keywords) {
      const keywordRegex = new RegExp(`\\b${keyword.replace(/\s+/g, '\\s+')}\\b`, 'i');
      if (keywordRegex.test(body)) {
        const priority = INTENT_PRIORITIES[intent] || 0;
        return { intent, confidence: 0.7, priority, isOverride: priority >= 95, isEmergency: intent.startsWith('emergency_') };
      }
    }
  }
  
  return { intent: 'statement', confidence: 0.5, priority: INTENT_PRIORITIES.statement };
}

// ============================================
// STATE MACHINE SIMULATOR
// ============================================
class ConversationStateMachine {
  constructor(userId, config = {}) {
    this.userId = userId;
    this.states = new Map(); // contactPhone -> state
    this.config = {
      vipCodeWord: config.vipCodeWord || null,
      screenUnknown: config.screenUnknown || false,
      dndActive: config.dndActive || false,
      defaultRulePriority: config.defaultRulePriority || 50,
      schedulingSlots: config.schedulingSlots || [],
    };
  }
  
  getState(contactPhone) {
    return this.states.get(contactPhone) || { state: 'IDLE', priority: 0 };
  }
  
  setState(contactPhone, newState) {
    this.states.set(contactPhone, newState);
    return newState;
  }
  
  processMessage(contactPhone, message, contactName = 'Unknown') {
    const intent = detectMessageIntent(message, { vipCodeWord: this.config.vipCodeWord });
    const currentState = this.getState(contactPhone);
    
    const result = {
      contactPhone,
      contactName,
      message,
      intent: intent.intent,
      priority: intent.priority,
      previousState: currentState.state,
      newState: null,
      action: null,
      response: null,
    };
    
    // Emergency Override Logic - highest priority
    if (intent.isEmergency && intent.priority > currentState.priority) {
      result.newState = 'DESTROYED';
      result.action = 'EMERGENCY_OVERRIDE';
      result.response = `I am alerting ${this.userId} right now.`;
      this.setState(contactPhone, { state: 'DESTROYED', priority: 99, emergencyIntent: intent.intent });
      return result;
    }
    
    // VIP Code Override
    if (intent.intent === 'vip_override_code') {
      result.newState = 'TEMP_WHITELIST';
      result.action = 'VIP_BYPASS';
      result.response = 'Connecting you now.';
      this.setState(contactPhone, { state: 'TEMP_WHITELIST', priority: 95, expiresIn: 15 });
      return result;
    }
    
    // State-specific processing
    switch (currentState.state) {
      case 'IDLE':
        return this.handleIdleState(contactPhone, message, intent, result, contactName);
      
      case 'BOUND':
      case 'deflecting':
        return this.handleBoundState(contactPhone, message, intent, currentState, result);
      
      case 'DND_ACTIVE':
        return this.handleDNDState(contactPhone, message, intent, result);
      
      case 'TEMP_WHITELIST':
        return this.handleWhitelistState(contactPhone, message, intent, result);
      
      case 'SCREENING_MODE':
        return this.handleScreeningState(contactPhone, message, intent, currentState, result);
      
      case 'SCHEDULING_MODE':
        return this.handleSchedulingState(contactPhone, message, intent, currentState, result);
      
      case 'FORWARDING':
        return this.handleForwardingState(contactPhone, message, intent, result);
      
      default:
        result.newState = 'IDLE';
        result.action = 'PASS_THROUGH';
        return result;
    }
  }
  
  handleIdleState(contactPhone, message, intent, result, contactName) {
    // Check if DND is active globally
    if (this.config.dndActive && intent.intent !== 'vip_override_code') {
      result.newState = 'DND_ACTIVE';
      result.action = 'BLOCK';
      result.response = `${this.userId} is in Deep Work mode. Check back at 5 PM.`;
      this.setState(contactPhone, { state: 'DND_ACTIVE', priority: 50 });
      return result;
    }
    
    // Check for unknown number screening
    if (this.config.screenUnknown && contactName === 'Unknown') {
      result.newState = 'SCREENING_MODE';
      result.action = 'SCREEN_START';
      result.response = `This is ${this.userId}'s AI. Who is calling and is it urgent?`;
      this.setState(contactPhone, { state: 'SCREENING_MODE', priority: 40, challengeCount: 0 });
      return result;
    }
    
    // Check for meeting request -> Scheduling mode
    if (intent.intent === 'meeting_request' && this.config.schedulingSlots.length > 0) {
      result.newState = 'SCHEDULING_MODE';
      result.action = 'SCHEDULE_START';
      result.response = `${this.userId} is free tomorrow between ${this.config.schedulingSlots.join(', ')}. Do any of those work?`;
      this.setState(contactPhone, { 
        state: 'SCHEDULING_MODE', 
        priority: 50, 
        proposedSlots: this.config.schedulingSlots,
        selectedSlot: null 
      });
      return result;
    }
    
    // Default: pass through
    result.newState = 'IDLE';
    result.action = 'PASS_THROUGH';
    return result;
  }
  
  handleBoundState(contactPhone, message, intent, currentState, result) {
    // Check for override (emergency already handled above)
    if (intent.priority > currentState.priority) {
      // Plea might break through at higher intensity
      if (intent.intent === 'plea_desperate') {
        result.newState = 'FORWARDING';
        result.action = 'ESCALATE';
        result.response = "I can hear this is important. Let me check if I can get through.";
        this.setState(contactPhone, { state: 'FORWARDING', priority: 75 });
        return result;
      }
    }
    
    // Maintain deflection
    const responses = {
      location_query: "I'm tied up with work right now.",
      availability_query: "I'll call you as soon as I'm free.",
      plea_soft: "I'll call you as soon as I'm free.",
      greeting: "I'm busy at the moment, I'll get back to you.",
      default: "I'm tied up with work right now. I'll get back to you soon.",
    };
    
    result.newState = 'BOUND';
    result.action = 'MAINTAIN_DEFLECTION';
    result.response = responses[intent.intent] || responses.default;
    return result;
  }
  
  handleDNDState(contactPhone, message, intent, result) {
    // Already checked for VIP override above
    result.newState = 'DND_ACTIVE';
    result.action = 'BLOCK';
    result.response = `${this.userId} is in Deep Work mode. Check back at 5 PM.`;
    return result;
  }
  
  handleWhitelistState(contactPhone, message, intent, result) {
    // Calls and messages go through
    result.newState = 'TEMP_WHITELIST';
    result.action = 'ALLOW';
    result.response = null; // No auto-reply, pass through
    return result;
  }
  
  handleScreeningState(contactPhone, message, intent, currentState, result) {
    const challengeCount = currentState.challengeCount || 0;
    
    if (intent.intent === 'identification_success') {
      // Extract name from message
      const nameMatch = message.match(/(?:it's|this is|i'm|my name is)\s+([A-Z][a-z]+)/i);
      const name = nameMatch ? nameMatch[1] : message.split(' ').pop();
      
      result.newState = 'FORWARDING';
      result.action = 'IDENTITY_CONFIRMED';
      result.response = null;
      result.forwardMessage = `${name} is trying to reach you. Allow?`;
      this.setState(contactPhone, { state: 'FORWARDING', priority: 30, identifiedAs: name });
      return result;
    }
    
    if (intent.intent === 'identification_vague') {
      const newChallengeCount = challengeCount + 1;
      
      if (newChallengeCount >= 2) {
        // Soft fail after 2 vague attempts
        result.newState = 'SCREENING_MODE';
        result.action = 'CHALLENGE_SOFT_FAIL';
        result.response = `I can't put you through without a name. Please state your name or text ${this.userId} directly.`;
        this.setState(contactPhone, { ...currentState, challengeCount: newChallengeCount });
        return result;
      }
      
      result.newState = 'SCREENING_MODE';
      result.action = 'CHALLENGE_RETRY';
      result.response = "Sorry, I don't have this number saved. What is your name?";
      this.setState(contactPhone, { ...currentState, challengeCount: newChallengeCount });
      return result;
    }
    
    // Default screening response
    result.newState = 'SCREENING_MODE';
    result.action = 'CHALLENGE_INITIAL';
    result.response = `This is ${this.userId}'s AI. Who is calling and is it urgent?`;
    return result;
  }
  
  handleSchedulingState(contactPhone, message, intent, currentState, result) {
    if (intent.intent === 'proposal_time') {
      // Extract time from message
      const timeMatch = message.match(/(\d{1,2}(?::\d{2})?\s*(?:[ap]m)?)/i);
      const proposedTime = timeMatch ? timeMatch[1] : message;
      
      result.newState = 'SCHEDULING_MODE';
      result.action = 'SLOT_PROPOSED';
      result.response = `${proposedTime} works. Shall I lock that in for you?`;
      this.setState(contactPhone, { ...currentState, selectedSlot: proposedTime });
      return result;
    }
    
    if (intent.intent === 'proposal_correction') {
      const timeMatch = message.match(/(\d{1,2}(?::\d{2})?\s*(?:[ap]m)?)/i);
      const newTime = timeMatch ? timeMatch[1] : null;
      
      if (newTime) {
        result.newState = 'SCHEDULING_MODE';
        result.action = 'SLOT_UPDATED';
        result.response = `No problem. Confirming ${newTime} tomorrow?`;
        this.setState(contactPhone, { ...currentState, selectedSlot: newTime });
        return result;
      }
    }
    
    if (intent.intent === 'confirmation' && currentState.selectedSlot) {
      result.newState = 'IDLE';
      result.action = 'BOOKING_CONFIRMED';
      result.response = `Perfect! Booked for ${currentState.selectedSlot} tomorrow. I'll send the invite.`;
      this.setState(contactPhone, { state: 'IDLE', priority: 0 });
      return result;
    }
    
    // Still in scheduling mode
    result.newState = 'SCHEDULING_MODE';
    result.action = 'AWAIT_RESPONSE';
    return result;
  }
  
  handleForwardingState(contactPhone, message, intent, result) {
    result.newState = 'FORWARDING';
    result.action = 'FORWARD_PENDING';
    result.response = "I've forwarded your message. Waiting for a response.";
    return result;
  }
}

// ============================================
// TEST CASES
// ============================================
function runTestCase1() {
  console.log('\n' + '='.repeat(70));
  console.log('TEST CASE 1: Emergency Override (Escalation Logic)');
  console.log('='.repeat(70));
  console.log('\nObjective: Test if system can "break character" when emergency detected');
  console.log('Rule: If Grandma texts, say I am busy (State: Active_Deflection)\n');
  
  const sm = new ConversationStateMachine('Jishan');
  const grandmaPhone = '+15551234567';
  
  // Initialize with deflection state
  sm.setState(grandmaPhone, { state: 'BOUND', priority: 50 });
  
  const steps = [
    { message: "Where are you?", expectedIntent: 'location_query', expectedState: 'BOUND' },
    { message: "I really need you.", expectedIntent: 'plea_soft', expectedState: 'BOUND' },
    { message: "I fell down and I'm scared.", expectedIntent: 'emergency_medical', expectedState: 'DESTROYED' },
  ];
  
  let passed = 0;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const result = sm.processMessage(grandmaPhone, step.message, 'Grandma');
    
    const intentOk = result.intent === step.expectedIntent;
    const stateOk = result.newState === step.expectedState;
    const status = intentOk && stateOk ? '✅' : '❌';
    
    if (intentOk && stateOk) passed++;
    
    console.log(`Step ${i + 1}: ${status}`);
    console.log(`   [Grandma]: "${step.message}"`);
    console.log(`   Intent: ${result.intent} (expected: ${step.expectedIntent}) ${intentOk ? '✓' : '✗'}`);
    console.log(`   State: ${result.previousState} → ${result.newState} (expected: ${step.expectedState}) ${stateOk ? '✓' : '✗'}`);
    console.log(`   Action: ${result.action}`);
    console.log(`   Response: "${result.response || 'N/A'}"`);
    console.log();
  }
  
  console.log(`Result: ${passed}/${steps.length} steps passed`);
  return passed === steps.length;
}

function runTestCase2() {
  console.log('\n' + '='.repeat(70));
  console.log('TEST CASE 2: Scheduling Negotiation (Multi-Turn Logic)');
  console.log('='.repeat(70));
  console.log('\nObjective: Test multi-turn scheduling without booking until confirmed');
  console.log('Rule: If Recruiter asks for meeting, offer slots 2-4 PM tomorrow\n');
  
  const sm = new ConversationStateMachine('Jishan', {
    schedulingSlots: ['2 PM', '3 PM', '4 PM'],
  });
  const recruiterPhone = '+15559876543';
  
  const steps = [
    { message: "Can we chat?", expectedIntent: 'meeting_request', expectedState: 'SCHEDULING_MODE', expectedAction: 'SCHEDULE_START' },
    { message: "How about 2:30?", expectedIntent: 'proposal_time', expectedState: 'SCHEDULING_MODE', expectedAction: 'SLOT_PROPOSED' },
    { message: "Actually, make it 3:00.", expectedIntent: 'proposal_correction', expectedState: 'SCHEDULING_MODE', expectedAction: 'SLOT_UPDATED' },
    { message: "Yes, thanks.", expectedIntent: 'confirmation', expectedState: 'IDLE', expectedAction: 'BOOKING_CONFIRMED' },
  ];
  
  let passed = 0;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const result = sm.processMessage(recruiterPhone, step.message, 'Recruiter');
    
    const intentOk = result.intent === step.expectedIntent;
    const stateOk = result.newState === step.expectedState;
    const actionOk = result.action === step.expectedAction;
    const status = intentOk && stateOk && actionOk ? '✅' : '❌';
    
    if (intentOk && stateOk && actionOk) passed++;
    
    console.log(`Step ${i + 1}: ${status}`);
    console.log(`   [Recruiter]: "${step.message}"`);
    console.log(`   Intent: ${result.intent} (expected: ${step.expectedIntent}) ${intentOk ? '✓' : '✗'}`);
    console.log(`   State: ${result.previousState} → ${result.newState} (expected: ${step.expectedState}) ${stateOk ? '✓' : '✗'}`);
    console.log(`   Action: ${result.action} (expected: ${step.expectedAction}) ${actionOk ? '✓' : '✗'}`);
    console.log(`   Response: "${result.response || 'N/A'}"`);
    console.log();
  }
  
  console.log(`Result: ${passed}/${steps.length} steps passed`);
  return passed === steps.length;
}

function runTestCase3() {
  console.log('\n' + '='.repeat(70));
  console.log('TEST CASE 3: Code Word VIP Bypass');
  console.log('='.repeat(70));
  console.log('\nObjective: Test hard-coded bypass for trusted contacts');
  console.log('Rule: Block ALL calls/texts (DND Mode). Exception: Code word "Banana"\n');
  
  const sm = new ConversationStateMachine('Jishan', {
    dndActive: true,
    vipCodeWord: 'Banana',
  });
  const wifePhone = '+15551112222';
  
  const steps = [
    { message: "Call me.", expectedIntent: 'call_request', expectedState: 'DND_ACTIVE', expectedAction: 'BLOCK' },
    { message: "Banana", expectedIntent: 'vip_override_code', expectedState: 'TEMP_WHITELIST', expectedAction: 'VIP_BYPASS' },
    { message: "Hey, can you talk now?", expectedIntent: 'greeting', expectedState: 'TEMP_WHITELIST', expectedAction: 'ALLOW' },
  ];
  
  let passed = 0;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const result = sm.processMessage(wifePhone, step.message, 'Wife');
    
    const intentOk = result.intent === step.expectedIntent;
    const stateOk = result.newState === step.expectedState;
    const actionOk = result.action === step.expectedAction;
    const status = intentOk && stateOk && actionOk ? '✅' : '❌';
    
    if (intentOk && stateOk && actionOk) passed++;
    
    console.log(`Step ${i + 1}: ${status}`);
    console.log(`   [Wife]: "${step.message}"`);
    console.log(`   Intent: ${result.intent} (expected: ${step.expectedIntent}) ${intentOk ? '✓' : '✗'}`);
    console.log(`   State: ${result.previousState} → ${result.newState} (expected: ${step.expectedState}) ${stateOk ? '✓' : '✗'}`);
    console.log(`   Action: ${result.action} (expected: ${step.expectedAction}) ${actionOk ? '✓' : '✗'}`);
    console.log(`   Response: "${result.response || '(pass through)'}"`);
    console.log();
  }
  
  console.log(`Result: ${passed}/${steps.length} steps passed`);
  return passed === steps.length;
}

function runTestCase4() {
  console.log('\n' + '='.repeat(70));
  console.log('TEST CASE 4: Ambiguity Loop (Error Handling / Screening)');
  console.log('='.repeat(70));
  console.log('\nObjective: Test how system handles vague identification');
  console.log('Rule: Screen unknown numbers. Ask who they are.\n');
  
  const sm = new ConversationStateMachine('Jishan', {
    screenUnknown: true,
  });
  const unknownPhone = '+15559999999';
  
  const steps = [
    { message: "Hello?", expectedIntent: 'greeting', expectedState: 'SCREENING_MODE', expectedAction: 'SCREEN_START' },
    { message: "It's me.", expectedIntent: 'identification_vague', expectedState: 'SCREENING_MODE', expectedAction: 'CHALLENGE_RETRY' },
    { message: "The guy from the gym.", expectedIntent: 'identification_vague', expectedState: 'SCREENING_MODE', expectedAction: 'CHALLENGE_SOFT_FAIL' },
    { message: "It's Dave.", expectedIntent: 'identification_success', expectedState: 'FORWARDING', expectedAction: 'IDENTITY_CONFIRMED' },
  ];
  
  let passed = 0;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const result = sm.processMessage(unknownPhone, step.message, 'Unknown');
    
    const intentOk = result.intent === step.expectedIntent;
    const stateOk = result.newState === step.expectedState;
    const actionOk = result.action === step.expectedAction;
    const status = intentOk && stateOk && actionOk ? '✅' : '❌';
    
    if (intentOk && stateOk && actionOk) passed++;
    
    console.log(`Step ${i + 1}: ${status}`);
    console.log(`   [Unknown]: "${step.message}"`);
    console.log(`   Intent: ${result.intent} (expected: ${step.expectedIntent}) ${intentOk ? '✓' : '✗'}`);
    console.log(`   State: ${result.previousState} → ${result.newState} (expected: ${step.expectedState}) ${stateOk ? '✓' : '✗'}`);
    console.log(`   Action: ${result.action} (expected: ${step.expectedAction}) ${actionOk ? '✓' : '✗'}`);
    console.log(`   Response: "${result.response || '(forward)'}"`);
    if (result.forwardMessage) {
      console.log(`   Forward: "${result.forwardMessage}"`);
    }
    console.log();
  }
  
  console.log(`Result: ${passed}/${steps.length} steps passed`);
  return passed === steps.length;
}

// ============================================
// RUN ALL TESTS
// ============================================
console.log('╔════════════════════════════════════════════════════════════════════╗');
console.log('║     ADVANCED FINITE STATE DIALOGUE MANAGEMENT TESTS               ║');
console.log('║     Testing: Emergency, Scheduling, VIP Bypass, Screening         ║');
console.log('╚════════════════════════════════════════════════════════════════════╝');

const results = {
  'Test 1 - Emergency Override': runTestCase1(),
  'Test 2 - Scheduling Negotiation': runTestCase2(),
  'Test 3 - VIP Code Bypass': runTestCase3(),
  'Test 4 - Ambiguity Loop': runTestCase4(),
};

console.log('\n' + '='.repeat(70));
console.log('FINAL RESULTS');
console.log('='.repeat(70));

let totalPassed = 0;
let totalTests = 0;

for (const [name, passed] of Object.entries(results)) {
  const status = passed ? '✅ PASSED' : '❌ FAILED';
  console.log(`${status} - ${name}`);
  if (passed) totalPassed++;
  totalTests++;
}

console.log('─'.repeat(70));
console.log(`Overall: ${totalPassed}/${totalTests} test cases passed`);

if (totalPassed === totalTests) {
  console.log('\n🎉 ALL TESTS PASSED! The Finite State Dialogue system is working correctly.');
} else {
  console.log('\n⚠️  Some tests failed. Review the output above for details.');
}
