/**
 * Test Reminders - Both Call and Text
 * Tests reminder creation and execution on live server
 */

import dotenv from 'dotenv';
dotenv.config();

const API_BASE = 'https://comsierge-iwe0.onrender.com/api';
const TEST_PHONE = '+14372392448';

// Test credentials from environment
const TEST_EMAIL = process.env.TEST_EMAIL || 'jishan@comsierge.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD;

if (!TEST_PASSWORD) {
  console.error('❌ TEST_PASSWORD environment variable is required');
  console.log('Set it in .env file or run: $env:TEST_PASSWORD="your_password"');
  process.exit(1);
}

let authToken = null;
let userId = null;

async function login() {
  console.log('🔐 Logging in...');
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD })
  });
  
  const data = await res.json();
  authToken = data.data?.token || data.token;
  
  if (!authToken) {
    console.error('Login response:', data);
    throw new Error(`Login failed: ${res.status}`);
  }
  
  const user = data.data?.user || data.user;
  userId = user.id || user._id;
  console.log(`✅ Logged in as ${user.email} (${userId})`);
  console.log(`   Forwarding number: ${user.forwardingNumber || 'NOT SET'}`);
  return { user, token: authToken };
}

async function apiCall(method, endpoint, body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  };
  if (body) options.body = JSON.stringify(body);
  
  const res = await fetch(`${API_BASE}${endpoint}`, options);
  const data = await res.json();
  
  if (!res.ok) {
    throw new Error(`API error: ${res.status} - ${JSON.stringify(data)}`);
  }
  return data;
}

async function getReminders() {
  return apiCall('GET', `/reminders?userId=${userId}`);
}

async function createReminder(type, title, description, minutesFromNow = 1) {
  const scheduledAt = new Date(Date.now() + minutesFromNow * 60 * 1000);
  
  console.log(`\n📝 Creating ${type} reminder: "${title}"`);
  console.log(`   Scheduled for: ${scheduledAt.toISOString()} (${minutesFromNow} min from now)`);
  
  const reminder = await apiCall('POST', '/reminders', {
    userId,
    type,
    title,
    description,
    scheduledAt: scheduledAt.toISOString(),
    contactPhone: TEST_PHONE,
    contactName: 'Test Contact'
  });
  
  console.log(`✅ Created reminder ID: ${reminder.id}`);
  return reminder;
}

async function deleteReminder(id) {
  return apiCall('DELETE', `/reminders/${id}`);
}

async function updateUserForwardingNumber(phone) {
  console.log(`\n📞 Updating forwarding number to: ${phone}`);
  const res = await fetch(`${API_BASE}/auth/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ forwardingNumber: phone })
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to update profile: ${err}`);
  }
  
  const data = await res.json();
  console.log(`✅ Forwarding number set to: ${data.user?.forwardingNumber || phone}`);
  return data;
}

async function runTests() {
  console.log('═'.repeat(60));
  console.log('REMINDER TEST SUITE');
  console.log('═'.repeat(60));
  console.log(`Test phone: ${TEST_PHONE}`);
  console.log(`API: ${API_BASE}`);
  console.log('═'.repeat(60));
  
  try {
    // Login
    const loginData = await login();
    
    // Make sure forwarding number is set correctly
    if (loginData.user.forwardingNumber !== TEST_PHONE) {
      await updateUserForwardingNumber(TEST_PHONE);
    }
    
    // Clean up any old test reminders
    console.log('\n🧹 Cleaning up old test reminders...');
    const existingReminders = await getReminders();
    console.log(`   Found ${existingReminders.length} existing reminders`);
    
    for (const r of existingReminders) {
      if (r.title.includes('Test') || r.title.includes('test')) {
        console.log(`   Deleting: ${r.title}`);
        await deleteReminder(r.id);
      }
    }
    
    // Test 1: Create a TEXT reminder (1 minute from now)
    console.log('\n' + '─'.repeat(60));
    console.log('TEST 1: TEXT REMINDER (will fire in ~1 minute)');
    console.log('─'.repeat(60));
    
    const textReminder = await createReminder(
      'message', // or 'personal' - both send SMS
      'Test SMS Reminder',
      'This is a test text reminder from Comsierge!',
      1 // 1 minute from now
    );
    
    // Test 2: Create a CALL reminder (2 minutes from now)
    console.log('\n' + '─'.repeat(60));
    console.log('TEST 2: CALL REMINDER (will fire in ~2 minutes)');
    console.log('─'.repeat(60));
    
    const callReminder = await createReminder(
      'call',
      'Test Call Reminder',
      'This is a test phone call reminder from Comsierge!',
      2 // 2 minutes from now
    );
    
    // Show current reminders
    console.log('\n' + '─'.repeat(60));
    console.log('PENDING REMINDERS');
    console.log('─'.repeat(60));
    
    const pendingReminders = await getReminders();
    for (const r of pendingReminders) {
      const scheduledTime = new Date(r.scheduledAt);
      const now = new Date();
      const minutesUntil = ((scheduledTime - now) / 60000).toFixed(1);
      console.log(`  [${r.type}] ${r.title}`);
      console.log(`     ID: ${r.id}`);
      console.log(`     Scheduled: ${scheduledTime.toISOString()}`);
      console.log(`     Fires in: ${minutesUntil} minutes`);
      console.log(`     Completed: ${r.isCompleted}`);
    }
    
    console.log('\n' + '═'.repeat(60));
    console.log('✅ REMINDERS CREATED SUCCESSFULLY!');
    console.log('═'.repeat(60));
    console.log(`\n📱 You should receive:`);
    console.log(`   1. A TEXT message in ~1 minute at ${TEST_PHONE}`);
    console.log(`   2. A PHONE CALL in ~2 minutes at ${TEST_PHONE}`);
    console.log(`\n⏰ The reminder scheduler runs every 30 seconds on the server.`);
    console.log(`   Watch for them to arrive!`);
    console.log('\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTests();
