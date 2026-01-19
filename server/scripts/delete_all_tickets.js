import mongoose from "mongoose";
import dotenv from "dotenv";
import SupportTicket from "../models/SupportTicket.js";

dotenv.config();

async function deleteAllTickets() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const result = await SupportTicket.deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} support tickets`);

    await mongoose.disconnect();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

deleteAllTickets();
