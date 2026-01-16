import mongoose from "mongoose";
import dotenv from "dotenv";
import twilio from "twilio";
dotenv.config();

const COMSIERGE_NUMBER = "+16464660822";
const JAKE_NUMBER = "+14372392448";
const TOLL_FREE = "+18886011616";

async function main() {
  console.log("=== Transfer Rules Live Test ===\n");
  
  // Connect to MongoDB
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");
  
  // Import models
  const Rule = (await import("../models/Rule.js")).default;
  const User = (await import("../models/User.js")).default;
  const CallRecord = (await import("../models/CallRecord.js")).default;
  const TwilioAccount = (await import("../models/TwilioAccount.js")).default;
  
  // Find user
  const user = await User.findOne({ email: "kapoorjishan2@gmail.com" });
  if (!user) {
    console.log("❌ User not found");
    process.exit(1);
  }
  console.log(`✅ Found user: ${user.email} (id: ${user._id})`);
  console.log(`   Phone: ${user.phoneNumber}`);
  console.log(`   Forwarding: ${user.forwardingNumber || "NOT SET"}\n`);
  
  // Get Twilio credentials - use env vars as fallback
  let twilioSid = process.env.TWILIO_ACCOUNT_SID;
  let twilioToken = process.env.TWILIO_AUTH_TOKEN;
  let twilioPhone = process.env.TWILIO_PHONE_NUMBER || user.phoneNumber;
  
  const twilioAccount = await TwilioAccount.findOne({ userId: user._id });
  if (twilioAccount) {
    console.log(`✅ Found Twilio account in DB: ${twilioAccount.phoneNumber}`);
    twilioSid = twilioAccount.accountSid;
    twilioToken = twilioAccount.authToken;
    twilioPhone = twilioAccount.phoneNumber;
  } else {
    console.log(`ℹ️ Using Twilio from env vars`);
  }
  
  console.log(`   SID: ${twilioSid?.substring(0, 10)}...`);
  console.log(`   Phone: ${twilioPhone}`);
  
  const client = twilio(twilioSid, twilioToken);
  
  // Get all rules
  console.log("\n=== Current Rules ===");
  const rules = await Rule.find({ userId: user._id });
  console.log(`Found ${rules.length} rules:\n`);
  
  for (const r of rules) {
    console.log(`📋 Rule: "${r.rule}"`);
    console.log(`   Type: ${r.type}`);
    console.log(`   Active: ${r.active}`);
    if (r.type === "transfer") {
      console.log(`   Transfer Mode: ${r.transferDetails?.mode || "not set"}`);
      console.log(`   Transfer To: ${r.transferDetails?.contactPhone || "not set"}`);
      console.log(`   Source: ${r.conditions?.sourceContactPhone || "all"}`);
    }
    console.log("");
  }
  
  // Get recent call records
  console.log("\n=== Recent Call Records (last 5) ===");
  const recentCalls = await CallRecord.find({ userId: user._id })
    .sort({ createdAt: -1 })
    .limit(5);
  
  for (const call of recentCalls) {
    console.log(`📞 ${call.direction} from ${call.contactPhone} - Status: ${call.status}`);
    console.log(`   At: ${call.createdAt}`);
    if (call.forwardedTo) console.log(`   Forwarded to: ${call.forwardedTo}`);
    if (call.matchedRule) console.log(`   Matched rule: ${call.matchedRule}`);
    console.log("");
  }
  
  // Test: Make an outbound call simulation
  console.log("\n=== Test Scenarios ===");
  console.log("1. Current active transfer rules for CALLS:");
  const callTransferRules = rules.filter(r => 
    r.type === "transfer" && 
    r.active && 
    (r.transferDetails?.mode === "calls" || r.transferDetails?.mode === "both")
  );
  console.log(`   Found ${callTransferRules.length} active call transfer rules`);
  for (const r of callTransferRules) {
    console.log(`   - "${r.rule}" -> ${r.transferDetails?.contactPhone}`);
  }
  
  console.log("\n2. Current active transfer rules for MESSAGES:");
  const msgTransferRules = rules.filter(r => 
    r.type === "transfer" && 
    r.active && 
    (r.transferDetails?.mode === "messages" || r.transferDetails?.mode === "both")
  );
  console.log(`   Found ${msgTransferRules.length} active message transfer rules`);
  for (const r of msgTransferRules) {
    console.log(`   - "${r.rule}" -> ${r.transferDetails?.contactPhone}`);
  }
  
  // Prompt for action
  const action = process.argv[2];
  
  if (action === "call") {
    const from = process.argv[3] || JAKE_NUMBER;
    const to = process.argv[4] || COMSIERGE_NUMBER;
    
    console.log(`\n🔔 Initiating test call: ${from} -> ${to}`);
    console.log("   This will ring the Comsierge number and test transfer rules...\n");
    
    try {
      const call = await client.calls.create({
        url: "http://demo.twilio.com/docs/voice.xml", // Simple TwiML that says hello
        to: to,
        from: twilioPhone,
      });
      console.log(`✅ Call initiated! SID: ${call.sid}`);
      console.log("   Check the logs to see what happened!");
    } catch (err) {
      console.error("❌ Call failed:", err.message);
    }
  } else if (action === "toggle") {
    const ruleId = process.argv[3];
    if (!ruleId) {
      console.log("\nUsage: node test_transfer_rules.js toggle <rule_id>");
      console.log("Rule IDs:");
      for (const r of rules) {
        console.log(`  ${r._id} - "${r.rule}" (${r.active ? "active" : "inactive"})`);
      }
    } else {
      const rule = await Rule.findById(ruleId);
      if (rule) {
        rule.active = !rule.active;
        await rule.save();
        console.log(`✅ Rule "${rule.rule}" is now ${rule.active ? "ACTIVE" : "INACTIVE"}`);
      } else {
        console.log("❌ Rule not found");
      }
    }
  } else if (action === "create-call-rule") {
    // Create a transfer rule for calls from Jake to toll-free
    const newRule = await Rule.create({
      userId: user._id,
      rule: `Transfer all calls from Jake to toll-free`,
      type: "transfer",
      active: true,
      conditions: {
        sourceContactPhone: JAKE_NUMBER,
        mode: "all",
      },
      transferDetails: {
        mode: "calls", // CALLS ONLY
        priority: "all",
        contactName: "Toll-Free",
        contactPhone: TOLL_FREE,
      },
    });
    console.log(`✅ Created call transfer rule: ${newRule._id}`);
  } else {
    console.log("\n=== Available Actions ===");
    console.log("  node test_transfer_rules.js call [from] [to]  - Make a test call");
    console.log("  node test_transfer_rules.js toggle <rule_id>  - Toggle a rule on/off");
    console.log("  node test_transfer_rules.js create-call-rule  - Create test call transfer rule");
  }
  
  await mongoose.disconnect();
  console.log("\n✅ Done");
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
