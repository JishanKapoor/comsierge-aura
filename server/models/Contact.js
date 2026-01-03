import mongoose from "mongoose";

const contactSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Contact name is required"],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
    email: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
    },
    avatar: {
      type: String,
      default: null,
    },
    company: {
      type: String,
      default: null,
    },
    notes: {
      type: String,
      default: null,
    },
    tags: [{
      type: String,
      trim: true,
    }],
    isFavorite: {
      type: Boolean,
      default: false,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for user + phone uniqueness
contactSchema.index({ userId: 1, phone: 1 }, { unique: true });

const Contact = mongoose.model("Contact", contactSchema);

export default Contact;
