/**
 * Live API Test for AI Agent
 * Tests the complete flow: rule creation, message sending, confirmations
 */

import fetch from 'node-fetch';

// Configuration - UPDATE THESE
const API_BASE = 'https://comsierge-aura.onrender.com';
const TEST_USER_EMAIL = 'test@example.com';
const TEST_USER_PASSWORD = 'password123';

let authToken = null;

async function login() {
  console.log('\n=== LOGGING IN ===');
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD })
    });
    const data = await res.json();
    if (data.token) {
      authToken = data.token;
      console.log('✅ Login successful');
      return true;
    }
    console.log('❌ Login failed:', data);
    return false;
  } catch (err) {
    console.log('❌ Login error:', err.message);
    return false;
  }
}

async function testAIChat(message, chatHistory = []) {
  console.log(`\n>>> USER: "${message}"`);
  
  const res = await fetch(`${API_BASE}/api/ai/chat`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ message, chatHistory })
  });
  
  const data = await res.json();
  console.log(`<<< AI: "${data.response}"`);
  return data.response;
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('AI AGENT LIVE API TESTS');
  console.log('='.repeat(60));
  
  // Login first
  if (!await login()) {
    console.log('Cannot continue without login');
    return;
  }
  
  const chatHistory = [];
  
  // Test 1: Basic rule creation with missing recipient
  console.log('\n--- TEST 1: Rule creation that needs clarification ---');
  const response1 = await testAIChat("Forward all bank messages");
  chatHistory.push({ role: "user", text: "Forward all bank messages" });
  chatHistory.push({ role: "assistant", text: response1 });
  
  // Test 2: Provide clarification
  if (response1.includes('Who should') || response1.includes('forward to')) {
    console.log('\n--- TEST 2: Providing clarification ---');
    const response2 = await testAIChat("John", chatHistory);
    chatHistory.push({ role: "user", text: "John" });
    chatHistory.push({ role: "assistant", text: response2 });
  }
  
  // Test 3: Complex multi-condition rule
  console.log('\n--- TEST 3: Complex rule ---');
  const response3 = await testAIChat("Forward urgent client messages about payments to my accountant during work hours");
  
  // Test 4: Rule with exclusions
  console.log('\n--- TEST 4: Rule with exclusions ---');
  const response4 = await testAIChat("Forward everything except messages from mom");
  
  // Test 5: Time-based rule
  console.log('\n--- TEST 5: Time-based rule ---');
  const response5 = await testAIChat("Auto-reply 'In a meeting' after 6pm");
  
  // Test 6: AI-powered rule
  console.log('\n--- TEST 6: AI-powered rule ---');
  const response6 = await testAIChat("Forward messages that sound angry");
  
  // Test 7: Show rules
  console.log('\n--- TEST 7: Show rules ---');
  const response7 = await testAIChat("Show my rules");
  
  // Test 8: Send message
  console.log('\n--- TEST 8: Send message ---');
  const sendHistory = [];
  const response8 = await testAIChat("send hello to +13828804321", sendHistory);
  sendHistory.push({ role: "user", text: "send hello to +13828804321" });
  sendHistory.push({ role: "assistant", text: response8 });
  
  // Test 9: Confirm send
  if (response8.includes('Ready to send') || response8.includes('Reply "yes"')) {
    console.log('\n--- TEST 9: Confirm send ---');
    const response9 = await testAIChat("yes", sendHistory);
    console.log('Send result:', response9);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('TESTS COMPLETE');
  console.log('='.repeat(60));
}

// Run if called directly
runTests().catch(console.error);
