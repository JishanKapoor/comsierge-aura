import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  
  // Get all conversations
  const convs = await db.collection('conversations').find({}).toArray();
  
  for (const c of convs) {
    // Reset contactName to phone number
    await db.collection('conversations').updateOne(
      { _id: c._id }, 
      { $set: { contactName: c.contactPhone } }
    );
    console.log('Reset', c.contactName, '->', c.contactPhone);
  }
  
  console.log('Done! All conversation names reset to phone numbers.');
  process.exit(0);
});
