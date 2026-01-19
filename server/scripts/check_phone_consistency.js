// Comprehensive check of phone assignments and consistency
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";
import TwilioAccount from "../models/TwilioAccount.js";

dotenv.config();

async function checkConsistency() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB\n");

    // 1. Get all Twilio phone numbers
    const accounts = await TwilioAccount.find().select("accountSid phoneNumbers");
    const allPhones = accounts.flatMap((a) => a.phoneNumbers || []);
    console.log("═══════════════════════════════════════════════");
    console.log("📞 ALL TWILIO PHONE NUMBERS");
    console.log("═══════════════════════════════════════════════");
    for (const acc of accounts) {
      console.log(`  Account: ${acc.accountSid}`);
      for (const phone of acc.phoneNumbers || []) {
        console.log(`    - ${phone}`);
      }
    }
    console.log(`  Total: ${allPhones.length} phones\n`);

    // 2. Get ALL users (including admins)
    const allUsers = await User.find().select("_id name email role phoneNumber");
    console.log("═══════════════════════════════════════════════");
    console.log("👥 ALL USERS");
    console.log("═══════════════════════════════════════════════");
    for (const u of allUsers) {
      const phoneStatus = u.phoneNumber ? `📱 ${u.phoneNumber}` : "❌ No phone";
      console.log(`  ${u.name || "No name"} (${u.email})`);
      console.log(`    Role: ${u.role || "user"}`);
      console.log(`    Phone: ${phoneStatus}`);
      console.log(`    ID: ${u._id}`);
      console.log("");
    }

    // 3. Check for admins with phones (SHOULD BE NONE)
    const adminsWithPhones = allUsers.filter(u => u.role === "admin" && u.phoneNumber);
    console.log("═══════════════════════════════════════════════");
    console.log("⚠️  CONSISTENCY CHECK: ADMINS WITH PHONES");
    console.log("═══════════════════════════════════════════════");
    if (adminsWithPhones.length === 0) {
      console.log("  ✅ No admins have phone numbers (correct!)\n");
    } else {
      console.log("  ❌ PROBLEM: The following admins have phones:");
      for (const admin of adminsWithPhones) {
        console.log(`    - ${admin.name} (${admin.email}): ${admin.phoneNumber}`);
      }
      console.log("");
    }

    // 4. Check assigned vs available
    const usersWithPhones = allUsers.filter(u => u.phoneNumber && u.role !== "admin");
    const assignedPhones = usersWithPhones.map(u => u.phoneNumber);
    const availablePhones = allPhones.filter(p => !assignedPhones.includes(p));

    console.log("═══════════════════════════════════════════════");
    console.log("📊 PHONE ASSIGNMENT SUMMARY");
    console.log("═══════════════════════════════════════════════");
    console.log(`  Total Twilio phones: ${allPhones.length}`);
    console.log(`  Assigned to users: ${assignedPhones.length}`);
    console.log(`  Available: ${availablePhones.length}`);
    console.log("");

    if (assignedPhones.length > 0) {
      console.log("  🔒 ASSIGNED PHONES:");
      for (const u of usersWithPhones) {
        console.log(`    ${u.phoneNumber} → ${u.name} (${u.email})`);
      }
    }
    console.log("");

    if (availablePhones.length > 0) {
      console.log("  ✅ AVAILABLE PHONES:");
      for (const phone of availablePhones) {
        console.log(`    ${phone}`);
      }
    }
    console.log("");

    // 5. Check for orphaned assignments (phones assigned that don't exist in Twilio)
    const orphanedAssignments = usersWithPhones.filter(u => !allPhones.includes(u.phoneNumber));
    console.log("═══════════════════════════════════════════════");
    console.log("🔍 ORPHANED ASSIGNMENTS CHECK");
    console.log("═══════════════════════════════════════════════");
    if (orphanedAssignments.length === 0) {
      console.log("  ✅ No orphaned assignments (all assigned phones exist in Twilio)\n");
    } else {
      console.log("  ❌ PROBLEM: Users with phones not in Twilio:");
      for (const u of orphanedAssignments) {
        console.log(`    - ${u.name}: ${u.phoneNumber} (doesn't exist in Twilio!)`);
      }
      console.log("");
    }

    await mongoose.disconnect();
    console.log("═══════════════════════════════════════════════");
    console.log("Done!");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkConsistency();
