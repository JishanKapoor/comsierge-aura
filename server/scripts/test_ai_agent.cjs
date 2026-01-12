/**
 * Comprehensive AI Agent Test Suite
 * Tests all rule creation scenarios from basic to extreme
 */

const testCases = {
  // BASIC / CLEAR INTENT
  basic: [
    { input: "Forward all bank messages to my accountant.", expected: { action: "forward", keywords: ["bank"], requiresContact: true } },
    { input: "Send urgent messages to John.", expected: { action: "forward", priority: "high", contact: "John" } },
    { input: "Mute spam messages.", expected: { action: "mute", keywords: ["spam"] } },
    { input: "Block unknown numbers.", expected: { action: "block", condition: "unknown" } },
    { input: "Always prioritize messages from my boss.", expected: { action: "prioritize", contact: "boss" } },
    { input: "Forward messages from Mom to my personal number.", expected: { action: "forward", fromContact: "Mom", requiresNumber: true } },
    { input: "Hold promotional texts.", expected: { action: "hold", keywords: ["promotional", "promo"] } },
    { input: "Auto-reply after hours.", expected: { action: "auto_reply", timeCondition: "after_hours" } },
    { input: "Never forward messages from family.", expected: { action: "exclude", group: "family" } },
    { input: "Forward client messages to my email.", expected: { action: "forward", keywords: ["client"], toEmail: true } },
  ],
  
  // CONDITIONAL / TIME-BASED
  conditional: [
    { input: "If I don't reply in 10 minutes, forward urgent messages to Sarah.", expected: { action: "forward", delay: 10, priority: "high", contact: "Sarah" } },
    { input: "Forward messages to Alex only during work hours.", expected: { action: "forward", contact: "Alex", timeCondition: "work_hours" } },
    { input: "Mute unknown numbers after 9 PM.", expected: { action: "mute", condition: "unknown", timeCondition: "after_9pm" } },
    { input: "Forward messages to my assistant while I'm offline.", expected: { action: "forward", contact: "assistant", condition: "offline" } },
    { input: "Only forward messages if I haven't opened them.", expected: { action: "forward", condition: "unread" } },
    { input: "Forward messages for the next 2 hours.", expected: { action: "forward", duration: "2h" } },
    { input: "Stop forwarding messages tomorrow morning.", expected: { action: "stop_forward", scheduledTime: "tomorrow_morning" } },
    { input: "Forward messages when I'm traveling.", expected: { action: "forward", condition: "traveling" } },
    { input: "Forward urgent messages only on weekdays.", expected: { action: "forward", priority: "high", timeCondition: "weekdays" } },
    { input: "Pause all forwarding this weekend.", expected: { action: "pause", duration: "weekend" } },
  ],
  
  // MULTI-CONDITION / STACKED
  multiCondition: [
    { input: "Forward bank messages to my accountant, but not if they're from my family.", expected: { action: "forward", keywords: ["bank"], exclude: ["family"] } },
    { input: "Only forward urgent client messages if they mention payments.", expected: { action: "forward", priority: "high", keywords: ["client", "payment"] } },
    { input: "Mute spam, but still notify me if it's urgent.", expected: { action: "mute", keywords: ["spam"], exceptPriority: "high" } },
    { input: "Forward messages with attachments to my work email.", expected: { action: "forward", condition: "has_attachment", toEmail: true } },
    { input: "Forward messages from unknown numbers only if they seem important.", expected: { action: "forward", condition: "unknown", priority: "high" } },
    { input: "Forward messages that mention meetings and I haven't replied.", expected: { action: "forward", keywords: ["meeting"], condition: "no_reply" } },
    { input: "Forward messages about contracts to my lawyer during business hours.", expected: { action: "forward", keywords: ["contract"], contact: "lawyer", timeCondition: "business_hours" } },
    { input: "If it's a bank message and urgent, forward immediately.", expected: { action: "forward", keywords: ["bank"], priority: "high", immediate: true } },
  ],
  
  // EXTREME / EDGE / ADVERSARIAL
  extreme: [
    { input: "Forward everything except messages from my mom.", expected: { action: "forward_all", exclude: ["mom"] } },
    { input: "Forward nothing unless it's an emergency.", expected: { action: "forward", onlyEmergency: true } },
    { input: "Forward urgent messages, but stop if I reply even once.", expected: { action: "forward", priority: "high", stopOnReply: true } },
    { input: "Forward messages unless I'm online and actively typing.", expected: { action: "forward", condition: "not_active" } },
    { input: "Forward messages that feel stressful.", expected: { action: "forward", sentiment: "stressful", needsAI: true } },
    { input: "Forward messages if they sound angry.", expected: { action: "forward", sentiment: "angry", needsAI: true } },
    { input: "Forward messages only when I'm asleep.", expected: { action: "forward", timeCondition: "sleeping_hours" } },
    { input: "Forward messages if I ignore them on purpose.", expected: { action: "forward", condition: "intentionally_ignored", needsAI: true } },
    { input: "Forward messages but don't tell me.", expected: { action: "forward", silent: true } },
    { input: "Forward messages, but only once per person per day.", expected: { action: "forward", rateLimit: "1_per_person_per_day" } },
    { input: "Forward messages if they mention money but aren't spam.", expected: { action: "forward", keywords: ["money"], exclude: ["spam"] } },
    { input: "Forward messages even if I delete them.", expected: { action: "forward", condition: "even_if_deleted" } },
    { input: "Forward messages only if I would care.", expected: { action: "forward", condition: "important_to_user", needsAI: true } },
    { input: "Forward messages unless it's probably nothing.", expected: { action: "forward", exclude: ["trivial"], needsAI: true } },
    { input: "Forward messages but never at night unless it's really bad.", expected: { action: "forward", timeExclude: "night", exceptEmergency: true } },
    { input: "Forward messages unless I say stop later.", expected: { action: "forward", canBeOverridden: true } },
    { input: "Forward messages intelligently.", expected: { action: "forward", mode: "ai_intelligent" } },
  ]
};

