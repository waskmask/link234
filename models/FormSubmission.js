const mongoose = require("mongoose");

const formSubmissionSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  phoneNumber: { type: String },
  country: { type: String },
  message: { type: String },
  form_type: {
    type: String,
    enum: ["contact", "newsletter"],
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("FormSubmission", formSubmissionSchema);
