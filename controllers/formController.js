const FormSubmission = require("../models/FormSubmission");

// Handle form submission (Contact & Newsletter)
exports.submitForm = async (req, res) => {
  try {
    const { fullName, email, phoneNumber, country, message, form_type } =
      req.body;

    // Validate form_type
    if (!["contact", "newsletter"].includes(form_type)) {
      return res.status(400).json({
        success: false,
        error: "invalid_form_type",
        message:
          "Invalid form type. Accepted values are 'contact' or 'newsletter'.",
      });
    }

    // Validate required fields
    if (!fullName || !email) {
      return res.status(400).json({
        success: false,
        error: "missing_fields",
        message: "Full name and email are required.",
      });
    }

    if (form_type === "contact" && (!phoneNumber || !country || !message)) {
      return res.status(400).json({
        success: false,
        error: "missing_fields",
        message:
          "Phone number, country, and message are required for contact forms.",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: "invalid_email",
        message: "Invalid email format. Please enter a valid email address.",
      });
    }

    // Create new form submission entry
    const newSubmission = new FormSubmission({
      fullName,
      email,
      phoneNumber: form_type === "contact" ? phoneNumber : undefined, // Only for contact
      country: form_type === "contact" ? country : undefined, // Only for contact
      message: form_type === "contact" ? message : undefined, // Only for contact
      form_type,
    });

    await newSubmission.save();

    res.status(201).json({
      success: true,
      message: "Form submitted successfully.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "server_error",
      message: "Error submitting form. Please try again later.",
      details: error.message, // Helpful for debugging
    });
  }
};

// Get all submissions (Admin Use)
exports.getSubmissions = async (req, res) => {
  try {
    const { form_type } = req.query;
    const filter = form_type ? { form_type } : {};

    const submissions = await FormSubmission.find(filter).sort({
      createdAt: -1,
    });
    res.status(200).json(submissions);
  } catch (error) {
    res.status(500).json({ error: "Error fetching form submissions." });
  }
};