// Parse and extract rule components from natural language
function parseRuleIntent(input) {
  const result = {
    action: null,
    priority: null,
    keywords: [],
    contacts: [],
    excludeContacts: [],
    timeConditions: [],
    otherConditions: [],
    needsAI: false,
    needsClarification: [],
  };
  
  const lower = input.toLowerCase();
  
  // Detect action
  if (lower.includes('forward') || lower.includes('send')) result.action = 'forward';
  else if (lower.includes('mute')) result.action = 'mute';
  else if (lower.includes('block')) result.action = 'block';
  else if (lower.includes('hold')) result.action = 'hold';
  else if (lower.includes('auto-reply') || lower.includes('auto reply')) result.action = 'auto_reply';
  else if (lower.includes('prioritize')) result.action = 'prioritize';
  else if (lower.includes('pause') || lower.includes('stop')) result.action = 'pause';
  
  // Detect priority
  if (lower.includes('urgent') || lower.includes('emergency') || lower.includes('important')) {
    result.priority = 'high';
  }
  
  // Detect keywords
  const keywordPatterns = [
    { pattern: /bank/i, keyword: 'bank' },
    { pattern: /spam/i, keyword: 'spam' },
    { pattern: /promotional|promo/i, keyword: 'promotional' },
    { pattern: /client/i, keyword: 'client' },
    { pattern: /payment/i, keyword: 'payment' },
    { pattern: /contract/i, keyword: 'contract' },
    { pattern: /meeting/i, keyword: 'meeting' },
    { pattern: /money/i, keyword: 'money' },
    { pattern: /attachment/i, keyword: 'attachment' },
  ];
  
  keywordPatterns.forEach(({ pattern, keyword }) => {
    if (pattern.test(lower)) result.keywords.push(keyword);
  });
  
  // Detect contacts mentioned
  const contactPatterns = [
    /to (\w+)/i,
    /from (\w+)/i,
    /(\w+)'s/i,
  ];
  
  // Detect time conditions
  if (lower.includes('work hours') || lower.includes('business hours')) {
    result.timeConditions.push('work_hours');
  }
  if (lower.includes('after hours') || lower.includes('after 9')) {
    result.timeConditions.push('after_hours');
  }
  if (lower.includes('weekday')) result.timeConditions.push('weekdays');
  if (lower.includes('weekend')) result.timeConditions.push('weekend');
  if (lower.includes('night')) result.timeConditions.push('night');
  if (lower.includes('morning')) result.timeConditions.push('morning');
  
  // Detect exclusions
  if (lower.includes('except') || lower.includes('but not') || lower.includes('unless')) {
    result.hasExclusion = true;
  }
  
  // Detect AI-required conditions
  const aiRequiredPhrases = [
    'feel', 'sound', 'seem', 'would care', 'probably', 'intelligently',
    'stressful', 'angry', 'important', 'ignore them on purpose'
  ];
  
  if (aiRequiredPhrases.some(phrase => lower.includes(phrase))) {
    result.needsAI = true;
  }
  
  // Detect what clarification is needed
  if (result.action === 'forward' && !lower.includes(' to ')) {
    result.needsClarification.push('recipient');
  }
  
  return result;
}

// Run tests
function runTests() {
  console.log("=".repeat(60));
  console.log("AI AGENT RULE PARSING TEST SUITE");
  console.log("=".repeat(60));
  
  let passed = 0;
  let failed = 0;
  
  Object.entries(testCases).forEach(([category, tests]) => {
    console.log(`\n--- ${category.toUpperCase()} ---`);
    
    tests.forEach((test, i) => {
      const result = parseRuleIntent(test.input);
      const hasAction = result.action !== null;
      
      console.log(`\n${i + 1}. "${test.input}"`);
      console.log(`   Action: ${result.action || 'UNKNOWN'}`);
      console.log(`   Priority: ${result.priority || 'normal'}`);
      console.log(`   Keywords: ${result.keywords.join(', ') || 'none'}`);
      console.log(`   Time: ${result.timeConditions.join(', ') || 'anytime'}`);
      console.log(`   Needs AI: ${result.needsAI}`);
      console.log(`   Needs Clarification: ${result.needsClarification.join(', ') || 'none'}`);
      
      if (hasAction) {
        console.log(`   ✅ PARSED`);
        passed++;
      } else {
        console.log(`   ❌ FAILED TO PARSE`);
        failed++;
      }
    });
  });
  
  console.log("\n" + "=".repeat(60));
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log("=".repeat(60));
}

// Export for use
module.exports = { testCases, parseRuleIntent, runTests };

// Run if called directly
if (require.main === module) {
  runTests();
}
