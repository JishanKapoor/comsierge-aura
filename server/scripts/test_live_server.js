// Live Server Test - Tests the actual deployed Render server
import dotenv from 'dotenv';
dotenv.config();

const LIVE_SERVER = process.env.LIVE_SERVER_URL || 'https://comsierge-iwe0.onrender.com';
const TEST_EMAIL = process.env.TEST_EMAIL || 'jishan@comsierge.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD;

if (!TEST_PASSWORD) {
  console.error('❌ TEST_PASSWORD environment variable is required');
  console.log('Set it in .env file or run: $env:TEST_PASSWORD="your_password"');
  process.exit(1);
}

async function login() {
  console.log(`\n🔐 Logging in to ${LIVE_SERVER}...`);
  const res = await fetch(`${LIVE_SERVER}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD })
  });
  
  const data = await res.json();
  const token = data.data?.token || data.token;
  if (!token) {
    console.error('❌ Login failed:', data);
    process.exit(1);
  }
  console.log(`✅ Logged in as ${TEST_EMAIL} (user: ${data.data?.user?.name})`);
  return token;
}

async function testAIChat(token, message) {
  console.log(`\n📤 Sending: "${message}"`);
  
  const res = await fetch(`${LIVE_SERVER}/api/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ message })
  });
  
  const data = await res.json();
  console.log(`📥 Response:`, data.response);
  return data;
}

async function runLiveTests() {
  console.log('═'.repeat(70));
  console.log('🌐 LIVE SERVER TEST - Testing actual deployed Render server');
  console.log('═'.repeat(70));
  console.log(`Server: ${LIVE_SERVER}`);
  
  const token = await login();
  
  // Comprehensive test cases for live server
  const tests = [
    // Message sending
    { msg: "send a message to jake saying hey", expect: "Jake 2|ready to send" },
    { msg: "send a message to jaek saying hello", expect: "couldn't find|Jake 2|ready" }, // typo should resolve to Jake 2
    
    // Rules display
    { msg: "show my rules", expect: "rule|auto-repl|forward|block|transfer" },
    { msg: "what are my active rules", expect: "rule|auto-repl|forward|block|transfer" },
    
    // Contact validation (should fail for non-existent contacts)
    { msg: "block grandma", expect: "couldn't find|could not find|which|phone number" },
    { msg: "auto reply to uncle bob with 'busy'", expect: "couldn't find|could not find|save them" },
    { msg: "forward calls from fake person to jeremy", expect: "couldn't find|could not find|check" },
    
    // Contact operations with REAL contacts
    { msg: "block jake 2", expect: "blocked|block|Jake 2" },
    { msg: "unblock jake 2", expect: "unblocked|unblock|Jake 2" },
    
    // Transfer rules with real contacts
    { msg: "forward messages from jake to jeremy", expect: "forward|Jake 2|jeremy|transfer" },
    
    // Routing preferences
    { msg: "favorites only for calls", expect: "favorite|done" },
    { msg: "all messages", expect: "all message|done|notification" },
    
    // Spam filter
    { msg: "block spam messages", expect: "spam|block|which|call|message" },
    
    // Search/list contacts
    { msg: "show my contacts", expect: "contact|Jake|jeremy" },
    { msg: "who are my favorites", expect: "favorite|Jake" },
    
    // Delete rules  
    { msg: "delete all my rules", expect: "delete|remove|sure|confirm" },
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    console.log('\n' + '─'.repeat(70));
    const result = await testAIChat(token, test.msg);
    
    // Check if response matches expected pattern
    const patterns = test.expect.split('|');
    const responseText = (result.response || '').toLowerCase();
    const matches = patterns.some(p => responseText.includes(p.toLowerCase()));
    
    if (matches) {
      console.log(`   ✅ PASS - Contains expected: "${test.expect}"`);
      passed++;
    } else {
      console.log(`   ❌ FAIL - Expected "${test.expect}" but got: "${result.response?.substring(0, 100)}..."`);
      failed++;
    }
    
    // Small delay between requests
    await new Promise(r => setTimeout(r, 1500));
  }
  
  console.log('\n' + '═'.repeat(70));
  console.log(`📊 LIVE TEST RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
  console.log('═'.repeat(70));
  
  if (failed > 0) {
    console.log('⚠️  Some tests failed - review above for details');
  } else {
    console.log('✅ All live tests passed!');
  }
}

runLiveTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
