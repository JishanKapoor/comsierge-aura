import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const coll = mongoose.connection.collection('twilioaccounts');
  const docs = await coll.find({}).toArray();
  console.log("TwilioAccounts in DB:");
  console.log(JSON.stringify(docs, null, 2));
  process.exit(0);
}).catch(e => { 
  console.error(e); 
  process.exit(1); 
});
