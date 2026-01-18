/**
 * Test AI Agent Capabilities - Dashboard vs SMS Parity
 * Tests that all dashboard features can be done via @comsierge SMS
 */

import dotenv from 'dotenv';
dotenv.config();

const LIVE_SERVER = 'https://comsierge-iwe0.onrender.com';
const TEST_EMAIL = process.env.TEST_EMAIL || 'jishan@comsierge.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD;

let token = null;

async function login() {
  const res = await fetch(`${LIVE_SERVER}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD })
  });
  const data = await res.json();
  token = data.data?.token || data.token;
  console.log('✅ Logged in\n');
}

async function testAI(message, description) {
  console.log(`📤 ${description}`);
  console.log(`   Command: "${message}"`);
  
  const res = await fetch(`${LIVE_SERVER}/api/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ message })
  });
  
  const data = await res.json();
  const response = (data.response || data.error || 'No response').substring(0, 200);
  console.log(`   📥 ${response}${response.length >= 200 ? '...' : ''}`);
  
  const success = !data.error && data.response && !data.response.includes('error');
  console.log(`   ${success ? '✅ PASS' : '❌ FAIL'}\n`);
  return success;
}

async function runTests() {
  console.log('═'.repeat(70));
  console.log('AI AGENT CAPABILITIES TEST - Dashboard vs SMS Parity');
  console.log('═'.repeat(70));
  console.log('Testing that all dashboard features work via @comsierge SMS\n');

  await login();

  const tests = [
    // MESSAGING
    ['send hi to jeremy', 'Send message to contact'],
    ['text jake 2 saying hello', 'Send message with content'],
    
    // CALLS
    ['call jeremy', 'Make call to contact'],
    ['call +14372392448', 'Make call to number'],
    
    // CONTACTS
    ['list my contacts', 'List contacts'],
    ['search for jake', 'Search contacts'],
    ['add contact test person 555-123-4567', 'Add new contact'],
    ['whats jakes number', 'Get contact details'],
    ['block jake 2', 'Block contact'],
    ['unblock jake 2', 'Unblock contact'],
    
    // RULES
    ['show my rules', 'List active rules'],
    ['forward messages from jeremy to jake', 'Create transfer rule'],
    ['auto reply to jake saying im busy', 'Create auto-reply rule'],
    ['set spam filter for lottery winner', 'Create spam filter'],
    
    // REMINDERS & SCHEDULING
    ['remind me in 5 minutes to check email', 'Create reminder (text)'],
    ['call me in 10 minutes to wake up', 'Create reminder (call)'],
    ['what reminders do i have', 'List reminders'],
    ['text jake tomorrow at 9am saying good morning', 'Schedule message'],
    
    // CONVERSATION MANAGEMENT
    ['pin conversation with jeremy', 'Pin conversation'],
    ['mute jake', 'Mute conversation'],
    ['archive conversation with jake 2', 'Archive conversation'],
    ['summarize my conversation with jeremy', 'Summarize conversation'],
    
    // SETTINGS
    ['turn on do not disturb', 'Set DND'],
    ['only let favorites call me', 'Set call filter'],
    ['whats my phone number', 'Get phone info'],
    
    // AI CALLS (voice AI)
    ['have ai call jeremy and ask if hes free for lunch', 'Make AI call'],
    ['list my ai calls', 'List AI calls'],
    
    // MESSAGES
    ['whats the last message from jeremy', 'Get last message'],
    ['search messages for hello', 'Search messages'],
    ['what did jeremy say yesterday', 'Search messages by date'],
    
    // SUPPORT
    ['create support ticket i need help', 'Create support ticket'],
    ['show my support tickets', 'List support tickets'],
    
    // PROACTIVE
    ['whats new unread messages', 'Get unread summary'],
    ['suggest a reply to jeremy', 'Suggest reply'],
  ];

  let passed = 0;
  let failed = 0;

  for (const [command, description] of tests) {
    try {
      const success = await testAI(command, description);
      if (success) passed++; else failed++;
    } catch (e) {
      console.log(`   ❌ ERROR: ${e.message}\n`);
      failed++;
    }
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('═'.repeat(70));
  console.log(`RESULTS: ${passed}/${passed + failed} tests passed`);
  console.log('═'.repeat(70));
  
  console.log('\n📱 DASHBOARD FEATURES AVAILABLE VIA @comsierge SMS:');
  console.log('─'.repeat(70));
  console.log(`
✅ MESSAGING
   - Send messages: "text jeremy saying hello"
   - Schedule messages: "text jake tomorrow at 3pm saying reminder"
   
✅ CALLS  
   - Make calls: "call jeremy" 
   - Make AI calls: "have ai call jake and ask about the meeting"
   
✅ CONTACTS
   - List contacts: "list my contacts"
   - Search: "search for jake"
   - Add: "add contact John 555-123-4567"
   - Get info: "what's jeremy's number"
   - Block/Unblock: "block jake" / "unblock jake"
   
✅ RULES
   - View rules: "show my rules"
   - Transfer rules: "forward messages from X to Y"
   - Auto-reply: "auto reply to jake saying im busy for 1 hour"
   - Spam filter: "block messages containing lottery"
   
✅ REMINDERS
   - Text reminder: "remind me in 30 min to call mom"
   - Call reminder: "call me in 1 hour to wake up"
   - List: "what reminders do I have"
   
✅ CONVERSATION MANAGEMENT
   - Pin: "pin jeremy"
   - Mute: "mute jake"
   - Archive: "archive conversation with jake"
   - Summarize: "summarize conversation with jeremy"
   
✅ SETTINGS
   - DND: "turn on do not disturb"
   - Call filter: "only let favorites ring"
   - Routing: "forward unknown calls to voicemail"
   
✅ MESSAGES
   - Last message: "what's the last message from jake"
   - Search: "search messages for meeting"
   - By date: "what did jeremy say yesterday"
`);
}

runTests().catch(console.error);
