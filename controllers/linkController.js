const User = require("../models/User");

exports.updateSocialLinks = async (req, res) => {
  try {
    const { socialLinks } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!socialLinks || typeof socialLinks !== "object") {
      return res.status(400).json({
        message: "Social links must be provided in an object format.",
      });
    }

    // Find user by ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if socialLinks exists in the user document; if not, initialize it
    if (!user.socialLinks || Object.keys(user.socialLinks).length === 0) {
      user.socialLinks = socialLinks;
    } else {
      // Merge with existing social links if they already exist
      user.socialLinks = { ...user.socialLinks, ...socialLinks };
    }

    await user.save();
    res
      .status(200)
      .json({ message: "Social links updated successfully", user });
  } catch (error) {
    console.error("Error updating social links:", error);
    res.status(500).json({ error: "Failed to update social links" });
  }
};

// Update Additional Links
exports.addOrUpdateAdditionalLinks = async (req, res) => {
  const userId = req.user.id;
  const { additionalLinks } = req.body;

  try {
    // Ensure additionalLinks array exists
    if (!additionalLinks || !Array.isArray(additionalLinks)) {
      return res
        .status(400)
        .json({ message: "No additional links provided or invalid format" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update existing links or add new ones
    additionalLinks.forEach((updatedLink) => {
      const existingLinkIndex = user.additionalLinks.findIndex(
        (link) => link._id.toString() === updatedLink._id
      );

      if (existingLinkIndex !== -1) {
        // Update the existing link
        user.additionalLinks[existingLinkIndex].title = updatedLink.title;
        user.additionalLinks[existingLinkIndex].link = updatedLink.link;
      } else {
        // Add new link (if `_id` is not present)
        user.additionalLinks.push(updatedLink);
      }
    });

    // Save the updated user document
    await user.save();

    res.status(200).json({
      message: "Additional links updated successfully",
      additionalLinks: user.additionalLinks,
    });
  } catch (error) {
    console.error("Error updating additional links:", error);
    res.status(500).json({ message: "Failed to update additional links" });
  }
};

exports.deleteSocialLinks = async (req, res) => {
  try {
    const { socialLinks } = req.body; // Expecting an array of social link keys to "clear", e.g., ["facebook", "instagram"]
    const userId = req.user.id;

    // Validate input
    if (!Array.isArray(socialLinks) || socialLinks.length === 0) {
      return res
        .status(400)
        .json({ message: "Please provide social link keys to clear." });
    }

    // Find user by ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update the specified social links to empty strings
    socialLinks.forEach((link) => {
      if (user.socialLinks[link] !== undefined) {
        user.socialLinks[link] = ""; // Set value to empty string
        console.log(`Cleared social link value for: ${link}`);
      } else {
        console.log(`Social link ${link} not found`);
      }
    });

    // Mark socialLinks as modified to ensure Mongoose saves the changes
    user.markModified("socialLinks");

    // Save the user to apply the changes in the database
    await user.save();

    // Verify by logging the updated socialLinks object
    console.log("Updated socialLinks:", user.socialLinks);

    res.status(200).json({
      message: "Social links cleared successfully",
      socialLinks: user.socialLinks,
    });
  } catch (error) {
    console.error("Error clearing social links:", error);
    res.status(500).json({ error: "Failed to clear social links" });
  }
};

exports.deleteAdditionalLinks = async (req, res) => {
  try {
    const { ids } = req.body; // Expecting an array of IDs to delete, e.g., ["id1", "id2"]
    const userId = req.user.id;

    // Validate input
    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ message: "Please provide additional link IDs to delete." });
    }

    // Find user by ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Filter out additional links with matching IDs
    user.additionalLinks = user.additionalLinks.filter(
      (link) => !ids.includes(link._id.toString())
    );

    await user.save();

    res
      .status(200)
      .json({
        message: "Additional links deleted successfully",
        additionalLinks: user.additionalLinks,
      });
  } catch (error) {
    console.error("Error deleting additional links:", error);
    res.status(500).json({ error: "Failed to delete additional links" });
  }
};
