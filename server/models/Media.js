import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema({
  // Base64 encoded image data
  data: {
    type: String,
    required: true,
  },
  // MIME type (image/jpeg, image/png, etc.)
  mimeType: {
    type: String,
    required: true,
  },
  // Original filename
  filename: {
    type: String,
  },
  // User who uploaded
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  // Auto-delete after 1 hour (for MMS temp storage)
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    index: { expires: 0 }, // TTL index - MongoDB auto-deletes expired docs
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("Media", mediaSchema);
