import dotenv from 'dotenv';
dotenv.config();

const LIVE_SERVER = 'https://comsierge-iwe0.onrender.com';
const TEST_EMAIL = process.env.TEST_EMAIL || 'jishan@comsierge.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD;

async function testRuleCreation() {
  // Login
  console.log('Logging in...');
  const loginRes = await fetch(`${LIVE_SERVER}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD })
  });
  const loginData = await loginRes.json();
  const token = loginData.data?.token || loginData.token;
  console.log('Logged in!');

  // Test creating auto-reply rule
  console.log('\n--- Creating auto-reply rule ---');
  const chatRes = await fetch(`${LIVE_SERVER}/api/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ 
      message: 'if grandmother texts me about my location, auto reply saying im in a meeting for 1 hour' 
    })
  });
  const chatData = await chatRes.json();
  console.log('AI Response:', chatData.response);
  
  // Check rules
  console.log('\n--- Checking rules in database ---');
  const rulesRes = await fetch(`${LIVE_SERVER}/api/rules?userId=${loginData.data?.user?.id || loginData.user?.id}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const rulesData = await rulesRes.json();
  console.log('Rules returned by API:', rulesData.length);
  rulesData.forEach((r, i) => {
    console.log(`  ${i+1}. [${r.type}] ${r.rule?.substring(0, 60)}`);
  });
}

testRuleCreation().catch(console.error);
