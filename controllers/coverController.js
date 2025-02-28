const User = require("../models/User");
const fs = require("fs");
const qr = require("qr-image");
const path = require("path");
const { resizeImage, deleteFile } = require("../utils/uploadMiddleware");

exports.uploadCoverImage = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Delete old profile image if exists
    if (user.coverImage) {
      deleteFile(path.join(__dirname, "..", user.coverImage));
    }

    const newPath = `/uploads/${new Date()
      .toLocaleString("en-us", { month: "2-digit", year: "numeric" })
      .replace("/", "-")}/images/${req.file.filename}`;

    await resizeImage(req.file.path, req.file.path); // Resize image unconditionally

    user.coverImage = newPath; // Save new path in database
    await user.save();

    res.status(200).json({
      message: "Cover image updated successfully",
      coverImage: newPath,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
