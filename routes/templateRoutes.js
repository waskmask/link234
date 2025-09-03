const express = require("express");
const {
  updateTemplate,
  backfillTemplateDefaults,
} = require("../controllers/templateController");
const auth = require("../middleware/authMiddleware");
const router = express.Router();

router.put("/template", auth, updateTemplate);
router.post("/template/backfill-defaults", backfillTemplateDefaults);
module.exports = router;
