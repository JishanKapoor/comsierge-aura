import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
import Rule from '../models/Rule.js';

async function cleanupDuplicateRules() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Get all active rules
  const allRules = await Rule.find({ active: true }).sort({ createdAt: -1 });
  console.log('Total active rules:', allRules.length);

  // Get unique user IDs
  const userIds = [...new Set(allRules.map(r => r.userId?.toString()).filter(Boolean))];
  console.log('User IDs with rules:', userIds);

  for (const userId of userIds) {
    console.log('\n--- Processing user:', userId, '---');
    
    const userRules = await Rule.find({ userId, active: true }).sort({ createdAt: -1 });
    console.log('User has', userRules.length, 'active rules');

    // Track what we've seen (normalized description -> rule object)
    const seenRules = new Map();
    const toDelete = [];

    for (const rule of userRules) {
      // Normalize the description for comparison
      // Remove trailing ": User requested ..." or similar
      let normalizedDesc = rule.rule.toLowerCase()
        .replace(/:\s*(user requested.*|blocked.*|created.*)$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Also create a type+target key for block rules
      let key = normalizedDesc;
      if (rule.type === 'block' && rule.conditions?.contactId) {
        key = `block-contact-${rule.conditions.contactId}`;
      }
      
      // Check for defaults - we want to keep only one of each type
      if (rule.rule.includes('(default)')) {
        const defaultKey = `default-${rule.type}-${rule.conditions?.mode || 'standard'}`;
        key = defaultKey;
      }

      if (seenRules.has(key)) {
        // This is a duplicate - mark for deletion
        console.log('  DUPLICATE:', rule.rule, '(will delete)');
        toDelete.push(rule._id);
      } else {
        // First time seeing this rule - keep it
        seenRules.set(key, rule);
        console.log('  KEEP:', rule.rule);
      }
    }

    if (toDelete.length > 0) {
      console.log('\nDeleting', toDelete.length, 'duplicate rules...');
      await Rule.deleteMany({ _id: { $in: toDelete } });
      console.log('Deleted successfully');
    }

    // Show remaining rules
    const remaining = await Rule.find({ userId, active: true }).sort({ createdAt: -1 });
    console.log('\nRemaining rules for user:', remaining.length);
    remaining.forEach((r, i) => console.log(`  ${i + 1}. [${r.type}] ${r.rule}`));
  }

  await mongoose.disconnect();
  console.log('\nDone!');
}

cleanupDuplicateRules().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
