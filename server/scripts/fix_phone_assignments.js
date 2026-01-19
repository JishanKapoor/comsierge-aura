// One-time script to find and fix orphaned phone assignments
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";
import TwilioAccount from "../models/TwilioAccount.js";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function fixPhoneAssignments() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    // Get all phone numbers from Twilio accounts
    const accounts = await TwilioAccount.find().select("phoneNumbers");
    const allPhones = accounts.flatMap((a) => a.phoneNumbers || []);
    console.log("\n📞 All Twilio phones:", allPhones);

    // Get all users with phone numbers
    const usersWithPhones = await User.find({ phoneNumber: { $ne: null } }).select("_id name email phoneNumber");
    console.log("\n👥 Users with assigned phones:");
    for (const u of usersWithPhones) {
      console.log(`  - ${u.name || "No name"} (${u.email}): ${u.phoneNumber} [ID: ${u._id}]`);
    }

    const assignedPhones = usersWithPhones.map((u) => u.phoneNumber);
    console.log("\n🔒 Assigned phones:", assignedPhones);

    const availablePhones = allPhones.filter((p) => !assignedPhones.includes(p));
    console.log("\n✅ Available phones:", availablePhones);

    // Find the problematic phone
    const problematicPhone = "+16464660822";
    const userWithProblematicPhone = usersWithPhones.find(u => u.phoneNumber === problematicPhone);
    
    if (userWithProblematicPhone) {
      console.log(`\n⚠️ Found user with ${problematicPhone}:`, {
        id: userWithProblematicPhone._id,
        name: userWithProblematicPhone.name,
        email: userWithProblematicPhone.email,
      });
      
      // Fix it:
      console.log("🔧 Unassigning phone from user...");
      userWithProblematicPhone.phoneNumber = null;
      await userWithProblematicPhone.save();
      console.log("✅ Fixed!");
    } else {
      console.log(`\n✅ No user found with ${problematicPhone} assigned`);
      
      // Check if it's a format mismatch
      console.log("\n🔍 Checking for format mismatches...");
      for (const u of usersWithPhones) {
        const normalized = u.phoneNumber?.replace(/[^\d]/g, '');
        const targetNormalized = problematicPhone.replace(/[^\d]/g, '');
        if (normalized === targetNormalized) {
          console.log(`  Found format mismatch! User ${u._id} has ${u.phoneNumber} (normalized: ${normalized})`);
        }
      }
    }

    await mongoose.disconnect();
    console.log("\nDone!");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

fixPhoneAssignments();
