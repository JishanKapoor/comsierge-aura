const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const User = (await import('../models/User.js')).default;
  const users = await User.find({ forwardingNumber: { $exists: true, $ne: null, $ne: '' } }).limit(5);
  console.log('Users with forwarding numbers:');
  users.forEach(u => console.log(`  ${u.email || u._id}: forwarding=${u.forwardingNumber}, comsierge=${u.phoneNumber}`));
  
  if (users.length > 0) {
    const testUser = users[0];
    console.log(`\nTesting with user: ${testUser.email || testUser._id}`);
    
    // Test calling own number
    const { rulesAgentChat } = await import('../services/aiAgentService.js');
    console.log(`\n--- Test: Call own forwarding number (${testUser.forwardingNumber}) ---`);
    const result = await rulesAgentChat(testUser._id.toString(), `call ${testUser.forwardingNumber}`, [], { viaSms: true });
    console.log('Result:', result);
  }
  
  mongoose.disconnect();
});
