// controllers/userController.js
const User = require("../models/User");
const shortid = require("shortid");
const fs = require("fs");
const qr = require("qr-image");
const path = require("path");
const { resizeImage, deleteFile } = require("../utils/uploadMiddleware");
// Create Profile
exports.createProfile = async (req, res) => {
  try {
    const { profileName, type, address, aboutUs, phoneNumber } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "user_not_found" });

    user.profileName = profileName;
    user.type = type;
    user.address = address;
    user.aboutUs = aboutUs;
    user.phoneNumber = phoneNumber;

    await user.save();
    res.status(200).json({ message: "Profile created successfully", user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Edit Username
exports.editUsername = async (req, res) => {
  try {
    const { newUsername } = req.body;
    const userId = req.user.id;

    // Check if the new username already exists
    const existingUser = await User.findOne({ username: newUsername });
    if (existingUser) {
      return res.status(400).json({ message: "Username is already taken" });
    }

    // Find the user by ID
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "user_not_found" });

    // Store the old username for removing the old QR code
    const oldUsername = user.username;

    // Update the username in the user model
    user.username = newUsername.toLowerCase();

    // Ensure the 'qrcodes' folder exists
    const qrCodeDir = path.join(__dirname, "..", "qrcodes");
    if (!fs.existsSync(qrCodeDir)) {
      fs.mkdirSync(qrCodeDir); // Create the folder if it doesn't exist
    }

    // Remove the old QR code images (if they exist)
    const oldPngFilePath = path.join(qrCodeDir, `${oldUsername}-qr.png`);
    const oldSvgFilePath = path.join(qrCodeDir, `${oldUsername}-qr.svg`);

    if (fs.existsSync(oldPngFilePath)) {
      fs.unlinkSync(oldPngFilePath); // Delete old PNG QR code
    }
    if (fs.existsSync(oldSvgFilePath)) {
      fs.unlinkSync(oldSvgFilePath); // Delete old SVG QR code
    }

    // Generate new QR codes with the updated username
    const userProfileUrl = `https://yourdomain.com/user-profile/${user.username}`;

    // Generate and save the PNG QR code
    const pngQRCode = qr.image(userProfileUrl, { type: "png" });
    const pngFilePath = path.join(qrCodeDir, `${user.username}-qr.png`);
    pngQRCode.pipe(fs.createWriteStream(pngFilePath));

    // Generate and save the SVG QR code
    const svgQRCode = qr.image(userProfileUrl, { type: "svg" });
    const svgFilePath = path.join(qrCodeDir, `${user.username}-qr.svg`);
    svgQRCode.pipe(fs.createWriteStream(svgFilePath));

    // Save the paths to the new QR code images in the user model
    user.qrCodePNG = `/qrcodes/${user.username}-qr.png`;
    user.qrCodeSVG = `/qrcodes/${user.username}-qr.svg`;

    // Save the user document with the updated username and new QR code paths
    await user.save();

    res
      .status(200)
      .json({ message: "Username and QR code updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Check if Username Exists
exports.checkUsername = async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username });
    res.status(200).json({ exists: !!user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// add images Information
exports.editProfileInfo = async (req, res) => {
  try {
    const { profileName, address, type, aboutUs, phoneNumber } = req.body;
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ message: "user_not_found" });

    // Update fields directly so an empty string is allowed
    user.profileName = profileName;
    user.aboutUs = aboutUs;
    user.phoneNumber = phoneNumber; // even if it's an empty string, it will update
    user.address = { ...user.address, ...address };
    user.type = type;

    // Save the updated user profile
    await user.save();

    res.status(200).json({ message: "Profile updated successfully", user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Upload profile image
exports.uploadProfileImage = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "user_not_found" });

    // Delete old profile image if exists
    if (user.profileImage) {
      deleteFile(path.join(__dirname, "..", user.profileImage));
    }

    const newPath = `/uploads/${new Date()
      .toLocaleString("en-us", { month: "2-digit", year: "numeric" })
      .replace("/", "-")}/images/${req.file.filename}`;

    await resizeImage(req.file.path, req.file.path); // Resize image unconditionally

    user.profileImage = newPath; // Save new path in database
    await user.save();

    res.status(200).json({
      message: "Profile image updated successfully",
      profileImage: newPath,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Upload cover image
exports.uploadCoverImage = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "user_not_found" });

    // Delete old cover image if exists
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

// Delete profile image
exports.deleteProfileImage = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "user_not_found" });

    if (user.profileImage) {
      const imagePath = path.join(__dirname, "..", user.profileImage);
      try {
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      } catch (error) {
        console.error("Error deleting profile image:", error);
        return res
          .status(500)
          .json({ error: "Failed to delete profile image" });
      }
      user.profileImage = null;
      await user.save();
    }

    res.status(200).json({ message: "Profile image deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete cover image
exports.deleteCoverImage = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "user_not_found" });

    if (user.coverImage) {
      const imagePath = path.join(__dirname, "..", user.coverImage);
      try {
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      } catch (error) {
        console.error("Error deleting cover image:", error);
        return res.status(500).json({ error: "Failed to delete cover image" });
      }
      user.coverImage = null;
      await user.save();
    }

    res.status(200).json({ message: "Cover image deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id; // Assuming user ID is available on `req.user`

    // Find the user by ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "user_not_found" });
    }

    // Optional: Delete profile and cover images from the file system
    if (user.profileImage) deleteFile(user.profileImage);
    if (user.coverImage) deleteFile(user.coverImage);

    // Optional: Delete catalogue files
    if (user.catelogue && user.catelogue.length > 0) {
      user.catelogue.forEach((item) => {
        if (item.file) deleteFile(item.file);
      });
    }

    // Delete the user from the database
    await User.findByIdAndDelete(userId);

    res.status(200).json({ message: "account_deleted_successfully" });
  } catch (error) {
    console.error("Error deleting account:", error);
    res.status(500).json({ error: "failed_to_delete_account" });
  }
};

// get routes
// Controller to get user data by ID
exports.getUserById = async (req, res) => {
  try {
    const userId = req.user.id; // User ID from the middleware

    // Find the user by ID in the database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "user_not_found" });
    }

    // Return user data
    res.status(200).json({ message: "User data retrieved successfully", user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Controller to get user by username from URL
exports.getUserByUsername = async (req, res) => {
  try {
    const { username } = req.params; // Extract username from the URL

    // Find the user by username
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: "user_not_found" });
    }

    // Remove sensitive fields (e.g., password) before sending the response
    const { password, ...safeUserData } = user.toObject();

    res.status(200).json({
      message: "User data retrieved successfully",
      user: safeUserData,
    });
  } catch (error) {
    console.error("Error retrieving user by username:", error.message);
    res.status(500).json({ error: "Failed to retrieve user data" });
  }
};

exports.removeAddress = async (req, res) => {
  try {
    const userId = req.user.id; // Get user ID from authenticated request

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "user_not_found" });

    // Make all address fields empty instead of deleting the address object
    user.address = {
      street: "",
      houseNo: "",
      city: "",
      country: "",
      postcode: "",
    };

    await user.save();
    res.status(200).json({ message: "Address removed successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
