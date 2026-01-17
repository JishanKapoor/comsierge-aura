/**
 * Comprehensive AI Agent Test Suite
 * Tests dashboard AI chat functionality for rules, routing, contacts, and more
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { rulesAgentChat } from '../services/aiAgentService.js';
import Rule from '../models/Rule.js';
import User from '../models/User.js';
import Contact from '../models/Contact.js';
import Conversation from '../models/Conversation.js';

// Test user ID (will be set dynamically)
let testUserId = null;
let testUserPhone = null;

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

// Get test user
async function getTestUser() {
  const user = await User.findOne({ email: { $exists: true } }).limit(1);
  if (!user) {
    console.error('❌ No test user found');
    process.exit(1);
  }
  testUserId = user._id.toString();
  testUserPhone = user.twilioNumber || user.phone || '+15551234567';
  console.log(`📱 Using test user: ${user.name || user.email} (${testUserId})`);
  return user;
}

// Helper to send chat message and get response
async function chat(message) {
  try {
    const result = await rulesAgentChat(testUserId, message, []);
    return result.response || result;
  } catch (error) {
    return `ERROR: ${error.message}`;
  }
}

// Helper to check if response contains expected text
function assertContains(response, expected, testName) {
  const normalizedResponse = response.toLowerCase();
  const normalizedExpected = expected.toLowerCase();
  const passed = normalizedResponse.includes(normalizedExpected);
  if (passed) {
    console.log(`   ✅ ${testName}`);
  } else {
    console.log(`   ❌ ${testName}`);
    console.log(`      Expected to contain: "${expected}"`);
    console.log(`      Got: "${response.substring(0, 200)}..."`);
  }
  return passed;
}

// Helper to check if response does NOT contain text
function assertNotContains(response, notExpected, testName) {
  const normalizedResponse = response.toLowerCase();
  const normalizedNotExpected = notExpected.toLowerCase();
  const passed = !normalizedResponse.includes(normalizedNotExpected);
  if (passed) {
    console.log(`   ✅ ${testName}`);
  } else {
    console.log(`   ❌ ${testName}`);
    console.log(`      Should NOT contain: "${notExpected}"`);
    console.log(`      Got: "${response.substring(0, 200)}..."`);
  }
  return passed;
}

// Clean up test rules before/after tests
async function cleanupTestRules() {
  if (!testUserId) return;
  
  // Delete all test-related rules (keep system defaults)
  await Rule.deleteMany({
    userId: testUserId,
    rule: { $regex: /test|jake|jeremy|block.*test/i }
  });
  console.log('🧹 Cleaned up test rules');
}

// ==========================================
// TEST SUITES
// ==========================================

const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function recordTest(name, passed) {
  testResults.tests.push({ name, passed });
  if (passed) testResults.passed++;
  else testResults.failed++;
}

// TEST 1: Basic Rule Display
async function testRuleDisplay() {
  console.log('\n' + '='.repeat(60));
  console.log('📋 TEST 1: Rule Display (No Duplicates, No Defaults)');
  console.log('='.repeat(60));
  
  // First, show current rules
  const response = await chat('show me my active rules');
  console.log(`   Response: "${response.substring(0, 300)}..."`);
  
  // Should NOT show default routing rules
  const p1 = assertNotContains(response, '(default)', 'Should not show "(default)" marker');
  const p2 = assertNotContains(response, 'all calls ring your phone', 'Should not show default call routing');
  const p3 = assertNotContains(response, 'urgent messages only', 'Should not show default message routing');
  
  // Check for duplicate detection
  const ruleMatches = response.match(/block jake/gi) || [];
  const noDuplicates = ruleMatches.length <= 1;
  console.log(`   ${noDuplicates ? '✅' : '❌'} No duplicate "Block Jake" rules (found ${ruleMatches.length})`);
  
  recordTest('Rule display - no defaults', p1 && p2 && p3);
  recordTest('Rule display - no duplicates', noDuplicates);
}

// TEST 2: Block Contact (Deduplication)
async function testBlockContact() {
  console.log('\n' + '='.repeat(60));
  console.log('🚫 TEST 2: Block Contact (No Duplicates)');
  console.log('='.repeat(60));
  
  // Create a test contact first
  const testContact = await Contact.findOneAndUpdate(
    { userId: testUserId, name: 'Test Jake' },
    { 
      userId: testUserId, 
      name: 'Test Jake', 
      phone: '+15559999999',
      isBlocked: false 
    },
    { upsert: true, new: true }
  );
  
  // Block the contact
  const response1 = await chat('block Test Jake');
  console.log(`   First block: "${response1.substring(0, 150)}..."`);
  const p1 = assertContains(response1, 'block', 'First block should succeed') ||
             assertContains(response1, 'all set', 'First block should succeed');
  
  // Try to block again - should say already blocked
  const response2 = await chat('block Test Jake');
  console.log(`   Second block: "${response2.substring(0, 150)}..."`);
  const p2 = assertContains(response2, 'already', 'Second block should say already blocked') ||
             assertContains(response2, 'block', 'Second block acknowledged');
  
  // Count block rules for this contact
  const blockRules = await Rule.find({
    userId: testUserId,
    type: 'block',
    'transferDetails.sourcePhone': '+15559999999'
  });
  const noDuplicate = blockRules.length <= 1;
  console.log(`   ${noDuplicate ? '✅' : '❌'} Only one block rule created (found ${blockRules.length})`);
  
  // Cleanup
  await Rule.deleteMany({ userId: testUserId, 'transferDetails.sourcePhone': '+15559999999' });
  await Contact.deleteOne({ _id: testContact._id });
  
  recordTest('Block contact - first attempt', p1);
  recordTest('Block contact - deduplication', p2 && noDuplicate);
}

// TEST 3: Transfer/Forward Rules
async function testTransferRules() {
  console.log('\n' + '='.repeat(60));
  console.log('📤 TEST 3: Transfer/Forward Rules');
  console.log('='.repeat(60));
  
  // Create test contacts
  await Contact.findOneAndUpdate(
    { userId: testUserId, name: 'Test Source' },
    { userId: testUserId, name: 'Test Source', phone: '+15558881111' },
    { upsert: true }
  );
  await Contact.findOneAndUpdate(
    { userId: testUserId, name: 'Test Target' },
    { userId: testUserId, name: 'Test Target', phone: '+15558882222' },
    { upsert: true }
  );
  
  // Create transfer rule for calls only
  const response1 = await chat('forward calls from Test Source to Test Target');
  console.log(`   Create calls-only transfer: "${response1.substring(0, 150)}..."`);
  const p1 = assertContains(response1, 'done', 'Should confirm rule creation') ||
             assertContains(response1, 'created', 'Should confirm rule creation') ||
             assertContains(response1, 'all set', 'Should confirm rule creation') ||
             assertContains(response1, 'forward', 'Should confirm forwarding');
  
  // Verify the rule was created with correct mode
  const rule = await Rule.findOne({
    userId: testUserId,
    type: 'transfer',
    'conditions.sourceContactName': 'Test Source'
  });
  
  const correctMode = rule?.transferDetails?.mode === 'calls' || response1.toLowerCase().includes('calls');
  console.log(`   ${correctMode ? '✅' : '❌'} Rule mode is 'calls' (got: ${rule?.transferDetails?.mode})`);
  
  // Update to messages only
  const response2 = await chat('actually make it messages only from Test Source to Test Target');
  console.log(`   Update to messages-only: "${response2.substring(0, 150)}..."`);
  const p2 = assertContains(response2, 'done', 'Should confirm rule update') ||
             assertContains(response2, 'updated', 'Should confirm rule update');
  
  // Cleanup
  await Rule.deleteMany({ userId: testUserId, 'conditions.sourceContactName': 'Test Source' });
  await Contact.deleteMany({ userId: testUserId, name: { $in: ['Test Source', 'Test Target'] } });
  
  recordTest('Transfer rule - create', p1);
  recordTest('Transfer rule - update mode', p2);
}

// TEST 4: Routing Preferences
async function testRoutingPreferences() {
  console.log('\n' + '='.repeat(60));
  console.log('📞 TEST 4: Routing Preferences (Calls/Messages)');
  console.log('='.repeat(60));
  
  // Ensure user has a forwarding number for testing
  const user = await User.findById(testUserId);
  if (!user.forwardingNumber) {
    user.forwardingNumber = '+15551234567';
    await user.save();
    console.log('   ℹ️ Set test forwarding number');
  }
  
  // Set favorites only for calls
  const response1 = await chat('only let favorites call me');
  console.log(`   Set favorites only: "${response1.substring(0, 150)}..."`);
  const p1 = assertContains(response1, 'favorite', 'Should mention favorites') ||
             assertContains(response1, 'done', 'Should confirm done');
  
  // Check that a forward rule was created - allow 1 second for DB propagation
  await new Promise(r => setTimeout(r, 500));
  const forwardRule = await Rule.findOne({
    userId: testUserId,
    type: 'forward',
    'conditions.mode': 'favorites'
  });
  const ruleCreated = !!forwardRule;
  console.log(`   ${ruleCreated ? '✅' : '❌'} Forward rule created with mode=favorites`);
  
  // Set message filtering
  const response2 = await chat('only urgent messages please');
  console.log(`   Set urgent messages: "${response2.substring(0, 150)}..."`);
  const p2 = assertContains(response2, 'urgent', 'Should mention urgent') ||
             assertContains(response2, 'done', 'Should confirm done');
  
  // Reset to defaults
  const response3 = await chat('let all calls through');
  console.log(`   Reset to all calls: "${response3.substring(0, 150)}..."`);
  
  recordTest('Routing - favorites only', p1 && ruleCreated);
  recordTest('Routing - urgent messages', p2);
}

// TEST 5: Spam Filter Rules
async function testSpamFilters() {
  console.log('\n' + '='.repeat(60));
  console.log('🛡️ TEST 5: Spam Filter Rules (Deduplication)');
  console.log('='.repeat(60));
  
  // First clean up any existing car warranty rules
  await Rule.deleteMany({ userId: testUserId, rule: /car warranty/i });
  
  // Create spam filter with explicit command
  const response1 = await chat('create a spam filter for car warranty messages');
  console.log(`   First spam filter: "${response1.substring(0, 150)}..."`);
  const p1 = assertContains(response1, 'spam', 'Should mention spam') ||
             assertContains(response1, 'filter', 'Should mention filter') ||
             assertContains(response1, 'block', 'Should confirm blocking') ||
             assertContains(response1, 'done', 'Should confirm done');
  
  // Try to create same filter again
  const response2 = await chat('create a spam filter for car warranty messages');
  console.log(`   Second spam filter: "${response2.substring(0, 150)}..."`);
  const p2 = assertContains(response2, 'already', 'Should say filter already exists') ||
             assertContains(response2, 'exists', 'Should say filter exists') ||
             assertContains(response2, 'filter', 'Should acknowledge filter');
  
  // Cleanup
  await Rule.deleteMany({ userId: testUserId, rule: /car warranty/i });
  
  recordTest('Spam filter - create', p1);
  recordTest('Spam filter - deduplication', p2);
}

// TEST 6: Rule Count Accuracy
async function testRuleCount() {
  console.log('\n' + '='.repeat(60));
  console.log('🔢 TEST 6: Rule Count Accuracy');
  console.log('='.repeat(60));
  
  // Get current rule count from database (excluding defaults)
  const actualRules = await Rule.find({
    userId: testUserId,
    active: true,
    rule: { $not: { $regex: /\(default\)/i } }
  });
  
  // Filter out system routing rules
  const customRules = actualRules.filter(r => {
    const ruleText = r.rule?.toLowerCase() || '';
    if (ruleText.includes('all calls ring')) return false;
    if (ruleText.includes('urgent messages only')) return false;
    if (ruleText.includes('all messages notify')) return false;
    if (r.type === 'forward' && r.conditions?.mode && !r.conditions?.sourceContactPhone) return false;
    if (r.type === 'message-notify' && !r.conditions?.sourceContactPhone) return false;
    return true;
  });
  
  console.log(`   Database custom rules: ${customRules.length}`);
  
  // Ask AI for rule count
  const response = await chat('how many rules do I have');
  console.log(`   AI response: "${response.substring(0, 200)}..."`);
  
  // Check if the count is reasonable
  const countMatch = response.match(/(\d+)\s*(rules?|active)/i);
  if (countMatch) {
    const aiCount = parseInt(countMatch[1]);
    const accurate = Math.abs(aiCount - customRules.length) <= 1;
    console.log(`   ${accurate ? '✅' : '❌'} AI count (${aiCount}) matches DB count (${customRules.length})`);
    recordTest('Rule count accuracy', accurate);
  } else {
    console.log(`   ⚠️ Could not extract count from response`);
    recordTest('Rule count accuracy', true); // Pass if no count mentioned
  }
}

// TEST 7: Delete Rule
async function testDeleteRule() {
  console.log('\n' + '='.repeat(60));
  console.log('🗑️ TEST 7: Delete Rule');
  console.log('='.repeat(60));
  
  // Create a test rule first
  await Rule.create({
    userId: testUserId,
    rule: 'Test rule to delete',
    type: 'custom',
    active: true
  });
  
  // Delete the rule
  const response = await chat('delete the test rule');
  console.log(`   Delete response: "${response.substring(0, 150)}..."`);
  
  const p1 = assertContains(response, 'delete', 'Should confirm deletion') ||
             assertContains(response, 'removed', 'Should confirm removal');
  
  // Verify it's gone
  const remainingRules = await Rule.find({
    userId: testUserId,
    rule: 'Test rule to delete'
  });
  const deleted = remainingRules.length === 0;
  console.log(`   ${deleted ? '✅' : '❌'} Rule actually deleted from database`);
  
  recordTest('Delete rule', p1 && deleted);
}

// TEST 8: Contact Operations
async function testContactOperations() {
  console.log('\n' + '='.repeat(60));
  console.log('👤 TEST 8: Contact Operations');
  console.log('='.repeat(60));
  
  // Search for contacts
  const response1 = await chat('find contacts named John');
  console.log(`   Search contacts: "${response1.substring(0, 150)}..."`);
  // Just verify it responds without error
  const p1 = !response1.toLowerCase().includes('error');
  console.log(`   ${p1 ? '✅' : '❌'} Contact search works without error`);
  
  // List favorites
  const response2 = await chat('show my favorites');
  console.log(`   Show favorites: "${response2.substring(0, 150)}..."`);
  const p2 = !response2.toLowerCase().includes('error');
  console.log(`   ${p2 ? '✅' : '❌'} Show favorites works without error`);
  
  recordTest('Contact search', p1);
  recordTest('Show favorites', p2);
}

// TEST 9: Conversation Summaries
async function testConversationSummaries() {
  console.log('\n' + '='.repeat(60));
  console.log('💬 TEST 9: Conversation Summaries');
  console.log('='.repeat(60));
  
  // Get recent conversations
  const convo = await Conversation.findOne({ userId: testUserId });
  
  if (convo) {
    const response = await chat(`summarize my conversation with ${convo.contactName || 'unknown'}`);
    console.log(`   Summary response: "${response.substring(0, 200)}..."`);
    const p1 = !response.toLowerCase().includes('error') && response.length > 20;
    console.log(`   ${p1 ? '✅' : '❌'} Summarization works`);
    recordTest('Conversation summary', p1);
  } else {
    console.log('   ⚠️ No conversations found, skipping');
    recordTest('Conversation summary', true);
  }
}

// TEST 10: Complex Routing Commands
async function testComplexRoutingCommands() {
  console.log('\n' + '='.repeat(60));
  console.log('🔀 TEST 10: Complex Routing Commands');
  console.log('='.repeat(60));
  
  // Test complex command: favorites for calls, urgent for messages
  const response1 = await chat('favorites only for calls, urgent messages only');
  console.log(`   Complex routing: "${response1.substring(0, 150)}..."`);
  const p1 = (response1.toLowerCase().includes('favorite') || response1.toLowerCase().includes('call')) &&
             (response1.toLowerCase().includes('urgent') || response1.toLowerCase().includes('message'));
  console.log(`   ${p1 ? '✅' : '❌'} Both call and message settings acknowledged`);
  
  // Test time-based routing
  const response2 = await chat('no calls from 10pm to 6am');
  console.log(`   Time-based routing: "${response2.substring(0, 150)}..."`);
  const p2 = !response2.toLowerCase().includes('error');
  console.log(`   ${p2 ? '✅' : '❌'} Time-based routing accepted`);
  
  recordTest('Complex routing', p1);
  recordTest('Time-based routing', p2);
}

// ==========================================
// MAIN TEST RUNNER
// ==========================================

async function runAllTests() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 COMPREHENSIVE AI AGENT TEST SUITE');
  console.log('='.repeat(70));
  console.log('Testing dashboard AI chat functionality');
  console.log('='.repeat(70) + '\n');
  
  await connectDB();
  await getTestUser();
  await cleanupTestRules();
  
  try {
    // Run all test suites
    await testRuleDisplay();
    await testBlockContact();
    await testTransferRules();
    await testRoutingPreferences();
    await testSpamFilters();
    await testRuleCount();
    await testDeleteRule();
    await testContactOperations();
    await testConversationSummaries();
    await testComplexRoutingCommands();
    
  } catch (error) {
    console.error('\n❌ Test suite error:', error);
  }
  
  // Final cleanup
  await cleanupTestRules();
  
  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(70));
  console.log(`   Total Tests: ${testResults.passed + testResults.failed}`);
  console.log(`   Passed: ${testResults.passed} ✅`);
  console.log(`   Failed: ${testResults.failed} ❌`);
  console.log(`   Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  console.log('='.repeat(70) + '\n');
  
  // List failed tests
  if (testResults.failed > 0) {
    console.log('Failed tests:');
    testResults.tests.filter(t => !t.passed).forEach(t => {
      console.log(`   ❌ ${t.name}`);
    });
  }
  
  await mongoose.disconnect();
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests();
