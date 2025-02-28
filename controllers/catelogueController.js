const User = require("../models/User");
const fs = require("fs");
const path = require("path");
const { deleteFile } = require("../utils/fileUtils");
exports.addCatalogueItem = async (req, res) => {
  try {
    const { title, description } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }

    // File path
    const filePath = req.file
      ? path.join(
          "catalogues",
          `${new Date().getMonth() + 1}-${new Date().getFullYear()}`,
          req.file.filename
        )
      : null;

    // Find user by ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Add new item to catalogue
    const newItem = { title, description, file: filePath };
    user.catelogue.push(newItem);

    await user.save();
    res
      .status(201)
      .json({ message: "Catalogue item added successfully", newItem });
  } catch (error) {
    console.error("Error adding catalogue item:", error);
    res.status(500).json({ error: "Failed to add catalogue item" });
  }
};

exports.updateCatalogueItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { title, description } = req.body;
    const userId = req.user.id;

    // File path (if a new file is uploaded)
    const newFilePath = req.file
      ? path.join(
          "catalogues",
          `${new Date().getMonth() + 1}-${new Date().getFullYear()}`,
          req.file.filename
        )
      : null;

    // Find user by ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find and update the specific catalogue item
    const item = user.catelogue.id(itemId);
    if (!item) {
      return res.status(404).json({ message: "Catalogue item not found" });
    }

    // Delete the old file if a new file is uploaded
    if (newFilePath && item.file) {
      deleteFile(path.join(__dirname, "..", item.file));
    }

    // Update the item's properties
    if (title) item.title = title;
    if (description) item.description = description;
    if (newFilePath) item.file = newFilePath;

    await user.save();
    res
      .status(200)
      .json({ message: "Catalogue item updated successfully", item });
  } catch (error) {
    console.error("Error updating catalogue item:", error);
    res.status(500).json({ error: "Failed to update catalogue item" });
  }
};

exports.removeCatalogueItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user.id;

    // Find user by ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find the item to be deleted
    const item = user.catelogue.id(itemId);
    if (!item) {
      return res.status(404).json({ message: "Catalogue item not found" });
    }

    // Delete the associated file
    if (item.file) {
      const filePath = path.join(__dirname, "..", item.file);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath); // Synchronous removal
          console.log(`File deleted: ${filePath}`);
        }
      } catch (err) {
        console.error(`Failed to delete file: ${filePath}`, err);
      }
    }

    // Remove the item from the catalogue array
    await User.findByIdAndUpdate(userId, {
      $pull: { catelogue: { _id: itemId } },
    });
    console.log("Catalogue item deleted:", itemId);
    res.status(200).json({ message: "Catalogue item removed successfully" });
  } catch (error) {
    console.error("Error removing catalogue item:", error);
    res.status(500).json({ error: "Failed to remove catalogue item" });
  }
};
