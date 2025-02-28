const express = require("express");
const router = express.Router();
const formController = require("../controllers/formController");

// Submit form (Contact or Newsletter)
router.post("/submit", formController.submitForm);

// Get all form submissions (Filter by type)
router.get("/submissions", formController.getSubmissions);

module.exports = router;
