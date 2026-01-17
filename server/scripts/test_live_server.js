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
  
  // Test cases - the exact user issue
  const tests = [
    "if i receive a message from my grandmother and she talks about where i am say in a meeting with jeremy",
    "auto reply to uncle bob with 'I will call you back'",
  ];
  
  for (const test of tests) {
    console.log('\n' + '─'.repeat(70));
    await testAIChat(token, test);
    // Small delay between requests
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('\n' + '═'.repeat(70));
  console.log('✅ Live tests complete');
}

runLiveTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
