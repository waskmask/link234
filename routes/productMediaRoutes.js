// Add under your existing routes:
const express = require("express");
const auth = require("../middleware/authMiddleware");
const productController = require("../controllers/productMediaController");

const router = express.Router();

// products
router.post("/products", auth, productController.addProduct);
// router.put("/products/:productId", auth, productController.updateProduct);
router.delete("/products/:productId", auth, productController.deleteProduct);

// releases
router.post("/releases", auth, productController.addRelease);
// router.put("/releases/:releaseId", auth, productController.updateRelease);
router.delete("/releases/:releaseId", auth, productController.deleteRelease);

module.exports = router;
