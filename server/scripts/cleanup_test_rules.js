import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

await mongoose.connect(process.env.MONGODB_URI);
const Rule = (await import("../models/Rule.js")).default;

// Delete toll-free test rules
const result = await Rule.deleteMany({ rule: { $regex: /toll-free/i } });
console.log("Deleted:", result.deletedCount, "test rules");

// Show remaining rules
const rules = await Rule.find({ type: "transfer" });
console.log("\nRemaining transfer rules:", rules.length);
for (const r of rules) {
  console.log(" -", r.rule, "| active:", r.active);
}

await mongoose.disconnect();
