import express from "express";
import Media from "../models/Media.js";

const router = express.Router();

// @route   GET /api/media/:id
// @desc    Serve media file by ID (for Twilio MMS)
// @access  Public (Twilio needs to access it)
router.get("/:id", async (req, res) => {
  try {
    const media = await Media.findById(req.params.id);
    
    if (!media) {
      return res.status(404).json({ error: "Media not found or expired" });
    }

    // Extract base64 data (remove data:image/xxx;base64, prefix if present)
    let base64Data = media.data;
    if (base64Data.includes(",")) {
      base64Data = base64Data.split(",")[1];
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, "base64");

    // Set appropriate headers
    res.set({
      "Content-Type": media.mimeType,
      "Content-Length": buffer.length,
      "Cache-Control": "public, max-age=3600", // Cache for 1 hour
    });

    res.send(buffer);
  } catch (error) {
    console.error("Error serving media:", error);
    res.status(500).json({ error: "Failed to serve media" });
  }
});

export default router;
