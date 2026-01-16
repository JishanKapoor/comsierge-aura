import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const COMSIERGE_NUMBER = "+16464660822";
const JAKE_NUMBER = "+14372392448";
const JEREMY_NUMBER = "+13828804321";
const TOLL_FREE = "+18886011616";

async function main() {
  console.log("=== Transfer Rules Webhook Simulation Test ===\n");
  
  // Connect to MongoDB
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");
  
  // Import models
  const Rule = (await import("../models/Rule.js")).default;
  const User = (await import("../models/User.js")).default;
  const Contact = (await import("../models/Contact.js")).default;
  
  // Find user
  const user = await User.findOne({ email: "kapoorjishan2@gmail.com" });
  console.log(`User: ${user.email} (${user._id})`);
  console.log(`Phone: ${user.phoneNumber}`);
  console.log(`Forwarding: ${user.forwardingNumber}\n`);
  
  // Get all transfer rules
  const transferRules = await Rule.find({ 
    userId: user._id, 
    type: "transfer",
    active: true 
  });
  
  console.log(`Found ${transferRules.length} active transfer rules:\n`);
  
  // Test scenarios
  const scenarios = [
    { caller: JAKE_NUMBER, callerName: "Jake", eventType: "call" },
    { caller: JEREMY_NUMBER, callerName: "Jeremy", eventType: "call" },
    { caller: JAKE_NUMBER, callerName: "Jake", eventType: "message" },
    { caller: JEREMY_NUMBER, callerName: "Jeremy", eventType: "message" },
    { caller: "+15551234567", callerName: "Unknown", eventType: "call" },
  ];
  
  for (const scenario of scenarios) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📞 SCENARIO: ${scenario.eventType.toUpperCase()} from ${scenario.callerName} (${scenario.caller})`);
    console.log("=".repeat(60));
    
    // Get caller contact info
    const callerDigits = scenario.caller.replace(/\D/g, "").slice(-10);
    const contact = await Contact.findOne({ 
      userId: user._id, 
      $or: [
        { phone: scenario.caller },
        { phone: { $regex: callerDigits } }
      ]
    });
    
    console.log(`\n   Contact found: ${contact ? contact.name : "NO"}`);
    if (contact) {
      console.log(`   - isFavorite: ${contact.isFavorite}`);
      console.log(`   - isBlocked: ${contact.isBlocked}`);
      console.log(`   - tags: ${contact.tags?.join(", ") || "none"}`);
    }
    
    // Check each transfer rule
    let matched = false;
    for (const rule of transferRules) {
      console.log(`\n   🔍 Checking rule: "${rule.rule}"`);
      
      const conditions = rule.conditions || {};
      const transferDetails = rule.transferDetails || {};
      const sourceContactPhone = conditions.sourceContactPhone;
      const transferTargetPhone = transferDetails.contactPhone;
      const transferMode = transferDetails.mode || "both";
      
      console.log(`      - transferMode: ${transferMode}`);
      console.log(`      - sourceContactPhone: ${sourceContactPhone || "ANY"}`);
      console.log(`      - transferTargetPhone: ${transferTargetPhone}`);
      
      // Check if rule applies to this event type
      if (scenario.eventType === "call") {
        if (transferMode !== "calls" && transferMode !== "both") {
          console.log(`      ⏭️ SKIP: Rule is for ${transferMode} only, not calls`);
          continue;
        }
      } else if (scenario.eventType === "message") {
        if (transferMode !== "messages" && transferMode !== "both") {
          console.log(`      ⏭️ SKIP: Rule is for ${transferMode} only, not messages`);
          continue;
        }
      }
      
      // Check if rule is scoped to a specific contact
      if (sourceContactPhone) {
        const srcDigits = sourceContactPhone.replace(/\D/g, "").slice(-10);
        console.log(`      - Comparing: caller=${callerDigits} vs source=${srcDigits}`);
        
        if (callerDigits !== srcDigits) {
          console.log(`      ⏭️ SKIP: Rule is scoped to ${sourceContactPhone}, caller doesn't match`);
          continue;
        }
        console.log(`      ✓ Source contact phone matched!`);
      }
      
      // Check conditions mode
      const mode = conditions.mode || "all";
      console.log(`      - conditions.mode: ${mode}`);
      
      let matches = false;
      switch (mode) {
        case "all":
          matches = true;
          console.log(`      ✓ Mode 'all' - matches everyone`);
          break;
        case "favorites":
          matches = contact?.isFavorite || false;
          console.log(`      ${matches ? '✓' : '✗'} Mode 'favorites' - isFavorite: ${contact?.isFavorite}`);
          break;
        case "saved":
          matches = !!contact;
          console.log(`      ${matches ? '✓' : '✗'} Mode 'saved' - isSavedContact: ${!!contact}`);
          break;
        default:
          matches = false;
          console.log(`      ✗ Unknown mode: ${mode}`);
      }
      
      if (matches && transferTargetPhone) {
        console.log(`\n   ✅ MATCH! Would transfer ${scenario.eventType} to: ${transferTargetPhone}`);
        matched = true;
        break;
      }
    }
    
    if (!matched) {
      console.log(`\n   ❌ NO MATCH - ${scenario.eventType} would NOT be transferred`);
      console.log(`   → Would follow normal routing (forward rule or direct to user)`);
    }
  }
  
  await mongoose.disconnect();
  console.log("\n\n✅ Simulation complete");
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
