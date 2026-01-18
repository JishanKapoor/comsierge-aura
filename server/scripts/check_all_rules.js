import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import Rule from '../models/Rule.js';

async function checkRules() {
  await mongoose.connect(process.env.MONGODB_URI);
  const userId = '695c7572bbcdab628443e087';

  const rules = await Rule.find({ userId }).sort({ createdAt: -1 });
  console.log('Total rules:', rules.length);
  console.log('Active rules:', rules.filter(r => r.active).length);
  console.log('');
  
  for (let i = 0; i < rules.length; i++) {
    const r = rules[i];
    console.log((i+1) + '. [' + r.type + '] ' + (r.active ? 'ACTIVE' : 'INACTIVE'));
    console.log('   Rule:', (r.rule || '').substring(0, 80));
    console.log('   Created:', r.createdAt);
    if (r.targetContact) console.log('   Target:', r.targetContact);
    if (r.schedule) console.log('   Schedule:', JSON.stringify(r.schedule));
    console.log('');
  }

  await mongoose.disconnect();
}

checkRules().catch(console.error);
