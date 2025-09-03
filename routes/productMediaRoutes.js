// Add under your existing routes:
const express = require("express");
const auth = require("../middleware/authMiddleware");
const productController = require("../controllers/productMediaController");
const { upload } = require("../utils/uploadMiddleware");
const router = express.Router();

// products
router.post(
  "/products",
  auth,
  upload.single("image"),
  productController.addProduct
);
router.put(
  "/products/:productId",
  auth,
  upload.single("image"),
  productController.updateProduct
);
router.delete("/products/:productId", auth, productController.deleteProduct);

// releases
router.post(
  "/releases",
  auth,
  upload.single("poster"),
  productController.addRelease
);
router.put(
  "/releases/:releaseId",
  auth,
  upload.single("poster"), // ⬅️ accept file field "poster"
  productController.updateRelease
);

router.delete("/releases/:releaseId", auth, productController.deleteRelease);

module.exports = router;
