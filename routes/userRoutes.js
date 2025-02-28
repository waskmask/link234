// routes/userRoutes.js
const express = require("express");
const userController = require("../controllers/userController");
const linksController = require("../controllers/linkController");
const catelogueController = require("../controllers/catelogueController");
const authMiddleware = require("../middleware/authMiddleware");
const { uploadProfileImage } = require("../controllers/userController");
const { uploadCoverImage } = require("../controllers/coverController");
const { upload } = require("../utils/uploadMiddleware");
const uploads = require("../utils/catalogueUploadMiddleware");
const router = express.Router();

// Protected routes for managing profile
router.post("/create-profile", authMiddleware, userController.createProfile);
router.put("/edit-username", authMiddleware, userController.editUsername);
router.get("/check-username/:username", userController.checkUsername);

router.put("/edit-profile", authMiddleware, userController.editProfileInfo);

// Route for uploading profile image (single file)
router.post(
  "/upload/profile-image",
  authMiddleware,
  upload.single("profileImage"), // Using the upload middleware for a single file
  uploadProfileImage
);

// Route for uploading cover image (single file)
router.post(
  "/upload/cover-image",
  authMiddleware,
  upload.single("coverImage"), // Using the upload middleware for a single file
  uploadCoverImage
);
// Route for deleting profile image
router.delete(
  "/delete/profile-image",
  authMiddleware,
  userController.deleteProfileImage
);

// Route for deleting cover image
router.delete(
  "/delete/cover-image",
  authMiddleware,
  userController.deleteCoverImage
);

router.put(
  "/update-social-links",
  authMiddleware,
  linksController.updateSocialLinks
);

router.put(
  "/update-additional-links",
  authMiddleware,
  linksController.addOrUpdateAdditionalLinks
);

// Delete specific social links
router.delete(
  "/delete-social-links",
  authMiddleware,
  linksController.deleteSocialLinks
);

// Delete specific additional links
router.delete(
  "/delete-additional-links",
  authMiddleware,
  linksController.deleteAdditionalLinks
);

router.post(
  "/catelogue",
  authMiddleware,
  uploads.single("file"),
  catelogueController.addCatalogueItem
);
router.put(
  "/catelogue/:itemId",
  authMiddleware,
  uploads.single("file"),
  catelogueController.updateCatalogueItem
);
router.delete(
  "/catelogue/:itemId",
  authMiddleware,
  catelogueController.removeCatalogueItem
);

// Delete account route
router.delete("/delete-account", authMiddleware, userController.deleteAccount);

// Use the verifyToken middleware to protect the route
router.get("/get-user", authMiddleware, userController.getUserById);

// Route to get user by username
router.get("/get-user/:username", userController.getUserByUsername);

//remove address from user
router.delete("/delete-address", authMiddleware, userController.removeAddress);

module.exports = router;
