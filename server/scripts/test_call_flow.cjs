const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const User = (await import('../models/User.js')).default;
  const testUser = await User.findOne({ email: 'bossprojectorcanada@gmail.com' });
  
  if (!testUser) {
    console.log('Test user not found');
    mongoose.disconnect();
    return;
  }
  
  console.log(`User: ${testUser.email}`);
  console.log(`Forwarding: ${testUser.forwardingNumber}`);
  console.log(`Comsierge: ${testUser.phoneNumber}`);
  
  const { rulesAgentChat } = await import('../services/aiAgentService.js');
  
  // Test 1: Call a different number (should work)
  console.log('\n--- Test: Call a different number (+14372392448) ---');
  const result1 = await rulesAgentChat(testUser._id.toString(), 'call +14372392448', [], { viaSms: true });
  console.log('Result:', result1);
  
  // Test 2: Call own Comsierge number (should block)
  console.log('\n--- Test: Call own Comsierge number (+18314806288) ---');
  const result2 = await rulesAgentChat(testUser._id.toString(), 'call +18314806288', [], { viaSms: true });
  console.log('Result:', result2);
  
  mongoose.disconnect();
});
