import mongoose from "mongoose";

const twilioAccountSchema = new mongoose.Schema(
  {
    accountSid: {
      type: String,
      required: [true, "Account SID is required"],
      unique: true,
      trim: true,
    },
    authToken: {
      type: String,
      required: [true, "Auth Token is required"],
    },
    phoneNumbers: [{
      type: String,
      trim: true,
    }],
    friendlyName: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Track which users are assigned to which phone numbers
    phoneAssignments: [{
      phoneNumber: String,
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      assignedAt: {
        type: Date,
        default: Date.now,
      },
    }],
  },
  {
    timestamps: true,
  }
);

const TwilioAccount = mongoose.model("TwilioAccount", twilioAccountSchema);

export default TwilioAccount;
